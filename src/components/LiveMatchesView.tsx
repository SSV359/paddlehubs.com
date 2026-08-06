/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import { LiveScoreboardModal } from './LiveScoreboardModal';
import type { LiveMatch, ScheduleFixture } from '../types';
import { Radio, Trophy } from 'lucide-react';

export const LiveMatchesView: React.FC = () => {
  const { tournaments, api } = useAppState();
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState<LiveMatch | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => api.listAllLiveMatches().then((r: any) => { if (!cancelled) { setLiveMatches(r.items); setLoading(false); } }).catch(() => setLoading(false));
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const tournamentName = (id: string) => tournaments.find((t) => t.id === id)?.name || 'Tournament';

  // This dashboard is a pure spectator view — player names are shown
  // (the live match record carries the fixture's specific pairing now),
  // but it still doesn't know whether the viewer themselves is one of
  // those players, since determining that would mean loading every
  // tournament's full roster data just to render this one page. The
  // real "manage this score" experience lives on the tournament's own
  // Schedule tab, where that authorization check already has full context.
  const asMinimalFixture = (lm: LiveMatch): ScheduleFixture => ({
    fixtureId: lm.fixtureId,
    teamAId: lm.teamAId,
    teamBId: lm.teamBId,
    court: lm.court,
    gameType: lm.gameType,
    gamesPlayed: lm.games.length,
    teamAPlayers: lm.teamAPlayers,
    teamBPlayers: lm.teamBPlayers,
    matchId: '',
  });

  const minimalTour = watching ? tournaments.find((t) => t.id === watching.tournamentId) : null;

  return (
    <div className="space-y-6" id="live-matches-view">
      <div className="flex items-center gap-2 mb-1.5">
        <Radio className="w-5 h-5 text-rose-500 shrink-0 animate-pulse" />
        <span className="text-[10px] font-bold text-rose-500 font-mono tracking-widest uppercase leading-none">HAPPENING NOW</span>
      </div>
      <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase -mt-4">Live Matches</h1>
      <p className="text-slate-gray text-xs -mt-3">Every match currently being scored live, across every tournament.</p>

      {loading ? (
        <div className="text-center py-16 text-xs text-slate-gray font-mono">Checking for live matches...</div>
      ) : liveMatches.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white shadow-sm">
          <Radio className="w-10 h-10 text-slate-gray mx-auto mb-3" />
          <h3 className="text-sm font-bold text-charcoal">Nothing live right now</h3>
          <p className="text-xs text-slate-gray mt-1">Live matches show up here automatically once someone starts courtside scoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveMatches.map((lm) => (
            <button
              key={`${lm.tournamentId}-${lm.fixtureId}`}
              onClick={() => setWatching(lm)}
              className="text-left bg-deep-navy border border-rose-500/20 rounded-2xl p-4 shadow-md hover:border-rose-500/40 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-rose-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Live
                </span>
                <span className="text-[9px] font-mono text-slate-400 uppercase">{lm.court}</span>
              </div>

              <div className="flex items-center gap-1.5 text-[9px] font-mono text-soft-gold uppercase mb-2 truncate">
                <Trophy className="w-3 h-3 shrink-0" /> {tournamentName(lm.tournamentId)}
              </div>

              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-white truncate block">{lm.teamAName}</span>
                  {lm.teamAPlayers.length > 0 && <span className="text-[10px] text-slate-400 font-mono truncate block">{lm.teamAPlayers.map((p) => p.name).join(' & ')}</span>}
                </div>
                <span className="text-2xl font-display font-black text-white ml-2 shrink-0">{lm.liveA}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-white truncate block">{lm.teamBName}</span>
                  {lm.teamBPlayers.length > 0 && <span className="text-[10px] text-slate-400 font-mono truncate block">{lm.teamBPlayers.map((p) => p.name).join(' & ')}</span>}
                </div>
                <span className="text-2xl font-display font-black text-white ml-2 shrink-0">{lm.liveB}</span>
              </div>

              {lm.games.length > 0 && (
                <p className="text-[9px] font-mono text-slate-500 mt-2">Games so far: {lm.games.map((g) => `${g.a}-${g.b}`).join(', ')}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {watching && minimalTour && (
        <LiveScoreboardModal
          tour={minimalTour}
          fixture={asMinimalFixture(watching)}
          weekDate=""
          api={api}
          readOnly
          onClose={() => setWatching(null)}
          onFinished={() => setWatching(null)}
        />
      )}
    </div>
  );
};
