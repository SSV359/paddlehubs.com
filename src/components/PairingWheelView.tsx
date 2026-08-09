/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAppState } from '../AppContext';
import type { RosterPlayer } from '../types';
import { Sparkles, Users2, RotateCcw, Copy, Check, Trash2 } from 'lucide-react';

const WHEEL_COLORS = ['#1E7A4C', '#F2B705', '#7A2E2E', '#2D9C8F', '#B8892B', '#C1502E', '#0A1220', '#6B3FA0', '#D97B1F', '#00A896'];

export const PairingWheelView: React.FC = () => {
  const { tournaments } = useAppState();
  const [pool, setPool] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [sourceTournamentId, setSourceTournamentId] = useState('');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pending, setPending] = useState<string | null>(null); // first player picked for the current pair, awaiting a second
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const [justWon, setJustWon] = useState<string | null>(null); // name of whoever the last spin landed on — highlighted directly, not just implied by pointer angle
  const [byePlayer, setByePlayer] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const remaining = pool; // whoever's still left to be picked

  const loadFromTournament = (tournamentId: string) => {
    setSourceTournamentId(tournamentId);
    const t = tournaments.find((x) => x.id === tournamentId);
    if (!t) return;
    const map = new Map<string, RosterPlayer>();
    for (const p of t.playerPool || []) map.set(p.email || p.name, p);
    for (const team of t.teams || []) for (const p of team.players) map.set(p.email || p.name, p);
    setPool(Array.from(map.values()).map((p) => p.name));
    resetPairing(false);
  };

  const addNames = () => {
    const names = nameInput.split(/[\n,]/).map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setPool((prev) => [...prev, ...names]);
    setNameInput('');
  };

  const removeFromPool = (name: string) => setPool((prev) => prev.filter((n) => n !== name));

  const resetPairing = (clearPool = true) => {
    setPairs([]);
    setPending(null);
    setByePlayer(null);
    setRotation(0);
    if (clearPool) setPool([]);
  };

  const spin = () => {
    if (spinning || resetting || remaining.length === 0) return;
    setJustWon(null);

    // Odd one out with nobody left to pair against — auto-assign as bye
    // rather than spinning a wheel with only one segment on it.
    if (remaining.length === 1 && !pending) {
      setByePlayer(remaining[0]);
      setPool([]);
      return;
    }

    const n = remaining.length;
    const winnerIdx = Math.floor(Math.random() * n);
    // No pointer to land on anymore — the winner banner is the sole,
    // authoritative announcement of who was picked, so the spin amount
    // is purely for visual flair now, not tied to any target angle.
    const finalRotation = 5 * 360 + Math.random() * 360;

    // Every spin starts from a clean, known baseline (0) rather than
    // continuing from wherever it last stopped, so the animation always
    // has a full, consistent spin to work with.
    setResetting(true);
    setRotation(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setResetting(false);
        setSpinning(true);
        setRotation(finalRotation);
      });
    });

    setTimeout(() => {
      const winner = remaining[winnerIdx];
      setJustWon(winner);
      setPool((prev) => prev.filter((_, i) => i !== winnerIdx));
      if (pending) {
        setPairs((prev) => [...prev, [pending, winner]]);
        setPending(null);
      } else {
        setPending(winner);
      }
      setSpinning(false);
    }, 4000);
  };

  const copyPairs = () => {
    const lines = pairs.map((p, i) => `Pair ${i + 1}: ${p[0]} & ${p[1]}`);
    if (byePlayer) lines.push(`Bye: ${byePlayer}`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const n = remaining.length;
  const segmentAngle = n > 0 ? 360 / n : 0;

  return (
    <div className="space-y-6" id="pairing-wheel-view">
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="w-5 h-5 text-court-green shrink-0" />
        <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">RANDOM DRAW</span>
      </div>
      <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase -mt-4">Pairing Wheel</h1>
      <p className="text-slate-gray text-xs -mt-3">Spin to randomly pair players for doubles — no bias, no arguments.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: setup */}
        <div className="space-y-4">
          <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-display font-bold text-xs text-charcoal flex items-center gap-1.5"><Users2 className="w-4 h-4 text-court-green" /> Player Pool</h3>

            <select
              value={sourceTournamentId}
              onChange={(e) => e.target.value && loadFromTournament(e.target.value)}
              className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5"
            >
              <option value="">Load from a tournament...</option>
              {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <div className="flex gap-2">
              <textarea
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Or type names, one per line..."
                rows={3}
                className="flex-1 text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5 resize-none"
              />
            </div>
            <button onClick={addNames} className="w-full py-2 rounded-lg bg-court-green/10 text-court-green text-[10px] font-bold font-mono uppercase cursor-pointer hover:bg-court-green/20 transition-all">
              Add Names
            </button>

            {pool.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-light-border max-h-40 overflow-y-auto">
                {pool.map((name) => (
                  <span key={name} className="flex items-center gap-1 text-[10px] font-bold bg-off-white border border-light-border rounded-lg px-2 py-1">
                    {name}
                    <button onClick={() => removeFromPool(name)} className="text-slate-gray hover:text-red-600 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}

            <button onClick={() => resetPairing(true)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-light-border text-[10px] font-bold font-mono uppercase text-slate-gray hover:text-charcoal cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" /> Clear Everything
            </button>
          </div>

          {/* Results */}
          {(pairs.length > 0 || pending || byePlayer) && (
            <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-xs text-charcoal">Pairs</h3>
                {pairs.length > 0 && (
                  <button onClick={copyPairs} className="text-[9px] font-mono font-bold text-court-green hover:underline cursor-pointer uppercase flex items-center gap-1">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copy
                  </button>
                )}
              </div>
              {pairs.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-off-white rounded-lg px-3 py-2">
                  <span className="font-mono font-bold text-court-green">#{i + 1}</span>
                  <span className="font-bold text-charcoal">{p[0]}</span>
                  <span className="text-slate-gray">&</span>
                  <span className="font-bold text-charcoal">{p[1]}</span>
                </div>
              ))}
              {pending && (
                <div className="flex items-center gap-2 text-xs bg-soft-gold/10 border border-soft-gold/20 rounded-lg px-3 py-2">
                  <span className="font-bold text-charcoal">{pending}</span>
                  <span className="text-slate-gray">waiting for a partner — spin again</span>
                </div>
              )}
              {byePlayer && (
                <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <span className="font-bold text-charcoal">{byePlayer}</span>
                  <span className="text-slate-gray">gets a bye (odd number of players)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: the wheel */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center bg-white border border-light-border rounded-2xl p-8 shadow-sm">
          {n === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="w-10 h-10 text-slate-gray/40 mx-auto mb-3" />
              <p className="text-xs text-slate-gray">Add players to the pool to start spinning.</p>
            </div>
          ) : (
            <>
              <div className="relative w-80 h-80 mb-6">
                <div
                  className="w-full h-full rounded-full border-4 border-deep-navy shadow-xl relative overflow-hidden"
                  style={{
                    background: `conic-gradient(${remaining.map((_, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`).join(', ')})`,
                    transform: `rotate(${rotation}deg)`,
                    transition: resetting ? 'none' : spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                  }}
                >
                  {remaining.map((name, i) => {
                    const angle = i * segmentAngle + segmentAngle / 2;
                    const flip = angle > 90 && angle < 270;
                    return (
                      <div
                        key={name}
                        className="absolute top-1/2 left-1/2 origin-left"
                        style={{ transform: `rotate(${angle}deg)`, width: '50%' }}
                      >
                        <span
                          className="absolute text-[10px] font-bold text-white truncate"
                          style={{
                            left: '55%',
                            transform: `translateY(-50%) ${flip ? 'rotate(180deg)' : ''}`,
                            maxWidth: '70px',
                          }}
                        >
                          {name}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-deep-navy border-4 border-white shadow-lg" />
              </div>

              {justWon && !spinning && (
                <div className="mb-4 px-5 py-2.5 rounded-xl bg-court-green/10 border border-court-green/30 text-court-green font-bold text-sm font-mono uppercase animate-fadeIn">
                  🎉 {justWon} selected!
                </div>
              )}

              <button
                onClick={spin}
                disabled={spinning || resetting}
                className="px-8 py-3 rounded-xl bg-court-green hover:bg-[#235F3A] text-white font-bold text-sm font-mono uppercase cursor-pointer shadow-md transition-all disabled:opacity-60"
              >
                {spinning ? 'Spinning...' : pending ? `Spin for ${pending}'s Partner` : 'Spin the Wheel'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
