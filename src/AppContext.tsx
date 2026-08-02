/**
 * Phase 1 rewrite: same navigation/UI shell as the original zip, but the
 * data layer now talks to the real live backend (Cognito + API Gateway +
 * Lambda + DynamoDB) instead of Firestore.
 *
 * NOTE (Phase 2 TODO): the view components (DashboardView, LeaderboardView,
 * TournamentsView, etc.) were built against the old Firestore demo's data
 * shapes (Player/Team/DoublesPair with client-recalculated stats). They'll
 * need updating to consume the real shapes below (Me, Tournament, TeamStandingRow,
 * PlayerRankingRow, ClubMatch, Booking, Auction, Playoffs) — this file only
 * establishes the real data layer and exposes everything the real API offers.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from './auth';
import * as api from './api';
import type {
  Me,
  Tournament,
  TournamentMatch,
  TournamentSchedule,
  TournamentRegistration,
  TeamStandingRow,
  PlayerRankingRow,
  ClubMatch,
  Booking,
  Auction,
  Playoffs,
  RegisteredUser,
  SiteAnalytics,
} from './types';

export type ColorTheme = 'courtEnergy' | 'editorial' | 'clay';

export type ActiveView =
  | 'dashboard'
  | 'leaderboard'
  | 'player-rankings'
  | 'player-performance'
  | 'tournaments'
  | 'schedule'
  | 'profile'
  | 'admin'
  | 'team-hub'
  | 'tournament-hub'
  | 'register-bracket'
  | 'registered-users'
  | 'bookings'
  | 'analytics'
  | 'playoffs'
  | 'auction';

interface AppContextType {
  // Auth
  currentUser: Me | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: () => void;
  signUp: () => void;
  forgotPassword: () => void;
  logout: () => void;
  updateProfile: (updates: Partial<Me>) => Promise<void>;

  // Navigation
  currentView: ActiveView;
  navigateTo: (view: ActiveView, id?: string) => void;
  navigateBack: () => void;
  canNavigateBack: boolean;
  activeTournamentId: string | null;
  activeTeamId: string | null;
  activePlayerId: string | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  colorTheme: ColorTheme;
  setColorTheme: (t: ColorTheme) => void;
  logoutUser: () => void;

  // Club-wide data
  tournaments: Tournament[];
  refreshTournaments: () => Promise<void>;
  clubMatches: ClubMatch[];
  refreshClubMatches: () => Promise<void>;
  clubBookings: Booking[];
  refreshClubBookings: () => Promise<void>;
  playerRankings: PlayerRankingRow[];
  refreshPlayerRankings: () => Promise<void>;

  // Loading
  isLoading: boolean;

  // Tournament detail (lazy-loaded per tournament id)
  loadTournament: (id: string) => Promise<Tournament>;
  loadTeamStandings: (id: string) => Promise<TeamStandingRow[]>;
  loadTournamentMatches: (id: string) => Promise<TournamentMatch[]>;
  loadTournamentSchedule: (id: string) => Promise<TournamentSchedule>;
  loadRegistrations: (id: string) => Promise<TournamentRegistration[]>;

  // Admin-only
  loadRegisteredUsers: () => Promise<{ count: number; onlineCount: number; users: RegisteredUser[] }>;
  loadSiteAnalytics: (days?: number) => Promise<SiteAnalytics>;

  // Re-export the raw API + auth modules for actions not yet wired into
  // context state (bookings CRUD, tournament matches CRUD, auction,
  // playoffs, etc.) so Phase 2 screens can call them directly.
  api: typeof api;
  auth: typeof authApi;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Me | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentView, setCurrentView] = useState<ActiveView>('dashboard');
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [history, setHistory] = useState<{
    view: ActiveView;
    tournamentId: string | null;
    teamId: string | null;
    playerId: string | null;
  }[]>([]);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [clubMatches, setClubMatches] = useState<ClubMatch[]>([]);
  const [clubBookings, setClubBookings] = useState<Booking[]>([]);
  const [playerRankings, setPlayerRankings] = useState<PlayerRankingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ph_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  // The visual "skin" — separate from light/dark mode. Only the accent
  // colors and display font change between these; backgrounds/text
  // still follow light/dark independently, so any theme works in
  // either mode without a combinatorial mess of special cases.
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem('ph_color_theme');
    return saved === 'editorial' || saved === 'clay' || saved === 'courtEnergy' ? saved : 'courtEnergy';
  });

  useEffect(() => {
    localStorage.setItem('ph_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ph_color_theme', colorTheme);
    document.documentElement.classList.remove('theme-editorial', 'theme-clay');
    if (colorTheme === 'editorial') document.documentElement.classList.add('theme-editorial');
    else if (colorTheme === 'clay') document.documentElement.classList.add('theme-clay');
  }, [colorTheme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  const setColorTheme = (t: ColorTheme) => setColorThemeState(t);

  // ---------- Auth bootstrap ----------
  const refreshCurrentUser = useCallback(async () => {
    const session = await authApi.getCurrentSession();
    if (!session) {
      setCurrentUser(null);
      setIsAdmin(false);
      return;
    }
    setIsAdmin(session.isAdmin);
    try {
      const me = await api.getMe();
      setCurrentUser(me);
    } catch (e) {
      console.error('Failed to load profile:', e);
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      if (window.location.pathname === '/auth/callback') {
        await authApi.handleAuthCallback();
        // Clean the ?code=... off the URL without a full reload.
        window.history.replaceState({}, '', '/');
      }
      await refreshCurrentUser();
      setAuthLoading(false);
    })();
  }, [refreshCurrentUser]);

  // These redirect the whole browser to Cognito's Hosted UI — there's no
  // session to await here, the app picks back up at /auth/callback.
  const login = useCallback(() => authApi.signIn(), []);
  const signUp = useCallback(() => authApi.signUp(), []);
  const forgotPassword = useCallback(() => authApi.forgotPassword(), []);

  const logout = useCallback(() => {
    authApi.signOut();
    setCurrentUser(null);
    setIsAdmin(false);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Me>) => {
    await api.updateMe(updates);
    const me = await api.getMe();
    setCurrentUser(me);
  }, []);

  // ---------- Club-wide data loaders ----------
  const refreshTournaments = useCallback(async () => {
    const { items } = await api.listTournaments();
    setTournaments(items);
  }, []);

  const refreshClubMatches = useCallback(async () => {
    const { items } = await api.listClubMatches();
    setClubMatches(items);
  }, []);

  const refreshClubBookings = useCallback(async () => {
    const { items } = await api.listClubBookings();
    setClubBookings(items);
  }, []);

  const refreshPlayerRankings = useCallback(async () => {
    const { standings } = await api.getPlayerRankings();
    setPlayerRankings(standings);
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        // /tournaments requires a JWT — guests get the public, read-only
        // completed-tournaments list instead. Once logged in, the effect
        // below upgrades this to the full authenticated list.
        const { items } = await api.listCompletedTournamentsPublic();
        setTournaments(items as Tournament[]);
        await refreshPlayerRankings();
      } catch (e) {
        console.error('Failed to load initial data:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshPlayerRankings]);

  useEffect(() => {
    if (!currentUser) return;
    refreshTournaments().catch((e) => console.error(e));
    refreshClubMatches().catch((e) => console.error(e));
    refreshClubBookings().catch((e) => console.error(e));
  }, [currentUser, refreshTournaments, refreshClubMatches, refreshClubBookings]);

  // ---------- Tournament-detail lazy loaders (no global caching — callers
  // decide when to refetch, since these can be large and per-view) ----------
  const loadTournament = useCallback((id: string) => api.getTournament(id), []);
  const loadTeamStandings = useCallback(
    (id: string) => api.getTeamStandings(id).then((r) => r.standings),
    []
  );
  const loadTournamentMatches = useCallback(
    (id: string) => api.listTournamentMatches(id).then((r) => r.items),
    []
  );
  const loadTournamentSchedule = useCallback((id: string) => api.getTournamentSchedule(id), []);
  const loadRegistrations = useCallback(
    (id: string) => api.listRegistrations(id).then((r) => r.items),
    []
  );

  // ---------- Admin-only loaders ----------
  const loadRegisteredUsers = useCallback(() => api.getRegisteredUsers(), []);
  const loadSiteAnalytics = useCallback((days?: number) => api.getSiteAnalytics(days), []);

  // ---------- Navigation ----------
  const navigateTo = (view: ActiveView, id?: string) => {
    setHistory((h) => [
      ...h,
      { view: currentView, tournamentId: activeTournamentId, teamId: activeTeamId, playerId: activePlayerId },
    ]);
    setCurrentView(view);
    if (id !== undefined) {
      if (view === 'team-hub') setActiveTeamId(id);
      else if (view === 'profile') setActivePlayerId(id);
      else setActiveTournamentId(id);
    }
  };

  const navigateBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setCurrentView(prev.view);
      setActiveTournamentId(prev.tournamentId);
      setActiveTeamId(prev.teamId);
      setActivePlayerId(prev.playerId);
      return h.slice(0, -1);
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAdmin,
        isAuthenticated: !!currentUser,
        authLoading,
        login,
        signUp,
        forgotPassword,
        logout,
        updateProfile,

        currentView,
        navigateTo,
        navigateBack,
        canNavigateBack: history.length > 0,
        activeTournamentId,
        activeTeamId,
        activePlayerId,
        theme,
        toggleTheme,
        colorTheme,
        setColorTheme,
        logoutUser: logout,

        tournaments,
        refreshTournaments,
        clubMatches,
        refreshClubMatches,
        clubBookings,
        refreshClubBookings,
        playerRankings,
        refreshPlayerRankings,

        isLoading,

        loadTournament,
        loadTeamStandings,
        loadTournamentMatches,
        loadTournamentSchedule,
        loadRegistrations,

        loadRegisteredUsers,
        loadSiteAnalytics,

        api,
        auth: authApi,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
