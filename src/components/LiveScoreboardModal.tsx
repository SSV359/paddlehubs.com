/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Tournament, ScheduleFixture, LiveMatch } from '../types';
import { X, Plus, Minus, Undo2, Flag, Radio } from 'lucide-react';
import { MatchTimer } from './MatchTimer';

export const LiveScoreboardModal: React.FC<{
  tour: Tournament;
  fixture: ScheduleFixture;
  weekDate: string;
  api: any;
  onClose: () => void;
  onFinished: (matchId: string) => void;
  readOnly?: boolean;
}> = ({ tour, fixture, weekDate, api, onClose, onFinished, readOnly }) => {
  const [live, setLive] = useState<LiveMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const teamA = (tour.teams || []).find((t) => t.id === fixture.teamAId);
  const teamB = (tour.teams || []).find((t) => t.id === fixture.teamBId);

  const load = useCallback(async () => {
    try {
      const r = await api.getLiveMatch(tour.id, fixture.fixtureId);
      setLive('teamAId' in r ? (r as LiveMatch) : null);
    } catch {
      setLive(null);
    } finally {
      setLoading(false);
    }
  }, [tour.id, fixture.fixtureId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load]);

  const start = async () => {
    setError(null);
    try {
      const r = await api.startLiveMatch(tour.id, fixture.fixtureId, {
        teamAId: fixture.teamAId,
        teamBId: fixture.teamBId,
        court: fixture.court,
        gameType: fixture.gameType,
      });
      setLive(r);
    } catch (e: any) {
      setError(e?.message || 'Could not start live scoring.');
    }
  };

  const [actionPending, setActionPending] = useState(false);

  const act = async (action: string) => {
    if (actionPending) return; // a tap is already in flight — ignore a second one landing before it resolves
    setActionPending(true);
    setError(null);
    try {
      const r = await api.updateLiveMatch(tour.id, fixture.fixtureId, action);
      setLive(r);
    } catch (e: any) {
      setError(e?.message || 'Could not update score.');
    } finally {
      setActionPending(false);
    }
  };

  const finish = async () => {
    if (!live) return;
    setError(null);
    // Fold the in-progress game into the final record too, if it has
    // any points on the board — otherwise a match ended mid-game would
    // silently lose that game's score.
    const games = [...live.games];
    if (live.liveA > 0 || live.liveB > 0) games.push({ a: live.liveA, b: live.liveB });
    if (games.length === 0) { setError('No games have been played yet.'); return; }

    setFinishing(true);
    try {
      const match = await api.createTournamentMatch(tour.id, {
        date: weekDate,
        court: live.court,
        gameType: live.gameType,
        teamAId: live.teamAId,
        teamBId: live.teamBId,
        gamesPlayed: games.length,
        games,
        teamAPlayers: fixture.teamAPlayers,
        teamBPlayers: fixture.teamBPlayers,
      });
      await api.endLiveMatch(tour.id, fixture.fixtureId);
      onFinished(match.id);
    } catch (e: any) {
      setError(e?.message || 'Failed to save the final match.');
    } finally {
      setFinishing(false);
    }
  };

  const cancel = async () => {
    if (!confirm('End live scoring without saving a match? All points will be lost.')) return;
    await api.endLiveMatch(tour.id, fixture.fixtureId).catch(() => {});
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-deep-navy text-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
            <h3 className="font-display font-bold text-sm">Live Scoring</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {error && <p className="text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">{error}</p>}

          {loading ? (
            <p className="text-xs text-slate-400 text-center py-8">Loading...</p>
          ) : !live ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-sm text-slate-300">{teamA?.name || 'Team A'} vs {teamB?.name || 'Team B'}</p>
              {readOnly ? (
                <p className="text-xs text-slate-500">This match isn't live right now.</p>
              ) : (
                <button onClick={start} className="px-5 py-3 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase cursor-pointer transition-all">
                  Start Live Scoring
                </button>
              )}
            </div>
          ) : (
            <>
              {!readOnly && <MatchTimer minutes={12} />}

              {/* Completed games so far */}
              {live.games.length > 0 && (
                <div className="flex justify-center gap-2">
                  {live.games.map((g, i) => (
                    <span key={i} className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-1 rounded">{g.a}-{g.b}</span>
                  ))}
                </div>
              )}

              {/* Current game scoreboard */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center space-y-2">
                  <p className="text-xs font-bold text-slate-300 truncate">{live.teamAName}</p>
                  {live.teamAPlayers.length > 0 && (
                    <p className="text-[9px] text-slate-500 font-mono truncate">{live.teamAPlayers.map((p) => p.name).join(' & ')}</p>
                  )}
                  <p className="text-5xl font-display font-black">{live.liveA}</p>
                  {!readOnly && (
                    <div className="flex justify-center gap-1.5">
                      <button onClick={() => act('undo_a')} disabled={actionPending} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><Minus className="w-4 h-4" /></button>
                      <button onClick={() => act('point_a')} disabled={actionPending} className="w-9 h-9 rounded-lg bg-court-green hover:bg-[#235F3A] flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><Plus className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                <div className="text-center space-y-2">
                  <p className="text-xs font-bold text-slate-300 truncate">{live.teamBName}</p>
                  {live.teamBPlayers.length > 0 && (
                    <p className="text-[9px] text-slate-500 font-mono truncate">{live.teamBPlayers.map((p) => p.name).join(' & ')}</p>
                  )}
                  <p className="text-5xl font-display font-black">{live.liveB}</p>
                  {!readOnly && (
                    <div className="flex justify-center gap-1.5">
                      <button onClick={() => act('undo_b')} disabled={actionPending} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><Minus className="w-4 h-4" /></button>
                      <button onClick={() => act('point_b')} disabled={actionPending} className="w-9 h-9 rounded-lg bg-court-green hover:bg-[#235F3A] flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><Plus className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>

              {!readOnly && (
                <button onClick={() => act('complete_game')} disabled={actionPending} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/15 text-xs font-bold font-mono uppercase text-slate-300 hover:text-white hover:border-white/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  <Undo2 className="w-4 h-4 rotate-180" /> Complete This Game
                </button>
              )}

              {readOnly ? (
                <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-white/10 text-[10px] font-mono text-slate-400 uppercase">
                  <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Watching live &mdash; scoring managed by the players
                </div>
              ) : (
                <div className="flex gap-2 pt-2 border-t border-white/10">
                  <button onClick={cancel} className="flex-1 py-2.5 rounded-xl text-xs font-bold font-mono uppercase text-slate-400 hover:text-white cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={finish} disabled={finishing} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-soft-gold hover:bg-soft-gold/90 text-deep-navy text-xs font-bold font-mono uppercase cursor-pointer disabled:opacity-60">
                    <Flag className="w-4 h-4" /> {finishing ? 'Saving...' : 'Finish Match'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
