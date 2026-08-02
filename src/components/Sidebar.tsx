/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppState, ActiveView } from '../AppContext';
import { PaddleHubsLogo } from './PaddleHubsLogo';
import {
  LayoutDashboard,
  Trophy,
  Award,
  CalendarDays,
  User,
  ShieldCheck,
  Calendar,
  LogOut,
  Sparkles,
  Users,
  Activity,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
}

import { defaultAvatar } from '../utils/avatar';

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, onLogout }) => {
  const { currentView, navigateTo, currentUser, isAdmin, theme, toggleTheme, colorTheme, setColorTheme, isAuthenticated } = useAppState();

  const menuItems = [
    { id: 'dashboard' as ActiveView, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leaderboard' as ActiveView, label: 'Leaderboard', icon: Trophy },
    { id: 'player-rankings' as ActiveView, label: 'Player Rankings', icon: Award },
    { id: 'player-performance' as ActiveView, label: 'Performance Lab', icon: Activity },
    { id: 'tournaments' as ActiveView, label: 'Tournaments', icon: Activity },
    { id: 'schedule' as ActiveView, label: 'Schedule', icon: CalendarDays },
    { id: 'bookings' as ActiveView, label: 'Court Bookings', icon: Calendar },
    { id: 'profile' as ActiveView, label: 'My Profile', icon: User },
  ];

  // Real admin gating now — driven by Cognito's "admins" group, not a
  // hardcoded email or a client-side toggle.
  if (isAdmin) {
    menuItems.push({ id: 'admin' as ActiveView, label: 'Admin Portal', icon: ShieldCheck });
    menuItems.push({ id: 'registered-users' as ActiveView, label: 'Registered Users', icon: Users });
    menuItems.push({ id: 'analytics' as ActiveView, label: 'Site Analytics', icon: Activity });
  }

  const handleNav = (view: ActiveView) => {
    navigateTo(view);
    setIsOpen(false); // Close sidebar on mobile
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden h-16 bg-deep-navy border-b border-deep-navy/60 px-4 flex items-center justify-between sticky top-0 z-50">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
          id="mobile-logo-container"
          onClick={() => handleNav('dashboard')}
          title="Go to Dashboard"
        >
          <PaddleHubsLogo size={32} showText={true} textColorClass="text-white text-base" />
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-gray hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-400" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-slate-gray hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            id="mobile-menu-btn"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-deep-navy border-r border-deep-navy/60 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:h-screen ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="sidebar-navigation"
      >
        {/* Logo / Header (Desktop) */}
        <div 
          className="hidden lg:flex items-center gap-3 px-5 h-20 border-b border-deep-navy/60 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => handleNav('dashboard')}
          title="Go to Dashboard"
        >
          <PaddleHubsLogo size={36} showText={true} textColorClass="text-white text-lg" />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <p className="text-[10px] font-bold text-slate-gray tracking-widest px-3 mb-3 font-mono uppercase">NAVIGATION</p>
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id || 
              (item.id === 'tournaments' && currentView === 'tournament-hub') ||
              (item.id === 'profile' && currentView === 'profile' && !currentUser); // handle general profile
            
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-court-green text-white shadow-md'
                    : 'text-slate-gray hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-gray group-hover:text-slate-200'}`} />
                <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                {item.id === 'admin' && (
                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${isActive ? 'bg-deep-navy/40 text-white' : 'bg-court-green/10 text-court-green border border-court-green/20'}`}>
                    SYS
                  </span>
                )}
                {item.id === 'registered-users' && (
                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${isActive ? 'bg-deep-navy/40 text-white' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                    OWNER
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Dark Mode Switcher */}
        <div className="px-4 mb-3 shrink-0">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs font-bold text-slate-gray hover:text-white group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-400 group-hover:-rotate-12 transition-transform duration-300" />
              )}
              <span className="uppercase tracking-wider">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase text-slate-gray px-1.5 py-0.5 rounded bg-deep-navy/40">
              {theme === 'dark' ? 'DARK' : 'LIGHT'}
            </span>
          </button>
        </div>

        {/* Visual Theme Picker */}
        <div className="px-4 mb-3 shrink-0 space-y-1.5">
          <span className="text-[9px] font-bold text-slate-gray tracking-widest px-1 font-mono uppercase block">Theme</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'courtEnergy' as const, label: 'Court', a: '#1E7A4C', b: '#F2B705' },
                { id: 'editorial' as const, label: 'Editorial', a: '#7A2E2E', b: '#B8892B' },
                { id: 'clay' as const, label: 'Clay', a: '#C1502E', b: '#2D9C8F' },
              ]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setColorTheme(t.id)}
                title={t.label}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-all cursor-pointer ${
                  colorTheme === t.id ? 'border-white/40 bg-white/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <span className="flex -space-x-1">
                  <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: t.a }} />
                  <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: t.b }} />
                </span>
                <span className={`text-[8px] font-mono font-bold uppercase ${colorTheme === t.id ? 'text-white' : 'text-slate-gray'}`}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User Session Info / Cognito Integration */}
        <div className="p-4 border-t border-deep-navy/60 bg-deep-navy/40 mt-auto flex flex-col gap-3">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={currentUser?.avatarDataUrl || defaultAvatar(currentUser?.displayName || 'Player')}
                    alt="User Profile"
                    className="w-10 h-10 rounded-xl object-cover border border-white/10 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-deep-navy ${
                    isAdmin ? 'bg-error-red' : 'bg-court-green'
                  }`} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-xs text-white truncate leading-tight">
                    {currentUser?.displayName || 'Player'}
                  </span>
                  <span className="text-[10px] text-slate-gray truncate mt-0.5 leading-none">
                    {currentUser?.email}
                  </span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="w-full py-2 px-3 rounded-lg bg-deep-navy border border-white/10 text-xs text-slate-gray hover:text-white hover:bg-white/5 hover:border-white/20 transition-all flex items-center justify-center gap-2 font-bold uppercase tracking-wider font-mono group cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-gray group-hover:text-error-red group-hover:translate-x-0.5 transition-transform" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] text-slate-gray leading-normal text-center">
                Sign in to register for brackets, join teams, and customize your profile.
              </p>
              <button
                onClick={() => handleNav('profile')}
                className="w-full py-2.5 px-3 rounded-xl bg-court-green text-white text-xs hover:bg-court-green/90 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-wider font-mono shadow-md cursor-pointer"
              >
                <span>Sign In / Register</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}
    </>
  );
};
