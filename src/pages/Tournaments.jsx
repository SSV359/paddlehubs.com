import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isLoggedIn } from "../lib/auth.js";
import { api } from "../lib/api.js";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function toISODate(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusBadge(status) {
  const s = String(status || "ACTIVE").toUpperCase();
  const base = "inline-flex items-center rounded-full px-2 py-1 text-[11px] border";
  if (s === "ACTIVE") return `${base} border-emerald-400/30 bg-emerald-500/10 text-emerald-100`;
  if (s === "ARCHIVED") return `${base} border-white/10 bg-white/5 text-white/70`;
  return `${base} border-amber-400/30 bg-amber-500/10 text-amber-100`;
}

export default function Tournaments() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState(() => {
    const today = toISODate(new Date());
    return {
      name: "",
      startDate: today,
      endDate: today,
      teamCount: 4,
      playersPerTeam: 2,
    };
  });

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

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

  const sorted = useMemo(() => {
    const list = (items || []).slice();
    list.sort((a, b) => {
      const as = String(a.status || "ACTIVE").toUpperCase();
      const bs = String(b.status || "ACTIVE").toUpperCase();
      if (as !== bs) {
        if (as === "ACTIVE") return -1;
        if (bs === "ACTIVE") return 1;
      }
      const ad = String(a.startDate || a.createdAt || "");
      const bd = String(b.startDate || b.createdAt || "");
      return bd.localeCompare(ad);
    });
    return list;
  }, [items]);

  async function createTournament(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!loggedIn) return setErr("Please login to create a tournament.");

    const name = String(form.name || "").trim();
    const startDate = String(form.startDate || "").trim();
    const endDate = String(form.endDate || "").trim();
    const teamCount = Number(form.teamCount);
    const playersPerTeam = Number(form.playersPerTeam);

    if (!name) return setErr("Tournament name is required.");
    if (!startDate) return setErr("Start date is required.");
    if (!endDate) return setErr("End date is required.");
    if (endDate < startDate) return setErr("End date cannot be before start date.");
    if (!Number.isFinite(teamCount) || teamCount <= 0) return setErr("Team count must be valid.");
    if (!Number.isFinite(playersPerTeam) || playersPerTeam <= 0) return setErr("Players per team must be valid.");

    setLoading(true);
    try {
      const created = await api.createTournament({ name, startDate, endDate, teamCount, playersPerTeam });
      setItems((prev) => [created, ...(prev || [])]);
      setMsg("Tournament created ✅");
      setForm((f) => ({ ...f, name: "" }));
      navigate(`/tournaments/${encodeURIComponent(created.id)}`);
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/15 via-white/5 to-fuchsia-500/15 p-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Create tournament</div>
            <button
              type="button"
              onClick={load}
              className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
              disabled={!loggedIn || loading}
            >
              Refresh
            </button>
          </div>

          {!loggedIn ? (
            <div className="mt-4 text-sm text-white/70">Please login to create and view tournaments.</div>
          ) : (
            <form onSubmit={createTournament} className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-white/60">Tournament Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  placeholder="e.g., Winter Open 2026"
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
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    min={1}
                    max={64}
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
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    min={1}
                    max={20}
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 font-semibold disabled:opacity-40"
                disabled={!loggedIn || loading}
              >
                {loading ? "Creating..." : "Create Tournament"}
              </button>

              <div className="text-xs text-white/60">
                After creation, you will setup team names + players inside tournament.
              </div>
            </form>
          )}
        </div>

        {/* List */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">All tournaments</div>
            <div className="text-xs text-white/60">{sorted.length}</div>
          </div>

          <div className="mt-4 space-y-3">
            {!loggedIn ? (
              <div className="text-sm text-white/70">Login to view tournaments.</div>
            ) : sorted.length === 0 ? (
              <div className="text-sm text-white/70">No tournaments yet.</div>
            ) : (
              sorted.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tournaments/${encodeURIComponent(t.id)}`)}
                  className={classNames(
                    "w-full text-left rounded-2xl border px-4 py-3 transition",
                    "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t.name || "Untitled"}</div>
                      <div className="text-xs text-white/60 mt-1">
                        {t.startDate || "—"} → {t.endDate || "—"} •{" "}
                        {t.teamCount ? `${t.teamCount} teams` : "teams not set"}
                      </div>
                    </div>
                    <span className={statusBadge(t.status)}>{String(t.status || "ACTIVE")}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

