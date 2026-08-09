/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { encodeProfileId } from '../utils/profileId';
import { useAppState } from '../AppContext';
import { defaultAvatar } from '../utils/avatar';
import { TopRankedPlayersRail } from './TopRankedPlayersRail';
import { Award, ArrowUpRight, Medal, Sparkles } from 'lucide-react';

export const PlayerRankingsView: React.FC = () => {
  const { playerRankings, navigateTo, refreshPlayerRankings } = useAppState();

  useEffect(() => { refreshPlayerRankings(); }, []);

  const sorted = [...playerRankings].sort((a, b) => (a.rank || 0) - (b.rank || 0));

  return (
    <div className="space-y-6" id="player-rankings-section">
      <div className="flex items-center gap-2 mb-1.5">
        <Award className="w-5 h-5 text-court-green shrink-0" />
        <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">CLUB-WIDE STANDINGS</span>
      </div>
      <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase -mt-4">
        Overall Player Rankings
      </h1>
      <p className="text-slate-gray text-xs -mt-3">
        Combined rankings across every tournament this club has run.
      </p>

      <TopRankedPlayersRail rankings={playerRankings} navigateTo={navigateTo} />

      <div className="relative bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-2xl z-20"></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-off-white border-b border-light-border">
                <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase w-16 text-center">Rank</th>
                <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase">Player Name</th>
                <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-36">DUPR Rating</th>
                <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-36">Club Rating</th>
                <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-24">Wins</th>
                <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-24">Losses</th>
                <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-28">Win %</th>
                <th className="py-4 px-6 text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase text-center w-36">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-xs text-slate-gray font-mono">No ranked players yet.</td></tr>
              ) : sorted.map((p) => {
                const total = p.wins + p.losses;
                const winPct = total > 0 ? Math.round((p.wins / total) * 100) : 0;
                return (
                  <tr key={p.player} className="hover:bg-off-white/40 transition-all group">
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center font-mono font-bold text-sm">
                        {p.rank === 1 ? <Medal className="w-5 h-5 text-soft-gold" /> : p.rank === 2 ? <Medal className="w-5 h-5 text-slate-400" /> : p.rank === 3 ? <Medal className="w-5 h-5 text-amber-700" /> : <span className="text-slate-gray">{p.rank}</span>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <button onClick={() => navigateTo('profile', encodeProfileId(p.email, p.player))} className="flex items-center gap-3 hover:text-court-green group/pbtn transition-colors text-left cursor-pointer">
                        <img src={p.avatarDataUrl || defaultAvatar(p.player)} alt={p.player} className="w-9 h-9 rounded-lg object-cover border border-light-border group-hover/pbtn:border-court-green/40 shadow-sm" referrerPolicy="no-referrer" />
                        <div>
                          <span className="font-bold text-sm text-charcoal group-hover/pbtn:text-court-green transition-colors block">{p.player}</span>
                          {p.online && <span className="text-[10px] text-court-green font-mono">&bull; Online</span>}
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-court-green transition-all ml-1" />
                      </button>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-court-green/10 text-court-green border border-court-green/20 font-mono font-extrabold text-xs">
                        <Sparkles className="w-3 h-3 text-soft-gold" />
                        {p.duprRating != null ? p.duprRating.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-soft-gold/10 text-soft-gold border border-soft-gold/20 font-mono font-extrabold text-xs" title="Computed from match results within this club — separate from self-reported DUPR">
                        {p.clubRating != null ? p.clubRating.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center font-mono font-bold text-charcoal text-sm">{p.wins}</td>
                    <td className="py-4 px-6 text-center font-mono font-bold text-slate-gray text-sm">{p.losses}</td>
                    <td className="py-4 px-6 text-center font-mono font-black text-charcoal text-sm">{winPct}%</td>
                    <td className="py-4 px-6 text-center font-mono text-xs">
                      <span className={`font-bold ${p.streak > 0 ? 'text-court-green' : 'text-slate-gray'}`}>{p.streak > 0 ? `${p.streak}W streak` : '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
