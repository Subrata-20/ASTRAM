import React from 'react';
import { Bell, Settings, Search, Menu, Radio } from 'lucide-react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  searchValue: string;
  setSearchValue: (val: string) => void;
  onMobileMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  searchValue,
  setSearchValue,
  onMobileMenuToggle
}) => {
  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Bengaluru Traffic Command';
      case 'report':
        return 'Incident Reporting Module';
      case 'results':
        return 'Incident Impact Analysis';
      case 'analytics':
        return 'Bengaluru Traffic Event Analytics';
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'analytics':
        return 'Search analytics...';
      case 'dashboard':
        return 'Search events...';
      default:
        return 'Search...';
    }
  };

  return (
    <header className="flex justify-between items-center w-full px-4 h-14 border-b border-[#3c494e] bg-[#161b2b] sticky top-0 z-30 shrink-0">
      {/* Search/Context display */}
      <div className="flex items-center gap-4">
        {/* Mobile Navbar Elements */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={onMobileMenuToggle}
            className="text-[#a8e8ff] hover:text-white transition-all cursor-pointer"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-1">
            <Radio className="text-[#00d4ff] w-4 h-4" />
            <span className="font-bold text-[#a8e8ff] text-base select-none leading-none tracking-tight">ASTRAM</span>
          </div>
        </div>

        {/* Desktop View Tab Title Context */}
        <div className="hidden md:flex items-center gap-4">
          <span className="text-lg font-bold text-[#dee1f7] tracking-tight">{getTitle()}</span>
          {activeTab === 'dashboard' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#090e1c] rounded border border-[#3c494e]">
              <div className="w-2 h-2 rounded-full bg-[#6bff8f] animate-pulse"></div>
              <span className="text-[10px] font-bold font-mono text-[#6bff8f]">LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-3">
        {/* Search bar widget */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#859398] w-4 h-4" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="bg-[#050811] border border-[#3c494e] rounded px-3 py-1 pl-9 text-xs font-mono text-[#dee1f7] focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] focus:outline-none w-48 transition-colors placeholder:text-[#859398]"
            placeholder={getSearchPlaceholder()}
          />
        </div>

        {/* Notifications Icon with indicator */}
        <button className="text-[#bbc9cf] hover:text-[#dee1f7] hover:bg-[#2f3445] transition-colors p-1.5 rounded-full relative cursor-pointer">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#ffb4ab] border border-[#161b2b]"></span>
        </button>

        {/* Settings Button */}
        <button className="text-[#bbc9cf] hover:text-[#dee1f7] hover:bg-[#2f3445] transition-colors p-1.5 rounded-full cursor-pointer">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
