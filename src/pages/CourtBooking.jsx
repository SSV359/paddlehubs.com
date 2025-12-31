import React, { useEffect, useMemo, useState } from "react";
import { isLoggedIn, getUserEmail } from "../lib/auth.js";
import { api } from "../lib/api.js";

/** Monday week key (YYYY-MM-DD of Monday) for client display */
function weekKey(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "invalid-week";

  // convert JS day: Sun=0..Sat=6 => Mon=0..Sun=6
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);

  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function emailPrefix(email) {
  return (email || "").split("@")[0] || email || "";
}

export default function CourtBooking() {
  const loggedIn = isLoggedIn();
  const email = getUserEmail();

  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState(null);
  const [bookings, setBookings] = useState([]);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [form, setForm] = useState({
    name: "",
    court: "Court 1",
    date: "",
    time: "",
    duration: 60,
    players: "",
  });

  async function loadAll() {
    if (!loggedIn) {
      setMe(null);
      setBookings([]);
      setForm((f) => ({ ...f, name: "" }));
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");

    try {
      const m = await api.getMe(); // GET /me
      setMe(m);

      const display = (m?.displayName || "").trim() || emailPrefix(email);
      setForm((f) => ({ ...f, name: display }));

      const res = await api.listBookings(); // GET /bookings => { items: [] }
      setBookings(res?.items || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  function onChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  const sorted = useMemo(() => {
    return (bookings || [])
      .slice()
      .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)));
  }, [bookings]);

  const currentWeekCount = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const wk = weekKey(`${yyyy}-${mm}-${dd}`);

    return (bookings || []).filter((b) => b.weekKey === wk).length;
  }, [bookings]);

  async function add(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!loggedIn) {
      setError("Please login to book a court.");
      return;
    }

    if (!form.date || !form.time) {
      setError("Please select Date and Time.");
      return;
    }

    setLoading(true);
    try {
      // POST /bookings
      const created = await api.createBooking({
        date: form.date,
        time: form.time,
        court: form.court,
        duration: Number(form.duration || 60),
        players: String(form.players || "").trim(),
      });

      // Add to list immediately (API returns the created item)
      setBookings((prev) => [created, ...(prev || [])]);

      setInfo("Booking added ✅");
      setForm((f) => ({ ...f, date: "", time: "", players: "" }));
    } catch (e2) {
      // Backend returns 400 with JSON like { error: "Weekly limit..." }
      const msg = String(e2?.message || e2);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function del(id) {
    setError("");
    setInfo("");

    if (!loggedIn) return;

    setLoading(true);
    try {
      await api.deleteBooking(id); // DELETE /bookings/{id}
      setBookings((prev) => (prev || []).filter((b) => b.id !== id));
      setInfo("Deleted ✅");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/15 via-white/5 to-cyan-500/15 p-6">
        <div className="text-2xl font-semibold">Court Booking</div>
        <div className="text-sm text-white/70 mt-1">
          {loggedIn ? (
            <>
              Logged in as{" "}
              <span className="font-semibold">
                {(me?.displayName || "").trim() || emailPrefix(email)}
              </span>{" "}
              • Weekly usage: <span className="font-semibold">{currentWeekCount}/2</span>
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
        {/* Form */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">New booking</div>
            <button
              type="button"
              onClick={loadAll}
              className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
              disabled={!loggedIn || loading}
              title="Refresh"
            >
              Refresh
            </button>
          </div>

          <form onSubmit={add} className="mt-4 space-y-3">
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Your name"
              disabled
            />

            <select
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              name="court"
              value={form.court}
              onChange={onChange}
              disabled={!loggedIn || loading}
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
                disabled={!loggedIn || loading}
              />
              <input
                type="time"
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="time"
                value={form.time}
                onChange={onChange}
                disabled={!loggedIn || loading}
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
                disabled={!loggedIn || loading}
              />
              <input
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                name="players"
                value={form.players}
                onChange={onChange}
                placeholder="Players (optional)"
                disabled={!loggedIn || loading}
              />
            </div>

            <button
              className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 font-semibold disabled:opacity-40"
              disabled={!loggedIn || loading}
            >
              {loading ? "Saving..." : "Add Booking"}
            </button>

            {loggedIn && (
              <div className="text-xs text-white/60">
                Backend rule: <span className="font-semibold">2 bookings per week</span> per user.
              </div>
            )}
          </form>
        </div>

        {/* List */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">My Bookings</div>
            <div className="text-xs text-white/60">{sorted.length}</div>
          </div>

          <div className="mt-4 space-y-3">
            {!loggedIn ? (
              <div className="text-sm text-white/60">Login to view your bookings.</div>
            ) : sorted.length === 0 ? (
              <div className="text-sm text-white/60">No bookings yet.</div>
            ) : (
              sorted.map((b) => (
                <div key={b.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{b.court}</div>
                      <div className="text-xs text-white/70">
                        {b.date} • {b.time} • {b.duration} mins
                      </div>
                      <div className="text-xs text-white/60">
                        {b.ownerDisplayName || form.name || "—"} • {b.players || "—"}
                      </div>
                    </div>

                    <button
                      onClick={() => del(b.id)}
                      className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
                      disabled={loading}
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

