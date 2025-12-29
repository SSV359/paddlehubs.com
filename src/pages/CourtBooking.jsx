import React, { useEffect, useMemo, useState } from "react";
import { isLoggedIn, getUserEmail, getUserSub } from "../lib/auth.js";

/** ---------- helpers ---------- */
const uid = () => crypto.randomUUID?.() || (Math.random().toString(16).slice(2) + Date.now().toString(16));

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Week starts Monday. Returns "YYYY-MM-DD" (Monday date) for a given YYYY-MM-DD.
function weekKey(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "invalid-week";

  // Convert JS day (Sun=0..Sat=6) to Mon=0..Sun=6
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);

  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function bookingKeyForUser() {
  const sub = getUserSub();
  return sub ? `ph_bookings:${sub}` : `ph_bookings:guest`;
}

function defaultNameFromEmail(email) {
  if (!email) return "";
  return email.split("@")[0];
}

export default function CourtBooking() {
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Require login (Phase 1 rule)
  const loggedIn = isLoggedIn();
  const sub = getUserSub();
  const email = getUserEmail();

  // per-user bookings storage
  const [bookings, setBookings] = useState(() => read(bookingKeyForUser(), []));

  const [form, setForm] = useState({
    name: "",
    court: "Court 1",
    date: "",
    time: "",
    duration: 60,
    players: "",
  });

  // When user changes (login/logout), reload user-scoped bookings + default name
  useEffect(() => {
    const key = bookingKeyForUser();
    setBookings(read(key, []));

    // map registered user -> player (Phase 1)
    const fallback = defaultNameFromEmail(email);
    setForm((f) => ({
      ...f,
      name: f.name?.trim() ? f.name : fallback, // only set if empty
    }));
  }, [email, sub]);

  const sorted = useMemo(
    () => bookings.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [bookings]
  );

  // How many bookings this week for this user
  const currentWeekCount = useMemo(() => {
    if (!sub) return 0;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const wk = weekKey(`${yyyy}-${mm}-${dd}`);
    return bookings.filter((b) => b.ownerSub === sub && b.weekKey === wk).length;
  }, [bookings, sub]);

  function onChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function save(next) {
    const key = bookingKeyForUser();
    setBookings(next);
    write(key, next);
  }

  function add(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!loggedIn || !sub) {
      setError("Please login to book a court.");
      return;
    }

    if (!form.name || !form.date || !form.time) {
      setError("Please fill Name, Date and Time.");
      return;
    }

    const wk = weekKey(form.date);
    const mineThisWeek = bookings.filter((b) => b.ownerSub === sub && b.weekKey === wk);

    // ✅ enforce 2 bookings per week per user (Phase 1)
    if (mineThisWeek.length >= 2) {
      setError("Weekly limit reached: Only 2 court bookings per week per user.");
      return;
    }

    const item = {
      id: uid(),
      ownerSub: sub,
      ownerEmail: email || "",
      weekKey: wk,
      name: form.name.trim(),
      court: form.court,
      date: form.date,
      time: form.time,
      duration: Number(form.duration),
      players: form.players.trim(),
      createdAt: new Date().toISOString(),
    };

    const next = [item, ...bookings];
    save(next);

    setInfo(`Booking added. Remaining this week: ${Math.max(0, 2 - (mineThisWeek.length + 1))}`);
    setForm((f) => ({ ...f, date: "", time: "", players: "" }));
  }

  function del(id) {
    setError("");
    setInfo("");

    const next = bookings.filter((b) => b.id !== id);
    save(next);
  }

  // Show only this user's bookings in the list (keeps UI clean)
  const myBookings = useMemo(() => {
    if (!sub) return [];
    return sorted.filter((b) => b.ownerSub === sub);
  }, [sorted, sub]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/15 via-white/5 to-cyan-500/15 p-6">
        <div className="text-2xl font-semibold">Court Booking</div>
        <div className="text-sm text-white/70 mt-1">
          {loggedIn ? (
            <>
              Logged in as <span className="font-semibold">{email || "user"}</span> • Weekly limit:{" "}
              <span className="font-semibold">{currentWeekCount}/2</span>
            </>
          ) : (
            "Please login to add bookings."
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {info}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="font-semibold">New booking</div>
          <form onSubmit={add} className="mt-4 space-y-3">
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Your name (auto-filled from login)"
              disabled={!loggedIn}
            />

            <select
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              name="court"
              value={form.court}
              onChange={onChange}
              disabled={!loggedIn}
            >
              <option>Court 1</option>
              <option>Court 2</option>
              <option>Court 3</option>
              <option>Court 4</option>
            </select>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="date"
                value={form.date}
                onChange={onChange}
                disabled={!loggedIn}
              />
              <input
                type="time"
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="time"
                value={form.time}
                onChange={onChange}
                disabled={!loggedIn}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="15"
                step="15"
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="duration"
                value={form.duration}
                onChange={onChange}
                disabled={!loggedIn}
              />
              <input
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="players"
                value={form.players}
                onChange={onChange}
                placeholder="Players (optional)"
                disabled={!loggedIn}
              />
            </div>

            <button
              className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 font-semibold disabled:opacity-40"
              disabled={!loggedIn}
            >
              Add Booking
            </button>

            {loggedIn && (
              <div className="text-xs text-white/60">
                You can book up to <span className="font-semibold">2 times per week</span>.
              </div>
            )}
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">My Bookings</div>
            <div className="text-xs text-white/60">{myBookings.length}</div>
          </div>

          <div className="mt-4 space-y-3">
            {myBookings.length === 0 ? (
              <div className="text-sm text-white/60">No bookings yet.</div>
            ) : (
              myBookings.map((b) => (
                <div key={b.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{b.court}</div>
                      <div className="text-xs text-white/70">
                        {b.date} • {b.time} • {b.duration} mins
                      </div>
                      <div className="text-xs text-white/60">
                        {b.name} • {b.players || "—"}
                      </div>
                    </div>
                    <button
                      onClick={() => del(b.id)}
                      className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {loggedIn && (
            <div className="mt-4 text-xs text-white/60">
              Weekly usage: <span className="font-semibold">{currentWeekCount}/2</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

