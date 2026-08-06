/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../AppContext';
import { defaultAvatar } from '../utils/avatar';
import { encodeProfileId } from '../utils/profileId';
import { BadgeRow } from './BadgeRow';
import { Users, Search, ArrowUpRight } from 'lucide-react';

export const PlayerDirectoryView: React.FC = () => {
  const { playerRankings, tournaments, navigateTo, refreshPlayerRankings } = useAppState();
  const [query, setQuery] = useState('');
  useEffect(() => { refreshPlayerRankings(); }, []);

  const allPlayers = useMemo(() => {
    const map = new Map<string, { name: string; email: string; row?: any }>();
    for (const r of playerRankings) {
      map.set(r.email || r.player, { name: r.player, email: r.email || '', row: r });
    }
    for (const t of tournaments) {
      for (const p of t.playerPool || []) {
        const key = p.email || p.name;
        if (!map.has(key)) map.set(key, { name: p.name, email: p.email || '' });
      }
      for (const team of t.teams || []) {
        for (const p of team.players) {
          const key = p.email || p.name;
          if (!map.has(key)) map.set(key, { name: p.name, email: p.email || '' });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [playerRankings, tournaments]);

  const filtered = query.trim()
    ? allPlayers.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : allPlayers;

  return (
    <div className="space-y-6" id="player-directory-view">
      <div className="flex items-center gap-2 mb-1.5">
        <Users className="w-5 h-5 text-court-green shrink-0" />
        <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">CLUB ROSTER</span>
      </div>
      <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase -mt-4">Player Directory</h1>
      <p className="text-slate-gray text-xs -mt-3">Every player registered or rostered anywhere in the club — {allPlayers.length} total.</p>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-gray absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          className="w-full bg-white border border-light-border rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-court-green shadow-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white text-slate-gray text-xs">
          No players match "{query}".
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <button
              key={p.email || p.name}
              onClick={() => navigateTo('profile', encodeProfileId(p.email, p.name))}
              className="flex items-center gap-3 bg-white border border-light-border rounded-xl p-3.5 shadow-sm hover:border-court-green/40 hover:shadow-md transition-all cursor-pointer text-left group"
            >
              <img
                src={p.row?.avatarDataUrl || defaultAvatar(p.name)}
                alt={p.name}
                className="w-11 h-11 rounded-xl object-cover border border-light-border shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-charcoal group-hover:text-court-green transition-colors truncate">{p.name}</span>
                  {p.row?.online && <span className="w-1.5 h-1.5 rounded-full bg-court-green shrink-0" />}
                </div>
                {p.row ? (
                  <p className="text-[10px] text-slate-gray font-mono">
                    {p.row.duprRating != null ? `DUPR ${p.row.duprRating.toFixed(2)}` : 'No DUPR yet'} &middot; {p.row.wins}-{p.row.losses}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-gray font-mono">No matches played yet</p>
                )}
                {p.row && <div className="mt-1"><BadgeRow row={p.row} size="sm" /></div>}
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-gray/40 group-hover:text-court-green transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
