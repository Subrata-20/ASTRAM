import React from 'react';
import { LayoutDashboard, FileEdit, TrendingUp, BarChart3, Radio } from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="fixed h-full left-0 top-0 w-[240px] border-r border-[#3c494e] bg-[#090e1c] flex flex-col z-40 hidden md:flex">
        {/* Brand Header */}
        <div className="p-4 border-b border-[#3c494e] flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#00d4ff]/10 flex items-center justify-center border border-[#00d4ff]/50 animate-pulse">
            <Radio className="text-[#a8e8ff] w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-[#a8e8ff] tracking-tight leading-none uppercase">ASTRAM</div>
            <div className="text-[10px] font-mono text-[#859398] tracking-[0.2em] font-bold">INTELLIGENCE</div>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 py-4 flex flex-col gap-1 px-2">
          {/* Dashboard Item */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-left cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-[#a8e8ff] border-l-[3px] border-[#00d4ff] bg-[#161b2b] shadow-[inset_4px_0_0_0_rgba(0,119,182,0.1)]'
                : 'text-[#bbc9cf] hover:bg-[#1a1f2f] hover:text-[#dee1f7]'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-sm font-medium">Dashboard</span>
          </button>

          {/* Report Item */}
          <button
            onClick={() => setActiveTab('report')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-left cursor-pointer ${
              activeTab === 'report'
                ? 'text-[#a8e8ff] border-l-[3px] border-[#00d4ff] bg-[#161b2b] shadow-[inset_4px_0_0_0_rgba(0,119,182,0.1)]'
                : 'text-[#bbc9cf] hover:bg-[#1a1f2f] hover:text-[#dee1f7]'
            }`}
          >
            <FileEdit className="w-5 h-5" />
            <span className="text-sm font-medium">Report Incident</span>
          </button>

          {/* Results Item */}
          <button
            onClick={() => setActiveTab('results')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-left cursor-pointer ${
              activeTab === 'results'
                ? 'text-[#a8e8ff] border-l-[3px] border-[#00d4ff] bg-[#161b2b] shadow-[inset_4px_0_0_0_rgba(0,119,182,0.1)]'
                : 'text-[#bbc9cf] hover:bg-[#1a1f2f] hover:text-[#dee1f7]'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Incident Results</span>
          </button>

          {/* Analytics Item */}
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-left cursor-pointer ${
              activeTab === 'analytics'
                ? 'text-[#a8e8ff] border-l-[3px] border-[#00d4ff] bg-[#161b2b] shadow-[inset_4px_0_0_0_rgba(0,119,182,0.1)]'
                : 'text-[#bbc9cf] hover:bg-[#1a1f2f] hover:text-[#dee1f7]'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-sm font-medium">Analytics</span>
          </button>
        </div>

        {/* System Online Badge */}
        <div className="p-4 border-t border-[#3c494e] mt-auto">
          <div className="flex items-center gap-2 text-xs font-mono text-[#859398]">
            <span className="w-2 h-2 rounded-full bg-[#6bff8f] shadow-[0_0_8px_rgba(107,255,143,0.6)] animate-pulse"></span>
            SYSTEM ONLINE
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Dock */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#090e1c] border-t border-[#3c494e] flex justify-around py-1.5 px-2 z-40">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center py-1 px-3 rounded-md transition-all cursor-pointer ${
            activeTab === 'dashboard' ? 'text-[#a8e8ff]' : 'text-[#bbc9cf]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`flex flex-col items-center py-1 px-3 rounded-md transition-all cursor-pointer ${
            activeTab === 'report' ? 'text-[#a8e8ff]' : 'text-[#bbc9cf]'
          }`}
        >
          <FileEdit className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">Report</span>
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`flex flex-col items-center py-1 px-3 rounded-md transition-all cursor-pointer ${
            activeTab === 'results' ? 'text-[#a8e8ff]' : 'text-[#bbc9cf]'
          }`}
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">Results</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center py-1 px-3 rounded-md transition-all cursor-pointer ${
            activeTab === 'analytics' ? 'text-[#a8e8ff]' : 'text-[#bbc9cf]'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">Analytics</span>
        </button>
      </div>
    </>
  );
};
