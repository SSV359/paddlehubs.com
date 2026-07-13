import React, { useEffect, useRef, useState } from "react";
import { isLoggedIn, getUserEmail } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { resizeImageFile } from "../lib/image.js";
import { PlayerAvatar, AVATAR_PALETTE } from "../components/ui.jsx";

function emailPrefix(email) {
  return (email || "").split("@")[0] || "";
}

export default function Profile() {
  const loggedIn = isLoggedIn();
  const email = getUserEmail();
  const fileInputRef = useRef(null);

  const [displayName, setDisplayName] = useState("");
  const [duprId, setDuprId] = useState("");
  const [duprRating, setDuprRating] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
  const [avatarColor, setAvatarColor] = useState("");
  const [gender, setGender] = useState("");
  const [uploading, setUploading] = useState(false);
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
        setDuprId(me.duprId || "");
        setDuprRating(me.duprRating != null ? String(me.duprRating) : "");
        setAvatarDataUrl(me.avatarDataUrl || "");
        setAvatarColor(me.avatarColor || "");
        setGender(me.gender || "");
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

  async function onPhotoChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file later
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }

    setErr("");
    setUploading(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setAvatarDataUrl(dataUrl);
      setAvatarColor(""); // a real photo takes priority over a color avatar
    } catch (e2) {
      setErr(e2.message || "Couldn't process that image.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setAvatarDataUrl("");
  }

  function pickColor(hex) {
    setAvatarColor(hex);
    setAvatarDataUrl(""); // picking a color clears any uploaded photo
  }

  async function save(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    const name = (displayName || "").trim();
    if (!name) {
      setErr("Display name cannot be empty.");
      return;
    }

    const ratingTrim = (duprRating || "").trim();
    if (ratingTrim) {
      const n = Number(ratingTrim);
      if (!Number.isFinite(n) || n < 2.0 || n > 8.0) {
        setErr("DUPR rating must be a number between 2.0 and 8.0.");
        return;
      }
    }

    try {
      await api.putMe({
        displayName: name,
        duprId: duprId.trim(),
        duprRating: ratingTrim || null,
        avatarDataUrl,
        avatarColor,
        gender,
      });
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
      <div className="rounded-2xl border border-line border-l-4 border-l-signature bg-surface p-6">
        <div className="text-2xl font-semibold">My Profile</div>
        <div className="text-sm text-muted mt-1">
          Set your player display name (Phase II — saved in DynamoDB)
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {msg}
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        {!loggedIn ? (
          <div className="text-muted">Please login to update your profile.</div>
        ) : (
          <>
            <div className="text-sm text-muted">
              Logged in as: <span className="font-semibold">{email || "user"}</span>
            </div>

            <form onSubmit={save} className="mt-5 space-y-5">
              <div>
                <label className="text-xs text-muted">Gender (optional)</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { value: "", label: "Prefer not to say" },
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ].map((opt) => (
                    <button
                      key={opt.value || "unset"}
                      type="button"
                      onClick={() => setGender(opt.value)}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        gender === opt.value
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-line bg-surface2 text-ink hover:border-accent/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted">
                  Helps identify Men's/Women's/Mixed matchups, and picks a cartoon avatar if you haven't uploaded a
                  photo.
                </div>
              </div>

              <div>
                <label className="text-xs text-muted">Profile Photo / Avatar</label>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <PlayerAvatar
                    name={displayName || "?"}
                    avatarDataUrl={avatarDataUrl}
                    avatarColor={avatarColor}
                    gender={gender}
                    size={72}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line disabled:opacity-40"
                    >
                      {uploading ? "Processing…" : "Upload Photo"}
                    </button>
                    {avatarDataUrl && (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line"
                      >
                        Remove Photo
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={onPhotoChosen}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs text-muted">
                  {gender ? "Or pick a background color for your cartoon avatar:" : "Or pick a color instead of a photo:"}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AVATAR_PALETTE.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => pickColor(hex)}
                      title={hex}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        avatarColor === hex && !avatarDataUrl ? "border-ink scale-110" : "border-line"
                      }`}
                      style={{ background: hex }}
                    />
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted">
                  Shown on Player Rankings, team rosters, and anywhere else your name appears.
                </div>
              </div>

              <div>
                <label className="text-xs text-muted">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                  placeholder="e.g., Sai Sidharth"
                />
                <div className="mt-2 text-xs text-muted">
                  This will be used as the “player” name for bookings/matches.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted">DUPR ID (optional)</label>
                  <input
                    value={duprId}
                    onChange={(e) => setDuprId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                    placeholder="e.g., ABC123"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">DUPR Rating (optional)</label>
                  <input
                    value={duprRating}
                    onChange={(e) => setDuprRating(e.target.value)}
                    type="number"
                    step="0.001"
                    min="2"
                    max="8"
                    className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                    placeholder="e.g., 4.125"
                  />
                </div>
              </div>
              <div className="-mt-2 text-xs text-muted">
                Entered manually — DUPR doesn't offer a self-serve API for live syncing yet. Find your rating and ID
                in the DUPR app under your profile.
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="rounded-2xl bg-surface2 hover:bg-line border border-line px-4 py-2 font-semibold">
                  Save
                </button>

                <button
                  type="button"
                  onClick={resetToDefault}
                  className="rounded-2xl bg-surface2 hover:bg-surface2 border border-line px-4 py-2"
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
