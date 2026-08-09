/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useAppState } from '../AppContext';
import { defaultAvatar } from '../utils/avatar';
import { encodeProfileId } from '../utils/profileId';
import { Newspaper, Trophy, Calendar, Award, ArrowUpRight, Medal, Crown } from 'lucide-react';

export const ClubNewsView: React.FC = () => {
  const { tournaments, playerRankings, navigateTo, refreshPlayerRankings } = useAppState();

  useEffect(() => { refreshPlayerRankings(); }, []);

  const today = new Date().toISOString().slice(0, 10);

  const recentChampions = tournaments
    .filter((t) => t.winners?.first?.teamId)
    .sort((a, b) => (b.winnersUpdatedAt || '').localeCompare(a.winnersUpdatedAt || ''))
    .slice(0, 4);

  const upcoming = tournaments
    .filter((t) => !t.endDate || t.endDate >= today)
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
    .slice(0, 6);

  const top10 = [...playerRankings].sort((a, b) => (a.rank || 0) - (b.rank || 0)).slice(0, 10);

  return (
    <div className="space-y-8" id="club-news-view">
      <div className="flex items-center gap-2 mb-1.5">
        <Newspaper className="w-5 h-5 text-court-green shrink-0" />
        <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">WHAT'S HAPPENING</span>
      </div>
      <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase -mt-6">Club News</h1>
      <p className="text-slate-gray text-xs -mt-5">Recent champions, upcoming tournaments, and the current top 10 — all in one place.</p>

      {/* Recently Crowned Champions */}
      {recentChampions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-soft-gold" />
            <h2 className="text-xs font-display font-bold text-charcoal uppercase tracking-wide">Recently Crowned</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentChampions.map((t) => {
              const first = t.winners!.first!;
              const teamName = (t.teams || []).find((tm) => tm.id === first.teamId)?.name || 'Champions';
              return (
                <button
                  key={t.id}
                  onClick={() => navigateTo('tournament-hub', t.id)}
                  className="bg-white border border-light-border rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:border-court-green/40 hover:shadow-md transition-all cursor-pointer group"
                >
                  {first.photoDataUrl ? (
                    <img src={first.photoDataUrl} alt={teamName} className="w-14 h-14 rounded-xl object-cover border border-light-border shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-soft-gold/10 border border-soft-gold/20 flex items-center justify-center shrink-0">
                      <Trophy className="w-6 h-6 text-soft-gold" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-mono font-bold text-soft-gold uppercase truncate">{t.name}</p>
                    <p className="text-sm font-bold text-charcoal truncate group-hover:text-court-green transition-colors">🏆 {teamName}</p>
                    <p className="text-[10px] text-slate-gray">Champions &middot; hosted by {t.ownerDisplayName}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-gray/40 group-hover:text-court-green transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Tournaments */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-court-green" />
            <h2 className="text-xs font-display font-bold text-charcoal uppercase tracking-wide">Upcoming Tournaments</h2>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-light-border rounded-2xl bg-white text-slate-gray text-xs">
              Nothing scheduled right now.
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigateTo('tournament-hub', t.id)}
                  className="w-full bg-white border border-light-border rounded-xl p-4 shadow-sm flex items-center justify-between gap-3 text-left hover:border-court-green/40 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-charcoal truncate group-hover:text-court-green transition-colors">{t.name}</p>
                    <p className="text-[10px] text-slate-gray font-mono mt-0.5">{t.startDate} to {t.endDate}</p>
                    <p className="text-[10px] text-slate-gray mt-0.5">Owned by <span className="font-semibold text-charcoal">{t.ownerDisplayName}</span></p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-gray/40 group-hover:text-court-green transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Top 10 Rankings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-court-green" />
            <h2 className="text-xs font-display font-bold text-charcoal uppercase tracking-wide">Top 10 Players</h2>
          </div>
          {top10.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-light-border rounded-2xl bg-white text-slate-gray text-xs">
              No ranked players yet.
            </div>
          ) : (
            <div className="bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
              {top10.map((p) => (
                <button
                  key={p.player}
                  onClick={() => navigateTo('profile', encodeProfileId(p.email, p.player))}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-off-white/50 transition-all text-left cursor-pointer group"
                >
                  <div className="w-7 flex items-center justify-center shrink-0">
                    {p.rank === 1 ? <Crown className="w-4 h-4 text-soft-gold" /> : p.rank === 2 ? <Medal className="w-4 h-4 text-slate-400" /> : p.rank === 3 ? <Medal className="w-4 h-4 text-amber-700" /> : <span className="text-xs font-mono font-bold text-slate-gray">{p.rank}</span>}
                  </div>
                  <img src={p.avatarDataUrl || defaultAvatar(p.player)} alt={p.player} className="w-8 h-8 rounded-lg object-cover border border-light-border shrink-0" referrerPolicy="no-referrer" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-charcoal truncate group-hover:text-court-green transition-colors">{p.player}</p>
                    <p className="text-[9px] text-slate-gray font-mono">{p.wins}-{p.losses} &middot; {p.duprRating != null ? `DUPR ${p.duprRating.toFixed(2)}` : 'No DUPR'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
