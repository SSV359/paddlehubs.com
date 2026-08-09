/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { Tournament, TournamentWinnerEntry } from '../types';
import { compressImageFile } from '../utils/imageCompress';
import { Trophy, Camera, Pencil } from 'lucide-react';

const PLACES: { key: 'first' | 'second' | 'third'; label: string; medal: string; accent: string }[] = [
  { key: 'first', label: '1st Place', medal: '🥇', accent: 'from-soft-gold/20 to-soft-gold/5 border-soft-gold/30' },
  { key: 'second', label: '2nd Place', medal: '🥈', accent: 'from-slate-300/20 to-slate-300/5 border-slate-300/40' },
  { key: 'third', label: '3rd Place', medal: '🥉', accent: 'from-amber-700/20 to-amber-700/5 border-amber-700/30' },
];

export const TournamentWinnersCard: React.FC<{ tour: Tournament; isAdmin: boolean; api: any; onChanged: () => void }> = ({ tour, isAdmin, api, onChanged }) => {
  const [editingPlace, setEditingPlace] = useState<'first' | 'second' | 'third' | null>(null);

  const hasAnyWinner = !!(tour.winners?.first || tour.winners?.second || tour.winners?.third);
  if (!hasAnyWinner && !isAdmin) return null; // nothing to show a non-admin visitor yet

  const teamName = (id?: string) => (tour.teams || []).find((t) => t.id === id)?.name || '';

  return (
    <div className="bg-white border border-light-border rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-soft-gold" />
        <h3 className="font-display font-bold text-lg text-charcoal">Champions</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLACES.map((p) => {
          const entry = tour.winners?.[p.key];
          return (
            <div key={p.key} className={`relative rounded-2xl border bg-gradient-to-b p-4 text-center ${p.accent}`}>
              {isAdmin && (
                <button
                  onClick={() => setEditingPlace(p.key)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/80 hover:bg-white flex items-center justify-center cursor-pointer shadow-sm"
                  title={entry ? 'Change' : 'Set winner'}
                >
                  <Pencil className="w-3.5 h-3.5 text-charcoal" />
                </button>
              )}
              <span className="text-3xl block mb-2">{p.medal}</span>
              {entry?.photoDataUrl ? (
                <img src={entry.photoDataUrl} alt={teamName(entry.teamId)} className="w-24 h-24 rounded-xl object-cover mx-auto border-2 border-white shadow-md mb-2" />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-white/60 border-2 border-dashed border-white mx-auto flex items-center justify-center mb-2">
                  <Camera className="w-6 h-6 text-slate-gray/40" />
                </div>
              )}
              <p className="text-[9px] font-mono uppercase text-slate-gray font-bold">{p.label}</p>
              <p className="text-sm font-bold text-charcoal mt-0.5">{entry?.teamId ? teamName(entry.teamId) : 'Not set yet'}</p>
            </div>
          );
        })}
      </div>

      {editingPlace && (
        <EditWinnerModal
          tour={tour}
          place={editingPlace}
          api={api}
          onClose={() => setEditingPlace(null)}
          onSaved={() => { setEditingPlace(null); onChanged(); }}
        />
      )}
    </div>
  );
};

const EditWinnerModal: React.FC<{ tour: Tournament; place: 'first' | 'second' | 'third'; api: any; onClose: () => void; onSaved: () => void }> = ({ tour, place, api, onClose, onSaved }) => {
  const existing = tour.winners?.[place];
  const placeLabel = PLACES.find((p) => p.key === place)!.label;
  const [teamId, setTeamId] = useState(existing?.teamId || '');
  const [photoDataUrl, setPhotoDataUrl] = useState(existing?.photoDataUrl || '');
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setError(null);
    try {
      setPhotoDataUrl(await compressImageFile(file));
    } catch (err: any) {
      setError(err?.message || 'Could not process that photo.');
    } finally {
      setCompressing(false);
    }
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const entry: TournamentWinnerEntry = { teamId, photoDataUrl };
      await api.updateTournamentWinners(tour.id, { [place]: entry });
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold text-lg text-charcoal">Set {placeLabel}</h3>
        {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">{error}</p>}

        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Team</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5">
            <option value="">Select a team...</option>
            {(tour.teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Photo</label>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-light-border rounded-xl h-32 cursor-pointer hover:border-court-green transition-all overflow-hidden bg-off-white">
            {compressing ? (
              <span className="text-xs text-slate-gray font-mono">Compressing...</span>
            ) : photoDataUrl ? (
              <img src={photoDataUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-slate-gray"><Camera className="w-5 h-5" /><span className="text-[10px] font-mono">Add a photo</span></span>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-light-border text-xs font-bold font-mono uppercase text-slate-gray hover:text-charcoal cursor-pointer">Cancel</button>
          <button onClick={submit} disabled={submitting || compressing || !teamId} className="flex-1 py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer disabled:opacity-60">
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
