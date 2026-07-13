// /opt/paddlehubs-site/src/pages/Tournaments.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isLoggedIn } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { resizeImageFile } from "../lib/image.js";
import { HScroll, PromoCard } from "../components/ui.jsx";

function trim(v) {
  return String(v || "").trim();
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Tournaments() {
  const loggedIn = isLoggedIn();
  const navigate = useNavigate();
  const logoInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    registrationStartDate: new Date().toISOString().slice(0, 10),
    registrationEndDate: new Date().toISOString().slice(0, 10),
    registrationLimit: "",
    teamCount: 4,
    playersPerTeam: 2,
    format: "standard",
    mlpRegWin: 3,
    mlpDbWin: 2,
    mlpDbLoss: 1,
    mlpRegLoss: 0,
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
    if (name === "format") {
      setForm((f) => ({
        ...f,
        format: value,
        teamCount: value === "mlp_singles" ? 6 : 4,
        playersPerTeam: value === "mlp_singles" ? 4 : 2,
      }));
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function onLogoChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Please choose an image file.");

    setErr("");
    setLogoUploading(true);
    try {
      const dataUrl = await resizeImageFile(file, 240, 0.8);
      setLogoDataUrl(dataUrl);
    } catch (e2) {
      setErr(e2.message || "Couldn't process that image.");
    } finally {
      setLogoUploading(false);
    }
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
      registrationStartDate: trim(form.registrationStartDate),
      registrationEndDate: trim(form.registrationEndDate),
      registrationLimit: form.registrationLimit === "" ? "" : Number(form.registrationLimit),
      teamCount: Number(form.teamCount),
      playersPerTeam: Number(form.playersPerTeam),
      format: form.format,
      logoDataUrl,
      ...(form.format === "mlp_singles"
        ? {
            mlpRegWin: Number(form.mlpRegWin),
            mlpDbWin: Number(form.mlpDbWin),
            mlpDbLoss: Number(form.mlpDbLoss),
            mlpRegLoss: Number(form.mlpRegLoss),
          }
        : {}),
    };

    if (!payload.name) return setErr("Tournament name is required.");

    setLoading(true);
    try {
      const created = await api.createTournament(payload);

      // refresh list
      await load();

      setMsg("Tournament created ✅");
      setLogoDataUrl("");

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

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (items || [])
      .filter((t) => t.startDate && t.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 10);
  }, [items]);

  const PROMO_GRADIENTS = [
    ["#1C4E80", "#0b1319"],
    ["#8338EC", "#1a0f2e"],
    ["#2F9E44", "#0f1f13"],
    ["#E4572E", "#2a1108"],
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line border-l-4 border-l-signature bg-surface p-6">
        <div className="font-display text-3xl font-black uppercase tracking-tight">Tournaments</div>
        <div className="text-sm text-muted mt-1">Create tournaments, setup teams, and track standings.</div>
      </div>

      {upcoming.length > 0 && (
        <div>
          <div className="flex items-end justify-between">
            <div className="font-display text-xl font-black uppercase tracking-tight">Upcoming Tournaments</div>
          </div>
          <HScroll className="mt-3">
            {upcoming.map((t, i) => (
              <button key={t.id} onClick={() => navigate(`/tournaments/${t.id}`)} className="text-left">
                <PromoCard
                  title={t.name || "Tournament"}
                  subtitle={`${t.startDate} → ${t.endDate}`}
                  badge={t.format === "mlp_singles" ? "MLP Singles" : "Round Robin"}
                  gradientFrom={PROMO_GRADIENTS[i % PROMO_GRADIENTS.length][0]}
                  gradientTo={PROMO_GRADIENTS[i % PROMO_GRADIENTS.length][1]}
                  logoUrl={t.logoDataUrl}
                />
              </button>
            ))}
          </HScroll>
        </div>
      )}

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

      {!loggedIn ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-muted">Please login.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Create tournament</div>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-xl border border-line bg-surface2 hover:bg-surface2 px-3 py-2 text-xs disabled:opacity-40"
              >
                Refresh
              </button>
            </div>

            <form onSubmit={onCreate} className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-muted">Tournament Logo (optional)</label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {logoDataUrl ? (
                    <img src={logoDataUrl} alt="Tournament logo" className="h-14 w-14 rounded-xl border border-line object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-line text-[10px] text-muted">
                      No logo
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading || loading}
                      className="rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line disabled:opacity-40"
                    >
                      {logoUploading ? "Processing…" : "Upload Logo"}
                    </button>
                    {logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoDataUrl("")}
                        className="rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line"
                      >
                        Remove
                      </button>
                    )}
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={onLogoChosen} className="hidden" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted">Tournament Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="e.g., Winter Open 2026"
                  className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={onChange}
                    className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={form.endDate}
                    onChange={onChange}
                    className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted">Registration Opens</label>
                  <input
                    type="date"
                    name="registrationStartDate"
                    value={form.registrationStartDate}
                    onChange={onChange}
                    className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Registration Closes</label>
                  <input
                    type="date"
                    name="registrationEndDate"
                    value={form.registrationEndDate}
                    onChange={onChange}
                    className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted">Registration Limit (optional — max # of registrants)</label>
                <input
                  type="number"
                  name="registrationLimit"
                  value={form.registrationLimit}
                  onChange={onChange}
                  min={0}
                  placeholder="Leave blank for unlimited"
                  className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-xs text-muted">Format</label>
                <select
                  name="format"
                  value={form.format}
                  onChange={onChange}
                  className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                  disabled={loading}
                >
                  <option value="standard">Standard (round robin, win/tie/loss)</option>
                  <option value="mlp_singles">MLP One-Day Singles (6 teams, 4 players, DreamBreaker)</option>
                </select>
                {form.format === "mlp_singles" && (
                  <div className="mt-2 text-xs text-muted">
                    4 singles games per matchup, decided by games won. A 2-2 tie is broken by a DreamBreaker — record
                    it when adding that match. Team count and players per team below are set to 6 and 4 to match the
                    format, but can still be adjusted.
                  </div>
                )}
              </div>

              {form.format === "mlp_singles" && (
                <div className="rounded-xl border border-line bg-surface2 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Standings points (editable)
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["mlpRegWin", "Reg. Win"],
                      ["mlpDbWin", "DB Win"],
                      ["mlpDbLoss", "DB Loss"],
                      ["mlpRegLoss", "Reg. Loss"],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="text-[11px] text-muted">{label}</label>
                        <input
                          type="number"
                          name={key}
                          value={form[key]}
                          onChange={onChange}
                          className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                          disabled={loading}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted">How many teams?</label>
                  <input
                    type="number"
                    name="teamCount"
                    value={form.teamCount}
                    onChange={onChange}
                    min={1}
                    max={64}
                    className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Players per team</label>
                  <input
                    type="number"
                    name="playersPerTeam"
                    value={form.playersPerTeam}
                    onChange={onChange}
                    min={1}
                    max={20}
                    className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                className="w-full rounded-2xl bg-surface2 hover:bg-line border border-line py-2.5 font-semibold disabled:opacity-40"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Tournament"}
              </button>

              <div className="text-xs text-muted">
                After creation, setup team names + players inside the tournament.
              </div>
            </form>
          </div>

          {/* List */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">All tournaments</div>
              <div className="text-xs text-muted">{sorted.length}</div>
            </div>

            <div className="mt-4 space-y-3">
              {sorted.length === 0 ? (
                <div className="text-sm text-muted">No tournaments yet.</div>
              ) : (
                sorted.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/tournaments/${t.id}`)}
                    className={classNames(
                      "flex w-full items-center gap-3 text-left rounded-xl border border-line bg-surface2 hover:bg-surface2 p-4"
                    )}
                  >
                    {t.logoDataUrl ? (
                      <img
                        src={t.logoDataUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-sm font-bold text-muted">
                        {(t.name || "?")[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">
                        {t.name || "Tournament"}
                        {t.format === "mlp_singles" && (
                          <span className="ml-2 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                            MLP Singles
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {t.startDate || "—"} → {t.endDate || "—"} • {t.status || "ACTIVE"}
                      </div>
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

