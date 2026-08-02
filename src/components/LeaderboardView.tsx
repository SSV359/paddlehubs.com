/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import type { TeamStandingRow } from '../types';
import { Trophy, Users, User, ArrowUpRight, Award, Medal, Zap, Sparkles, Flame, Share2 } from 'lucide-react';

type LeaderboardTab = 'team' | 'singles';

export const LeaderboardView: React.FC = () => {
  const { tournaments, playerRankings, navigateTo, api, refreshPlayerRankings } = useAppState();

  // Refetch fresh rankings whenever this page opens rather than relying
  // on the app-load-time cache.
  useEffect(() => { refreshPlayerRankings(); }, []);

  const [activeTab, setActiveTab] = useState<LeaderboardTab>('team');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [teamStandings, setTeamStandings] = useState<TeamStandingRow[]>([]);

  useEffect(() => {
    if (!selectedTournamentId && tournaments.length > 0) {
      setSelectedTournamentId(tournaments[0].id);
    }
  }, [tournaments, selectedTournamentId]);

  useEffect(() => {
    if (!selectedTournamentId) return;
    api.getTeamStandings(selectedTournamentId)
      .then((r) => setTeamStandings(r.standings))
      .catch(() => setTeamStandings([]));
  }, [selectedTournamentId]);

  // Sorted players: primary is duprRating, secondary is wins
  const sortedPlayers = [...playerRankings].sort((a, b) => (a.rank || 0) - (b.rank || 0));

  const calcWinPct = (wins: number, losses: number) => {
    const total = wins + losses;
    return total > 0 ? `${Math.round((wins / total) * 100)}%` : '0%';
  };

  return (
    <div className="space-y-6" id="leaderboard-section">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-light-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Trophy className="w-5 h-5 text-court-green shrink-0" />
            <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">OFFICIAL STANDINGS</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase">
            Tournament Leaderboards
          </h1>
          <p className="text-slate-gray text-xs mt-1">
            Real-time rankings recalculated automatically following approved matches.
          </p>
        </div>

        {/* Tab triggers - Styled like an elite sports selector */}
        <div className="flex flex-wrap gap-1 bg-white p-1 rounded-xl border border-light-border shadow-sm self-start md:self-center">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === 'team'
                ? 'bg-deep-navy text-white shadow-sm'
                : 'text-slate-gray hover:text-charcoal'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>TEAMS</span>
          </button>
          <button
            onClick={() => setActiveTab('singles')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === 'singles'
                ? 'bg-deep-navy text-white shadow-sm'
                : 'text-slate-gray hover:text-charcoal'
            }`}
          >
            <User className="w-4 h-4" />
            <span>PLAYERS</span>
          </button>
        </div>
      </div>

      {/* Tournament selector for team standings — team standings are
          per-tournament on the real backend, unlike the demo's single
          global teams list. */}
      {activeTab === 'team' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-slate-gray uppercase tracking-wider">Tournament:</span>
          <select
            value={selectedTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
            className="bg-white border border-light-border rounded-lg px-3 py-1.5 text-xs font-bold text-charcoal focus:outline-none focus:border-court-green"
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Leaderboard content panels */}
      <div className="relative bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm" id="leaderboard-table-card">
          {/* Left Glow Accent Gradient Sidebar */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-2xl z-20"></div>
          
          {/* Team Leaderboard */}
          {activeTab === 'team' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-off-white border-b border-light-border">
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase w-16 text-center">Rank</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase">Team Name</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-24">Wins</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-24">Losses</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-28">Win %</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-32">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamStandings.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-slate-gray font-mono">No teams saved for this tournament yet.</td></tr>
                ) : teamStandings.map((team) => {
                  const rank = team.rank;
                  return (
                    <tr 
                      key={team.teamId}
                      className="hover:bg-off-white/40 transition-all group"
                    >
                      {/* Rank Column */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center font-mono font-bold text-sm">
                          {rank === 1 ? (
                            <Medal className="w-5 h-5 text-soft-gold" />
                          ) : rank === 2 ? (
                            <Medal className="w-5 h-5 text-slate-400" />
                          ) : rank === 3 ? (
                            <Medal className="w-5 h-5 text-amber-700" />
                          ) : (
                            <span className="text-slate-gray">{rank}</span>
                          )}
                        </div>
                      </td>

                      {/* Team Name Column */}
                      <td className="py-4 px-6">
                        <button
                          onClick={() => navigateTo('team-hub', team.teamId)}
                          className="flex items-center gap-3 hover:text-court-green group/btn transition-colors text-left cursor-pointer"
                        >
                          {team.logoDataUrl ? (
                            <img src={team.logoDataUrl} alt={team.teamName} className="w-9 h-9 rounded-lg object-cover border border-light-border shadow-sm" referrerPolicy="no-referrer" />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-lg border flex items-center justify-center text-xs font-black font-mono shadow-sm"
                              style={{ backgroundColor: `${team.color}1A`, borderColor: `${team.color}33`, color: team.color || undefined }}
                            >
                              {team.teamName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-sm text-charcoal group-hover/btn:text-court-green transition-colors block">
                              {team.teamName}
                            </span>
                            <span className="text-[10px] text-slate-gray font-display font-medium">Captain: {team.players.find((p) => (p.email || p.name) === team.captain)?.name || team.captain || '—'}</span>
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-court-green transition-all ml-1" />
                        </button>
                      </td>

                      {/* Wins */}
                      <td className="py-4 px-6 text-center font-mono font-bold text-charcoal text-sm">{team.wins}</td>

                      {/* Losses */}
                      <td className="py-4 px-6 text-center font-mono font-bold text-slate-gray text-sm">{team.losses}</td>

                      {/* Win % */}
                      <td className="py-4 px-6 text-center font-mono font-black text-charcoal text-sm">{calcWinPct(team.wins, team.losses)}</td>

                      {/* Points */}
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex px-3 py-1 rounded-lg bg-court-green/10 text-court-green border border-court-green/20 font-mono font-bold text-xs">
                          {team.points} PTS
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Player Rankings (club-wide) */}
        {activeTab === 'singles' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-off-white border-b border-light-border">
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase w-16 text-center">Rank</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase">Player Name</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-36">DUPR Rating</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-24">Wins</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-24">Losses</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-28">Win %</th>
                  <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-36">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPlayers.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-xs text-slate-gray font-mono">No ranked players yet.</td></tr>
                ) : sortedPlayers.map((p) => {
                  const rank = p.rank;
                  return (
                    <tr 
                      key={p.player}
                      className="hover:bg-off-white/40 transition-all group"
                    >
                      {/* Rank */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center font-mono font-bold text-sm">
                          {rank === 1 ? (
                            <Medal className="w-5 h-5 text-soft-gold" />
                          ) : rank === 2 ? (
                            <Medal className="w-5 h-5 text-slate-400" />
                          ) : rank === 3 ? (
                            <Medal className="w-5 h-5 text-amber-700" />
                          ) : (
                            <span className="text-slate-gray">{rank}</span>
                          )}
                        </div>
                      </td>

                      {/* Player Name */}
                      <td className="py-4 px-6">
                        <button
                          onClick={() => navigateTo('profile', p.email || p.player)}
                          className="flex items-center gap-3 hover:text-court-green group/pbtn transition-colors text-left cursor-pointer"
                        >
                          <img
                            src={p.avatarDataUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                            alt={p.player}
                            className="w-9 h-9 rounded-lg object-cover border border-light-border group-hover/pbtn:border-court-green/40 shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="font-bold text-sm text-charcoal group-hover/pbtn:text-court-green transition-colors block">
                              {p.player}
                            </span>
                            {p.online && <span className="text-[10px] text-court-green font-mono">&bull; Online</span>}
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-court-green transition-all ml-1" />
                        </button>
                      </td>

                      {/* DUPR Rating */}
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-court-green/10 text-court-green border border-court-green/20 font-mono font-extrabold text-xs">
                          <Sparkles className="w-3 h-3 text-soft-gold" />
                          {p.duprRating != null ? p.duprRating.toFixed(2) : '—'}
                        </span>
                      </td>

                      {/* Wins */}
                      <td className="py-4 px-6 text-center font-mono font-bold text-charcoal text-sm">{p.wins}</td>

                      {/* Losses */}
                      <td className="py-4 px-6 text-center font-mono font-bold text-slate-gray text-sm">{p.losses}</td>

                      {/* Win % */}
                      <td className="py-4 px-6 text-center font-mono font-black text-charcoal text-sm">{calcWinPct(p.wins, p.losses)}</td>

                      {/* Streak */}
                      <td className="py-4 px-6 text-center font-mono text-xs">
                        <span className={`font-bold ${p.streak > 0 ? 'text-court-green' : 'text-slate-gray'}`}>
                          {p.streak > 0 ? `${p.streak}W streak` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
