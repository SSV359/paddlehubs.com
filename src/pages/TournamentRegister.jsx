// /opt/paddlehubs-site/src/pages/TournamentRegister.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api } from "../lib/api.js";
import { Surface, PageHeading } from "../components/ui.jsx";

export default function TournamentRegister() {
  const { id } = useParams();

  const [tournament, setTournament] = useState(null);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await api.getTournamentPublicInfo(id);
        if (!cancelled) setTournament(t);
      } catch (e) {
        if (!cancelled) setLoadErr(String(e?.message || e));
      } finally {
        if (!cancelled) setLoadingTournament(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  const today = new Date().toISOString().slice(0, 10);
  const notOpenYet = tournament?.registrationStartDate && today < tournament.registrationStartDate;
  const closed = tournament?.registrationEndDate && today > tournament.registrationEndDate;
  const windowMessage = notOpenYet
    ? `Registration opens ${tournament.registrationStartDate}.`
    : closed
    ? `Registration closed on ${tournament.registrationEndDate}.`
    : "";

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) return setErr("Your name is required.");
    if (!form.email.trim()) return setErr("Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErr("Please enter a valid email address.");

    setSubmitting(true);
    try {
      await api.registerForTournament(id, form);
      setSubmitted(true);
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeading
        eyebrow="Tournament Registration"
        title={tournament?.name || (loadingTournament ? "Loading…" : "Register")}
        subtitle={
          tournament
            ? `${tournament.startDate} → ${tournament.endDate} — sign up below to play.`
            : loadErr
            ? "Couldn't load this tournament — the link may be incorrect."
            : undefined
        }
      />

      {submitted ? (
        <Surface className="p-6 text-center">
          <CheckCircle2 size={32} className="mx-auto text-emerald-600 dark:text-emerald-400" />
          <div className="mt-3 font-display text-2xl font-bold">You're registered</div>
          <div className="mt-1 text-sm text-muted">
            Thanks, {form.name.trim()}! The club will follow up with next steps and payment details if needed.
          </div>
        </Surface>
      ) : windowMessage ? (
        <Surface className="p-6 text-sm text-muted">
          <div className="font-medium text-ink">{notOpenYet ? "Registration hasn't opened yet" : "Registration is closed"}</div>
          <div className="mt-1">{windowMessage}</div>
        </Surface>
      ) : (
        <Surface className="p-6 shadow-sm">
          {err && (
            <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted">Your name</label>
              <input
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder="Full name"
                className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="text-xs text-muted">Email (required)</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                placeholder="name@example.com"
                className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="text-xs text-muted">Phone (optional)</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={onChange}
                placeholder="Phone number"
                className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="text-xs text-muted">Notes (optional)</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={onChange}
                rows="3"
                placeholder="Preferred partner, skill level, anything else the organizers should know"
                className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                disabled={submitting}
              />
            </div>

            <button
              className="w-full rounded-xl bg-accent py-2.5 font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40"
              disabled={submitting || loadingTournament}
            >
              {submitting ? "Submitting…" : "Register"}
            </button>
          </form>
        </Surface>
      )}
    </div>
  );
}
