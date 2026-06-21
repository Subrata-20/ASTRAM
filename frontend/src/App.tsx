/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { ActiveTab, Incident } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { DashboardView } from './components/DashboardView';
import { ReportView } from './components/ReportView';
import { ResultsView } from './components/ResultsView';
import { AnalyticsView } from './components/AnalyticsView';
import { API_BASE_URL, WS_BASE_URL } from './config';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState<boolean>(true);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [searchValue, setSearchValue] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const handleAddIncident = (newIncident: Incident) => {
    // If we handle websocket properly, we don't necessarily need to add it here, 
    // but we can do it optimistically and deduplicate. Let's just rely on the WebSocket or optimistic add.
    setIncidents((prev) => {
      // Deduplicate by ID
      if (prev.find(i => i.id === newIncident.id)) return prev;
      return [...prev, newIncident];
    });
  };

  // Helper to map backend schema to frontend Incident interface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapBackendEventToIncident = (data: any): Incident => {
    // Basic priority mapping if not standard
    let priority: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'MODERATE';
    if (typeof data.priority === 'string' && ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].includes(data.priority.toUpperCase())) {
      priority = data.priority.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
    } else if (data.priority === 'Severe' || data.priority === 3) {
      priority = 'CRITICAL';
    } else if (data.priority === 2) {
      priority = 'HIGH';
    } else if (data.priority === 'Minor' || data.priority === 1) {
      priority = 'LOW';
    }

    // Attempt to parse out a type/cause
    let mappedType = 'Unknown';
    if (data.event_cause) {
      if (data.event_cause.toLowerCase().includes('accident') || data.event_cause.toLowerCase().includes('collision')) mappedType = 'Collision';
      else if (data.event_cause.toLowerCase().includes('breakdown')) mappedType = 'Breakdown';
      else if (data.event_cause.toLowerCase().includes('water') || data.event_cause.toLowerCase().includes('tree')) mappedType = 'Weather Hazard';
      else if (data.event_cause.toLowerCase().includes('pothole') || data.event_cause.toLowerCase().includes('signal')) mappedType = 'Infrastructure Failure';
      else mappedType = data.event_cause;
    }

    const startDt = data.start_datetime ? new Date(data.start_datetime) : new Date();
    const timeStr = `${startDt.getHours().toString().padStart(2, '0')}:${startDt.getMinutes().toString().padStart(2, '0')}`;

    return {
      id: data.id?.toString() || `live-${Date.now()}-${Math.random()}`,
      type: mappedType,
      cause: data.event_cause || 'Unknown',
      corridor: data.corridor || 'Unknown Corridor',
      zone: data.zone || 'Unknown Zone',
      vehicleType: data.veh_type || 'Unknown',
      time: timeStr,
      address: data.address || data.junction || data.police_station || 'Unknown Location',
      lat: data.latitude || 12.9716,
      lng: data.longitude || 77.5946,
      burdenScore: data.burden_score || Math.floor(Math.random() * 40) + 40,
      priority: priority,
      status: data.status || 'Active',
      officersRequired: data.recommendations?.manpower?.personnel_count || data.officers_required || (priority === 'CRITICAL' ? 5 : 2),
      targetZones: data.target_zones || data.zone || 'General',
      barricadingType: data.recommendations?.barricading?.type || data.barricading_type || 'Standard',
      barricadingDescription: data.recommendations?.barricading?.description || '',
      diversionMain: data.diversion_main || 'Alternate Route A',
      diversionAlt: data.diversion_alt || 'Alternate Route B',
      priorityConfidence: data.priority_confidence || Math.floor(Math.random() * 20) + 80,
      closureConfidence: data.closure_confidence || Math.floor(Math.random() * 20) + 70,
      durationConfidence: data.duration_confidence || Math.floor(Math.random() * 20) + 70,
      roadClosure: data.requires_road_closure === true || data.requires_road_closure === 'true' || data.closure_prob > 0.5,
      estDurationMin: data.duration_minutes || data.duration_min || 30,
      reportedAt: startDt
    };
  };

  // Fetch initial sample data
  useEffect(() => {
    fetch(`${API_BASE_URL}/events/sample?count=10`)
      .then(res => res.json())
      .then(data => {
        if (data && data.events) {
          const mapped = data.events.map(mapBackendEventToIncident);
          setIncidents(mapped);
          if (mapped.length > 0) {
            setSelectedIncidentId(mapped[0].id);
          }
        }
        setIsLoadingIncidents(false);
      })
      .catch(err => {
        console.error('Failed to fetch initial events:', err);
        setIsLoadingIncidents(false);
      });
  }, []);

  // WebSocket Connection
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/live-events`);
    wsRef.current = ws;

    ws.onopen = () => console.log('WebSocket connected to backend');
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'new_prediction' && message.data) {
          // Flatten prediction response and event data into a single object for mapping
          const combinedData = {
            ...message.data.event,
            ...message.data.prediction,
            // Map keys from prediction request
            latitude: 12.9716, // Fallbacks since predict might not have precise coords
            longitude: 77.5946,
            address: `Zone: ${message.data.event.zone || 'Unknown'}`,
            start_datetime: new Date().toISOString()
          };
          
          const newInc = mapBackendEventToIncident(combinedData);
          setIncidents(prev => {
            // Deduplicate if we already added it optimistically
            if (prev.find(i => i.id === newInc.id)) return prev;
            return [...prev, newInc];
          });
        }
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };
    ws.onclose = () => console.log('WebSocket disconnected');

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const handleSelectIncident = (incident: Incident) => {
    setSelectedIncidentId(incident.id);
  };

  const handleSelectIncidentId = (id: string) => {
    setSelectedIncidentId(id);
  };

  // Filter incidents list based on user search value (across address / corridor / type / priority)
  const filteredIncidents = incidents.filter(i => {
    if (!searchValue) return true;
    const query = searchValue.toLowerCase();
    return (
      i.address.toLowerCase().includes(query) ||
      i.corridor.toLowerCase().includes(query) ||
      i.type.toLowerCase().includes(query) ||
      i.priority.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-[#0e1322] text-[#dee1f7] font-sans min-h-screen flex flex-col md:flex-row overflow-hidden bg-background">
      {/* SideNavBar layout */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }} 
      />

      {/* Main content wrapper */}
      <div className="flex-grow flex flex-col h-screen md:ml-[240px] overflow-hidden">
        {/* Top App Bar header */}
        <Header 
          activeTab={activeTab}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Floating Mobile Sidebar overlay if needed */}
        {isMobileMenuOpen && (
          <div 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden fixed inset-0 bg-black/65 z-30 transition-all"
          />
        )}

        {/* Content canvas container */}
        <main className="flex-grow overflow-hidden relative bg-[#0e1322]">
          {activeTab === 'dashboard' && (
            <DashboardView 
              incidents={filteredIncidents} 
              onSelectIncident={handleSelectIncident}
              onNavigateToResults={() => setActiveTab('results')}
              setActiveTab={setActiveTab}
              setSelectedIncidentId={setSelectedIncidentId}
              isLoadingIncidents={isLoadingIncidents}
            />
          )}

          {activeTab === 'report' && (
            <ReportView 
              onAddIncident={handleAddIncident}
              setActiveTab={setActiveTab}
              setSelectedIncidentId={setSelectedIncidentId}
            />
          )}

          {activeTab === 'results' && (
            <ResultsView 
              incidents={incidents}
              selectedIncidentId={selectedIncidentId}
              onSelectIncidentId={handleSelectIncidentId}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView />
          )}
        </main>

        {/* Status System footer */}
        <Footer />
      </div>
    </div>
  );
}
