/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppStateProvider, useAppState } from './AppContext';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { PaddleHubsLogo } from './components/PaddleHubsLogo';
import { DashboardView } from './components/DashboardView';
import { LeaderboardView } from './components/LeaderboardView';
import { PlayerRankingsView } from './components/PlayerRankingsView';
import { PlayerPerformanceView } from './components/PlayerPerformanceView';
import { ClubChatView } from './components/ClubChatView';
import { VideoLibraryView } from './components/VideoLibraryView';
import { ClubExpensesView } from './components/ClubExpensesView';
import { MarketplaceView } from './components/MarketplaceView';
import { PlayerDirectoryView } from './components/PlayerDirectoryView';
import { NeedASubView } from './components/NeedASubView';
import { LiveMatchesView } from './components/LiveMatchesView';
import { PairingWheelView } from './components/PairingWheelView';
import { NotificationBell } from './components/NotificationBell';
import { TournamentsView } from './components/TournamentsView';
import { TournamentDetailsView } from './components/TournamentDetailsView';
import { ScheduleView } from './components/ScheduleView';
import { TeamHubView } from './components/TeamHubView';
import { ProfileView } from './components/ProfileView';
import { AdminPortalView } from './components/AdminPortalView';
import { RegistrationView } from './components/RegistrationView';
import { RegisteredUsersView } from './components/RegisteredUsersView';
import { BookingsView } from './components/BookingsView';
import { AnalyticsView } from './components/AnalyticsView';
import { ShieldCheck, Calendar, Menu, Sun, Moon } from 'lucide-react';

const MainLayout: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { currentView, activeTeamId, activeTournamentId, activePlayerId, navigateTo, theme, toggleTheme, isAuthenticated, api } = useAppState();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check for register URL parameter on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const regId = params.get('register');
    const captainTournamentId = params.get('captainToken') ? params.get('tournamentId') : null;
    if (regId) {
      navigateTo('register-bracket', regId);
      const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.pushState({ path: newurl }, '', newurl);
    } else if (captainTournamentId) {
      // Captain auction links keep their query string (AuctionRoom reads
      // captainToken directly from the URL) — just route to the right
      // tournament; the captain clicks the Player Auction tab from there.
      navigateTo('tournament-hub', captainTournamentId);
    }
  }, []);

  // Determine top header breadcrumb title
  const getHeaderBreadcrumb = () => {
    switch (currentView) {
      case 'dashboard':
        return 'Dashboard';
      case 'leaderboard':
        return 'Leaderboard Standings';
      case 'player-rankings':
        return 'Overall Player Rankings';
      case 'player-performance':
        return 'Player Performance & Analysis';
      case 'club-chat':
        return 'Club Chat';
      case 'video-library':
        return 'Virtual AI Coach';
      case 'club-expenses':
        return 'Split Costs';
      case 'marketplace':
        return 'Paddle Marketplace';
      case 'player-directory':
        return 'Player Directory';
      case 'need-a-sub':
        return 'Need a Sub';
      case 'live-matches':
        return 'Live Matches';
      case 'pairing-wheel':
        return 'Pairing Wheel';
      case 'tournaments':
        return 'Brackets Directory';
      case 'tournament-hub':
        return 'Tournament Details';
      case 'schedule':
        return 'Schedule & Fixtures';
      case 'team-hub':
        return 'Team Hub Board';
      case 'profile':
        return 'Player Profile';
      case 'admin':
        return 'Admin Operations';
      case 'register-bracket':
        return 'Tournament Registration';
      case 'registered-users':
        return 'Registered Users';
      case 'bookings':
        return 'Court Bookings';
      case 'analytics':
        return 'Site Analytics';
      case 'playoffs':
        return 'Playoff Bracket';
      case 'auction':
        return 'Player Auction';
      default:
        return 'PaddleHubs';
    }
  };

  const isViewRestricted = (view: string) => {
    const publicViews = ['dashboard', 'leaderboard', 'tournaments', 'tournament-hub', 'schedule', 'register-bracket', 'player-directory', 'live-matches'];
    if (view === 'profile' && activePlayerId) {
      return false;
    }
    return !publicViews.includes(view);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-off-white dark:bg-[#0B1220] text-charcoal dark:text-slate-100 overflow-hidden font-sans">
      {/* Navigation Drawer (Sidebar) */}
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onLogout={onLogout}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="hidden lg:flex items-center justify-between px-8 h-20 border-b border-light-border dark:border-slate-800 bg-white dark:bg-[#0E1726] shrink-0">
          <div className="flex items-center gap-3">
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity flex items-center"
              onClick={() => navigateTo('dashboard')}
              title="Go to Dashboard"
            >
              <PaddleHubsLogo size={28} showText={true} textColorClass="text-charcoal dark:text-white text-base" isDarkBackground={theme === 'dark'} />
            </div>
            <span className="text-light-border dark:text-slate-700 font-mono text-xs">//</span>
            <span className="text-xs font-black font-mono text-court-green uppercase tracking-wider">
              {getHeaderBreadcrumb()}
            </span>
          </div>

          <div className="flex items-center gap-6">
            {/* Live Security Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-off-white dark:bg-slate-900/50 border border-light-border dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-court-green" />
              <span className="text-[10px] text-slate-gray dark:text-slate-400 font-bold font-mono tracking-wider">COGNITO SECURED</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-gray hover:text-charcoal dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-off-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4.5 h-4.5 text-amber-400" />
              ) : (
                <Moon className="w-4.5 h-4.5 text-indigo-400" />
              )}
            </button>

            {/* Notifications */}
            <NotificationBell api={api} isAuthenticated={isAuthenticated} navigateTo={navigateTo} />
          </div>
        </header>

        {/* Dynamic Scrolling Container */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:p-8 space-y-6 bg-off-white dark:bg-[#0B1220]">
          {!isAuthenticated && isViewRestricted(currentView) ? (
            <div className="max-w-md mx-auto py-8">
              <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl p-6 shadow-md space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-court-green/10 flex items-center justify-center mx-auto text-court-green">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-charcoal dark:text-white">Authentication Required</h3>
                  <p className="text-xs text-slate-gray mt-1 leading-relaxed">
                    Please sign in or create an account to view and participate in this feature.
                  </p>
                </div>
              </div>
              <div className="mt-6">
                <LoginView onLogin={() => {}} />
              </div>
            </div>
          ) : (
            <>
              {currentView === 'dashboard' && <DashboardView />}
              {currentView === 'leaderboard' && <LeaderboardView />}
              {currentView === 'player-rankings' && <PlayerRankingsView />}
              {currentView === 'player-performance' && <PlayerPerformanceView />}
              {currentView === 'club-chat' && <ClubChatView />}
              {currentView === 'video-library' && <VideoLibraryView />}
              {currentView === 'club-expenses' && <ClubExpensesView />}
              {currentView === 'marketplace' && <MarketplaceView />}
              {currentView === 'player-directory' && <PlayerDirectoryView />}
              {currentView === 'need-a-sub' && <NeedASubView />}
              {currentView === 'live-matches' && <LiveMatchesView />}
              {currentView === 'pairing-wheel' && <PairingWheelView />}
              {currentView === 'tournaments' && <TournamentsView />}
              {currentView === 'tournament-hub' && <TournamentDetailsView />}
              {currentView === 'schedule' && <ScheduleView />}
              {currentView === 'team-hub' && <TeamHubView />}
              {currentView === 'profile' && <ProfileView />}
              {currentView === 'admin' && <AdminPortalView />}
              {currentView === 'register-bracket' && <RegistrationView />}
              {currentView === 'registered-users' && <RegisteredUsersView />}
              {currentView === 'bookings' && <BookingsView />}
              {currentView === 'analytics' && <AnalyticsView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

function AppContent() {
  const { isLoading, logoutUser } = useAppState();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-off-white dark:bg-[#070C15] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-court-green/10 dark:bg-court-green/20 flex items-center justify-center border border-court-green/20">
            <svg className="animate-spin h-6 w-6 text-court-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-widest font-mono text-slate-900 dark:text-white">Connecting to PaddleHubs Cloud...</h3>
            <p className="text-[10px] text-slate-gray dark:text-slate-400 mt-1 font-mono">Synchronizing match statistics and active registrations.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MainLayout onLogout={logoutUser} />
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}
