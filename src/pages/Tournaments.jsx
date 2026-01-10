// /opt/paddlehubs-site/src/pages/Tournaments.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isLoggedIn } from "../lib/auth.js";
import { api } from "../lib/api.js";

function trim(v) {
  return String(v || "").trim();
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Tournaments() {
  const loggedIn = isLoggedIn();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    name: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    teamCount: 4,
    playersPerTeam: 2,
  });

  async function load() {
    setErr("");
    setMsg("");

    if (!loggedIn) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.listTournaments();
      setItems(res?.items || []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function onCreate(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!loggedIn) return setErr("Please login.");

    const payload = {
      name: trim(form.name),
      startDate: trim(form.startDate),
      endDate: trim(form.endDate),
      teamCount: Number(form.teamCount),
      playersPerTeam: Number(form.playersPerTeam),
    };

    if (!payload.name) return setErr("Tournament name is required.");

    setLoading(true);
    try {
      const created = await api.createTournament(payload);

      // refresh list
      await load();

      setMsg("Tournament created ✅");

      // ✅ navigate to details
      if (created?.id) {
        navigate(`/tournaments/${created.id}`);
      }
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setLoading(false);
    }
  }

  const sorted = useMemo(() => (items || []).slice(), [items]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/15 via-white/5 to-fuchsia-500/15 p-6">
        <div className="text-2xl font-semibold">Tournaments</div>
        <div className="text-sm text-white/70 mt-1">Create tournaments, setup teams, and track standings.</div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {msg}
        </div>
      )}

      {!loggedIn ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">Please login.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Create tournament</div>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
              >
                Refresh
              </button>
            </div>

            <form onSubmit={onCreate} className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-white/60">Tournament Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="e.g., Winter Open 2026"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={onChange}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={form.endDate}
                    onChange={onChange}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60">How many teams?</label>
                  <input
                    type="number"
                    name="teamCount"
                    value={form.teamCount}
                    onChange={onChange}
                    min={1}
                    max={64}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Players per team</label>
                  <input
                    type="number"
                    name="playersPerTeam"
                    value={form.playersPerTeam}
                    onChange={onChange}
                    min={1}
                    max={20}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 font-semibold disabled:opacity-40"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Tournament"}
              </button>

              <div className="text-xs text-white/60">
                After creation, setup team names + players inside the tournament.
              </div>
            </form>
          </div>

          {/* List */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">All tournaments</div>
              <div className="text-xs text-white/60">{sorted.length}</div>
            </div>

            <div className="mt-4 space-y-3">
              {sorted.length === 0 ? (
                <div className="text-sm text-white/70">No tournaments yet.</div>
              ) : (
                sorted.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/tournaments/${t.id}`)}
                    className={classNames(
                      "w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-4"
                    )}
                  >
                    <div className="font-semibold">{t.name || "Tournament"}</div>
                    <div className="text-xs text-white/60 mt-1">
                      {t.startDate || "—"} → {t.endDate || "—"} • {t.status || "ACTIVE"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

