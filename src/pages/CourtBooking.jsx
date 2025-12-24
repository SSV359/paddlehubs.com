import React, { useMemo, useState } from "react";
import { getBookings, saveBookings } from "../lib/storage.js";

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

export default function CourtBooking() {
  const [bookings, setBookings] = useState(() => getBookings());
  const [form, setForm] = useState({ name:"", court:"Court 1", date:"", time:"", duration:60, players:"" });

  const sorted = useMemo(() =>
    bookings.slice().sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time))
  , [bookings]);

  function onChange(e){ setForm(f=>({ ...f, [e.target.name]: e.target.value })); }

  function add(e){
    e.preventDefault();
    if(!form.name || !form.date || !form.time) return;

    const item = { id: uid(), ...form, duration: Number(form.duration) };
    const next = [item, ...bookings];
    setBookings(next); saveBookings(next);
    setForm(f=>({ ...f, date:"", time:"", players:"" }));
  }

  function del(id){
    const next = bookings.filter(b=>b.id!==id);
    setBookings(next); saveBookings(next);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/15 via-white/5 to-cyan-500/15 p-6">
        <div className="text-2xl font-semibold">Court Booking</div>
        <div className="text-sm text-white/70 mt-1">Add bookings (saved in this browser).</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="font-semibold">New booking</div>
          <form onSubmit={add} className="mt-4 space-y-3">
            <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              name="name" value={form.name} onChange={onChange} placeholder="Your name" />
            <select className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              name="court" value={form.court} onChange={onChange}>
              <option>Court 1</option><option>Court 2</option><option>Court 3</option><option>Court 4</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="date" value={form.date} onChange={onChange} />
              <input type="time" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="time" value={form.time} onChange={onChange} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="15" step="15" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="duration" value={form.duration} onChange={onChange} />
              <input className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="players" value={form.players} onChange={onChange} placeholder="Players" />
            </div>
            <button className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 font-semibold">
              Add Booking
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Bookings</div>
            <div className="text-xs text-white/60">{sorted.length}</div>
          </div>
          <div className="mt-4 space-y-3">
            {sorted.length === 0 ? (
              <div className="text-sm text-white/60">No bookings yet.</div>
            ) : sorted.map(b=>(
              <div key={b.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{b.court}</div>
                    <div className="text-xs text-white/70">{b.date} • {b.time} • {b.duration} mins</div>
                    <div className="text-xs text-white/60">{b.name} • {b.players || "—"}</div>
                  </div>
                  <button onClick={()=>del(b.id)} className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
