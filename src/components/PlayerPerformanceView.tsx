/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { encodeProfileId } from '../utils/profileId';
import { useAppState } from '../AppContext';
import { defaultAvatar } from '../utils/avatar';
import { BadgeRow } from './BadgeRow';
import { NetDivider } from './NetDivider';
import type { PlayerRankingRow, TournamentMatch } from '../types';
import {
  Activity, Search, Trophy, Target, TrendingUp, TrendingDown, Flame,
  Sparkles, Users, Swords, Medal, ArrowUpRight, X,
} from 'lucide-react';

const norm = (s: string) => (s || '').trim().toLowerCase();

type MatchEntry = { tourId: string; tourName: string; date: string; court: string; opponent: string; result: 'win' | 'loss' | 'tie'; scoreLine: string };

export const PlayerPerformanceView: React.FC = () => {
  const { playerRankings, tournaments, navigateTo, refreshPlayerRankings, api } = useAppState();
  useEffect(() => { refreshPlayerRankings(); }, []);

  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const [compareSearchOpen, setCompareSearchOpen] = useState(false);

  const rowKey = (p: PlayerRankingRow) => p.email || p.player;

  const sorted = useMemo(() => [...playerRankings].sort((a, b) => (a.rank || 0) - (b.rank || 0)), [playerRankings]);
  const filtered = query.trim()
    ? sorted.filter((p) => norm(p.player).includes(norm(query)))
    : sorted.slice(0, 8);

  const selected = sorted.find((p) => rowKey(p) === selectedKey) || sorted[0] || null;
  const compareRow = sorted.find((p) => rowKey(p) === compareKey) || null;

  // Aggregate this player's match history across every tournament — the
  // backend has no single "matches for this player" endpoint, so this
  // fetches every tournament's matches in parallel and filters, the same
  // pattern used for the global Schedule page.
  const [matchLog, setMatchLog] = useState<MatchEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  useEffect(() => {
    if (!selected || tournaments.length === 0) { setMatchLog([]); return; }
    let cancelled = false;
    setLoadingLog(true);
    const targetEmail = norm(selected.email || '');
    const targetName = norm(selected.player);

    Promise.all(tournaments.map((t) => api.listTournamentMatches(t.id).then((r: any) => ({ t, matches: r.items as TournamentMatch[] })).catch(() => null)))
      .then((results) => {
        if (cancelled) return;
        const entries: MatchEntry[] = [];
        for (const r of results) {
          if (!r) continue;
          for (const m of r.matches) {
            if (!m.winnerTeamId) continue;
            const isA = m.teamAPlayers.some((p) => (targetEmail && p.email ? norm(p.email) === targetEmail : norm(p.name) === targetName));
            const isB = m.teamBPlayers.some((p) => (targetEmail && p.email ? norm(p.email) === targetEmail : norm(p.name) === targetName));
            if (!isA && !isB) continue;
            const [sideA, sideB] = m.matchup.split(' vs ');
            const won = m.winnerTeamId === 'TIE' ? null : (isA ? m.winnerTeamId === m.teamAId : m.winnerTeamId === m.teamBId);
            entries.push({
              tourId: r.t.id, tourName: r.t.name, date: m.date, court: m.court,
              opponent: isA ? (sideB || 'Opponent') : (sideA || 'Opponent'),
              result: won === null ? 'tie' : won ? 'win' : 'loss',
              scoreLine: `${m.scoreA} - ${m.scoreB}`,
            });
          }
        }
        entries.sort((a, b) => b.date.localeCompare(a.date));
        setMatchLog(entries.slice(0, 20));
      })
      .finally(() => { if (!cancelled) setLoadingLog(false); });
    return () => { cancelled = true; };
  }, [selected?.email, selected?.player, tournaments.length]);

  const recentForm = matchLog.slice(0, 10).slice().reverse();

  return (
    <div className="space-y-6" id="player-performance-view">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden bg-deep-navy border border-deep-navy/80 p-6 sm:p-8 shadow-md court-texture">
        <div className="absolute top-0 right-0 w-72 h-72 bg-court-green/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-soft-gold/10 rounded-full blur-3xl -mb-16"></div>
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-court-green/25 to-court-green/10 border border-court-green/30 text-[10px] font-mono font-black text-court-green uppercase tracking-wider">
            <Swords className="w-3.5 h-3.5 text-soft-gold animate-live-pulse" />
            <span>PERFORMANCE LAB</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white uppercase">
            Player <span className="text-court-gradient">Performance</span> &amp; Analysis
          </h1>
          <NetDivider className="max-w-[140px]" />
          <p className="text-slate-400 text-xs max-w-xl leading-relaxed">
            Search any ranked player to break down their form, match history, and head-to-head comparisons across every tournament.
          </p>

          {/* Search */}
          <div className="relative max-w-md pt-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search player name..."
              className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-court-green transition-all"
            />
            {query.trim() && (
              <div className="absolute z-20 mt-1.5 w-full bg-[#0E1726] border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3">No players found.</p>
                ) : filtered.map((p) => (
                  <button
                    key={rowKey(p)}
                    onClick={() => { setSelectedKey(rowKey(p)); setQuery(''); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 text-left cursor-pointer"
                  >
                    <img src={p.avatarDataUrl || defaultAvatar(p.player)} alt={p.player} className="w-6 h-6 rounded object-cover" referrerPolicy="no-referrer" />
                    <span className="text-xs text-white font-semibold">{p.player}</span>
                    <span className="text-[10px] text-slate-500 font-mono ml-auto">#{p.rank}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!selected ? (
        <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white text-slate-gray text-xs">
          No ranked players yet — once matches are recorded with players attached, they'll show up here.
        </div>
      ) : (
        <>
          {/* Quick player chips */}
          {!query.trim() && (
            <div className="flex flex-wrap gap-2">
              {sorted.slice(0, 10).map((p) => (
                <button
                  key={rowKey(p)}
                  onClick={() => setSelectedKey(rowKey(p))}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border cursor-pointer transition-all ${
                    rowKey(p) === rowKey(selected) ? 'bg-deep-navy border-deep-navy text-white' : 'bg-white border-light-border text-slate-gray hover:text-charcoal'
                  }`}
                >
                  #{p.rank} {p.player}
                </button>
              ))}
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Rank" value={`#${selected.rank}`} icon={Medal} color="gold" />
            <StatCard label="DUPR" value={selected.duprRating != null ? selected.duprRating.toFixed(2) : '—'} icon={Sparkles} color="green" />
            <StatCard label="Record" value={`${selected.wins}-${selected.losses}`} icon={Trophy} color="blue" />
            <StatCard label="Win %" value={selected.played > 0 ? `${Math.round((selected.wins / selected.played) * 100)}%` : '0%'} icon={TrendingUp} color="amber" />
            <StatCard label="Streak" value={selected.streak > 0 ? `${selected.streak}W` : '—'} icon={Flame} color="red" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Profile + Form + Log */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <img src={selected.avatarDataUrl || defaultAvatar(selected.player)} alt={selected.player} className="w-16 h-16 rounded-xl object-cover border border-light-border shadow-sm" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-black text-lg text-charcoal uppercase truncate">{selected.player}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {selected.online && <span className="text-[10px] text-court-green font-mono font-bold">&bull; Online</span>}
                    <span className="text-[10px] text-slate-gray font-mono">{selected.played} games played</span>
                  </div>
                  <div className="mt-2"><BadgeRow row={selected} size="sm" /></div>
                </div>
                <button onClick={() => navigateTo('profile', encodeProfileId(selected.email, selected.player))} className="px-3 py-2 rounded-lg bg-court-green/10 text-court-green text-[10px] font-bold font-mono uppercase cursor-pointer hover:bg-court-green/20 transition-all flex items-center gap-1">
                  Full Profile <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Recent Form */}
              <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Recent Form (Last 10)</h3>
                {recentForm.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs">No recorded matches yet.</div>
                ) : (
                  <div className="flex items-end gap-1.5 h-24 px-1">
                    {recentForm.map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                        <span className="text-[8px] font-mono text-slate-gray opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4">{m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'T'}</span>
                        <div
                          className={`w-full rounded-t transition-all ${m.result === 'win' ? 'bg-court-green' : m.result === 'loss' ? 'bg-rose-500' : 'bg-slate-300'}`}
                          style={{ height: m.result === 'win' ? '100%' : m.result === 'loss' ? '45%' : '65%' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Match Log */}
              <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Match History</h3>
                {loadingLog ? (
                  <div className="text-center py-6 text-xs text-slate-gray font-mono">Loading match history...</div>
                ) : matchLog.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs">No recorded matches yet.</div>
                ) : (
                  <div className="space-y-2">
                    {matchLog.map((m, i) => (
                      <div key={i} className="flex items-center justify-between bg-off-white border border-light-border rounded-xl px-4 py-2.5 text-xs">
                        <div className="min-w-0">
                          <span className="font-bold text-charcoal block truncate">vs {m.opponent}</span>
                          <span className="text-[10px] text-slate-gray font-mono">{m.tourName} &middot; {m.date}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-slate-gray">{m.scoreLine}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            m.result === 'win' ? 'bg-court-green/10 text-court-green' : m.result === 'loss' ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-200 text-slate-600'
                          }`}>{m.result}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Head-to-Head Compare */}
            <div className="space-y-6">
              <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Compare Players</h3>
                  {compareRow && (
                    <button onClick={() => setCompareKey(null)} className="text-slate-gray hover:text-red-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>

                {!compareRow ? (
                  <div className="space-y-2">
                    <button onClick={() => setCompareSearchOpen(!compareSearchOpen)} className="w-full py-2.5 rounded-xl border border-dashed border-light-border text-xs font-bold font-mono uppercase text-slate-gray hover:text-court-green hover:border-court-green cursor-pointer flex items-center justify-center gap-2">
                      <Users className="w-4 h-4" /> Pick Opponent
                    </button>
                    {compareSearchOpen && (
                      <div className="max-h-48 overflow-y-auto space-y-1 border border-light-border rounded-xl p-2">
                        {sorted.filter((p) => rowKey(p) !== rowKey(selected)).map((p) => (
                          <button key={rowKey(p)} onClick={() => { setCompareKey(rowKey(p)); setCompareSearchOpen(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-off-white text-left cursor-pointer">
                            <img src={p.avatarDataUrl || defaultAvatar(p.player)} alt={p.player} className="w-6 h-6 rounded object-cover" referrerPolicy="no-referrer" />
                            <span className="text-xs text-charcoal font-semibold">{p.player}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-court-green truncate max-w-[45%]">{selected.player}</span>
                      <span className="text-slate-gray font-mono text-[10px]">VS</span>
                      <span className="text-rose-500 truncate max-w-[45%] text-right">{compareRow.player}</span>
                    </div>
                    <CompareBar label="DUPR" a={selected.duprRating ?? 0} b={compareRow.duprRating ?? 0} format={(v) => v.toFixed(2)} />
                    <CompareBar label="Wins" a={selected.wins} b={compareRow.wins} />
                    <CompareBar label="Win %" a={selected.played ? (selected.wins / selected.played) * 100 : 0} b={compareRow.played ? (compareRow.wins / compareRow.played) * 100 : 0} format={(v) => `${Math.round(v)}%`} />
                    <CompareBar label="Streak" a={selected.streak} b={compareRow.streak} format={(v) => `${v}W`} />
                  </div>
                )}
              </div>

              <div className="bg-deep-navy text-white rounded-2xl p-5 shadow-md border border-deep-navy/85 space-y-3">
                <h3 className="font-display text-[10px] font-medium text-court-green tracking-widest uppercase flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Snapshot</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-[9px] text-slate-400 font-mono uppercase block">Losses</span><span className="font-bold font-mono">{selected.losses}</span></div>
                  <div><span className="text-[9px] text-slate-400 font-mono uppercase block">Ties</span><span className="font-bold font-mono">{selected.ties}</span></div>
                  <div><span className="text-[9px] text-slate-400 font-mono uppercase block">Rank Change</span><span className="font-bold font-mono">{selected.rankChange ? (selected.rankChange > 0 ? `+${selected.rankChange}` : selected.rankChange) : 'No change'}</span></div>
                  <div><span className="text-[9px] text-slate-400 font-mono uppercase block">Games Logged</span><span className="font-bold font-mono">{matchLog.length}</span></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const COLOR_MAP: Record<string, string> = {
  green: 'from-court-green/15 to-court-green/5 border-court-green/20 text-court-green',
  gold: 'from-soft-gold/15 to-transparent border-soft-gold/20 text-soft-gold',
  blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/20 text-blue-500',
  amber: 'from-amber-500/15 to-transparent border-amber-500/20 text-amber-500',
  red: 'from-rose-500/15 to-transparent border-rose-500/20 text-rose-500',
};

const StatCard: React.FC<{ label: string; value: string; icon: any; color: string }> = ({ label, value, icon: Icon, color }) => (
  <div className="relative bg-white border border-light-border rounded-2xl p-4 shadow-sm flex items-center justify-between overflow-hidden">
    <div className="space-y-1">
      <span className="text-[9px] text-charcoal font-extrabold font-mono tracking-wider block uppercase">{label}</span>
      <span className="text-2xl font-display font-black text-charcoal block">{value}</span>
    </div>
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${COLOR_MAP[color]} border flex items-center justify-center shrink-0`}>
      <Icon className="w-5 h-5" />
    </div>
  </div>
);

const CompareBar: React.FC<{ label: string; a: number; b: number; format?: (v: number) => string }> = ({ label, a, b, format }) => {
  const max = Math.max(a, b, 0.001);
  const fmt = format || ((v: number) => String(v));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold">
        <span className="text-court-green">{fmt(a)}</span>
        <span className="text-slate-gray uppercase">{label}</span>
        <span className="text-rose-500">{fmt(b)}</span>
      </div>
      <div className="flex gap-1 h-2">
        <div className="flex-1 flex justify-end">
          <div className="bg-court-green rounded-l h-full" style={{ width: `${(a / max) * 100}%` }} />
        </div>
        <div className="flex-1">
          <div className="bg-rose-500 rounded-r h-full" style={{ width: `${(b / max) * 100}%` }} />
        </div>
      </div>
    </div>
  );
};
