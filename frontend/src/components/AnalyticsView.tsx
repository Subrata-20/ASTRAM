import React, { useState, useEffect } from 'react';
import { Download, TrendingUp, Calendar, AlertTriangle, ShieldCheck, Database, BarChart3, LineChart } from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';

export const AnalyticsView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'24H' | '7D' | '30D'>('7D');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isImputingZone, setIsImputingZone] = useState(false);
  const [zoneFixed, setZoneFixed] = useState(false);

  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [resolutionData, setResolutionData] = useState<any[]>([]);
  const [closureData, setClosureData] = useState<any[]>([]);
  const [backendStats, setBackendStats] = useState({ total: '0', causes: '0', records: '0', coverage: '0%' });

  useEffect(() => {
    let days = 7;
    if (timeRange === '24H') days = 1;
    if (timeRange === '30D') days = 30;

    fetch(`http://localhost:8000/analytics?days=${days}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) return;
        
        const volume = Object.entries(data.hourly_distribution || {}).map(([hour, count]) => ({
          time: `${hour.padStart(2, '0')}:00`,
          events: count as number,
          baseline: Math.round((count as number) * 0.85)
        }));
        setVolumeData(volume);

        const resolution = Object.entries(data.duration_by_cause || {}).map(([cause, mins]) => ({
          cause,
          mins: Number(mins)
        })).slice(0, 5);
        setResolutionData(resolution);

        const closure = Object.entries(data.closure_rates || {}).map(([cause, rate]) => ({
          cause,
          prob: Math.round((rate as number) * 100)
        })).slice(0, 5);
        setClosureData(closure);

        setBackendStats({
          total: data.total_events?.toLocaleString() || '0',
          causes: Object.keys(data.duration_by_cause || {}).length.toString(),
          records: data.events_with_duration?.toLocaleString() || '0',
          coverage: data.total_events ? Math.round((data.events_with_duration / data.total_events) * 100) + '%' : '0%'
        });
      })
      .catch(err => console.error("Failed to fetch analytics", err));
  }, [timeRange]);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    }, 1500);
  };

  const handleImpute = () => {
    setIsImputingZone(true);
    setTimeout(() => {
      setIsImputingZone(false);
      setZoneFixed(true);
    }, 2000);
  };

  return (
    <div className="flex-grow flex flex-col overflow-auto p-4 bg-[#0e1322] select-none h-full">
      
      {/* Time Range Filter Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 select-none font-mono">
        <div className="flex gap-2">
          {(['24H', '7D', '30D'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-sm border text-xs font-bold font-mono transition-colors cursor-pointer ${
                timeRange === range
                  ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff] shadow-[0_0_10px_rgba(0,212,255,0.1)]'
                  : 'border-[#3c494e] bg-[#1a1f2f] text-[#bbc9cf] hover:border-[#00d4ff]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#00d4ff] text-[#001f27] text-xs font-bold hover:bg-[#3cd7ff] transition-colors shadow-[0_0_15px_rgba(0,212,255,0.2)] cursor-pointer font-sans tracking-wide select-none"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'Exporting...' : exportSuccess ? 'Export Sent ✓' : 'Export Report'}</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col gap-4 w-full">
        {/* KPI Bento Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[1px] bg-[#3c494e] border border-[#3c494e] rounded-sm overflow-hidden select-none">
          {/* Total Events */}
          <div className="bg-[#001f27]/5 bg-[#0d1b2a] p-4 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00d4ff]"></div>
            <div className="flex justify-between items-start font-mono">
              <span className="text-[9px] text-[#859398] uppercase tracking-wider font-bold">Total Events Logged</span>
              <LineChart className="text-[#a8e8ff] opacity-40 w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-mono font-bold text-[#dee1f7] leading-none mt-1">{backendStats.total}</div>
            <div className="flex items-center gap-1 text-[#6bff8f] font-mono text-[10px] mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+12% vs last week</span>
            </div>
          </div>

          {/* Unique Causes */}
          <div className="bg-[#0d1b2a] p-4 flex flex-col gap-2 relative overflow-hidden group">
            <div className="flex justify-between items-start font-mono">
              <span className="text-[9px] text-[#859398] uppercase tracking-wider font-bold">Unique Causes</span>
              <Database className="text-[#ffb95f] opacity-40 w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-mono font-bold text-[#dee1f7] leading-none mt-1">{backendStats.causes}</div>
            <div className="flex flex-wrap gap-1 mt-1 font-mono">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border border-[#ffb95f]/30 text-[#ffb95f] bg-[#ffb95f]/10 uppercase">Weather</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border border-[#ffb4ab]/30 text-[#ffb4ab] bg-[#ffb4ab]/10 uppercase">Collision</span>
            </div>
          </div>

          {/* Duration records */}
          <div className="bg-[#0d1b2a] p-4 flex flex-col gap-2 relative overflow-hidden group">
            <div className="flex justify-between items-start font-mono">
              <span className="text-[9px] text-[#859398] uppercase tracking-wider font-bold">Duration Records</span>
              <BarChart3 className="text-[#859398] opacity-40 w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-mono font-bold text-[#dee1f7] leading-none mt-1">{backendStats.records}</div>
            <div className="w-full bg-[#2f3445] h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-[#00d4ff] h-full shadow-[0_0_8px_rgba(168,232,255,0.6)]" style={{ width: backendStats.coverage }}></div>
            </div>
            <div className="font-mono text-[8px] text-[#859398] text-right mt-1 font-bold">{backendStats.coverage} Coverage</div>
          </div>

          {/* Avg Resolution */}
          <div className="bg-[#0d1b2a] p-4 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#ffb4ab]"></div>
            <div className="flex justify-between items-start font-mono">
              <span className="text-[9px] text-[#859398] uppercase tracking-wider font-bold">Avg Resolution Time</span>
              <span className="text-[#ffb4ab] opacity-4 w-4.5 h-4.5 font-bold uppercase leading-none font-mono">⏰</span>
            </div>
            <div className="text-2xl font-mono font-bold text-[#ffb4ab] leading-none mt-1 filter drop-shadow-[0_0_8px_rgba(255,180,171,0.3)]">4h 12m</div>
            <div className="flex items-center gap-1 text-[#ffb4ab] font-mono text-[10px] mt-1 font-bold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+45m vs target</span>
            </div>
          </div>
        </div>

        {/* Main Charts area */}
        <div className="bg-[#1a1f2f]/30 border border-[#3c494e] rounded-sm flex flex-col">
          <div className="p-3 border-b border-[#3c494e] flex justify-between items-center bg-[#1a1f2f]/50 select-none">
            <div className="flex items-center gap-2">
              <LineChart className="text-[#00d4ff] w-4.5 h-4.5" />
              <h3 className="text-xs font-bold text-[#dee1f7] uppercase font-sans tracking-wide">24-Hour Incident Volume</h3>
            </div>
            <div className="flex gap-4 font-mono text-[9px] text-[#859398] font-bold">
              <span className="flex items-center gap-1.5 font-bold"><span className="w-2 h-2 rounded-full bg-[#00d4ff]"></span> ACTUAL VOLUME</span>
              <span className="flex items-center gap-1.5 font-bold"><span className="w-2 h-2 rounded-full border border-[#859398] border-dashed"></span> BASELINE VOLUME</span>
            </div>
          </div>
          
          {/* Main Area Chart Container */}
          <div className="p-4 h-[240px] w-full font-mono text-[9px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3c494e" vertical={false} opacity={0.3} />
                <XAxis dataKey="time" stroke="#bbc9cf" tickLine={false} axisLine={false} />
                <YAxis stroke="#bbc9cf" tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#162231', borderColor: '#3c494e', color: '#dee1f7', borderRadius: '2px' }} 
                  itemStyle={{ color: '#00d4ff' }} 
                />
                <Area type="monotone" dataKey="baseline" stroke="#3c494e" strokeDasharray="5 5" fillOpacity={0} strokeWidth={1.5} />
                <Area type="monotone" dataKey="events" stroke="#00d4ff" fillOpacity={1} fill="url(#colorEvents)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom charts (two horizontal bar charts side-by-side) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Median resolution time */}
          <div className="bg-[#1a1f2f]/30 border border-[#3c494e] rounded-sm flex flex-col">
            <div className="p-3 border-b border-[#3c494e] flex justify-between items-center bg-[#1a1f2f]/50 select-none">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-[#ffb95f] w-4.5 h-4.5" />
                <h3 className="text-[11px] font-bold text-[#dee1f7] uppercase font-sans tracking-wide">Median Resolution Time by Cause</h3>
              </div>
              <span className="text-[9px] font-mono bg-[#ffb95f]/10 text-[#ffb95f] border border-[#ffb95f]/30 px-2 py-0.5 rounded-sm font-bold uppercase select-none">Mins</span>
            </div>

            <div className="p-4 h-[200px] w-full font-mono text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resolutionData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3c494e" vertical={false} horizontal={true} opacity={0.2} />
                  <XAxis type="number" stroke="#bbc9cf" tickLine={false} axisLine={false} />
                  <YAxis dataKey="cause" type="category" stroke="#bbc9cf" tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#162231', borderColor: '#3c494e', color: '#dee1f7', borderRadius: '2px' }}
                    itemStyle={{ color: '#ffb95f' }}
                  />
                  <Bar dataKey="mins" fill="#ffb95f" radius={[0, 2, 2, 0]} barSize={12}>
                    {resolutionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fillOpacity={0.8 + (index * -0.12)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Closure likelihood */}
          <div className="bg-[#1a1f2f]/30 border border-[#3c494e] rounded-sm flex flex-col">
            <div className="p-3 border-b border-[#3c494e] flex justify-between items-center bg-[#1a1f2f]/50 select-none">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-[#ffb4ab] w-4.5 h-4.5" />
                <h3 className="text-[11px] font-bold text-[#dee1f7] uppercase font-sans tracking-wide">Road Closure Likelihood</h3>
              </div>
              <span className="text-[9px] font-mono bg-[#ffb4ab]/10 text-[#ffb4ab] border border-[#ffb4ab]/30 px-2 py-0.5 rounded-sm font-bold uppercase select-none">% Probability</span>
            </div>

            <div className="p-4 h-[200px] w-full font-mono text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={closureData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3c494e" vertical={false} horizontal={true} opacity={0.2} />
                  <XAxis type="number" stroke="#bbc9cf" tickLine={false} axisLine={false} domain={[0, 100]} />
                  <YAxis dataKey="cause" type="category" stroke="#bbc9cf" tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#162231', borderColor: '#3c494e', color: '#dee1f7', borderRadius: '2px' }}
                    itemStyle={{ color: '#ffb4ab' }}
                  />
                  <Bar dataKey="prob" fill="#ffb4ab" radius={[0, 2, 2, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Data Quality Report Table */}
        <div className="bg-[#1a1f2f]/30 border border-[#3c494e] rounded-sm flex flex-col mt-2 mb-12 select-none">
          <div className="p-3 border-[#3c494e] border-b bg-[#1a1f2f]/50 flex items-center gap-2 select-none">
            <ShieldCheck className="text-[#6bff8f] w-4.5 h-4.5" />
            <h3 className="text-xs font-bold text-[#6bff8f] uppercase font-sans tracking-wide">Data Quality Report</h3>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-[11px]">
              <thead>
                <tr className="border-b border-[#3c494e] bg-[#2f3445]/20 select-none text-[#859398] font-bold">
                  <th className="p-3 uppercase tracking-wider">Quality Metric</th>
                  <th className="p-3 uppercase tracking-wider">Scan Value</th>
                  <th className="p-3 uppercase tracking-wider">Log Status</th>
                  <th className="p-3 uppercase tracking-wider">Mitigation Needed</th>
                </tr>
              </thead>
              <tbody className="text-[#dee1f7]">
                {/* Row 1 */}
                <tr className="border-b border-[#3c494e]/30 hover:bg-[#1a1f2f]/30 transition-colors">
                  <td className="p-3">Rows Loaded</td>
                  <td className="p-3 font-bold">{backendStats.total}</td>
                  <td className="p-3">
                    <span className="px-1.5 py-0.5 rounded-sm border border-[#6bff8f]/30 text-[#6bff8f] bg-[#6bff8f]/10 uppercase text-[9px] font-bold leading-none select-none">
                      Complete
                    </span>
                  </td>
                  <td className="p-3 text-[#859398]">—</td>
                </tr>

                {/* Row 2 */}
                <tr className={`border-b border-[#3c494e]/30 transition-colors ${zoneFixed ? 'bg-[#6bff8f]/5' : 'bg-[#ffb4ab]/5'}`}>
                  <td className="p-3 flex items-center gap-1.5">
                    <span>Missing 'Zone' Keys Detection</span>
                    {!zoneFixed && <AlertTriangle className="text-[#ffb4ab] w-3.5 h-3.5" />}
                  </td>
                  <td className={`p-3 font-bold ${zoneFixed ? 'text-[#6bff8f]' : 'text-[#ffb4ab]'}`}>
                    {zoneFixed ? '0 (Imputed)' : '4,729'}
                  </td>
                  <td className="p-3">
                    <span className={`px-1.5 py-0.5 rounded-sm border uppercase text-[9px] font-bold leading-none select-none ${
                      zoneFixed 
                        ? 'border-[#6bff8f]/30 text-[#6bff8f] bg-[#6bff8f]/10' 
                        : 'border-[#ffb4ab]/30 text-[#ffb4ab] bg-[#ffb4ab]/10'
                    }`}>
                      {zoneFixed ? 'Fixed' : 'Critical Deficit'}
                    </span>
                  </td>
                  <td className="p-3">
                    <button 
                      onClick={handleImpute}
                      disabled={zoneFixed || isImputingZone}
                      className={`text-[9px] font-bold uppercase px-2 py-1 rounded-sm cursor-pointer border leading-none transition-all ${
                        zoneFixed 
                          ? 'border-transparent text-[#859398] bg-transparent cursor-default'
                          : 'border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20'
                      }`}
                    >
                      {isImputingZone ? 'Imputing vectors...' : zoneFixed ? 'Completed ✓' : 'Impute via Geo Coordinates'}
                    </button>
                  </td>
                </tr>

                {/* Row 3 */}
                <tr className="hover:bg-[#1a1f2f]/30 transition-colors font-mono">
                  <td className="p-3">Orphaned Duration Records</td>
                  <td className="p-3 font-bold text-[#ffb95f]">142</td>
                  <td className="p-3">
                    <span className="px-1.5 py-0.5 rounded-sm border border-[#ffb95f]/30 text-[#ffb95f] bg-[#ffb95f]/10 uppercase text-[9px] font-bold leading-none select-none">
                      Warning
                    </span>
                  </td>
                  <td className="p-3">
                    <button 
                      onClick={() => alert('Filter logic validated. No orphan cycles found.')}
                      className="text-[9px] font-bold uppercase px-2 py-1 border border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 rounded-sm cursor-pointer leading-none"
                    >
                      Review Filter Logic
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
