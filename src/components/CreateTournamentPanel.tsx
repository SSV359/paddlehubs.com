/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';

// The real backend's POST /tournaments has no admin check — any signed-in
// user can create a tournament (they become its owner). This form is
// shared between Admin Portal and the Tournaments page so regular users
// get the same capability, not just admins.
export const CreateTournamentPanel: React.FC<{ api: any; onCreated: () => void; navigateTo: any }> = ({ api, onCreated, navigateTo }) => {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<'standard' | 'mlp_singles'>('standard');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [regStart, setRegStart] = useState('');
  const [regEnd, setRegEnd] = useState('');
  const [regLimit, setRegLimit] = useState('');
  const [teamCount, setTeamCount] = useState(4);
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !startDate || !endDate) { setError('Name, start date, and end date are required.'); return; }

    setSubmitting(true);
    try {
      const created = await api.createTournament({
        name: name.trim(),
        format,
        startDate,
        endDate,
        registrationStartDate: regStart || undefined,
        registrationEndDate: regEnd || undefined,
        registrationLimit: regLimit ? Number(regLimit) : undefined,
        teamCount,
        playersPerTeam,
      });
      await onCreated();
      setSuccess(true);
      setTimeout(() => navigateTo('tournament-hub', created.id), 800);
    } catch (err: any) {
      setError(err?.message || 'Failed to create tournament.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-light-border rounded-2xl p-6 shadow-sm space-y-4 max-w-2xl animate-fadeIn">
      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}
      {success && <p className="text-xs font-semibold text-court-green bg-court-green/10 border border-court-green/20 p-3 rounded-xl flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Tournament created! Redirecting...</p>}

      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Tournament Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Summer Doubles League" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5">
            <option value="standard">Standard</option>
            <option value="mlp_singles">MLP-Style Singles</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Registration Limit (optional)</label>
          <input type="number" value={regLimit} onChange={(e) => setRegLimit(e.target.value)} placeholder="Unlimited" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Registration Opens</label>
          <input type="date" value={regStart} onChange={(e) => setRegStart(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Registration Closes</label>
          <input type="date" value={regEnd} onChange={(e) => setRegEnd(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Number of Teams</label>
          <input type="number" min={1} max={64} value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Players per Team</label>
          <input type="number" min={1} max={20} value={playersPerTeam} onChange={(e) => setPlayersPerTeam(Number(e.target.value))} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
      </div>

      <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
        <Save className="w-4 h-4" /> {submitting ? 'Creating...' : 'Launch Tournament'}
      </button>
    </form>
  );
};
