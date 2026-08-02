/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import type { PlayerRankingRow } from '../types';
import { defaultAvatar } from '../utils/avatar';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';

// The real backend has no separate Men's/Women's Doubles-vs-Singles
// rankings the way a pro tour does — those tabs there reflect Athletes
// entering separate divisions. What we do have per player is an
// optional gender field, so the tabs here reflect that instead: Overall,
// Men, Women. Players with no gender set only show up under Overall.
type GenderTab = 'all' | 'male' | 'female';

export const TopRankedPlayersRail: React.FC<{ rankings: PlayerRankingRow[]; navigateTo: any }> = ({ rankings, navigateTo }) => {
  const [tab, setTab] = useState<GenderTab>('all');
  const scrollerRef = useRef<HTMLDivElement>(null);

  const filtered = (tab === 'all' ? rankings : rankings.filter((p) => p.gender === tab))
    .slice()
    .sort((a, b) => (a.rank || 0) - (b.rank || 0))
    .slice(0, 10);

  const scroll = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4" id="top-ranked-rail">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-display font-black text-charcoal uppercase tracking-tight">Top Ranked Players</h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-white p-1 rounded-xl border border-light-border shadow-sm">
            {([
              { id: 'all' as GenderTab, label: 'Overall' },
              { id: 'male' as GenderTab, label: 'Men' },
              { id: 'female' as GenderTab, label: 'Women' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  tab === t.id ? 'bg-deep-navy text-white' : 'text-slate-gray hover:text-charcoal'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => scroll(-1)} className="w-8 h-8 rounded-lg border border-light-border bg-white flex items-center justify-center text-slate-gray hover:text-court-green hover:border-court-green cursor-pointer transition-all shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scroll(1)} className="w-8 h-8 rounded-lg border border-light-border bg-white flex items-center justify-center text-slate-gray hover:text-court-green hover:border-court-green cursor-pointer transition-all shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-light-border rounded-2xl bg-white text-slate-gray text-xs">
          No ranked players in this category yet.
        </div>
      ) : (
        <div ref={scrollerRef} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x" style={{ scrollbarWidth: 'thin' }}>
          {filtered.map((p, idx) => {
            const winRate = p.played > 0 ? Math.round((p.wins / p.played) * 100) : 0;
            return (
              <button
                key={p.email || p.player}
                onClick={() => navigateTo('profile', p.email || p.player)}
                className="group relative flex flex-col items-center shrink-0 w-[200px] snap-start cursor-pointer text-left animate-rank-card-in"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="flex items-start gap-2 w-full mb-2">
                  <span className="text-4xl font-display font-black text-court-green/25 group-hover:text-court-green/50 transition-colors leading-none">
                    {String(p.rank).padStart(2, '0')}
                  </span>
                  {p.online && (
                    <span className="mt-1 flex items-center gap-1 text-[9px] font-mono font-bold text-court-green uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-court-green animate-live-pulse" /> Live
                    </span>
                  )}
                </div>

                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-off-white border border-light-border shadow-sm mb-3">
                  <img
                    src={p.avatarDataUrl || defaultAvatar(p.player)}
                    alt={p.player}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  {p.rank === 1 && <div className="shimmer-sweep" />}
                  {p.rank <= 3 && (
                    <span className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black font-mono border-2 ${
                      p.rank === 1 ? 'bg-soft-gold border-soft-gold text-deep-navy' : p.rank === 2 ? 'bg-slate-200 border-slate-300 text-charcoal' : 'bg-amber-700 border-amber-800 text-white'
                    }`}>{p.rank}</span>
                  )}
                </div>

                <div className="w-full border border-light-border rounded-xl px-3 py-2.5 bg-white group-hover:border-court-green/40 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-mono font-bold text-slate-gray uppercase">DUPR</span>
                    <span className="text-[9px] font-mono font-bold text-slate-gray uppercase">Record</span>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-mono font-black text-court-green">{p.duprRating != null ? p.duprRating.toFixed(2) : '—'}</span>
                    <span className="text-sm font-mono font-black text-charcoal">{p.wins}-{p.losses}</span>
                  </div>
                  <div className="text-xs font-display font-bold text-charcoal uppercase truncate group-hover:text-court-green transition-colors flex items-center gap-1">
                    {p.player}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <div className="text-[9px] font-mono text-slate-gray mt-0.5">{winRate}% win rate</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
