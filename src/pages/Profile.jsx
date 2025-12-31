import React, { useEffect, useState } from "react";
import { isLoggedIn, getUserEmail } from "../lib/auth.js";
import { api } from "../lib/api.js";

function emailPrefix(email) {
  return (email || "").split("@")[0] || "";
}

export default function Profile() {
  const loggedIn = isLoggedIn();
  const email = getUserEmail();

  const [displayName, setDisplayName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setMsg("");
      setErr("");
      if (!loggedIn) return;

      try {
        const me = await api.getMe();
        if (!alive) return;

        const fallback = emailPrefix(email);
        setDisplayName((me.displayName || "").trim() || fallback);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load profile");
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [loggedIn, email]);

  async function save(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    const name = (displayName || "").trim();
    if (!name) {
      setErr("Display name cannot be empty.");
      return;
    }

    try {
      await api.putMe({ displayName: name });
      setMsg("Saved ✅");
    } catch (e2) {
      setErr(e2.message || "Save failed");
    }
  }

  function resetToDefault() {
    setDisplayName(emailPrefix(email));
    setMsg("Reset to default. Click Save to apply.");
    setErr("");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/15 via-white/5 to-indigo-500/15 p-6">
        <div className="text-2xl font-semibold">My Profile</div>
        <div className="text-sm text-white/70 mt-1">
          Set your player display name (Phase II — saved in DynamoDB)
        </div>
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

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        {!loggedIn ? (
          <div className="text-white/70">Please login to update your profile.</div>
        ) : (
          <>
            <div className="text-sm text-white/70">
              Logged in as: <span className="font-semibold">{email || "user"}</span>
            </div>

            <form onSubmit={save} className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-white/60">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  placeholder="e.g., Sai Sidharth"
                />
                <div className="mt-2 text-xs text-white/50">
                  This will be used as the “player” name for bookings/matches.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 font-semibold">
                  Save
                </button>

                <button
                  type="button"
                  onClick={resetToDefault}
                  className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2"
                >
                  Reset
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

