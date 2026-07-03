// /opt/paddlehubs-site/src/pages/AdminAnalytics.jsx
import React, { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { isLoggedIn, isAdmin } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { PageHeading, Surface, StatCard } from "../components/ui.jsx";

const RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export default function AdminAnalytics() {
  const loggedIn = isLoggedIn();
  const admin = isAdmin();

  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    if (!loggedIn || !admin) return;
    setErr("");
    setLoading(true);
    try {
      const res = await api.getSiteAnalytics(days);
      setData(res);
    } catch (e) {
      console.error("Site analytics failed to load:", e);
      setErr(String(e?.message || e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, admin, days]);

  const maxDaily = data?.daily?.length ? Math.max(...data.daily.map((d) => d.views), 1) : 1;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Admin"
        title="Site Analytics"
        subtitle="Page views from everyone who visits — logged in or not."
        action={
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-xl border border-line bg-surface2 px-3 py-2 text-sm"
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line disabled:opacity-40"
            >
              Refresh
            </button>
          </div>
        }
      />

      {!loggedIn ? (
        <Surface className="p-6 text-sm text-muted">Please login to view this page.</Surface>
      ) : !admin ? (
        <Surface className="p-6 text-sm text-muted">This page is only available to club admins.</Surface>
      ) : err ? (
        <Surface className="p-6 text-sm text-muted">
          Trouble loading right now — try{" "}
          <button onClick={load} className="underline underline-offset-2 hover:text-ink">
            refreshing
          </button>
          .
        </Surface>
      ) : loading && !data ? (
        <Surface className="p-6 text-sm text-muted">Loading analytics…</Surface>
      ) : !data || data.totalViews === 0 ? (
        <Surface className="p-6 text-sm text-muted">
          <div className="font-medium text-ink">No page views recorded yet</div>
          <div className="mt-1">
            This starts collecting from the moment it's deployed — check back after people start visiting the site.
          </div>
        </Surface>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total Page Views" value={data.totalViews} icon={BarChart3} hint={`Last ${data.rangeDays} days`} />
            <StatCard title="Unique Visitors" value={data.uniqueVisitors} hint="By anonymous device, not identity" />
            <StatCard
              title="Views / Visitor"
              value={data.uniqueVisitors ? (data.totalViews / data.uniqueVisitors).toFixed(1) : "0"}
            />
          </div>

          <Surface className="p-5 shadow-sm">
            <div className="font-semibold">Daily views</div>
            <div className="mt-4 flex items-end gap-1" style={{ height: 140 }}>
              {data.daily.map((d) => (
                <div key={d.date} className="group relative flex-1" title={`${d.date}: ${d.views} views`}>
                  <div
                    className="w-full rounded-t bg-accent/70 transition group-hover:bg-accent"
                    style={{ height: `${Math.max(4, (d.views / maxDaily) * 130)}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted">
              <span>{data.daily[0]?.date}</span>
              <span>{data.daily[data.daily.length - 1]?.date}</span>
            </div>
          </Surface>

          <Surface className="overflow-x-auto p-5 shadow-sm">
            <div className="font-semibold">Top Pages</div>
            <table className="mt-4 w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-2 text-left">Page</th>
                  <th className="py-2 text-right">Views</th>
                </tr>
              </thead>
              <tbody>
                {data.topPages.map((p) => (
                  <tr key={p.path} className="border-t border-line">
                    <td className="py-2 pr-2 font-mono text-xs">{p.path}</td>
                    <td className="stat-score py-2 text-right">{p.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        </>
      )}
    </div>
  );
}
