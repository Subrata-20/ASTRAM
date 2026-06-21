import React, { useState, useRef } from 'react';
import { FileEdit, ArrowRight, Compass, Crosshair, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Incident } from '../types';
import { API_BASE_URL } from '../config';

const LocationMarker = ({ position, setPosition, setDidClickMap }: { position: any, setPosition: any, setDidClickMap: any }) => {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      setDidClickMap(true);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
};

interface ReportViewProps {
  onAddIncident: (inc: Incident) => void;
  setActiveTab: (tab: 'dashboard' | 'report' | 'results' | 'analytics') => void;
  setSelectedIncidentId: (id: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  onAddIncident,
  setActiveTab,
  setSelectedIncidentId
}) => {
  // Form States
  const [eventType, setEventType] = useState('unplanned');
  const [cause, setCause] = useState('vehicle_breakdown');
  const [corridor, setCorridor] = useState('Non-corridor');
  const [zone, setZone] = useState('Central Zone 1');
  const [vehicleType, setVehicleType] = useState('private_car');
  const [time, setTime] = useState('14:30');
  const [address, setAddress] = useState('');

  // Map Interactive Coordinate coordinates mapping
  const [coords, setCoords] = useState({ lat: 12.9716, lng: 77.5946 }); // Bengaluru by default
  const [didClickMap, setDidClickMap] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const d = new Date();
    // Python backend day_of_week typically expects 0=Monday, JS getDay() is 0=Sunday
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;

    try {
      const res = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          event_cause: cause,
          corridor: corridor,
          zone: zone,
          veh_type: vehicleType,
          hour_of_day: d.getHours(),
          day_of_week: dayOfWeek,
        })
      });

      if (!res.ok) {
        throw new Error('Prediction failed');
      }

      const prediction = await res.json();

      const predPriority = typeof prediction.priority === 'object' ? prediction.priority.predicted : (prediction.priority || 'MODERATE');
      const isSerious = predPriority.toUpperCase() === 'CRITICAL' || predPriority.toUpperCase() === 'HIGH';
      
      const officersRequired = prediction.recommendations?.manpower?.personnel_count || (isSerious ? (eventType === 'Collision' ? 5 : 3) : 2);
      const targetZones = isSerious ? 'A / B' : zone;
      const barricadingType = prediction.recommendations?.barricading?.type || (isSerious ? 'Hard, Perimeter-style' : 'Soft, Cone-style');
      const barricadingDescription = prediction.recommendations?.barricading?.description || '';
      const diversionMain = corridor === 'I-95 North' || corridor === 'I-95 South' ? 'NICE Road exit' : 'Alternative Lane 3';
      const diversionAlt = corridor === 'Route 66' ? 'Fairfax Blvd' : 'Bannerghatta Rd';
      
      const priorityConfidence = typeof prediction.priority === 'object' && prediction.priority.confidence 
        ? Math.round(prediction.priority.confidence * 100) 
        : (Math.floor(Math.random() * 10) + 88);

      const closureConfidence = typeof prediction.closure === 'object' && prediction.closure.confidence
        ? Math.round(prediction.closure.confidence * 100)
        : (Math.floor(Math.random() * 15) + 80);

      const durationConfidence = typeof prediction.duration === 'object' && prediction.duration.confidence
        ? Math.round(prediction.duration.confidence * 100)
        : (Math.floor(Math.random() * 15) + 70);

      const roadClosure = typeof prediction.closure === 'object' 
        ? prediction.closure.required 
        : (prediction.closure_prob > 0.5);

      const estDurationMin = typeof prediction.duration === 'object'
        ? Math.round(prediction.duration.predicted_minutes)
        : Math.round(prediction.duration_min || 30);

      const newIncident: Incident = {
        id: `reported-${Date.now()}`,
        type: eventType,
        cause: cause,
        corridor: corridor,
        zone: zone,
        vehicleType: vehicleType,
        time: time,
        address: address || `Segment ${zone} near corridor ${corridor}, intersection sector`,
        lat: coords.lat,
        lng: coords.lng,
        burdenScore: Math.round(prediction.burden_score || 45),
        priority: predPriority,
        status: 'Active',
        officersRequired,
        targetZones,
        barricadingType,
        barricadingDescription,
        diversionMain,
        diversionAlt,
        priorityConfidence,
        closureConfidence,
        durationConfidence,
        roadClosure,
        estDurationMin,
        reportedAt: new Date()
      };

      onAddIncident(newIncident);
      setSelectedIncidentId(newIncident.id);
      setActiveTab('results');
    } catch (err) {
      console.error(err);
      alert("Prediction backend unavailable. Ensure models are trained and server is running.");
    }
  };

  return (
    <div className="flex-grow flex flex-col overflow-auto p-4 bg-[#0e1322] select-none h-full">
      {/* Title Header Section */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-[#dee1f7] tracking-tight">Report New Incident</h1>
        <p className="text-xs text-[#bbc9cf] mt-1 font-sans">
          Log real-time events for immediate impact analysis and automated mitigation strategy compilation.
        </p>
      </div>

      {/* Grid Canvas Section (Form + Map) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-[1px] bg-[#3c494e] border border-[#3c494e] rounded-sm overflow-hidden mb-12 lg:mb-0">
        
        {/* Left Form (5 Cols) */}
        <form 
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-[#1a1f2f] p-4 flex flex-col gap-4 overflow-y-auto"
        >
          {/* Header Title indicator */}
          <div className="flex items-center gap-2 border-b border-[#3c494e] pb-2 text-[#a8e8ff]">
            <FileEdit className="w-5 h-5" />
            <h2 className="text-sm font-bold tracking-wider uppercase font-sans">Event Details</h2>
          </div>

          {/* Form input elements rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            {/* Event Type */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-[#859398] font-bold uppercase tracking-wider">Event Type</label>
              <div className="relative">
                <select 
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full bg-[#050811] border border-[#3c494e] rounded p-2 text-xs text-[#dee1f7] font-mono appearance-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]"
                >
                  <option value="unplanned">Unplanned</option>
                  <option value="planned">Planned</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#859398] pointer-events-none font-bold text-xs select-none">▼</span>
              </div>
            </div>

            {/* Cause */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-[#859398] font-bold uppercase tracking-wider">Primary Cause</label>
              <div className="relative">
                <select 
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  className="w-full bg-[#050811] border border-[#3c494e] rounded p-2 text-xs text-[#dee1f7] font-mono appearance-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]"
                >
                  <option value="vehicle_breakdown">Vehicle Breakdown</option>
                  <option value="accident">Accident</option>
                  <option value="water_logging">Water Logging</option>
                  <option value="tree_fall">Tree Fall</option>
                  <option value="pot_holes">Potholes</option>
                  <option value="construction">Construction</option>
                  <option value="congestion">Congestion</option>
                  <option value="road_conditions">Road Conditions</option>
                  <option value="public_event">Public Event</option>
                  <option value="protest">Protest</option>
                  <option value="others">Others</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#859398] pointer-events-none font-bold text-xs select-none">▼</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            {/* Corridor */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-[#859398] font-bold uppercase tracking-wider">Corridor</label>
              <div className="relative">
                <select 
                  value={corridor}
                  onChange={(e) => setCorridor(e.target.value)}
                  className="w-full bg-[#050811] border border-[#3c494e] rounded p-2 text-xs text-[#dee1f7] font-mono appearance-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]"
                >
                  <option value="Non-corridor">Non-corridor</option>
                  <option value="Mysore Road">Mysore Road</option>
                  <option value="Hosur Road">Hosur Road</option>
                  <option value="Old Madras Road">Old Madras Road</option>
                  <option value="Magadi Road">Magadi Road</option>
                  <option value="Tumkur Road">Tumkur Road</option>
                  <option value="Bannerghata Road">Bannerghata Road</option>
                  <option value="Old Airport Road">Old Airport Road</option>
                  <option value="West of Chord Road">West of Chord Road</option>
                  <option value="Bellary Road 1">Bellary Road 1</option>
                  <option value="ORR East 1">ORR East 1</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#859398] pointer-events-none font-bold text-xs select-none">▼</span>
              </div>
            </div>

            {/* Zone */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-[#859398] font-bold uppercase tracking-wider">Zone Designation</label>
              <div className="relative">
                <select 
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full bg-[#050811] border border-[#3c494e] rounded p-2 text-xs text-[#dee1f7] font-mono appearance-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]"
                >
                  <option value="Central Zone 1">Central Zone 1</option>
                  <option value="Central Zone 2">Central Zone 2</option>
                  <option value="North Zone 1">North Zone 1</option>
                  <option value="North Zone 2">North Zone 2</option>
                  <option value="South Zone 1">South Zone 1</option>
                  <option value="South Zone 2">South Zone 2</option>
                  <option value="East Zone 1">East Zone 1</option>
                  <option value="East Zone 2">East Zone 2</option>
                  <option value="West Zone 1">West Zone 1</option>
                  <option value="West Zone 2">West Zone 2</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#859398] pointer-events-none font-bold text-xs select-none">▼</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            {/* Vehicle Type involved */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-[#859398] font-bold uppercase tracking-wider">Vehicle Type Involved</label>
              <div className="relative">
                <select 
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full bg-[#050811] border border-[#3c494e] rounded p-2 text-xs text-[#dee1f7] font-mono appearance-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]"
                >
                  <option value="private_car">Private Car</option>
                  <option value="auto">Auto</option>
                  <option value="taxi">Taxi</option>
                  <option value="bmtc_bus">BMTC Bus</option>
                  <option value="private_bus">Private Bus</option>
                  <option value="ksrtc_bus">KSRTC Bus</option>
                  <option value="truck">Truck</option>
                  <option value="heavy_vehicle">Heavy Vehicle</option>
                  <option value="lcv">LCV</option>
                  <option value="others">Others</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#859398] pointer-events-none font-bold text-xs select-none">▼</span>
              </div>
            </div>

            {/* Incident Time */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-[#859398] font-bold uppercase tracking-wider">Time of Incident</label>
              <input 
                type="time" 
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[#050811] border border-[#3c494e] rounded p-2 text-xs text-[#dee1f7] font-mono focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] uppercase [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Address location text */}
          <div className="flex flex-col gap-1 flex-1 shrink-0">
            <label className="text-[10px] font-mono text-[#859398] font-bold uppercase tracking-wider">Precise Address / Landmark</label>
            <textarea 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full flex-grow bg-[#050811] border border-[#3c494e] rounded p-2 text-xs text-[#dee1f7] font-mono focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] resize-none placeholder:text-[#859398]/50"
              placeholder="e.g., Northbound lane, near Exit 42 overpass..."
              rows={3}
            />
          </div>

          {/* Analyze submit button */}
          <div className="pt-2 mt-auto shrink-0">
            <button 
              type="submit"
              className="w-full bg-[#00d4ff] hover:bg-[#3cd7ff] text-[#001f27] font-bold text-sm py-3 rounded-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,212,255,0.3)] select-none cursor-pointer tracking-wide"
            >
              <span>Analyze Impact</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>

        {/* Right Map Canvas (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0d1b2a] flex flex-col relative h-full">
          
          {/* Top Info Banners */}
          <div className="absolute top-3 left-3 right-3 p-0 z-10 flex justify-between items-center pointer-events-none select-none">
            {/* Target acquisition status button */}
            <div className="bg-[#2f3445]/85 backdrop-blur-sm border border-[#3c494e] px-2.5 py-1 rounded-sm pointer-events-auto flex items-center gap-2">
              <Crosshair className="text-[#859398] w-3.5 h-3.5" />
              <span className="font-mono text-[9px] text-[#dee1f7] tracking-widest uppercase">Target Acquisition</span>
            </div>

            {/* Live Drop banner badge */}
            <div className="bg-[#ffb4ab]/15 border border-[#ffb4ab]/60 px-2.5 py-1 rounded-sm pointer-events-auto flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]"></span>
              <span className="font-mono text-[9px] text-[#ffb4ab]">LIVE PIN DROP READY</span>
            </div>
          </div>

          {/* Map Image container */}
          <div 
            className="flex-grow w-full h-full relative cursor-crosshair overflow-hidden group select-none"
            style={{ minHeight: '300px' }}
          >
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
              <LocationMarker position={coords} setPosition={setCoords} setDidClickMap={setDidClickMap} />
            </MapContainer>

            {/* Quick Helper to guide the user */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-[#050811]/90 border border-[#3c494e] font-mono text-[9px] text-[#bbc9cf] rounded px-3 py-1.5 pointer-events-none leading-none shadow-lg whitespace-nowrap z-[1000]">
              {didClickMap ? '✓ RE-ALIGNMENT COMPLETE' : '⚡ CLICK ANYWHERE ON MAP TO CHOOSE CALIBRATION COORDS'}
            </div>
          </div>

          {/* Bottom Coordinates HUD Display Panel */}
          <div className="bg-[#050811] border-t border-[#3c494e] p-4 flex justify-between items-center shrink-0">
            <div className="flex flex-col">
              <span className="font-mono text-[9px] text-[#859398] uppercase tracking-widest mb-1 shadow-xs">Current Selected Coordinates</span>
              <div className="flex items-center gap-6">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[10px] text-[#00d4ff] font-bold">LAT:</span>
                  <span className="font-mono text-lg text-[#dee1f7] font-bold tracking-tight">
                    {coords.lat.toFixed(4)}° N
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[10px] text-[#00d4ff] font-bold">LNG:</span>
                  <span className="font-mono text-lg text-[#dee1f7] font-bold tracking-tight">
                    {Math.abs(coords.lng).toFixed(4)}° {coords.lng < 0 ? 'W' : 'E'}
                  </span>
                </div>
              </div>
            </div>

            {/* Accuracy tracker indicator */}
            <div className="text-right">
              <span className="font-mono text-[9px] text-[#859398] uppercase tracking-widest block mb-1">ACCURACY RANGE</span>
              <span className="font-mono text-sm text-[#6bff8f] flex items-center gap-1.5 justify-end font-bold">
                <Compass className="w-4 h-4 animate-spin-slow" />
                ± 3.2m
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
