import React, { useState, useEffect } from 'react';

export const Footer: React.FC = () => {
  const [systemTime, setSystemTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      // Format to matching: 14:32:05 UTC
      const timeStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
      setSystemTime(timeStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="bg-[#090e1c] fixed bottom-0 right-0 left-0 h-8 border-t border-[#3c494e] flex justify-between items-center px-4 w-full z-50 md:ml-[240px] md:w-[calc(100%-240px)] select-none font-mono shrink-0">
      {/* System Status Metrics */}
      <div className="text-[9px] font-mono text-[#859398] select-text">
        WS: Connected | System Time: {systemTime || '14:32:05 UTC'}
      </div>

      {/* Latency and Status Info badge */}
      <div className="flex gap-4 font-mono text-[9px] text-[#859398] font-bold">
        <span className="flex items-center gap-1.5 hover:text-[#dee1f7] transition-all cursor-default group leading-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6bff8f] shadow-[0_0_8px_rgba(107,255,143,0.8)] animate-pulse"></span>
          Status: Nominal
        </span>
        <span className="flex items-center gap-1.5 hover:text-[#dee1f7] transition-all cursor-default leading-none">
          Latency: 24ms
        </span>
      </div>
    </footer>
  );
};
