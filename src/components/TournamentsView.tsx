/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../AppContext';
import type { Tournament } from '../types';
import { CreateTournamentPanel } from './CreateTournamentPanel';
import { Activity, Calendar, Users, Award, PlayCircle, PlusCircle, Trophy, LayoutGrid, List, ChevronLeft, ChevronRight, X } from 'lucide-react';

type TourFilter = 'all' | 'active' | 'upcoming' | 'completed';
type ViewMode = 'cards' | 'compact' | 'calendar';

const today = () => new Date().toISOString().slice(0, 10);

// The real backend never sets a 'completed'/'upcoming' status field —
// status is always 'ACTIVE'. Lifecycle state is derived from dates here,
// the same way the backend itself derives "completed" for its public
// completed-tournaments endpoint.
const deriveStatus = (t: Tournament): 'active' | 'upcoming' | 'completed' => {
  const now = today();
  if (t.endDate && t.endDate < now) return 'completed';
  if (t.startDate && t.startDate > now) return 'upcoming';
  return 'active';
};

const isRegistrationOpen = (t: Tournament) => {
  const now = today();
  return (!t.registrationStartDate || t.registrationStartDate <= now) && (!t.registrationEndDate || t.registrationEndDate >= now);
};

const getFormatLabel = (t: Tournament) => (t.format === 'mlp_singles' ? 'MLP Singles' : 'Standard League');

const statusStyle = (status: 'active' | 'upcoming' | 'completed') =>
  status === 'active'
    ? { badge: 'bg-court-green/10 text-court-green border-court-green/20', dot: 'bg-court-green animate-pulse', bar: 'from-court-green via-[#123E25] to-[#0A1F13]' }
    : status === 'upcoming'
    ? { badge: 'bg-soft-gold/10 text-soft-gold border-soft-gold/20', dot: 'bg-soft-gold', bar: 'from-soft-gold via-[#6b5212] to-[#2e2103]' }
    : { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-450', bar: 'from-slate-400 via-slate-600 to-slate-800' };

export const TournamentsView: React.FC = () => {
  const { tournaments, navigateTo, isAdmin, isAuthenticated, api, refreshTournaments } = useAppState();
  const [filter, setFilter] = useState<TourFilter>('all');
  const [view, setView] = useState<ViewMode>('cards');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const filteredTournaments = tournaments.filter(t => {
    if (filter === 'all') return true;
    return deriveStatus(t) === filter;
  });

  return (
    <div className="space-y-6" id="tournaments-directory">
      {/* Header and Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-light-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-5 h-5 text-court-green shrink-0" />
            <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">TOURNAMENT DIRECTORY</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase">
            Pickleball Brackets & Leagues
          </h1>
          <p className="text-slate-gray text-xs mt-1">
            Browse and enter official local, state, and club level tournaments.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex bg-white p-1 rounded-xl border border-light-border shadow-sm">
            {(['all', 'active', 'upcoming', 'completed'] as TourFilter[]).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3.5 py-2 text-[10px] font-bold font-mono tracking-wider rounded-lg transition-all uppercase cursor-pointer ${
                  filter === status ? 'bg-deep-navy text-white shadow-sm' : 'text-slate-gray hover:text-charcoal'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex bg-white p-1 rounded-xl border border-light-border shadow-sm">
            {([
              { id: 'cards' as const, icon: LayoutGrid, label: 'Cards' },
              { id: 'compact' as const, icon: List, label: 'Compact' },
              { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setView(opt.id)}
                title={opt.label}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold font-mono uppercase rounded-lg transition-all cursor-pointer ${
                  view === opt.id ? 'bg-deep-navy text-white shadow-sm' : 'text-slate-gray hover:text-charcoal'
                }`}
              >
                <opt.icon className="w-3.5 h-3.5" /> {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredTournaments.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white max-w-lg mx-auto shadow-sm">
          <Calendar className="w-10 h-10 text-slate-gray mx-auto mb-3" />
          <h3 className="text-sm font-display font-bold text-charcoal">No Tournaments Found</h3>
          <p className="text-xs text-slate-gray font-sans font-medium mt-1">There are no tournaments matching the selected status filter.</p>
        </div>
      ) : view === 'calendar' ? (
        <TournamentsCalendar tournaments={filteredTournaments} navigateTo={navigateTo} />
      ) : view === 'compact' ? (
        <CompactList tournaments={filteredTournaments} navigateTo={navigateTo} />
      ) : (
        <CardsGrid tournaments={filteredTournaments} navigateTo={navigateTo} />
      )}

      {/* Create Tournament — any signed-in user, not just admins, since
          the real backend has no admin check on tournament creation */}
      {isAuthenticated && (
        <div className="bg-white border border-light-border rounded-2xl shadow-sm overflow-hidden">
          {!showCreateForm ? (
            <div className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-charcoal">Create a New Tournament Bracket</h4>
                <p className="text-xs text-slate-gray">Launch a standard round-robin or MLP-style singles bracket — you'll be its owner.</p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2.5 rounded-lg bg-court-green text-white font-bold text-xs hover:bg-court-green/90 shadow-sm flex items-center gap-2 cursor-pointer transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Tournament</span>
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              <button onClick={() => setShowCreateForm(false)} className="text-xs font-bold font-mono text-slate-gray hover:text-charcoal cursor-pointer uppercase">&larr; Cancel</button>
              <CreateTournamentPanel api={api} onCreated={refreshTournaments} navigateTo={navigateTo} />
            </div>
          )}
        </div>
      )}

      {/* Admin Quick Link — remaining admin-only tools (managing every
          tournament regardless of ownership, registered users, etc.) */}
      {isAdmin && (
        <div className="bg-white border border-light-border p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-charcoal">Admin Tools</h4>
            <p className="text-xs text-slate-gray">Manage every tournament on the platform, regardless of who created it.</p>
          </div>
          <button
            onClick={() => navigateTo('admin')}
            className="px-4 py-2.5 rounded-lg bg-deep-navy text-white font-bold text-xs hover:bg-black shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Launch Admin Portal</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------- Cards (original, full-size) ----------------
const CardsGrid: React.FC<{ tournaments: Tournament[]; navigateTo: any }> = ({ tournaments, navigateTo }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="tournaments-cards-grid">
    {tournaments.map(tour => {
      const status = deriveStatus(tour);
      const regOpen = isRegistrationOpen(tour);
      const teamsFilled = tour.teams?.length || 0;
      const teamsTarget = tour.teamCount || teamsFilled || 1;
      const progress = Math.min(100, Math.round((teamsFilled / teamsTarget) * 100));
      const s = statusStyle(status);

      return (
        <div
          key={tour.id}
          onClick={() => navigateTo('tournament-hub', tour.id)}
          className="group bg-white border border-light-border hover:border-court-green/30 rounded-2xl p-5 pl-6.5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between h-[360px] cursor-pointer relative overflow-hidden"
        >
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${s.bar} rounded-l-2xl z-20`} />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider border uppercase ${s.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {status}
              </span>
              <span className="text-[10px] text-slate-gray font-bold font-mono uppercase">{getFormatLabel(tour)}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                {tour.logoDataUrl ? (
                  <img src={tour.logoDataUrl} alt={tour.name} className="w-9 h-9 rounded-lg object-cover border border-light-border shadow-sm shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-court-green/10 border border-court-green/20 flex items-center justify-center text-court-green shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                )}
                <h3 className="text-base font-display font-bold text-charcoal group-hover:text-court-green transition-colors line-clamp-1">{tour.name}</h3>
              </div>
              <p className="text-xs text-slate-gray line-clamp-3 leading-relaxed">
                {tour.teamCount} teams of {tour.playersPerTeam} players &middot; hosted by {tour.ownerDisplayName || 'PaddleHubs'}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-gray">
              <Calendar className="w-4 h-4 text-slate-gray/60" />
              <span>{tour.startDate} to {tour.endDate}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-gray">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-gray/60" />
                <span>{teamsFilled} / {teamsTarget} Teams</span>
              </div>
              <span className={`text-[10px] font-mono font-bold ${regOpen ? 'text-green-600' : 'text-slate-gray'}`}>
                {regOpen ? '● REG OPEN' : '● CLOSED'}
              </span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
            {status === 'completed' ? (
              <div className="flex items-center gap-2 text-xs text-soft-gold font-bold">
                <Award className="w-4 h-4" />
                <span>Tourney Completed</span>
              </div>
            ) : regOpen ? (
              <button
                onClick={() => navigateTo('register-bracket', tour.id)}
                className="px-3.5 py-1.5 rounded-lg bg-court-green hover:bg-[#235F3A] text-white text-[10px] font-mono font-bold uppercase cursor-pointer shadow-sm transition-all"
              >
                REGISTER
              </button>
            ) : (
              <div className="flex-1 space-y-1.5 mr-4">
                <div className="flex justify-between text-[10px] font-mono font-bold text-slate-gray">
                  <span>ROSTER PROGRESS</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-court-green h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <button
              onClick={() => navigateTo('tournament-hub', tour.id)}
              className="text-xs text-court-green font-bold font-mono tracking-wide group-hover:translate-x-1 transition-transform flex items-center gap-1 bg-transparent border-none cursor-pointer"
            >
              <span>VIEW HUB</span>
              <PlayCircle className="w-4 h-4 text-court-green" />
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

// ---------------- Compact (dense list rows — the format that scales to hundreds) ----------------
const CompactList: React.FC<{ tournaments: Tournament[]; navigateTo: any }> = ({ tournaments, navigateTo }) => (
  <div className="bg-white border border-light-border rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden" id="tournaments-compact-list">
    {tournaments.map((tour) => {
      const status = deriveStatus(tour);
      const regOpen = isRegistrationOpen(tour);
      const s = statusStyle(status);
      return (
        <button
          key={tour.id}
          onClick={() => navigateTo('tournament-hub', tour.id)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-off-white/60 transition-all text-left cursor-pointer group"
        >
          <span className={`w-1.5 h-8 rounded-full bg-gradient-to-b ${s.bar} shrink-0`} />
          {tour.logoDataUrl ? (
            <img src={tour.logoDataUrl} alt={tour.name} className="w-8 h-8 rounded-lg object-cover border border-light-border shrink-0" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-court-green/10 border border-court-green/20 flex items-center justify-center text-court-green shrink-0">
              <Trophy className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-charcoal truncate group-hover:text-court-green transition-colors">{tour.name}</p>
            <p className="text-[10px] text-slate-gray font-mono truncate">{tour.startDate} to {tour.endDate} &middot; {getFormatLabel(tour)} &middot; hosted by {tour.ownerDisplayName || 'PaddleHubs'}</p>
          </div>
          <span className={`hidden sm:inline-flex shrink-0 items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider border uppercase ${s.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {status}
          </span>
          <span className={`hidden md:inline text-[9px] font-mono font-bold shrink-0 ${regOpen && status !== 'completed' ? 'text-green-600' : 'text-slate-gray'}`}>
            {status === 'completed' ? '' : regOpen ? '● REG OPEN' : '● CLOSED'}
          </span>
        </button>
      );
    })}
  </div>
);

// ---------------- Calendar (month grid) ----------------
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const TournamentsCalendar: React.FC<{ tournaments: Tournament[]; navigateTo: any }> = ({ tournaments, navigateTo }) => {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Tournaments span a date range, not a single day — a tournament
  // shows up on every day of the calendar it's actually running,
  // capped to a reasonable window so a year-long league doesn't try to
  // paint a dot on 365 different cells.
  const byDate = useMemo(() => {
    const map = new Map<string, Tournament[]>();
    for (const t of tournaments) {
      if (!t.startDate) continue;
      const start = new Date(t.startDate);
      const end = t.endDate ? new Date(t.endDate) : start;
      const cappedEnd = new Date(Math.min(end.getTime(), start.getTime() + 1000 * 60 * 60 * 24 * 120)); // cap at ~4 months of dots
      for (let d = new Date(start); d <= cappedEnd; d.setDate(d.getDate() + 1)) {
        const key = isoDay(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
    }
    return map;
  }, [tournaments]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(startWeekday).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectedTournaments = selectedDate ? byDate.get(selectedDate) || [] : [];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-sm text-charcoal uppercase tracking-wide">{monthLabel}</h3>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg border border-light-border bg-white flex items-center justify-center text-slate-gray hover:text-court-green hover:border-court-green cursor-pointer transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCursor(new Date())} className="px-3 py-1.5 rounded-lg border border-light-border bg-white text-[10px] font-bold font-mono uppercase text-slate-gray hover:text-court-green hover:border-court-green cursor-pointer transition-all">
              Today
            </button>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg border border-light-border bg-white flex items-center justify-center text-slate-gray hover:text-court-green hover:border-court-green cursor-pointer transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[9px] font-mono font-bold text-slate-gray uppercase py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={i} className="min-h-[92px]" />;
            const dayTournaments = byDate.get(dateStr) || [];
            const isToday = dateStr === today();
            const dayNum = Number(dateStr.slice(-2));
            const visible = dayTournaments.slice(0, 2);
            const extra = dayTournaments.length - visible.length;
            return (
              <button
                key={i}
                onClick={() => dayTournaments.length > 0 && setSelectedDate(dateStr)}
                className={`min-h-[92px] rounded-lg border p-1.5 flex flex-col items-start gap-1 transition-all text-left ${
                  isToday ? 'border-court-green bg-court-green/5' : 'border-light-border bg-off-white hover:border-court-green/30'
                } ${dayTournaments.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className={`text-[10px] font-mono font-bold ${isToday ? 'text-court-green' : 'text-charcoal'}`}>{dayNum}</span>
                <div className="flex flex-col gap-0.5 w-full">
                  {visible.map((t) => {
                    const s = statusStyle(deriveStatus(t));
                    return (
                      <span key={t.id} className={`text-[8px] font-bold font-mono truncate w-full px-1 py-0.5 rounded border ${s.badge}`} title={t.name}>
                        {t.name}
                      </span>
                    );
                  })}
                  {extra > 0 && <span className="text-[8px] font-mono text-slate-gray px-1">+{extra} more</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-charcoal">{selectedDate}</h3>
            <button onClick={() => setSelectedDate(null)} className="text-slate-gray hover:text-charcoal cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">
            {selectedTournaments.map((tour) => {
              const status = deriveStatus(tour);
              const s = statusStyle(status);
              return (
                <button
                  key={tour.id}
                  onClick={() => navigateTo('tournament-hub', tour.id)}
                  className="w-full flex items-center gap-3 bg-off-white border border-light-border rounded-xl px-3 py-2.5 hover:border-court-green/40 transition-all cursor-pointer text-left"
                >
                  {tour.logoDataUrl ? (
                    <img src={tour.logoDataUrl} alt={tour.name} className="w-8 h-8 rounded-lg object-cover border border-light-border shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-court-green/10 border border-court-green/20 flex items-center justify-center text-court-green shrink-0">
                      <Trophy className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-charcoal truncate">{tour.name}</p>
                    <p className="text-[9px] text-slate-gray font-mono">{tour.startDate} to {tour.endDate}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider border uppercase ${s.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
