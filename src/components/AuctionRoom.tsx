/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Tournament, Auction, AuctionLevel, RosterPlayer } from '../types';
import { Gavel, Plus, Trash2, Copy, CheckCircle2, Sparkles, RotateCcw, Play, X } from 'lucide-react';

interface Props {
  tournament: Tournament;
  isAdmin: boolean;
  onChanged: () => void;
  api: any; // typeof api, passed in from parent to avoid a context re-import cycle
}

export const AuctionRoom: React.FC<Props & { api: any }> = ({ tournament, isAdmin, onChanged, api }) => {
  const [auction, setAuction] = useState<Auction | null>(tournament.auction || null);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [captainToken, setCaptainToken] = useState<string>('');
  const [yourTeamId, setYourTeamId] = useState<string | null>(null);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('captainToken');
    if (token) setCaptainToken(token);
  }, []);

  const poll = useCallback(async () => {
    try {
      const r = await api.getAuctionState(tournament.id, captainToken || undefined);
      setAuction(r.auction);
      setCurrentTeamId(r.currentTeamId);
      setYourTeamId(r.yourTeamId);
      setIsYourTurn(r.isYourTurn);
    } catch {
      // Auction not set up yet, or tournament changed — quietly ignore.
    }
  }, [tournament.id, captainToken]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  if (!auction) {
    return isAdmin ? (
      <AuctionSetup tournament={tournament} api={api} onSetup={(a) => { setAuction(a); onChanged(); }} />
    ) : (
      <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white text-slate-gray text-xs">
        No player auction has been set up for this tournament yet.
      </div>
    );
  }

  const requiredLevel = auction.levels[auction.currentRound - 1];
  const eligiblePlayers = requiredLevel ? requiredLevel.players.filter((p) => !auction.draftedPlayers.includes(p.name)) : [];

  return (
    <div className="space-y-6 animate-fadeIn">
      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}

      {/* Status Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-deep-navy border border-deep-navy/80 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-court-green/20 border border-court-green/30 flex items-center justify-center text-court-green">
            <Gavel className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-display font-bold uppercase tracking-tight">
              {auction.status === 'setup' ? 'Auction Ready' : auction.status === 'card_draw' ? 'Card Draw In Progress' : auction.status === 'drafting' ? `Round ${auction.currentRound} — Drafting` : auction.status === 'round_complete' ? `Round ${auction.currentRound} Complete` : 'Auction Complete'}
            </h2>
            <p className="text-slate-400 text-xs font-mono">{auction.levels[auction.currentRound - 1]?.name ? `Now drafting from: ${auction.levels[auction.currentRound - 1].name}` : ''}</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {(auction.status === 'setup' || auction.status === 'round_complete') && auction.currentRound < 4 && (
              <button onClick={async () => { const r = await api.startAuctionRound(tournament.id); setAuction(r.auction); }} className="px-3.5 py-2 rounded-lg bg-court-green hover:bg-[#235F3A] text-xs font-bold font-mono uppercase text-white cursor-pointer flex items-center gap-1.5">
                <Play className="w-4 h-4" /> Start Round {auction.currentRound + 1}
              </button>
            )}
            <button onClick={async () => { if (confirm('Reset the entire auction?')) { await api.resetAuction(tournament.id); setAuction(null); onChanged(); } }} className="px-3.5 py-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-xs font-bold font-mono uppercase text-red-400 cursor-pointer flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Captains / pick order */}
        <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Franchise Captains</h3>
          <div className="space-y-2">
            {auction.captains.map((c) => {
              const isOnClock = currentTeamId === c.teamId && (auction.status === 'drafting');
              const cardValue = auction.cardDraws[c.teamId];
              return (
                <div key={c.teamId} className={`flex items-center justify-between p-3 rounded-xl border text-xs ${isOnClock ? 'bg-court-green/10 border-court-green/40' : 'bg-off-white border-light-border'}`}>
                  <div>
                    <span className="font-bold text-charcoal block">{c.teamName}</span>
                    <span className="text-[10px] text-slate-gray font-mono">{c.captainName}</span>
                  </div>
                  <div className="text-right">
                    {cardValue != null && <span className="block text-[10px] font-mono text-slate-gray">Card #{cardValue}</span>}
                    {isOnClock && <span className="text-[10px] font-bold font-mono text-court-green uppercase">On the clock</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {isAdmin && auction.status === 'setup' && (
            <div className="pt-2 border-t border-light-border space-y-1.5">
              <span className="text-[9px] font-mono uppercase text-slate-gray font-bold block">Captain Links (share privately)</span>
              {auction.captains.map((c) => c.accessToken && (
                <CaptainLinkRow key={c.teamId} tournamentId={tournament.id} label={c.teamName} token={c.accessToken} />
              ))}
            </div>
          )}
        </div>

        {/* Your turn / draw card */}
        <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Your Console</h3>
          {!captainToken ? (
            <p className="text-xs text-slate-gray">Use your private captain link to draw cards and make picks.</p>
          ) : auction.status === 'card_draw' ? (
            <button
              onClick={async () => { try { const r = await api.drawAuctionCard(tournament.id, captainToken); setAuction(r.auction); } catch (e: any) { setError(e.message); } }}
              className="w-full py-3 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Draw Your Card
            </button>
          ) : isYourTurn ? (
            <PickForm eligiblePlayers={eligiblePlayers} onPick={async (player) => {
              try { const r = await api.pickAuctionPlayer(tournament.id, captainToken, player); setAuction(r.auction); } catch (e: any) { setError(e.message); }
            }} />
          ) : (
            <p className="text-xs text-slate-gray">Waiting for your turn...</p>
          )}
        </div>

        {/* Live pick log */}
        <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Live Selection Ticker</h3>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {auction.picks.length === 0 ? (
              <p className="text-xs text-slate-gray">No picks yet.</p>
            ) : auction.picks.slice().reverse().map((p, i) => (
              <div key={i} className="flex justify-between text-xs bg-off-white rounded-lg px-3 py-2">
                <span className="font-bold text-charcoal">{p.playerName}</span>
                <span className="text-slate-gray font-mono">{p.teamName} &middot; R{p.round}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CaptainLinkRow: React.FC<{ tournamentId: string; label: string; token: string }> = ({ tournamentId, label, token }) => {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?tournamentId=${tournamentId}&captainToken=${token}`;
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] font-mono bg-off-white border border-light-border rounded-lg px-2 py-1.5">
      <span className="truncate text-slate-gray">{label}</span>
      <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-court-green hover:underline cursor-pointer shrink-0 flex items-center gap-1">
        {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy Link'}
      </button>
    </div>
  );
};

const PickForm: React.FC<{ eligiblePlayers: RosterPlayer[]; onPick: (player: RosterPlayer) => void }> = ({ eligiblePlayers, onPick }) => {
  const [selectedKey, setSelectedKey] = useState('');
  const playerKey = (p: RosterPlayer) => p.email || p.name;
  const selected = eligiblePlayers.find((p) => playerKey(p) === selectedKey) || null;
  return (
    <div className="space-y-2">
      <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-2 py-2">
        <option value="">-- Select a player --</option>
        {eligiblePlayers.map((p) => <option key={playerKey(p)} value={playerKey(p)}>{p.name}</option>)}
      </select>
      <button
        onClick={() => selected && onPick(selected)}
        disabled={!selected}
        className="w-full py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase cursor-pointer disabled:opacity-50"
      >
        Confirm Pick
      </button>
    </div>
  );
};

const AuctionSetup: React.FC<{ tournament: Tournament; api: any; onSetup: (a: Auction) => void }> = ({ tournament, api, onSetup }) => {
  const eligibleCaptainTeams = (tournament.teams || []).filter((t) => t.captain);
  const [format, setFormat] = useState<Auction['format']>('mens_doubles');
  const [captainTeamIds, setCaptainTeamIds] = useState<string[]>([]);
  const [levels, setLevels] = useState<AuctionLevel[]>([{ name: 'Top Level', players: [] }]);
  const [manualName, setManualName] = useState<Record<number, string>>({});
  const [manualEmail, setManualEmail] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const playerKey = (p: RosterPlayer) => p.email || p.name;

  const toggleCaptain = (id: string) => {
    setCaptainTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const addLevel = () => setLevels((prev) => [...prev, { name: `Level ${prev.length + 1}`, players: [] }]);
  const removeLevel = (idx: number) => setLevels((prev) => prev.filter((_, i) => i !== idx));
  const addPlayerToLevel = (idx: number, player: RosterPlayer) => {
    if (!player.name.trim()) return;
    setLevels((prev) => prev.map((l, i) => (i === idx ? { ...l, players: [...l.players, player] } : l)));
  };
  const addManualPlayerToLevel = (idx: number) => {
    const name = (manualName[idx] || '').trim();
    const email = (manualEmail[idx] || '').trim().toLowerCase();
    if (!name) return;
    addPlayerToLevel(idx, { name, email });
    setManualName({ ...manualName, [idx]: '' });
    setManualEmail({ ...manualEmail, [idx]: '' });
  };
  const removePlayerFromLevel = (idx: number, key: string) => {
    setLevels((prev) => prev.map((l, i) => (i === idx ? { ...l, players: l.players.filter((p) => playerKey(p) !== key) } : l)));
  };

  // Registered players (from the tournament's registrant pool) not yet
  // placed into any skill level — the picklist "add registered player"
  // draws from. Matched by email, the real identity key.
  const assignedToLevels = new Set(levels.flatMap((l) => l.players.map((p) => p.email).filter(Boolean)));
  const unassignedPool = (tournament.playerPool || []).filter((p) => !p.email || !assignedToLevels.has(p.email));

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const r = await api.setupAuction(tournament.id, { format, captainTeamIds, levels });
      onSetup(r.auction);
    } catch (e: any) {
      setError(e?.message || 'Failed to set up the auction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-light-border rounded-2xl p-6 shadow-sm space-y-5 animate-fadeIn max-w-2xl">
      <h3 className="font-display font-bold text-lg text-charcoal">Set Up Player Auction</h3>
      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}

      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Format</label>
        <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2">
          <option value="mens_doubles">Men's Doubles</option>
          <option value="womens_doubles">Women's Doubles</option>
          <option value="womens_singles">Women's Singles</option>
          <option value="mens_singles">Men's Singles</option>
          <option value="mixed_doubles">Mixed Doubles</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Franchise Captains (teams must already have a captain set)</label>
        {eligibleCaptainTeams.length === 0 ? (
          <p className="text-xs text-slate-gray">No teams have a captain assigned yet — set one in Teams & Roster first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {eligibleCaptainTeams.map((t) => (
              <button key={t.id} type="button" onClick={() => toggleCaptain(t.id)} className={`text-xs px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${captainTeamIds.includes(t.id) ? 'bg-court-green text-white border-court-green' : 'bg-off-white border-light-border text-charcoal'}`}>
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="text-[9px] font-mono uppercase text-slate-gray font-bold block">Player Skill Levels (Round 1 = Level 1, top players first)</label>
        {unassignedPool.length === 0 && (tournament.playerPool || []).length === 0 && (
          <p className="text-[10px] text-slate-gray">No registered players synced yet — sync registrants in Teams & Roster, or type names manually below.</p>
        )}
        {levels.map((level, idx) => (
          <div key={idx} className="bg-off-white border border-light-border rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input value={level.name} onChange={(e) => { const val = e.target.value; setLevels((prev) => prev.map((l, i) => (i === idx ? { ...l, name: val } : l))); }} className="flex-1 text-xs font-bold bg-white border border-light-border rounded-lg px-2 py-1.5" />
              <button onClick={() => removeLevel(idx)} className="text-slate-gray hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {level.players.map((p) => (
                <span key={playerKey(p)} className="text-[10px] font-mono bg-white border border-light-border px-2 py-1 rounded flex items-center gap-1">
                  {p.name}
                  <button
                    type="button"
                    onClick={() => removePlayerFromLevel(idx, playerKey(p))}
                    className="text-slate-gray hover:text-red-600 cursor-pointer"
                  ><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            {unassignedPool.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const found = unassignedPool.find((p) => playerKey(p) === e.target.value);
                  if (found) addPlayerToLevel(idx, found);
                }}
                className="w-full text-xs bg-white border border-light-border rounded-lg px-2 py-1.5"
              >
                <option value="">-- Add Registered Player --</option>
                {unassignedPool.map((p) => <option key={playerKey(p)} value={playerKey(p)}>{p.name}{p.email ? ` (${p.email})` : ''}</option>)}
              </select>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <input
                value={manualName[idx] || ''}
                onChange={(e) => setManualName({ ...manualName, [idx]: e.target.value })}
                placeholder="Name (manual entry)"
                className="text-xs bg-white border border-light-border rounded-lg px-2 py-1.5"
              />
              <input
                value={manualEmail[idx] || ''}
                onChange={(e) => setManualEmail({ ...manualEmail, [idx]: e.target.value })}
                placeholder="Email (optional)"
                className="text-xs bg-white border border-light-border rounded-lg px-2 py-1.5"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualPlayerToLevel(idx); } }}
              />
            </div>
            <button onClick={() => addManualPlayerToLevel(idx)} className="w-full py-1.5 bg-court-green/10 text-court-green rounded-lg text-[10px] font-bold font-mono uppercase cursor-pointer flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Manually
            </button>
          </div>
        ))}
        <button onClick={addLevel} className="text-xs font-bold font-mono text-court-green hover:underline cursor-pointer flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Level</button>
      </div>

      <button onClick={submit} disabled={submitting || captainTeamIds.length < 2 || levels.some(l => l.players.length === 0)} className="w-full py-3 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase cursor-pointer disabled:opacity-50">
        {submitting ? 'Setting up...' : 'Launch Auction'}
      </button>
    </div>
  );
};
