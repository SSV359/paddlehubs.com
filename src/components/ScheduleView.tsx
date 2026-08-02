/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import { CalendarDays, Search, MapPin, Clock, Award, Activity, AlertCircle, Trophy } from 'lucide-react';

type ScheduleFilter = 'all' | 'upcoming' | 'completed';
const today = () => new Date().toISOString().slice(0, 10);

export const ScheduleView: React.FC = () => {
  // Three real sources get merged into one timeline here: informal
  // club-wide matches (always completed — a match record only exists
  // once it's played), court bookings (the closest thing to a personal
  // "scheduled but not yet played" entry), and — the piece that was
  // missing — each tournament's own weekly/round fixture plan, fetched
  // per-tournament since the backend has no single cross-tournament
  // fixtures feed.
  const { clubMatches, clubBookings, tournaments, navigateTo, api } = useAppState();
  const [filter, setFilter] = useState<ScheduleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tourFixtures, setTourFixtures] = useState<
    { id: string; date: string; court: string; tourId: string; tourName: string; tourLogo: string; teamA: string; teamB: string }[]
  >([]);

  useEffect(() => {
    if (tournaments.length === 0) return;
    let cancelled = false;
    Promise.all(
      tournaments.map((t) =>
        api.getTournamentSchedule(t.id).then((sched: any) => ({ t, sched })).catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const rows: typeof tourFixtures = [];
      for (const r of results) {
        if (!r) continue;
        const { t, sched } = r;
        for (const w of sched.weeks || []) {
          if (w.skipped) continue;
          for (const f of w.fixtures || []) {
            if (f.matchId) continue; // already played — shows up via Match History instead
            const teamA = (t.teams || []).find((tm: any) => tm.id === f.teamAId)?.name || 'TBD';
            const teamB = (t.teams || []).find((tm: any) => tm.id === f.teamBId)?.name || 'TBD';
            rows.push({
              id: `${t.id}-${w.week}-${f.teamAId}-${f.teamBId}-${teamA}-${teamB}-${rows.length}`,
              date: w.date, court: f.court, tourId: t.id, tourName: t.name, tourLogo: t.logoDataUrl || '',
              teamA, teamB,
            });
          }
        }
      }
      setTourFixtures(rows);
    });
    return () => { cancelled = true; };
  }, [tournaments]);

  type Row =
    | { kind: 'completed'; date: string; court: string; id: string; matchup: string; scoreA: number; scoreB: number; winner: string; gameType: string }
    | { kind: 'booking'; date: string; time: string; court: string; id: string; matchup: string }
    | { kind: 'fixture'; date: string; court: string; id: string; tourId: string; tourName: string; tourLogo: string; teamA: string; teamB: string };

  const rows: Row[] = [
    ...clubMatches.map((m) => ({
      kind: 'completed' as const, date: m.date, court: m.court, id: m.id,
      matchup: m.matchup, scoreA: m.scoreA, scoreB: m.scoreB, winner: m.winner, gameType: m.gameType,
    })),
    ...clubBookings.map((b) => ({
      kind: 'booking' as const, date: b.date, time: b.time, court: b.court, id: b.id,
      matchup: b.players || b.ownerDisplayName,
    })),
    ...tourFixtures.map((f) => ({ kind: 'fixture' as const, ...f })),
  ].sort((a, b) => (a.kind === 'completed' ? -1 : 1) === (b.kind === 'completed' ? -1 : 1) ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

  const filteredRows = rows.filter((r) => {
    const isCompleted = r.kind === 'completed';
    if (filter === 'upcoming' && isCompleted) return false;
    if (filter === 'completed' && !isCompleted) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const haystack = r.kind === 'fixture' ? `${r.teamA} ${r.teamB} ${r.tourName}` : r.kind === 'completed' ? r.matchup : r.matchup;
      return haystack.toLowerCase().includes(q) || r.court.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6" id="schedule-section">
      {/* Header block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-light-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <CalendarDays className="w-5 h-5 text-court-green shrink-0" />
            <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">CENTRAL CALENDAR</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase">
            Schedule & Fixtures
          </h1>
          <p className="text-slate-gray text-xs mt-1">
            Track times, court allocations, and scores across all active and upcoming leagues.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-gray absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search matchup, tournament, court..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-charcoal placeholder-slate-gray/60 border border-light-border rounded-xl py-2 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-court-green focus:ring-1 focus:ring-court-green/20 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
        {(['all', 'upcoming', 'completed'] as ScheduleFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider rounded-lg border cursor-pointer transition-all ${
              filter === f
                ? 'bg-deep-navy border-deep-navy text-white shadow-sm'
                : 'bg-transparent border-transparent text-slate-gray hover:text-charcoal'
            }`}
          >
            {f === 'all' ? 'All Fixtures' : f}
          </button>
        ))}
      </div>

      {/* Matches List Grid */}
      {filteredRows.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white max-w-lg mx-auto shadow-sm">
          <CalendarDays className="w-10 h-10 text-slate-gray mx-auto mb-3" />
          <h3 className="text-sm font-bold text-charcoal">No Matches Scheduled</h3>
          <p className="text-xs text-slate-gray mt-1">There are no matching matches or scheduled fixtures found.</p>
        </div>
      ) : (
        <div className="space-y-4" id="fixtures-timeline">
          {filteredRows.map(row => {
            const isCompleted = row.kind === 'completed';
            const isFixture = row.kind === 'fixture';
            const sideA = isFixture ? row.teamA : isCompleted ? row.matchup.split(' vs ')[0] : row.matchup;
            const sideB = isFixture ? row.teamB : isCompleted ? row.matchup.split(' vs ')[1] : 'Court reserved';
            const isAWinner = isCompleted && (row as any).winner === sideA;

            return (
              <div
                key={row.id}
                onClick={() => isFixture && navigateTo('tournament-hub', row.tourId)}
                className={`bg-white border border-light-border rounded-2xl p-5 md:p-6 shadow-sm transition-all duration-300 relative overflow-hidden group hover:border-court-green/30 hover:shadow-md ${isFixture ? 'cursor-pointer' : ''}`}
              >
                {/* Visual Status Indicator Strip */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b ${
                  isCompleted
                    ? 'from-court-green via-[#123E25] to-[#0A1F13]'
                    : isFixture ? 'from-soft-gold via-[#6b5212] to-[#2e2103]' : 'from-blue-500 via-blue-900 to-[#172554]'
                } rounded-l-2xl z-20`} />

                <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-6">
                  {/* Column 1: Date & Type / Tournament logo */}
                  <div className="flex flex-col min-w-[180px] pl-2 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-6">
                    {isFixture ? (
                      <div className="flex items-center gap-2 mb-1">
                        {row.tourLogo ? (
                          <img src={row.tourLogo} alt={row.tourName} className="w-6 h-6 rounded object-cover border border-light-border" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-soft-gold/10 border border-soft-gold/20 flex items-center justify-center text-soft-gold">
                            <Trophy className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="text-[10px] font-medium text-soft-gold font-display tracking-widest uppercase truncate">{row.tourName}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">
                        {isCompleted ? (row as any).gameType : 'Court Booking'}
                      </span>
                    )}
                    <span className="text-xs text-charcoal font-bold mt-1.5">{row.date}</span>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] font-bold font-mono text-court-green bg-court-green/10 border border-court-green/20 px-2 py-0.5 rounded uppercase">
                        {row.court}
                      </span>
                    </div>
                  </div>

                  {/* Column 2: Scoreboard Matchup */}
                  <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6">
                    {/* Entry 1 */}
                    <div className="text-center sm:text-right w-full sm:w-48 truncate">
                      <span className={`text-base font-extrabold ${isCompleted && isAWinner ? 'text-court-green font-black' : isCompleted ? 'text-slate-gray' : 'text-charcoal'}`}>
                        {sideA || 'TBD'}
                      </span>
                    </div>

                    {/* Scores or VS indicator */}
                    {isCompleted ? (
                      <div className="flex gap-1.5 bg-court-green/5 p-2 rounded-2xl border border-court-green/15">
                        <div className="flex flex-col items-center justify-center font-mono w-8 h-10 rounded-lg bg-white border border-light-border">
                          <span className={`text-xs font-bold ${isAWinner ? 'text-court-green' : 'text-slate-gray'}`}>{(row as any).scoreA}</span>
                          <span className={`text-[10px] ${!isAWinner ? 'text-court-green' : 'text-slate-gray'}`}>{(row as any).scoreB}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center font-mono px-3 py-1.5 rounded-full bg-[#F8FAF7] border border-light-border text-[10px] font-bold text-slate-gray min-w-[56px]">
                        VS
                      </div>
                    )}

                    {/* Entry 2 */}
                    <div className="text-center sm:text-left w-full sm:w-48 truncate">
                      <span className={`text-base font-extrabold ${isCompleted && !isAWinner ? 'text-court-green font-black' : isCompleted ? 'text-slate-gray' : 'text-charcoal'}`}>
                        {sideB}
                      </span>
                    </div>
                  </div>

                  {/* Column 3: Time & Status */}
                  <div className="flex flex-row lg:flex-col justify-between lg:justify-center items-center lg:items-end min-w-[140px] pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 text-xs text-slate-gray">
                    <div className="space-y-1 text-left lg:text-right">
                      {row.kind === 'booking' && (
                        <div className="flex items-center gap-1.5 justify-start lg:justify-end">
                          <Clock className="w-3.5 h-3.5 text-slate-gray/60" />
                          <span className="font-mono font-bold text-charcoal">{(row as any).time}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 justify-start lg:justify-end text-slate-gray/60 text-[11px]">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{row.court}</span>
                      </div>
                    </div>

                    <div className="mt-0 lg:mt-3">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono text-court-green bg-court-green/10 border border-court-green/20 px-2.5 py-1 rounded">
                          <Award className="w-3.5 h-3.5 text-soft-gold" />
                          <span>FINAL</span>
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2.5 py-1 rounded ${
                          isFixture ? 'text-soft-gold bg-soft-gold/10 border border-soft-gold/20' : 'text-slate-gray bg-slate-100 border border-slate-200'
                        }`}>
                          <Activity className="w-3.5 h-3.5" />
                          <span>UPCOMING</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
