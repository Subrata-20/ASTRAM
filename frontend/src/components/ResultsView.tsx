import React, { useState, useEffect } from 'react';
import { AlertTriangle, Map, HelpCircle, ShieldAlert, BarChart3, Radio, CheckCircle, Construction, Route, Clock, Percent, X, Maximize2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import { Incident } from '../types';

interface ResultsViewProps {
  incidents: Incident[];
  selectedIncidentId: string;
  onSelectIncidentId: (id: string) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncidentId
}) => {
  // Retrieve target active incident
  const activeIncident = incidents.find(i => i.id === selectedIncidentId) || incidents[incidents.length - 1] || null;

  const [mainRoutePath, setMainRoutePath] = useState<[number, number][] | null>(null);
  const [altRoutePath, setAltRoutePath] = useState<[number, number][] | null>(null);
  const [mainRouteText, setMainRouteText] = useState<string>("Loading...");
  const [altRouteText, setAltRouteText] = useState<string>("Loading...");
  const [selectedRoute, setSelectedRoute] = useState<'main' | 'alt'>('main');
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (!activeIncident) return;
    
    const fetchRoute = async () => {
      try {
        setMainRouteText("Loading...");
        setAltRouteText("Loading...");
        const res = await fetch(`http://localhost:8000/route/diversion?incident_lat=${activeIncident.lat}&incident_lng=${activeIncident.lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data.main_route) {
            setMainRoutePath(data.main_route.coordinates);
            setMainRouteText(data.main_route.text);
          } else {
            setMainRoutePath(null);
            setMainRouteText("No route found");
          }
          if (data.alt_route) {
            setAltRoutePath(data.alt_route.coordinates);
            setAltRouteText(data.alt_route.text);
          } else {
            setAltRoutePath(null);
            setAltRouteText("No alternative found");
          }
        }
      } catch (err) {
        console.error("Failed to fetch diversion route", err);
        setMainRoutePath(null);
        setAltRoutePath(null);
        setMainRouteText("Error");
        setAltRouteText("Error");
      }
    };

    fetchRoute();
  }, [activeIncident?.id]);

  if (!activeIncident) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-[#0e1322]">
        <HelpCircle className="w-12 h-12 text-[#859398] mb-3 animate-bounce" />
        <p className="text-sm font-mono text-[#bbc9cf]">No incidents filed yet. Please go to the Report screen to submit one.</p>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col overflow-auto p-4 bg-[#0e1322] select-none h-full">
      {/* Top Incident Selection Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 select-none">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#dee1f7] tracking-tight">Active Plan Recommendation</h1>
          <p className="text-[11px] text-[#bbc9cf] mt-1 font-sans">
            AI-generated tactical dispatch mitigation strategy and routing optimization models.
          </p>
        </div>

        {/* Dropdown to inspect other logs */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-[10px] text-[#859398] uppercase tracking-wider font-bold">Inspect Sector Target:</span>
          <div className="relative">
            <select
              value={activeIncident.id}
              onChange={(e) => onSelectIncidentId(e.target.value)}
              className="bg-[#1a1f2f] border border-[#3c494e] text-xs font-mono text-[#a8e8ff] py-1.5 pl-3 pr-8 rounded-sm focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] appearance-none cursor-pointer"
            >
              {incidents.map((i) => (
                <option key={i.id} value={i.id}>
                  {(i.corridor ? String(i.corridor) : 'Unknown').split(' ')[0]} ({i.time}) - {i.priority}
                </option>
              ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a8e8ff] pointer-events-none text-[9px] select-none">▼</span>
          </div>
        </div>
      </div>

      {/* Main Analysis Container layout */}
      <div className="max-w-7xl mx-auto space-y-3 flex flex-col gap-[1px] bg-[#3c494e] border border-[#3c494e] rounded-sm overflow-hidden mb-12 lg:mb-0">
        
        {/* Top Segment Panel: Score Gauge and Incident Cause Banners */}
        <div className="bg-[#0d1b2a] p-4 flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Gauge display widget */}
          <div className="flex flex-col items-center justify-center min-w-[240px] shrink-0 select-none">
            <div className="relative w-48 h-28 overflow-hidden flex justify-center items-end">
              <svg className="w-full h-full absolute bottom-0" viewBox="0 0 100 50">
                {/* Background arc */}
                <path className="fill-none stroke-[#2f3445] stroke-[8]" d="M 12 50 A 38 38 0 0 1 88 50"></path>
                {/* Foreground value arc (Burden ratio) */}
                <path 
                  className="fill-none stroke-[8] stroke-[#ffb95f] filter drop-shadow-[0_0_6px_rgba(255,185,95,0.4)] transition-all duration-1000 ease-out" 
                  d="M 12 50 A 38 38 0 0 1 88 50" 
                  strokeDasharray="119.38" 
                  // Math.max(0, 119.38 * (1 - (BURDEN / 100)))
                  strokeDashoffset={119.38 * (1 - (activeIncident.burdenScore / 100))}
                ></path>
              </svg>
              <div className="absolute bottom-2 text-center flex flex-col items-center justify-center">
                <div className="text-3xl font-mono font-bold text-[#ffb95f] leading-none select-all">
                  {activeIncident.burdenScore}
                </div>
                <span className="text-[9px] font-mono font-bold text-[#859398] uppercase tracking-widest mt-1 select-none">BURDEN SCORE</span>
              </div>
            </div>
          </div>

          {/* Cause Status values */}
          <div className="flex flex-col flex-grow items-start md:items-end gap-3.5 w-full select-none">
            <div className="text-lg md:text-xl font-bold text-[#dee1f7] flex items-center gap-2">
              <AlertTriangle className="text-[#ffb95f] w-5.5 h-5.5 animate-bounce-slow" />
              <span>Cause: {activeIncident.cause} ({activeIncident.type})</span>
            </div>

            {/* Configured status pills */}
            <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
              <div className="px-2.5 py-1 bg-[#93000a]/15 border border-[#ffb4ab]/30 text-[#ffb4ab] rounded-sm uppercase flex items-center gap-1.5 filter drop-shadow-[0_0_4px_rgba(255,180,171,0.2)]">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{activeIncident.priority} PRIORITY</span>
              </div>
              <div className="px-2.5 py-1 bg-[#ffb95f]/15 border border-[#ffb95f]/30 text-[#ffb95f] rounded-sm uppercase flex items-center gap-1.5 filter drop-shadow-[0_0_4px_rgba(255,185,95,0.2)]">
                <Construction className="w-3.5 h-3.5" />
                <span>CLOSURE: {activeIncident.roadClosure ? 'YES' : 'NO'}</span>
              </div>
              <div className="px-2.5 py-1 bg-[#00d4ff]/15 border border-[#a8e8ff]/30 text-[#a8e8ff] rounded-sm uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>~{activeIncident.estDurationMin} MINS</span>
              </div>
            </div>
          </div>

        </div>

        {/* Middle row cards grid (Bento trio) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[#3c494e]">
          
          {/* Bento Card 1: Manpower Plan */}
          <div className="bg-[#0d1b2a] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#3c494e] pb-2 text-[#859398]">
              <h3 className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
                <CheckCircle className="w-4 h-4 text-[#a8e8ff]" /> Manpower Plan
              </h3>
              <CheckCircle className="w-4 h-4 text-[#a8e8ff] fill-[#001f27]" />
            </div>

            <div className="flex flex-col gap-2.5 flex-grow justify-center font-mono">
              <div className="flex justify-between items-center bg-[#050811] p-2.5 rounded-sm border border-[#3c494e]">
                <span className="text-[10px] text-[#bbc9cf]">Officers Required</span>
                <span className="text-sm text-[#00d4ff] font-bold">{activeIncident.officersRequired}</span>
              </div>
              <div className="flex justify-between items-center bg-[#050811] p-2.5 rounded-sm border border-[#3c494e]">
                <span className="text-[10px] text-[#bbc9cf]">Target Sectors</span>
                <span className="text-sm text-[#dee1f7] font-bold">{activeIncident.targetZones}</span>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Barricading Plan */}
          <div className="bg-[#0d1b2a] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#3c494e] pb-2 text-[#859398]">
              <h3 className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
                <Construction className="w-4 h-4 text-[#ffb95f]" /> Barricading
              </h3>
            </div>

            <div className="flex flex-col gap-2.5 flex-grow justify-center font-mono">
              <div className="flex flex-col bg-[#050811] p-3 rounded-sm border border-[#ffb95f]/30">
                <span className="text-[10px] text-[#ffb95f] uppercase tracking-wider mb-1 font-bold">Type Required</span>
                <span className="text-xs text-[#dee1f7] font-bold leading-normal">{activeIncident.barricadingType}</span>
                {activeIncident.barricadingDescription && (
                  <span className="text-[10px] text-[#bbc9cf] mt-1 italic">{activeIncident.barricadingDescription}</span>
                )}
                <div className="w-full h-1 bg-[#161b2b] mt-3 rounded-full overflow-hidden">
                  <div className="h-full bg-[#ffb95f] w-full shadow-[0_0_4px_rgba(255,185,95,0.6)]"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Card 3: Diversion Route Plan */}
          <div className="bg-[#0d1b2a] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#3c494e] pb-2 text-[#859398]">
              <h3 className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
                <Route className="w-4 h-4 text-[#6bff8f]" /> Diversion Plan
              </h3>
            </div>

            <div className="flex flex-col gap-2 relative h-full min-h-[110px] justify-end">
              {/* Interactive Route Map */}
              <div 
                className="absolute inset-0 z-0 opacity-80 rounded-sm overflow-hidden border border-[#3c494e] cursor-pointer group"
                onClick={() => setIsMapExpanded(true)}
              >
                <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                  <Maximize2 className="w-6 h-6 text-[#dee1f7]" />
                </div>
                <MapContainer 
                  center={[activeIncident.lat, activeIncident.lng]} 
                  zoom={13} 
                  style={{ width: '100%', height: '100%', background: '#0e1322' }}
                  zoomControl={false}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; CARTO'
                  />
                  <Marker position={[activeIncident.lat, activeIncident.lng]} />
                  {selectedRoute === 'main' && mainRoutePath && (
                    <Polyline positions={mainRoutePath} color="#00d4ff" weight={4} opacity={0.8} />
                  )}
                  {selectedRoute === 'alt' && altRoutePath && (
                    <Polyline positions={altRoutePath} color="#dee1f7" weight={4} opacity={0.8} />
                  )}
                </MapContainer>
              </div>
              {/* Written routes list overlay */}
              <div className="z-10 flex flex-col gap-2 mt-auto font-mono">
                <div 
                  onClick={() => { setSelectedRoute('main'); setIsMapExpanded(true); }}
                  className={`bg-[#050811]/85 backdrop-blur-sm p-2 rounded-sm border cursor-pointer transition-colors flex justify-between items-center text-[10px] ${selectedRoute === 'main' ? 'border-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.3)]' : 'border-[#3c494e] hover:border-[#859398]'}`}
                >
                  <span className="text-[#859398] uppercase">Main Route</span>
                  <span className={`${selectedRoute === 'main' ? 'text-[#00d4ff]' : 'text-[#859398]'} font-bold truncate max-w-[130px]`} title={mainRouteText}>{mainRouteText}</span>
                </div>
                <div 
                  onClick={() => { setSelectedRoute('alt'); setIsMapExpanded(true); }}
                  className={`bg-[#050811]/85 backdrop-blur-sm p-2 rounded-sm border cursor-pointer transition-colors flex justify-between items-center text-[10px] ${selectedRoute === 'alt' ? 'border-[#dee1f7] shadow-[0_0_8px_rgba(222,225,247,0.3)]' : 'border-[#3c494e] hover:border-[#859398]'}`}
                >
                  <span className="text-[#859398] uppercase">Alt Route</span>
                  <span className={`${selectedRoute === 'alt' ? 'text-[#dee1f7]' : 'text-[#859398]'} font-bold truncate max-w-[130px]`} title={altRouteText}>{altRouteText}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Panel: Confidence circular percentages metrics */}
        <div className="bg-[#0d1b2a] p-4 grid grid-cols-1 md:grid-cols-3 gap-6 select-none font-mono">
          
          {/* Conf Meter 1: Priority Confidence */}
          <div className="flex flex-col items-center justify-center p-2">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 block" viewBox="0 0 36 36">
                <circle className="fill-none stroke-[#2f3445] stroke-[3]" cx="18" cy="18" r="16"></circle>
                <circle 
                  className="fill-none stroke-[#66fa8c] stroke-[3.5] stroke-linecap-round filter drop-shadow-[0_0_4px_rgba(102,250,140,0.4)] transition-all duration-700 ease-out" 
                  cx="18" 
                  cy="18" 
                  r="16"
                  strokeDasharray={`${activeIncident.priorityConfidence}, 100`}
                ></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#dee1f7]">
                {activeIncident.priorityConfidence}%
              </div>
            </div>
            <span className="mt-2.5 text-[9px] text-[#859398] uppercase tracking-wider text-center font-bold font-mono">Priority Confidence</span>
          </div>

          {/* Conf Meter 2: Closure Confidence */}
          <div className="flex flex-col items-center justify-center p-2 border-t md:border-t-0 md:border-l border-[#3c494e]">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 block" viewBox="0 0 36 36">
                <circle className="fill-none stroke-[#2f3445] stroke-[3]" cx="18" cy="18" r="16"></circle>
                <circle 
                  className="fill-none stroke-[#00d4ff] stroke-[3.5] stroke-linecap-round filter drop-shadow-[0_0_4px_rgba(0,212,255,0.4)] transition-all duration-700 ease-out" 
                  cx="18" 
                  cy="18" 
                  r="16"
                  strokeDasharray={`${activeIncident.closureConfidence}, 100`}
                ></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#dee1f7]">
                {activeIncident.closureConfidence}%
              </div>
            </div>
            <span className="mt-2.5 text-[9px] text-[#859398] uppercase tracking-wider text-center font-bold font-mono">Closure Confidence</span>
          </div>

          {/* Conf Meter 3: Duration Confidence */}
          <div className="flex flex-col items-center justify-center p-2 border-t md:border-t-0 md:border-l border-[#3c494e]">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 block" viewBox="0 0 36 36">
                <circle className="fill-none stroke-[#2f3445] stroke-[3]" cx="18" cy="18" r="16"></circle>
                <circle 
                  className="fill-none stroke-[#ffb95f] stroke-[3.5] stroke-linecap-round filter drop-shadow-[0_0_4px_rgba(255,185,95,0.4)] transition-all duration-700 ease-out" 
                  cx="18" 
                  cy="18" 
                  r="16"
                  strokeDasharray={`${activeIncident.durationConfidence}, 100`}
                ></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#dee1f7]">
                {activeIncident.durationConfidence}%
              </div>
            </div>
            <span className="mt-2.5 text-[9px] text-[#859398] uppercase tracking-wider text-center font-bold font-mono">Duration Confidence</span>
          </div>

        </div>

      </div>

      {/* Expanded Map Modal */}
      {isMapExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d1b2a] border border-[#3c494e] w-full max-w-5xl h-[80vh] flex flex-col rounded-sm overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between p-4 border-b border-[#3c494e] shrink-0 bg-[#1a1f2f]/80">
              <div>
                <h2 className="text-lg font-bold text-[#dee1f7] font-mono flex items-center gap-2">
                  <Route className="w-5 h-5 text-[#6bff8f]" /> Diversion Routing View
                </h2>
                <p className="text-xs text-[#859398] font-mono mt-1">
                  Incident at {activeIncident.lat}, {activeIncident.lng}
                </p>
              </div>
              <button 
                onClick={() => setIsMapExpanded(false)}
                className="p-1.5 hover:bg-[#3c494e] rounded-sm transition-colors text-[#859398] hover:text-[#dee1f7]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-grow relative bg-[#0e1322]">
              <MapContainer 
                center={[activeIncident.lat, activeIncident.lng]} 
                zoom={14} 
                style={{ width: '100%', height: '100%', background: '#0e1322' }}
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; CARTO'
                />
                <Marker position={[activeIncident.lat, activeIncident.lng]} />
                {selectedRoute === 'main' && mainRoutePath && (
                  <Polyline positions={mainRoutePath} color="#00d4ff" weight={5} opacity={0.9} />
                )}
                {selectedRoute === 'alt' && altRoutePath && (
                  <Polyline positions={altRoutePath} color="#dee1f7" weight={5} opacity={0.9} />
                )}
              </MapContainer>
              
              {/* Route Legend Overlay in Expanded Map */}
              <div className="absolute bottom-6 left-6 z-[1000] bg-[#050811]/90 backdrop-blur-md p-4 rounded-sm border border-[#3c494e] font-mono shadow-lg min-w-[250px]">
                <h3 className="text-[10px] text-[#859398] uppercase tracking-widest font-bold mb-3">Available Routes</h3>
                <div className="flex flex-col gap-3">
                  <div 
                    onClick={() => setSelectedRoute('main')}
                    className={`cursor-pointer transition-colors p-2 rounded-sm border flex flex-col gap-1 ${selectedRoute === 'main' ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-[#3c494e] hover:border-[#859398] bg-transparent'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#00d4ff]"></div>
                      <span className="text-xs text-[#dee1f7] font-bold">Main Route</span>
                    </div>
                    <span className="text-[10px] text-[#a8e8ff] ml-5">{mainRouteText}</span>
                  </div>
                  
                  <div 
                    onClick={() => setSelectedRoute('alt')}
                    className={`cursor-pointer transition-colors p-2 rounded-sm border flex flex-col gap-1 ${selectedRoute === 'alt' ? 'border-[#dee1f7] bg-[#dee1f7]/10' : 'border-[#3c494e] hover:border-[#859398] bg-transparent'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#dee1f7]"></div>
                      <span className="text-xs text-[#dee1f7] font-bold">Alt Route</span>
                    </div>
                    <span className="text-[10px] text-[#bbc9cf] ml-5">{altRouteText}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
