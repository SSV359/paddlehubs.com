/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { encodeProfileId } from '../utils/profileId';
import { NetDivider } from './NetDivider';
import { useAppState } from '../AppContext';
import type { TeamStandingRow, TournamentMatch, Tournament, TournamentTeam, PublicPlayerProfile, PlayerRankingRow } from '../types';
import {
  ArrowLeft,
  Users,
  Award,
  Trophy,
  Activity,
  User,
  Star,
  MapPin,
  Calendar,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';

const norm = (s: string) => (s || '').trim().toLowerCase();
import { defaultAvatar } from '../utils/avatar';

export const TeamHubView: React.FC = () => {
  const {
    activeTeamId,
    tournaments,
    playerRankings,
    navigateTo,
    navigateBack,
    canNavigateBack,
    api,
  } = useAppState();

  // Team ids are globally unique (uuid), so we can locate the team by
  // scanning every loaded tournament's roster.
  let team: TournamentTeam | undefined;
  let tournament: Tournament | undefined;
  for (const t of tournaments) {
    const found = (t.teams || []).find((tm) => tm.id === activeTeamId);
    if (found) { team = found; tournament = t; break; }
  }

  const [standing, setStanding] = useState<TeamStandingRow | null>(null);
  const [teamMatches, setTeamMatches] = useState<TournamentMatch[]>([]);
  const [tourRankings, setTourRankings] = useState<PlayerRankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournament || !team) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.getTeamStandings(tournament.id),
      api.listTournamentMatches(tournament.id),
      api.getTournamentPlayerRankings(tournament.id),
    ]).then(([standingsRes, matchesRes, rankingsRes]) => {
      setStanding(standingsRes.standings.find((s) => s.teamId === team!.id) || null);
      setTeamMatches(matchesRes.items.filter((m) => m.teamAId === team!.id || m.teamBId === team!.id && m.winnerTeamId));
      setTourRankings(rankingsRes.standings);
    }).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, [tournament?.id, team?.id]);

  if (!team || !tournament) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-sm">Team not found or session expired.</p>
        <button
          onClick={() => navigateTo('leaderboard')}
          className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
        >
          Back to Standings
        </button>
      </div>
    );
  }

  // Matched by email — the real identity key — falling back to name for
  // legacy roster entries with no email on record.
  const matchRow = (player: { name: string; email: string }) =>
    playerRankings.find((p) => (p.email && player.email ? norm(p.email) === norm(player.email) : norm(p.player) === norm(player.name)));

  // Wins/losses/matches/streak must be scoped to THIS tournament only —
  // a player's career-wide record (from the global playerRankings above)
  // was leaking into every tournament they'd been added to, showing
  // matches from other tournaments as if they'd been played here. DUPR
  // and avatar stay sourced from the global lookup above since those are
  // genuinely account-wide, not tournament-specific.
  const matchTourRow = (player: { name: string; email: string }) =>
    tourRankings.find((p) => (p.email && player.email ? norm(p.email) === norm(player.email) : norm(p.player) === norm(player.name)));

  // Player Rankings only exists for players who've played a recorded
  // match — teammates with zero matches have no rankings row at all, so
  // their real photo/DUPR (which already exists on their account) never
  // shows up here otherwise. Look those specific players up directly.
  const [directProfiles, setDirectProfiles] = useState<Record<string, PublicPlayerProfile>>({});
  useEffect(() => {
    const needsLookup = team!.players.filter((p) => {
      const row = matchRow(p);
      return p.email && !(row?.avatarDataUrl && row?.duprRating != null);
    });
    if (needsLookup.length === 0) return;
    Promise.all(
      needsLookup.map((p) => api.getPlayerProfileByEmail(p.email).then((r) => [p.email, r] as const).catch(() => null))
    ).then((results) => {
      const map: Record<string, PublicPlayerProfile> = {};
      for (const r of results) {
        if (r && !('error' in r[1])) map[r[0]] = r[1];
      }
      setDirectProfiles(map);
    });
  }, [team!.id]);

  const resolveAvatar = (email: string, row: ReturnType<typeof matchRow>) => directProfiles[email]?.avatarDataUrl || row?.avatarDataUrl || '';
  const resolveDupr = (email: string, row: ReturnType<typeof matchRow>) => directProfiles[email]?.duprRating ?? row?.duprRating ?? null;

  const rosterRows = team.players.map((player) => ({
    name: player.name,
    email: player.email,
    row: matchRow(player),
    tourRow: matchTourRow(player),
  }));
  const captainPlayer = team.players.find((p) => (p.email || p.name) === team!.captain);
  const captainName = captainPlayer?.name || team!.captain;
  const captainRow = captainPlayer ? matchRow(captainPlayer) : undefined;

  const completedMatches = teamMatches.filter((m) => m.winnerTeamId && m.winnerTeamId !== '');
  const form = completedMatches
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => (m.winnerTeamId === team!.id ? 'W' : m.winnerTeamId === 'TIE' ? 'T' : 'L'))
    .slice(-6);

  const getOpponentName = (match: TournamentMatch) => {
    const oppId = match.teamAId === team!.id ? match.teamBId : match.teamAId;
    return (tournament!.teams || []).find((t) => t.id === oppId)?.name || 'Opponent';
  };

  return (
    <div className="space-y-6" id="team-hub-page">
      {/* Back button */}
      <button
        onClick={() => {
          if (canNavigateBack) {
            navigateBack();
          } else {
            navigateTo('leaderboard');
          }
        }}
        className="inline-flex items-center gap-1.5 text-xs text-slate-gray hover:text-charcoal transition-colors font-bold font-mono tracking-wider uppercase cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Hero Banner Section */}
      <div className="relative rounded-2xl overflow-hidden bg-white border border-light-border p-6 sm:p-8 shadow-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-court-green/5 rounded-full blur-3xl -mr-16 -mt-16 -z-10"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {team.logoDataUrl ? (
              <img src={team.logoDataUrl} alt={team.name} className="w-16 h-16 rounded-xl object-cover border border-light-border shadow-sm shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-mono font-black text-2xl shadow-sm shrink-0"
                style={{ backgroundColor: team.color || '#1E5631' }}
              >
                {team.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-court-green font-bold font-mono tracking-wider bg-court-green/10 border border-court-green/20 px-2 py-0.5 rounded-full uppercase">
                  Pickleball Franchise
                </span>
                <span className="text-light-border text-xs font-semibold font-mono">|</span>
                <span className="text-[10px] text-slate-gray font-bold font-mono">{tournament.name}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-charcoal tracking-tight uppercase">
                {team.name}
              </h1>
              <NetDivider light className="max-w-[100px] mt-2" />
            </div>
          </div>

          <div className="flex gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-8">
            <div className="text-center sm:text-left">
              <span className="text-[9px] text-slate-gray font-medium font-display tracking-widest block uppercase">TEAM STANDING</span>
              <span className="text-2xl font-bold text-court-green font-mono mt-0.5 block">{standing ? `#${standing.rank} Seed` : '—'}</span>
            </div>
            <div className="text-center sm:text-left pl-4 border-l border-slate-100">
              <span className="text-[9px] text-slate-gray font-medium font-display tracking-widest block uppercase">OVERALL RECORD</span>
              <span className="text-2xl font-bold text-charcoal font-mono mt-0.5 block">{standing ? `${standing.wins}W - ${standing.losses}L` : '—'}</span>
            </div>
            <div className="text-center sm:text-left pl-4 border-l border-slate-100">
              <span className="text-[9px] text-slate-gray font-medium font-display tracking-widest block uppercase">PTS EARNED</span>
              <span className="text-2xl font-bold text-charcoal font-mono mt-0.5 block">{standing ? `${standing.points} pts` : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Left and Right Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Span 1): Roster & Captain */}
        <div className="space-y-6">
          {/* Captain Card */}
          <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">FRANCHISE CAPTAIN</h3>
            
            {team.captain ? (
              <div 
                onClick={() => navigateTo('profile', encodeProfileId(captainPlayer?.email, captainName))}
                className="bg-off-white hover:bg-white border border-light-border p-4 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={resolveAvatar(captainPlayer?.email || '', captainRow) || defaultAvatar(captainName)}
                    alt={captainName}
                    className="w-10 h-10 rounded-lg object-cover border border-light-border shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-charcoal group-hover:text-court-green transition-colors">{captainName}</h4>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-gray font-mono uppercase block">DUPR</span>
                  <span className="text-xs font-mono font-bold text-court-green">{(() => { const d = resolveDupr(captainPlayer?.email || '', captainRow); return d != null ? d.toFixed(2) : '—'; })()}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs font-sans font-medium">
                No captain assigned.
              </div>
            )}
          </div>

          {/* Roster Players */}
          <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">ACTIVE ROSTER ({rosterRows.length})</h3>
            
            <div className="space-y-3">
              {rosterRows.map(({ name, email, row }) => (
                <div
                  key={email || name}
                  onClick={() => navigateTo('profile', encodeProfileId(email, name))}
                  className="bg-off-white hover:bg-white p-3 rounded-lg flex items-center justify-between border border-light-border transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={resolveAvatar(email, row) || defaultAvatar(name)}
                      alt={name}
                      className="w-8 h-8 rounded-lg object-cover border border-light-border"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-xs font-bold text-charcoal group-hover:text-court-green transition-colors">{name}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-gray font-bold">DUPR: {(() => { const d = resolveDupr(email, row); return d != null ? d.toFixed(2) : '—'; })()}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-gray/60 group-hover:text-court-green transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Trend */}
          <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">FORM HISTORY</h3>
            <div className="flex items-center gap-2">
              {form.length === 0 ? (
                <div className="w-full text-center py-4 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs font-sans font-medium">
                  No official league fixtures registered.
                </div>
              ) : (
                form.map((f, i) => (
                  <div 
                    key={i} 
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold text-center flex-1 ${
                      f === 'W' 
                        ? 'bg-court-green/10 text-court-green border border-court-green/20' 
                        : f === 'T' ? 'bg-slate-100 text-slate-500 border border-slate-200'
                        : 'bg-red-50 text-error-red border border-red-100'
                    }`}
                  >
                    {f === 'W' ? 'WIN' : f === 'T' ? 'TIE' : 'LOSS'}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Span 2): Player Contributions & Match history */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Contribution Rankings */}
          <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-court-green/15 via-court-green/5 to-transparent dark:from-court-green/20 dark:via-court-green/5 dark:to-transparent p-4 border-b border-court-green/20 dark:border-court-green/20">
              <h3 className="font-bold text-sm text-court-green font-mono uppercase tracking-wider">Player Contribution Standings</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-off-white dark:bg-slate-900/60 border-b border-light-border dark:border-slate-800 font-mono text-[10px] tracking-wider text-slate-gray dark:text-slate-300 uppercase">
                    <th className="py-4 px-5">Player Name</th>
                    <th className="py-4 px-5 text-center">Matches</th>
                    <th className="py-4 px-5 text-center">Wins</th>
                    <th className="py-4 px-5 text-center">Losses</th>
                    <th className="py-4 px-5 text-center">Win %</th>
                    <th className="py-4 px-5 text-center">Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {rosterRows.map(({ name, email, row, tourRow }) => {
                    // Wins/losses/played/streak here are scoped to THIS
                    // tournament (tourRow) — not the player's career-wide
                    // totals (row), which would otherwise show matches
                    // from every other tournament they've ever played.
                    const wins = tourRow?.wins ?? 0;
                    const losses = tourRow?.losses ?? 0;
                    const played = tourRow?.played ?? 0;
                    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
                    return (
                      <tr key={email || name} className="hover:bg-off-white/50 dark:hover:bg-slate-900/40 transition-all">
                        <td className="py-3 px-5">
                          <button
                            onClick={() => navigateTo('profile', encodeProfileId(email, name))}
                            className="font-bold text-charcoal dark:text-white hover:text-court-green flex items-center gap-1.5 text-left transition-colors cursor-pointer"
                          >
                            <span>{name}</span>
                            <ArrowUpRight className="w-3 h-3 text-slate-gray/60" />
                          </button>
                        </td>
                        <td className="py-3 px-5 text-center font-mono font-semibold text-slate-gray dark:text-slate-400">{played}</td>
                        <td className="py-3 px-5 text-center font-mono font-bold text-charcoal dark:text-white">{wins}</td>
                        <td className="py-3 px-5 text-center font-mono font-semibold text-slate-gray/60 dark:text-slate-500">{losses}</td>
                        <td className="py-3 px-5 text-center font-mono font-bold text-court-green">{winRate}%</td>
                        <td className="py-3 px-5 text-center font-mono text-slate-gray dark:text-slate-400">
                          <span className="font-bold text-charcoal dark:text-white">{tourRow?.streak ?? 0}</span> game(s)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Match History */}
          <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">FIXTURES MATCH HISTORY</h3>

            {loading ? (
              <div className="text-center py-6 text-slate-gray text-xs font-mono">Loading fixtures...</div>
            ) : completedMatches.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs font-sans font-medium">
                No completed fixtures yet.
              </div>
            ) : (
              <div className="space-y-3">
                {completedMatches.map(match => {
                  const isWinner = match.winnerTeamId === team!.id;
                  const scoreLine = match.teamAId === team!.id
                    ? `${match.scoreA} - ${match.scoreB}`
                    : `${match.scoreB} - ${match.scoreA}`;

                  return (
                    <div
                      key={match.id}
                      className="bg-off-white border border-light-border p-4 rounded-xl flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-slate-gray uppercase block font-bold">
                          {match.date} &middot; {match.court}
                        </span>
                        <div className="text-xs text-slate-gray mt-1">
                          vs <span className="font-bold text-charcoal">{getOpponentName(match)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-gray font-mono block">SCORELINE</span>
                          <span className="text-xs font-mono font-bold text-charcoal mt-1 block">{scoreLine}</span>
                        </div>

                        <span className={`inline-flex px-2 py-1 rounded text-[10px] font-mono font-bold ${
                          isWinner ? 'bg-court-green/10 text-court-green border border-court-green/20' : 'bg-red-50 text-error-red border border-red-100'
                        }`}>
                          {match.winnerTeamId === 'TIE' ? 'TIE' : isWinner ? 'WIN' : 'LOSS'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
