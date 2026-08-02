/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppState } from '../AppContext';
import { NetDivider } from './NetDivider';
import type { TeamStandingRow, Tournament, TournamentTeam } from '../types';
import {
  Trophy,
  Calendar,
  Activity,
  ArrowRight,
  UserPlus,
  Tv,
  CheckCircle2,
  TrendingUp,
  Award,
  Flame,
  Zap,
  Target,
  Users
} from 'lucide-react';

const norm = (s: string) => (s || '').trim().toLowerCase();

export const DashboardView: React.FC = () => {
  const {
    tournaments,
    clubMatches,
    clubBookings,
    playerRankings,
    currentUser,
    navigateTo,
    isAuthenticated,
    api,
    refreshPlayerRankings,
  } = useAppState();

  // Same reasoning as ProfileView — refetch on open rather than trusting
  // the app-load-time cache, so recently recorded matches show up here
  // without requiring a full reload.
  useEffect(() => { refreshPlayerRankings(); }, []);

  const isGuest = !isAuthenticated;

  // Match by email — the real identity key — not name, so this doesn't
  // collide with anyone else sharing the same display name.
  const playerRow = currentUser
    ? playerRankings.find((p) => (p.email ? norm(p.email) === norm(currentUser.email) : norm(p.player) === norm(currentUser.displayName)))
    : undefined;

  // Find the tournament + team this player is rostered on, if any.
  let playerTeam: TournamentTeam | null = null;
  let playerTournament: Tournament | null = null;
  if (currentUser) {
    for (const t of tournaments) {
      const team = (t.teams || []).find((tm) =>
        tm.players.some((p) => (p.email ? norm(p.email) === norm(currentUser.email) : norm(p.name) === norm(currentUser.displayName)))
      );
      if (team) {
        playerTeam = team;
        playerTournament = t;
        break;
      }
    }
  }

  // One targeted fetch for the real W/L/points on that specific team,
  // rather than pulling standings for every tournament up front.
  const [teamStanding, setTeamStanding] = useState<TeamStandingRow | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!playerTournament || !playerTeam) {
      setTeamStanding(null);
      return;
    }
    api.getTeamStandings(playerTournament.id).then((r) => {
      if (cancelled) return;
      setTeamStanding(r.standings.find((s) => s.teamId === playerTeam!.id) || null);
    }).catch(() => setTeamStanding(null));
    return () => { cancelled = true; };
  }, [playerTournament?.id, playerTeam?.id]);

  const today = new Date().toISOString().slice(0, 10);
  const activeTournaments = isGuest
    ? tournaments.slice(0, 4)
    : tournaments.filter((t) => !t.endDate || t.endDate >= today).slice(0, 4);

  // Recent Results now surfaces club-wide informal matches (the backend's
  // readily-available "recent completed matches" feed) rather than a
  // cross-tournament fixture feed, which the real API doesn't expose as a
  // single lightweight endpoint — per-tournament match history lives on
  // the Tournament Details screen.
  const recentResults = (isGuest ? [] : clubMatches).slice(0, 3);

  // "Your Next Matches" now shows the player's own upcoming court
  // bookings — the closest real equivalent to a scheduled fixture.
  const upcomingBookings = (isGuest ? [] : clubBookings)
    .filter((b) => b.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);

  const totalTeams = tournaments.reduce((sum, t) => sum + (t.teams?.length || 0), 0);
  const totalGamesLogged = Math.round(playerRankings.reduce((s, p) => s + p.played, 0) / 2);

  const winRate = playerRow && playerRow.played > 0 ? Math.round((playerRow.wins / playerRow.played) * 100) : 0;

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-deep-navy border border-deep-navy/80 p-6 sm:p-8 shadow-md court-texture">
        {/* Subtle decorative athletic elements, avoiding generic blurs */}
        <div className="absolute top-0 right-0 w-64 h-full bg-court-green/10 transform skew-x-12 origin-top-right"></div>
        <div className="absolute -bottom-8 left-12 w-48 h-12 bg-soft-gold/5 transform -rotate-12"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-court-green/25 to-court-green/10 border border-court-green/30 text-[10px] font-mono font-black text-court-green uppercase tracking-wider shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-soft-gold animate-live-pulse" />
              <span>{isGuest ? 'PADDLEHUBS COMMUNITY PORTAL' : 'VERIFIED ATHLETE PORTAL'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white uppercase">
              {isGuest ? (
                <>Welcome to <span className="text-court-gradient font-black">PaddleHubs</span></>
              ) : (
                <>Welcome back, <span className="text-court-gradient font-black">{currentUser?.displayName}</span></>
              )}
            </h1>
            <NetDivider className="max-w-[140px]" />
            <p className="text-slate-gray text-xs sm:text-sm max-w-lg leading-relaxed">
              {isGuest 
                ? 'Join local racket sports brackets, build registered doubles teams, and track real-time court schedules.'
                : 'Track your tournament brackets, matching schedule, and live leaderboard statistics.'
              }
            </p>
          </div>

          <div className="flex gap-4 sm:border-l border-white/10 sm:pl-8">
            <div className="text-center sm:text-left">
              <span className="text-[10px] text-slate-gray font-black font-mono tracking-widest block uppercase">
                {isGuest ? 'TOTAL ATHLETES' : 'DUPR RATING'}
              </span>
              <span className="text-3xl font-display font-black text-court-green tracking-tight">
                {isGuest ? playerRankings.length : (currentUser?.duprRating != null ? currentUser.duprRating.toFixed(2) : '—')}
              </span>
            </div>
            <div className="text-center sm:text-left pl-4 border-l border-white/10">
              <span className="text-[10px] text-slate-gray font-black font-mono tracking-widest block uppercase">
                {isGuest ? 'ACTIVE BRACKETS' : 'CURRENT SEED'}
              </span>
              <span className="text-3xl font-display font-black text-soft-gold tracking-tight">
                {isGuest ? tournaments.length : (playerRow ? `#${playerRow.rank}` : '—')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="stats-summary-grid">
        {isGuest ? (
          <>
            {/* Total Athletes */}
            <div className="relative bg-gradient-to-br from-white via-[#EEFBF3] to-[#D1FAE5] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#0D2418] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-court-green/40 dark:hover:border-court-green/60 transition-all duration-300 overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-court-green/5 dark:bg-court-green/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-2xl z-20"></div>
              <div className="space-y-1 relative z-10 pl-2.5">
                <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
                  TOTAL ATHLETES
                </span>
                <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
                  {playerRankings.length}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-court-green/15 to-court-green/5 dark:from-court-green/25 dark:to-court-green/5 border border-court-green/20 dark:border-court-green/40 flex items-center justify-center text-court-green shadow-inner shrink-0 relative z-10 transition-transform group-hover:rotate-12">
                <Users className="w-5.5 h-5.5" />
              </div>
            </div>

            {/* Total Tournaments */}
            <div className="relative bg-gradient-to-br from-white via-[#FFF5F5] to-[#FEE2E2] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#2B121C] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-red-500/20 dark:hover:border-red-500/30 transition-all duration-300 overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 dark:bg-red-500/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-rose-600 via-[#7F1D1D] to-[#450A0A] rounded-l-2xl z-20"></div>
              <div className="space-y-1 relative z-10 pl-2.5">
                <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
                  ACTIVE BRACKETS
                </span>
                <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
                  {tournaments.length}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500/15 to-transparent dark:from-red-500/25 dark:to-transparent border border-red-500/20 flex items-center justify-center text-red-500 shrink-0 relative z-10 transition-transform group-hover:scale-110">
                <Trophy className="w-5.5 h-5.5" />
              </div>
            </div>

            {/* Total Teams */}
            <div className="relative bg-gradient-to-br from-white via-[#F1F6FF] to-[#DBEAFE] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#101F3B] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-court-green/40 dark:hover:border-court-green/60 transition-all duration-300 overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 via-blue-900 to-[#172554] rounded-l-2xl z-20"></div>
              <div className="space-y-1 relative z-10 pl-2.5">
                <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
                  REGISTERED TEAMS
                </span>
                <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
                  {totalTeams}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 dark:from-blue-500/25 dark:to-blue-500/5 border border-blue-500/20 dark:border-blue-500/40 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0 relative z-10 transition-transform group-hover:translate-y-[-2px]">
                <Activity className="w-5.5 h-5.5" />
              </div>
            </div>

            {/* Games Logged */}
            <div className="relative bg-gradient-to-br from-white via-[#FFFDF0] to-[#FEF3C7] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#2B2112] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-soft-gold/30 dark:hover:border-soft-gold/40 transition-all duration-300 overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-soft-gold/5 dark:bg-soft-gold/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 via-[#78350F] to-[#451A03] rounded-l-2xl z-20"></div>
              <div className="space-y-1 relative z-10 pl-2.5">
                <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
                  GAMES LOGGED
                </span>
                <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
                  {totalGamesLogged}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-soft-gold/15 to-transparent dark:from-soft-gold/25 dark:to-transparent border border-soft-gold/20 flex items-center justify-center text-soft-gold shrink-0 relative z-10 transition-transform group-hover:scale-125">
                <Flame className="w-5.5 h-5.5 animate-pulse" />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Matches Won */}
            <div className="relative bg-gradient-to-br from-white via-[#EEFBF3] to-[#D1FAE5] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#0D2418] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-court-green/40 dark:hover:border-court-green/60 transition-all duration-300 overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-court-green/5 dark:bg-court-green/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-2xl z-20"></div>
              <div className="space-y-1 relative z-10 pl-2.5">
                <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
                  MATCHES WON
                </span>
                <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
                  {playerRow?.wins ?? 0}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-court-green/15 to-court-green/5 dark:from-court-green/25 dark:to-court-green/5 border border-court-green/20 dark:border-court-green/40 flex items-center justify-center text-court-green shadow-inner shrink-0 relative z-10 transition-transform group-hover:rotate-12">
                <Trophy className="w-5.5 h-5.5" />
              </div>
            </div>

            {/* Matches Lost */}
            <div className="relative bg-gradient-to-br from-white via-[#FFF5F5] to-[#FEE2E2] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#2B121C] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-red-500/20 dark:hover:border-red-500/30 transition-all duration-300 overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 dark:bg-red-500/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-rose-600 via-[#7F1D1D] to-[#450A0A] rounded-l-2xl z-20"></div>
              <div className="space-y-1 relative z-10 pl-2.5">
                <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
                  MATCHES LOST
                </span>
                <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
                  {playerRow?.losses ?? 0}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500/15 to-transparent dark:from-red-500/25 dark:to-transparent border border-red-500/20 flex items-center justify-center text-red-500 shrink-0 relative z-10 transition-transform group-hover:scale-110">
                <Target className="w-5.5 h-5.5" />
              </div>
            </div>

            {/* Win Percentage */}
            <div className="relative bg-gradient-to-br from-white via-[#F1F6FF] to-[#DBEAFE] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#101F3B] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-court-green/40 dark:hover:border-court-green/60 transition-all duration-300 overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 via-blue-900 to-[#172554] rounded-l-2xl z-20"></div>
              <div className="space-y-1 relative z-10 pl-2.5">
                <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
                  WIN PERCENTAGE
                </span>
                <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
                  {winRate}%
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 dark:from-blue-500/25 dark:to-blue-500/5 border border-blue-500/20 dark:border-blue-500/40 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0 relative z-10 transition-transform group-hover:translate-y-[-2px]">
                <TrendingUp className="w-5.5 h-5.5" />
              </div>
            </div>

            {/* Current Streak */}
            <div className="relative bg-gradient-to-br from-white via-[#FFFDF0] to-[#FEF3C7] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#2B2112] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-soft-gold/30 dark:hover:border-soft-gold/40 transition-all duration-300 overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-soft-gold/5 dark:bg-soft-gold/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 via-[#78350F] to-[#451A03] rounded-l-2xl z-20"></div>
              <div className="space-y-1 relative z-10 pl-2.5">
                <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
                  WIN STREAK
                </span>
                <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
                  {playerRow?.streak ?? 0}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-soft-gold/15 to-transparent dark:from-soft-gold/25 dark:to-transparent border border-soft-gold/20 flex items-center justify-center text-soft-gold shrink-0 relative z-10 transition-transform group-hover:scale-125">
                <Flame className="w-5.5 h-5.5 animate-pulse" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Bento Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-bento-grid">
        
        {/* Left Columns (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Tournaments Panel */}
          <div className="bg-white border border-light-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-court-green" />
                <h2 className="text-lg font-display font-bold text-charcoal tracking-tight">Active Tournaments</h2>
              </div>
              <button 
                onClick={() => navigateTo('tournaments')}
                className="text-xs text-court-green hover:text-court-green/80 hover:underline flex items-center gap-1 transition-colors font-bold uppercase tracking-wider font-mono cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTournaments.map(tour => {
                const teamsFilled = tour.teams?.length || 0;
                const teamsTarget = tour.teamCount || teamsFilled || 1;
                const progressPct = Math.min(100, Math.round((teamsFilled / teamsTarget) * 100));

                return (
                  <div
                    key={tour.id}
                    onClick={() => navigateTo('tournament-hub', tour.id)}
                    className="group bg-white border border-light-border rounded-xl p-4 hover:border-court-green/30 hover:shadow-sm transition-all duration-300 cursor-pointer flex flex-col justify-between h-44 relative overflow-hidden"
                  >
                    {/* Left Gradient Sidebar Indicator */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-xl z-20"></div>
                    <div className="space-y-1.5 pl-2.5 relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold font-mono tracking-widest text-court-green uppercase bg-court-green/10 border border-court-green/20 px-2.5 py-0.5 rounded-full">
                          {tour.format === 'mlp_singles' ? 'MLP Singles' : 'standard'} format
                        </span>
                        <span className="text-[10px] text-slate-gray font-semibold font-mono">{tour.startDate}</span>
                      </div>
                      <h3 className="font-display font-bold text-sm text-charcoal group-hover:text-court-green transition-colors truncate">
                        {tour.name}
                      </h3>
                      <p className="text-xs text-slate-gray line-clamp-2 leading-relaxed">
                        {tour.teamCount} teams &middot; {tour.playersPerTeam} players each &middot; {tour.startDate} to {tour.endDate}
                      </p>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      <div className="flex justify-between text-[10px] font-mono font-bold text-slate-gray">
                        <span>ROSTER PROGRESS</span>
                        <span>{teamsFilled}/{teamsTarget} TEAMS</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                        <div 
                          className="bg-court-green h-full rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Match Scoreboard Results */}
          <div className="bg-white border border-light-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-court-green" />
                <h2 className="text-lg font-display font-bold text-charcoal tracking-tight">Recent Results</h2>
              </div>
              <button 
                onClick={() => navigateTo('schedule')} 
                className="text-xs text-court-green hover:text-court-green/80 hover:underline flex items-center gap-1 transition-colors font-bold uppercase tracking-wider font-mono cursor-pointer"
              >
                <span>Full Schedule</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentResults.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs font-sans font-medium">
                No recent completed fixtures yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentResults.map(match => {
                  const [sideA, sideB] = match.matchup.split(' vs ');
                  const aIsWinner = match.winner && match.winner === sideA;

                  return (
                    <div 
                      key={match.id}
                      className="bg-white border border-light-border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 hover:border-court-green/30 hover:shadow-sm transition-all duration-300 relative overflow-hidden"
                    >
                      {/* Left Gradient Sidebar Indicator */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-xl z-20"></div>
                      {/* Left: Date & Court */}
                      <div className="flex flex-col text-center sm:text-left min-w-[120px] pl-2.5 relative z-10">
                        <span className="text-[10px] font-bold text-slate-gray font-mono tracking-widest truncate uppercase">
                          {match.gameType}
                        </span>
                        <span className="text-xs text-charcoal font-bold mt-0.5">{match.date}</span>
                        <span className="text-[10px] text-slate-gray mt-0.5 font-mono">{match.court}</span>
                      </div>

                      {/* Middle: Score Board Display */}
                      <div className="flex items-center gap-6 flex-1 justify-center">
                        <div className="flex flex-col items-end w-32 sm:w-40 text-right">
                          <span className={`text-xs font-bold truncate ${aIsWinner ? 'text-charcoal font-black' : 'text-slate-gray'}`}>
                            {sideA || match.matchup}
                          </span>
                        </div>

                        {/* Score */}
                        <div className="flex items-center gap-1 bg-court-green/5 p-1 rounded-lg border border-court-green/15">
                          <div className="flex flex-col items-center justify-center font-mono w-7 h-9 rounded bg-white border border-light-border">
                            <span className={`text-xs font-bold ${aIsWinner ? 'text-court-green font-black' : 'text-slate-gray'}`}>{match.scoreA}</span>
                            <span className={`text-[9px] font-semibold ${!aIsWinner ? 'text-court-green font-black' : 'text-slate-gray'}`}>{match.scoreB}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-start w-32 sm:w-40 text-left">
                          <span className={`text-xs font-bold truncate ${!aIsWinner ? 'text-charcoal font-black' : 'text-slate-gray'}`}>
                            {sideB || ''}
                          </span>
                        </div>
                      </div>

                      {/* Right: Status badge */}
                      <div className="text-center sm:text-right">
                        <span className="text-[9px] font-bold font-mono text-court-green bg-court-green/10 border border-court-green/20 px-2 py-1 rounded">
                          FINAL
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (Col Span 1) */}
        <div className="space-y-6">
          
          {/* Upcoming Bookings Panel */}
          <div className="bg-deep-navy text-white rounded-xl p-5 shadow-md border border-deep-navy/85 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-court-green" />
              <h2 className="text-lg font-display font-bold text-white tracking-tight">Your Next Court Time</h2>
            </div>

            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/10 rounded-xl bg-white/5 text-slate-gray text-xs font-mono">
                No upcoming court bookings.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map(booking => (
                  <div
                    key={booking.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 relative overflow-hidden group hover:border-court-green/40 transition-all duration-300 pl-6"
                  >
                    {/* Left Gradient Sidebar Indicator */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 via-blue-900 to-[#0A101D] rounded-l-xl z-20"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold font-mono text-court-green tracking-widest block truncate max-w-[130px] uppercase">
                        {booking.court}
                      </span>
                      <span className="text-[10px] text-slate-gray font-mono">{booking.duration} min</span>
                    </div>

                    <div className="flex items-center justify-between border-y border-white/10 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-gray font-mono uppercase font-bold tracking-wider">Players</span>
                        <span className="text-xs font-bold text-white mt-0.5 truncate">
                          {booking.players || 'Just you'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-gray font-mono uppercase font-bold tracking-wider">Time</span>
                        <span className="text-xs font-bold text-court-green font-mono mt-0.5 block">
                          {booking.time}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-gray font-mono">{booking.date}</span>
                      <button onClick={() => navigateTo('bookings')} className="text-slate-gray font-mono uppercase font-bold hover:text-court-green cursor-pointer">Manage &rarr;</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Team details */}
          <div className="bg-white border border-light-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-court-green" />
              <h2 className="text-lg font-display font-bold text-charcoal tracking-tight">Active Affiliation</h2>
            </div>

            {playerTeam && playerTournament ? (
              <div 
                onClick={() => navigateTo('team-hub', playerTeam!.id)}
                className="bg-white border border-light-border hover:border-court-green/30 hover:shadow-md rounded-xl p-4 space-y-4 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-lg border flex items-center justify-center text-lg font-black font-mono"
                      style={{ backgroundColor: `${playerTeam.color}1A`, borderColor: `${playerTeam.color}33`, color: playerTeam.color }}
                    >
                      {playerTeam.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm text-charcoal group-hover:text-court-green transition-colors">
                        {playerTeam.name}
                      </h4>
                      <span className="text-[10px] text-slate-gray font-medium font-mono uppercase">{playerTournament.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-gray font-mono uppercase block font-bold">RANK</span>
                    <span className="text-sm font-display font-bold text-soft-gold font-mono">{teamStanding ? `#${teamStanding.rank}` : '—'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-light-border pt-3 text-center">
                  <div>
                    <span className="text-[9px] text-slate-gray font-mono block uppercase font-bold">RECORD</span>
                    <span className="text-xs font-bold text-charcoal font-mono">{teamStanding ? `${teamStanding.wins}W - ${teamStanding.losses}L` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-gray font-mono block uppercase font-bold">POINTS</span>
                    <span className="text-xs font-bold text-charcoal font-mono">{teamStanding ? `${teamStanding.points} pts` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-gray font-mono block uppercase font-bold">CAPTAIN</span>
                    <span className="text-xs font-bold text-charcoal font-mono truncate block">{playerTeam.players.find((p) => (p.email || p.name) === playerTeam!.captain)?.name || playerTeam.captain || '—'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs font-display font-normal">
                Not registered in any team currently.
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-white border border-light-border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-[10px] font-bold text-slate-gray tracking-widest font-mono uppercase">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => navigateTo('leaderboard')}
                className="p-3 bg-white hover:bg-court-green/5 hover:border-court-green border border-light-border hover:shadow-sm text-xs text-charcoal rounded-xl font-bold transition-all text-left flex flex-col justify-between h-20 cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-court-green" />
                <span className="uppercase tracking-wide text-[10px] font-mono">Leaderboard</span>
              </button>
              <button 
                onClick={() => navigateTo('tournaments')}
                className="p-3 bg-white hover:bg-court-green/5 hover:border-court-green border border-light-border hover:shadow-sm text-xs text-charcoal rounded-xl font-bold transition-all text-left flex flex-col justify-between h-20 cursor-pointer"
              >
                <Activity className="w-4 h-4 text-court-green" />
                <span className="uppercase tracking-wide text-[10px] font-mono">Brackets</span>
              </button>
              <button 
                onClick={() => navigateTo('schedule')}
                className="p-3 bg-white hover:bg-court-green/5 hover:border-court-green border border-light-border hover:shadow-sm text-xs text-charcoal rounded-xl font-bold transition-all text-left flex flex-col justify-between h-20 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-court-green" />
                <span className="uppercase tracking-wide text-[10px] font-mono">Schedule</span>
              </button>
              <button 
                onClick={() => navigateTo('profile')}
                className="p-3 bg-white hover:bg-court-green/5 hover:border-court-green border border-light-border hover:shadow-sm text-xs text-charcoal rounded-xl font-bold transition-all text-left flex flex-col justify-between h-20 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-court-green" />
                <span className="uppercase tracking-wide text-[10px] font-mono">My Profile</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
