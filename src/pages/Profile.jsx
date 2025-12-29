import React, { useEffect, useState } from "react";
import { isLoggedIn, getUserEmail, getUserSub } from "../lib/auth.js";

const KEY_PROFILES = "ph_profiles";

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

function emailPrefix(email) {
  return (email || "").split("@")[0] || "";
}

export default function Profile() {
  const loggedIn = isLoggedIn();
  const sub = getUserSub();
  const email = getUserEmail();

  const [displayName, setDisplayName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setMsg("");
    if (!loggedIn || !sub) return;

    const all = read(KEY_PROFILES, {});
    const existing = all[sub];

    if (existing?.displayName) {
      setDisplayName(existing.displayName);
    } else {
      setDisplayName(emailPrefix(email));
    }
  }, [loggedIn, sub, email]);

  function save(e) {
    e.preventDefault();
    setMsg("");

    if (!loggedIn || !sub) {
      setMsg("Please login to update profile.");
      return;
    }

    const name = (displayName || "").trim();
    if (!name) {
      setMsg("Display name cannot be empty.");
      return;
    }

    const all = read(KEY_PROFILES, {});
    const prev = all[sub] || {
      playerId: sub,
      email: email || "",
      createdAt: new Date().toISOString(),
    };

    all[sub] = {
      ...prev,
      playerId: sub,
      email: email || "",
      displayName: name,
      updatedAt: new Date().toISOString(),
    };

    write(KEY_PROFILES, all);
    setMsg("Saved ✅");
  }

  function resetToDefault() {
    setDisplayName(emailPrefix(email));
    setMsg("Reset to default (email prefix). Click Save to apply.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/15 via-white/5 to-indigo-500/15 p-6">
        <div className="text-2xl font-semibold">My Profile</div>
        <div className="text-sm text-white/70 mt-1">
          Set your player display name (Phase 1 — saved in this browser)
        </div>
      </div>

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
                  This name will auto-fill Player 1 in matches + bookings.
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

              {msg && <div className="text-sm text-white/80">{msg}</div>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

