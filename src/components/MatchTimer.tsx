/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Timer } from 'lucide-react';

const DEFAULT_MINUTES = 12;
// Spoken warnings as the clock counts down — checked once per second,
// each fires exactly once per countdown run.
const WARNING_SECONDS = [180, 120, 60, 30, 10];

function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // don't stack overlapping announcements
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MatchTimer: React.FC<{ minutes?: number; compact?: boolean }> = ({ minutes = DEFAULT_MINUTES, compact }) => {
  const [durationSec, setDurationSec] = useState(minutes * 60);
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const announcedRef = useRef<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDurationSec(minutes * 60);
    setRemaining(minutes * 60);
  }, [minutes]);

  const tick = useCallback(() => {
    setRemaining((prev) => {
      const next = prev - 1;
      if (WARNING_SECONDS.includes(next) && !announcedRef.current.has(next)) {
        announcedRef.current.add(next);
        const label = next >= 60 ? `${Math.round(next / 60)} minute${next >= 120 ? 's' : ''}` : `${next} seconds`;
        speak(`${label} remaining`, voiceOn);
      }
      if (next <= 0) {
        speak("Time! Match clock has ended.", voiceOn);
        setRunning(false);
        return 0;
      }
      return next;
    });
  }, [voiceOn]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, tick]);

  const start = () => {
    if (remaining <= 0) return;
    if (announcedRef.current.size === 0 || remaining === durationSec) {
      speak(`Match clock started. ${Math.round(durationSec / 60)} minutes on the clock.`, voiceOn);
    }
    setRunning(true);
  };
  const pause = () => { setRunning(false); window.speechSynthesis?.cancel(); };
  const reset = () => {
    setRunning(false);
    setRemaining(durationSec);
    announcedRef.current.clear();
    window.speechSynthesis?.cancel();
  };

  const isLastMinutes = remaining <= 120 && remaining > 0;
  const isDone = remaining <= 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`font-mono font-black text-lg ${isDone ? 'text-slate-500' : isLastMinutes ? 'text-rose-400' : 'text-white'}`}>
          {formatTime(remaining)}
        </span>
        <button onClick={running ? pause : start} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
          {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button onClick={reset} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setVoiceOn(!voiceOn)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
          {voiceOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-5 border transition-all ${isLastMinutes ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white/5 border-white/10'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-slate-300">
          <Timer className="w-3.5 h-3.5" /> Match Clock
        </span>
        <button onClick={() => setVoiceOn(!voiceOn)} title={voiceOn ? 'Voice announcements on' : 'Voice announcements off'} className="text-slate-400 hover:text-white cursor-pointer">
          {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      <p className={`text-center font-display font-black text-5xl mb-4 ${isDone ? 'text-slate-500' : isLastMinutes ? 'text-rose-400' : 'text-white'}`}>
        {formatTime(remaining)}
      </p>

      <div className="flex items-center justify-center gap-2 mb-3">
        {!running ? (
          <button onClick={start} disabled={isDone} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase cursor-pointer disabled:opacity-50">
            <Play className="w-4 h-4" /> Start
          </button>
        ) : (
          <button onClick={pause} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-soft-gold hover:bg-soft-gold/90 text-deep-navy text-xs font-bold font-mono uppercase cursor-pointer">
            <Pause className="w-4 h-4" /> Pause
          </button>
        )}
        <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold font-mono uppercase cursor-pointer">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {[10, 12, 15, 20].map((m) => (
          <button
            key={m}
            onClick={() => { setRunning(false); setDurationSec(m * 60); setRemaining(m * 60); announcedRef.current.clear(); }}
            className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold uppercase cursor-pointer ${
              durationSec === m * 60 ? 'bg-court-green text-white' : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {m}m
          </button>
        ))}
      </div>
    </div>
  );
};
