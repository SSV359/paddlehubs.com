/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import type { Booking } from '../types';
import { Calendar, Clock, MapPin, Plus, Trash2, Users } from 'lucide-react';

const COURTS = ['Court 1', 'Court 2', 'Court 3', 'Court 4'];

export const BookingsView: React.FC = () => {
  const { currentUser, isAdmin, api } = useAppState();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [clubBookings, setClubBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [court, setCourt] = useState(COURTS[0]);
  const [duration, setDuration] = useState(60);
  const [players, setPlayers] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.listMyBookings(), api.listClubBookings()])
      .then(([mine, club]) => { setMyBookings(mine.items); setClubBookings(club.items); })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!date) { setError('Pick a date.'); return; }
    setSubmitting(true);
    try {
      await api.createBooking({ date, time, court, duration, players });
      setShowForm(false);
      setDate(''); setPlayers('');
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelBooking = async (id: string) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await api.deleteBooking(id);
      load();
    } catch (e: any) {
      alert(e?.message || 'Failed to cancel booking.');
    }
  };

  const cancelAsAdmin = async (id: string) => {
    if (!confirm('Cancel this booking (admin)?')) return;
    try {
      await api.adminDeleteBooking(id);
      load();
    } catch (e: any) {
      alert(e?.message || 'Failed to cancel booking.');
    }
  };

  return (
    <div className="space-y-6" id="bookings-view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-light-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Calendar className="w-5 h-5 text-court-green shrink-0" />
            <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">COURT RESERVATIONS</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase">Court Bookings</h1>
          <p className="text-slate-gray text-xs mt-1">Reserve courts for open play — up to 2 bookings per week per player.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 rounded-lg bg-court-green text-white font-bold text-xs hover:bg-court-green/90 shadow-sm flex items-center gap-2 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'New Booking'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3 max-w-xl">
          {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Court</label>
              <select value={court} onChange={(e) => setCourt(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5">
                {COURTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Duration (min)</label>
              <input type="number" step={30} min={30} max={180} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Other Players (optional)</label>
            <input value={players} onChange={(e) => setPlayers(e.target.value)} placeholder="Names of who you're playing with" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer disabled:opacity-60">
            {submitting ? 'Booking...' : 'Confirm Booking'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">My Bookings</h3>
          {loading ? (
            <p className="text-xs text-slate-gray font-mono">Loading...</p>
          ) : myBookings.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs">No bookings yet.</div>
          ) : myBookings.map((b) => (
            <div key={b.id} className="bg-off-white border border-light-border p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-charcoal block">{b.court}</span>
                <div className="flex items-center gap-3 text-[10px] text-slate-gray font-mono mt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.time}</span>
                </div>
              </div>
              <button onClick={() => cancelBooking(b.id)} className="text-slate-gray hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Club-Wide Bookings</h3>
          {loading ? (
            <p className="text-xs text-slate-gray font-mono">Loading...</p>
          ) : clubBookings.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs">No club bookings yet.</div>
          ) : clubBookings.map((b) => (
            <div key={b.id} className="bg-off-white border border-light-border p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-charcoal block">{b.court} &middot; {b.ownerDisplayName}</span>
                <div className="flex items-center gap-3 text-[10px] text-slate-gray font-mono mt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.time}</span>
                  {b.players && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{b.players}</span>}
                </div>
              </div>
              {isAdmin && <button onClick={() => cancelAsAdmin(b.id)} className="text-slate-gray hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
