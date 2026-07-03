// /opt/paddlehubs-site/src/pages/ClubActivity.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { isLoggedIn } from "../lib/auth.js";
import { CalendarDays, Trophy, Search, RefreshCw } from "lucide-react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface2 px-2.5 py-1 text-[11px] text-muted">
      {children}
    </span>
  );
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function fmtWhen(item) {
  // Bookings have createdAt, matches have createdAt (your lambda stores it)
  const t = item?.createdAt || item?.date || "";
  if (!t) return "";
  if (String(t).includes("T")) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return String(t);
    return d.toLocaleString();
  }
  return String(t);
}

export default function ClubActivity() {
  const loggedIn = isLoggedIn();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [clubBookings, setClubBookings] = useState([]);
  const [clubMatches, setClubMatches] = useState([]);

  const [tab, setTab] = useState("all"); // all | bookings | matches
  const [q, setQ] = useState("");
  const [court, setCourt] = useState("All");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      // Requires these to exist in api.js:
      // api.listClubBookings() => GET /club/bookings
      // api.listClubMatches()  => GET /club/matches
      const [b, m] = await Promise.all([api.listClubBookings(), api.listClubMatches()]);
      setClubBookings(b?.items || []);
      setClubMatches(m?.items || []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loggedIn) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const allItems = useMemo(() => {
    const b = (clubBookings || []).map((x) => ({ ...x, _kind: "BOOKING" }));
    const m = (clubMatches || []).map((x) => ({ ...x, _kind: "MATCH" }));

    // sort by createdAt desc (fallback to date)
    return [...b, ...m].sort((a, b2) =>
      safeStr(b2.createdAt || b2.date).localeCompare(safeStr(a.createdAt || a.date))
    );
  }, [clubBookings, clubMatches]);

  const courts = useMemo(() => {
    const s = new Set(["All"]);
    allItems.forEach((x) => {
      const c = safeStr(x.court);
      if (c) s.add(c);
    });
    return Array.from(s);
  }, [allItems]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();

    return allItems.filter((x) => {
      if (tab === "bookings" && x._kind !== "BOOKING") return false;
      if (tab === "matches" && x._kind !== "MATCH") return false;

      if (court !== "All" && safeStr(x.court) !== court) return false;

      if (!query) return true;

      const hay = [
        x._kind,
        x.court,
        x.date,
        x.time,
        x.players,
        x.matchup,
        x.winner,
        x.ownerDisplayName,
        x.ownerEmail,
      ]
        .map(safeStr)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [allItems, tab, q, court]);

  const stats = useMemo(() => {
    const total = allItems.length;
    const bookings = allItems.filter((x) => x._kind === "BOOKING").length;
    const matches = allItems.filter((x) => x._kind === "MATCH").length;

    const players = new Set();
    allItems.forEach((x) => {
      if (x.ownerSub) players.add(x.ownerSub);
    });

    return { total, bookings, matches, players: players.size };
  }, [allItems]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line border-l-4 border-l-signature bg-surface p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">Club Activity</div>
            <div className="text-sm text-muted mt-1">
              Club-wide bookings + matches (shared database)
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill>Total: {loggedIn ? stats.total : "—"}</Pill>
              <Pill>Bookings: {loggedIn ? stats.bookings : "—"}</Pill>
              <Pill>Matches: {loggedIn ? stats.matches : "—"}</Pill>
              <Pill>Players: {loggedIn ? stats.players : "—"}</Pill>
            </div>
          </div>

          <button
            onClick={load}
            disabled={!loggedIn || loading}
            className={classNames(
              "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
              "border-line bg-surface2 hover:bg-surface2 disabled:opacity-40"
            )}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {!loggedIn ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-muted">
          Please login to view club activity.
        </div>
      ) : (
        <>
          {err ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {err}
            </div>
          ) : null}

          {/* Controls */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Tabs */}
              <div className="inline-flex rounded-xl border border-line bg-surface2 p-1">
                {[
                  { k: "all", label: "All" },
                  { k: "bookings", label: "Bookings" },
                  { k: "matches", label: "Matches" },
                ].map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setTab(t.k)}
                    className={classNames(
                      "rounded-xl px-3 py-2 text-sm",
                      tab === t.k ? "bg-surface2" : "hover:bg-surface2 text-ink/80"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Court filter */}
              <select
                className="rounded-xl border border-line bg-surface2 px-3 py-2 text-sm"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
              >
                {courts.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Search */}
              <div className="ml-auto flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2 w-full md:w-[420px]">
                <Search size={16} className="text-muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search player, court, matchup, date…"
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
            </div>

            <div className="mt-3 text-xs text-muted">
              Showing <span className="font-semibold">{filtered.length}</span> item(s)
            </div>
          </div>

          {/* Feed */}
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-line bg-surface p-6 text-muted">
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface p-6 text-muted">
                No activity found.
              </div>
            ) : (
              filtered.map((x) => (
                <div
                  key={x.sk || x.id}
                  className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl border border-line bg-surface2 p-2">
                          {x._kind === "BOOKING" ? <CalendarDays size={16} /> : <Trophy size={16} />}
                        </div>
                        <div className="font-semibold">
                          {x._kind === "BOOKING" ? "Booking" : "Match"}
                        </div>
                        <Pill>{safeStr(x.court) || "Court"}</Pill>
                        {x._kind === "MATCH" ? <Pill>{safeStr(x.gameType) || "type"}</Pill> : null}
                      </div>

                      {x._kind === "BOOKING" ? (
                        <div className="mt-2 text-sm text-ink">
                          {safeStr(x.date)} • {safeStr(x.time)} • {safeStr(x.duration)} mins
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-ink truncate">
                          {safeStr(x.matchup) || "—"}
                        </div>
                      )}

                      <div className="mt-1 text-xs text-muted">
                        By:{" "}
                        <span className="text-ink/80">
                          {safeStr(x.ownerDisplayName) || safeStr(x.ownerEmail) || "—"}
                        </span>
                        {x._kind === "BOOKING" && safeStr(x.players) ? (
                          <>
                            {" "}
                            • Players: <span className="text-ink/80">{safeStr(x.players)}</span>
                          </>
                        ) : null}
                        {x._kind === "MATCH" ? (
                          <>
                            {" "}
                            • Score:{" "}
                            <span className="text-ink/80">
                              {x.scoreA ?? "—"}-{x.scoreB ?? "—"}
                            </span>{" "}
                            • Winner: <span className="text-ink/80">{safeStr(x.winner) || "—"}</span>
                          </>
                        ) : null}
                      </div>

                      {x._kind === "MATCH" && safeStr(x.notes) ? (
                        <div className="mt-2 text-xs text-muted">
                          Notes: <span className="text-ink/80">{safeStr(x.notes)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="text-[11px] text-muted whitespace-nowrap">
                      {fmtWhen(x)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

