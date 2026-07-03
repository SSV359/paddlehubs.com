// /opt/paddlehubs-site/src/pages/AdminUsers.jsx
import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { isLoggedIn, isAdmin } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { PageHeading, Surface, Pill } from "../components/ui.jsx";

export default function AdminUsers() {
  const loggedIn = isLoggedIn();
  const admin = isAdmin();

  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    if (!loggedIn || !admin) return;
    setErr("");
    setLoading(true);
    try {
      const res = await api.getAdminUsers();
      setUsers(res?.users || []);
      setCount(res?.count ?? (res?.users || []).length);
    } catch (e) {
      console.error("Admin users failed to load:", e);
      setErr(String(e?.message || e));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, admin]);

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Admin"
        title="Registered Users"
        subtitle="Everyone who has signed up for PaddleHubs, pulled live from Cognito."
        action={
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line disabled:opacity-40"
          >
            Refresh
          </button>
        }
      />

      {!loggedIn ? (
        <Surface className="p-6 text-sm text-muted">Please login to view this page.</Surface>
      ) : !admin ? (
        <Surface className="p-6 text-sm text-muted">This page is only available to club admins.</Surface>
      ) : (
        <Surface className="overflow-x-auto p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-accent" />
            <div className="font-semibold">All Users</div>
            <span className="rounded-full border border-line bg-surface2 px-2.5 py-0.5 text-xs text-muted">
              {count}
            </span>
          </div>

          {err && (
            <div className="mt-3 text-xs text-muted">
              Trouble loading right now — try{" "}
              <button onClick={load} className="underline underline-offset-2 hover:text-ink">
                refreshing
              </button>
              .
            </div>
          )}

          {loading && users.length === 0 ? (
            <div className="mt-4 text-sm text-muted">Loading users…</div>
          ) : users.length === 0 && !err ? (
            <div className="mt-4 text-sm text-muted">No registered users yet.</div>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-2 text-left">Email</th>
                  <th className="py-2 px-2 text-left">Status</th>
                  <th className="py-2 px-2 text-left">Verified</th>
                  <th className="py-2 px-2 text-left">Role</th>
                  <th className="py-2 px-2 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.username} className="border-t border-line">
                    <td className="py-2 pr-2 font-medium">{u.email || u.username}</td>
                    <td className="py-2 px-2">
                      <Pill tone={u.enabled ? "live" : "danger"}>{u.status || (u.enabled ? "Active" : "Disabled")}</Pill>
                    </td>
                    <td className="py-2 px-2 text-muted">{u.emailVerified ? "Yes" : "No"}</td>
                    <td className="py-2 px-2">
                      {u.isAdmin ? <Pill tone="signature">Admin</Pill> : <span className="text-muted">Member</span>}
                    </td>
                    <td className="py-2 px-2 text-muted">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Surface>
      )}
    </div>
  );
}
