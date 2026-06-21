import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Clock, Heading, ShieldAlert, BarChart3, ChevronRight, Check, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Incident } from '../types';

// Fix Leaflet's default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DashboardViewProps {
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
  onNavigateToResults: () => void;
  setActiveTab: (tab: 'dashboard' | 'report' | 'results' | 'analytics') => void;
  setSelectedIncidentId: (id: string) => void;
  isLoadingIncidents: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  incidents,
  onSelectIncident,
  onNavigateToResults,
  setActiveTab,
  setSelectedIncidentId,
  isLoadingIncidents
}) => {
  const [selectedPin, setSelectedPin] = useState<Incident | null>(incidents[0] || null);
  const [mapHoverInfo, setMapHoverInfo] = useState<string | null>(null);

  // Statistics calculation based on live state
  const totalActive = incidents.filter(i => i.status === 'Active').length + 39; // Seed off-screen total of 42
  const highPriority = incidents.filter(i => i.priority === 'CRITICAL' || i.priority === 'HIGH').length + 10; // Seed off-screen high-priority
  const avgResolution = '28m';
  const roadClosures = incidents.filter(i => i.roadClosure).length + 3; // Seed off-screen closures

  // Count incidents by category for summary list
  const breakdownCount = incidents.filter(i => i.type === 'Breakdown').length + 16;
  const collisionCount = incidents.filter(i => i.type === 'Collision').length + 11;
  const weatherOrInfrastructureCount = incidents.filter(i => i.type === 'Weather Hazard' || i.type === 'Infrastructure Failure').length + 12;

  const totalCauses = breakdownCount + collisionCount + weatherOrInfrastructureCount;

  const handleIncidentClick = (inc: Incident) => {
    setSelectedPin(inc);
    setSelectedIncidentId(inc.id);
    onSelectIncident(inc);
  };

  useEffect(() => {
    if (selectedPin) {
      const el = document.getElementById(`incident-card-${selectedPin.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [selectedPin]);

  const handleInspectResults = (inc: Incident) => {
    setSelectedIncidentId(inc.id);
    onSelectIncident(inc);
    onNavigateToResults();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[1px] bg-[#3c494e] shrink-0 border-b border-[#3c494e]">
        <div className="bg-[#0d1b2a] p-4 flex flex-col justify-between h-24">
          <span className="text-[10px] font-mono text-[#859398] font-bold tracking-wider uppercase">TOTAL ACTIVE INCIDENTS</span>
          <span className="text-3xl font-mono text-[#dee1f7] font-bold">{totalActive}</span>
        </div>
        <div className="bg-[#0d1b2a] p-4 flex flex-col justify-between h-24">
          <span className="text-[10px] font-mono text-[#859398] font-bold tracking-wider uppercase">HIGH PRIORITY</span>
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-[#ffb4ab] w-5 h-5" />
            <span className="text-3xl font-mono text-[#ffb4ab] font-bold">{highPriority}</span>
          </div>
        </div>
        <div className="bg-[#0d1b2a] p-4 flex flex-col justify-between h-24">
          <span className="text-[10px] font-mono text-[#859398] font-bold tracking-wider uppercase">AVG RESOLUTION TIME</span>
          <span className="text-3xl font-mono text-[#a8e8ff] font-bold">{avgResolution}</span>
        </div>
        <div className="bg-[#0d1b2a] p-4 flex flex-col justify-between h-24">
          <span className="text-[10px] font-mono text-[#859398] font-bold tracking-wider uppercase">ROAD CLOSURES</span>
          <span className="text-3xl font-mono text-[#ffb95f] font-bold">{roadClosures}</span>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-[1px] bg-[#3c494e] overflow-hidden">
        
        {/* Left Side: Topology Map (8 Cols on Desktop) */}
        <div className="lg:col-span-7 bg-[#0d1b2a] relative overflow-hidden flex flex-col h-full">
          <div className="p-3 border-b border-[#3c494e] flex justify-between items-center bg-[#1a1f2f]/30 shrink-0 select-none">
            <span className="text-[10px] font-mono font-bold text-[#859398] tracking-widest uppercase">LIVE TRAFFIC TOPOLOGY — BENGALURU</span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#161b2b] text-[#859398] border border-[#3c494e]">
              ACTIVE CALIBRATION
            </span>
          </div>

          {/* Map Area */}
          <div className="flex-1 relative bg-[#050811] overflow-hidden">
            
            {/* Glowing Map Target Coordinates HUD */}
            <div className="absolute top-3 left-3 bg-[#161b2b]/95 backdrop-blur-sm border border-[#3c494e] px-2.5 py-1.5 rounded-sm pointer-events-none z-10 font-mono text-[9px] text-[#859398] flex flex-col gap-0.5 shadow-lg max-w-[170px]">
              <div>ACTIVE GRID FEED: <span className="text-[#a8e8ff] font-bold">12.97° N | 77.59° E</span></div>
              <div className="truncate">FOCUS PIN: <span className="text-[#ffb95f] font-bold">{selectedPin ? selectedPin.corridor.split(' ')[0] : 'None'}</span></div>
            </div>
            {/* Interactive Map Feed using Leaflet */}
            <div className="absolute inset-0 z-0">
              <MapContainer 
                center={[12.9716, 77.5946]} 
                zoom={12} 
                style={{ width: '100%', height: '100%', background: '#0e1322' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                {incidents.map((inc) => (
                  <Marker 
                    key={inc.id}
                    position={[inc.lat, inc.lng]}
                    eventHandlers={{
                      mouseover: () => setMapHoverInfo(inc.address),
                      mouseout: () => setMapHoverInfo(null),
                      click: () => handleIncidentClick(inc)
                    }}
                  >
                    <Popup className="font-mono bg-[#162231] text-[#dee1f7] border border-[#3c494e]">
                      <div className="flex flex-col gap-1 p-1">
                        <strong className="text-[#a8e8ff]">{inc.priority} PRIORITY</strong>
                        <span>{inc.type} - {inc.cause}</span>
                        <span className="text-[10px] text-[#859398]">{inc.address}</span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Static HUD Indicator over Bengalurians */}
            {mapHoverInfo && (
              <div className="absolute bottom-16 left-4 right-4 bg-[#090e1c]/95 border border-[#3c494e] rounded-sm p-2 font-mono text-[10px] text-[#a8e8ff] leading-[1.4] select-none pointer-events-none z-30 shadow-2xl flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-ping"></span>
                <span>HUD DETECTED ADDRESS: {mapHoverInfo}</span>
              </div>
            )}

            {/* Map Legend Overlay */}
            <div className="absolute bottom-4 left-4 bg-[#1a1f2f]/95 border border-[#3c494e] p-3 rounded-sm z-30 opacity-90 font-mono">
              <span className="text-[10px] text-[#859398] block mb-2 font-bold tracking-widest leading-none uppercase">LEGEND</span>
              <div className="flex flex-col gap-1.5 text-[9px]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffb4ab]"></div>
                  <span className="text-[#dee1f7]">Critical Incident (12)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffb95f]"></div>
                  <span className="text-[#dee1f7]">Warning Incident (30)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Charts & Incident Feed (5 Cols on Desktop) */}
        <div className="lg:col-span-5 flex flex-col h-full bg-[#0d1b2a] overflow-hidden">
          
          {/* Charts Area (Priority Distribution & Cause) */}
          <div className="grid grid-cols-2 gap-[1px] bg-[#3c494e] shrink-0 border-b border-[#3c494e] h-48 select-none">
            {/* Pie / Donut Chart */}
            <div className="bg-[#1a1f2f]/30 p-3.5 flex flex-col justify-start">
              <span className="text-[10px] font-[#859398] font-mono font-bold tracking-wider uppercase text-[#859398] mb-1">PRIORITY DISTRIBUTION</span>
              <div className="flex-1 flex justify-center items-center relative">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" fill="none" r="38" stroke="#2f3445" strokeWidth="12"></circle>
                  
                  {/* Warning slice (High-Priority): 70% */}
                  <circle 
                    className="drop-shadow-[0_0_4px_rgba(255,185,95,0.4)] transition-all duration-300" 
                    cx="50" 
                    cy="50" 
                    fill="none" 
                    r="38" 
                    stroke="#ffb95f" 
                    strokeDasharray="238.76" 
                    strokeDashoffset="71.635" // Offset of 70% 
                    strokeWidth="10"
                  />
                  {/* Critical slice: 30% */}
                  <circle 
                    className="drop-shadow-[0_0_4px_rgba(255,180,171,0.6)] transition-all duration-300" 
                    cx="50" 
                    cy="50" 
                    fill="none" 
                    r="38" 
                    stroke="#ffb4ab" 
                    strokeDasharray="238.76" 
                    strokeDashoffset="167.13" // Offset of 30%
                    strokeWidth="11"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col justify-center items-center">
                  <span className="text-lg font-mono text-[#dee1f7] font-bold font-headline">{totalActive}</span>
                  <span className="text-[8px] font-mono text-[#859398]">SUM TOTAL</span>
                </div>
              </div>
            </div>

            {/* Horizontal Bar Cause Chart */}
            <div className="bg-[#1a1f2f]/30 p-3.5 flex flex-col justify-start">
              <span className="text-[10px] font-mono font-bold tracking-wider text-[#859398] mb-2 uppercase">EVENTS BY CAUSE</span>
              
              <div className="flex-grow flex flex-col justify-center gap-3">
                {/* Breakdown Bar */}
                <div className="flex flex-col gap-1 z-10">
                  <div className="flex justify-between font-mono text-[9px]">
                    <span className="text-[#bbc9cf]">Breakdown</span>
                    <span className="text-[#dee1f7] font-bold">{breakdownCount}</span>
                  </div>
                  <div className="w-full bg-[#2f3445] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#a8e8ff] h-full" style={{ width: `${(breakdownCount / totalCauses) * 100}%` }}></div>
                  </div>
                </div>

                {/* Accident Bar */}
                <div className="flex flex-col gap-1 z-10">
                  <div className="flex justify-between font-mono text-[9px]">
                    <span className="text-[#bbc9cf]">Accident</span>
                    <span className="text-[#dee1f7] font-bold">{collisionCount}</span>
                  </div>
                  <div className="w-full bg-[#2f3445] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#ffb4ab] h-full" style={{ width: `${(collisionCount / totalCauses) * 100}%` }}></div>
                  </div>
                </div>

                {/* Other/Potholes Bar */}
                <div className="flex flex-col gap-1 z-10">
                  <div className="flex justify-between font-mono text-[9px]">
                    <span className="text-[#bbc9cf]">Pothole / Others</span>
                    <span className="text-[#dee1f7] font-bold">{weatherOrInfrastructureCount}</span>
                  </div>
                  <div className="w-full bg-[#2f3445] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#ffb95f] h-full" style={{ width: `${(weatherOrInfrastructureCount / totalCauses) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Incidents Feed Panel */}
          <div className="flex-grow flex flex-col overflow-hidden pb-12 md:pb-0">
            <div className="p-3 border-b border-[#3c494e] flex justify-between items-center bg-[#1a1f2f]/30 shrink-0">
              <span className="text-[10px] font-mono font-bold text-[#859398] tracking-widest uppercase">RECENT INCIDENTS FEED</span>
              <button 
                onClick={() => setActiveTab('analytics')}
                className="text-[9px] font-mono text-[#00d4ff] hover:text-[#a8e8ff] transition-colors uppercase font-bold tracking-wider select-none cursor-pointer"
              >
                VIEW ANALYTICS FEED
              </button>
            </div>

            {/* Scrollable Feed stream */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pb-8 flex flex-col gap-3 scrollbar-hide">
              {isLoadingIncidents ? (
                <div className="flex flex-col items-center justify-center h-full text-[#859398] gap-3 mt-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00d4ff]" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#00d4ff]">Establishing Uplink...</span>
                </div>
              ) : incidents.slice().reverse().map((inc) => {
                const isSelected = selectedPin?.id === inc.id;
                
                // Set emoji and priority color classes based on incident type
                let emoji = '🚗';
                if (inc.type === 'Collision') emoji = '💥';
                else if (inc.type === 'Weather Hazard') emoji = '⛈️';
                else if (inc.type === 'Infrastructure Failure') emoji = '🕳️';

                let priorityClass = 'bg-[#66fa8c]/15 text-[#6bff8f] border-[#66fa8c]/30';
                if (inc.priority === 'CRITICAL') {
                  priorityClass = 'bg-[#ffb4ab]/15 text-[#ffb4ab] border-[#ffb4ab]/30';
                } else if (inc.priority === 'HIGH') {
                  priorityClass = 'bg-[#ffb95f]/15 text-[#ffb95f] border-[#ffb95f]/30';
                }

                return (
                  <div
                    key={inc.id}
                    id={`incident-card-${inc.id}`}
                    onClick={() => handleIncidentClick(inc)}
                    className={`border rounded-sm p-3 transition-all cursor-pointer group flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-[#1a1f2f]/50 border-[#00d4ff] shadow-md'
                        : 'bg-[#090e1c] border-[#3c494e] hover:bg-[#1a1f2f]/20 hover:border-[#859398]/30'
                    }`}
                  >
                    {/* Feed Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl select-none group-hover:scale-110 transition-transform duration-200">{emoji}</span>
                        <div>
                          <div className={`text-xs font-bold leading-none ${isSelected ? 'text-[#00d4ff]' : 'text-[#dee1f7]'} group-hover:text-[#00d4ff] transition-colors`}>
                            {inc.corridor.split(' ')[0]} {inc.corridor.includes('(') ? inc.corridor.match(/\(([^)]+)\)/)?.[1] : ''} Intersection
                          </div>
                          <div className="text-[10px] text-[#bbc9cf] mt-1 font-mono leading-tight">
                            {inc.type} • {inc.vehicleType} Involved
                          </div>
                        </div>
                      </div>
                      <span className={`border px-1.5 py-0.5 rounded-sm font-mono text-[9px] font-bold ${priorityClass}`}>
                        {inc.priority}
                      </span>
                    </div>

                    {/* Feed Statistics details */}
                    <div className="text-[10px] font-mono text-[#859398] truncate leading-none">
                      LOC: {inc.address}
                    </div>

                    {/* Progress Slider Burden Score indicators */}
                    <div className="mt-1">
                      <div className="flex justify-between font-mono text-[9px] mb-1 leading-none">
                        <span className="text-[#859398]">Grid Burden Coefficient</span>
                        <span className={inc.burdenScore > 80 ? 'text-[#ffb4ab]' : 'text-[#ffb95f]'}>{inc.burdenScore}%</span>
                      </div>
                      <div className="w-full bg-[#161b2b] h-1 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-[#00d4ff] via-[#ffb95f] to-[#ffb4ab] h-full transition-all duration-500" 
                          style={{ width: `${inc.burdenScore}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Quick navigation and detail helper buttons */}
                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-[#3c494e] flex justify-between items-center bg-[#090e1c]/40 rounded-sm -mx-2 px-2 py-1 select-none">
                        <span className="text-[9px] font-mono text-[#859398]">Report: {inc.time} UTC</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectResults(inc);
                          }}
                          className="flex items-center gap-1 text-[9px] font-bold text-[#00d4ff] hover:text-[#a8e8ff] font-mono uppercase bg-[#1a1f2f] px-2 py-0.5 rounded cursor-pointer leading-none"
                        >
                          Inspect Impact Plan
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
