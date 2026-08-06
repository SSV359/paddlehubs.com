/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import type { SubRequest } from '../types';
import { UserPlus, Plus, X, Check, Trash2, Calendar as CalendarIcon } from 'lucide-react';

export const NeedASubView: React.FC = () => {
  const { api, currentUser, isAuthenticated, isAdmin, tournaments } = useAppState();
  const [requests, setRequests] = useState<SubRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const load = () => {
    setLoading(true);
    api.listSubRequests().then((r: any) => setRequests(r.items)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const visible = requests.filter((r) => filter === 'all' || r.status === 'open');

  return (
    <div className="space-y-6" id="need-a-sub-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <UserPlus className="w-5 h-5 text-court-green shrink-0" />
            <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">COURT COVERAGE</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase">Need a Sub</h1>
          <p className="text-slate-gray text-xs mt-1">Can't make it? Post here — anyone in the club can offer to cover.</p>
        </div>
        {isAuthenticated && (
          <button onClick={() => setShowForm(true)} className="px-4 py-2.5 rounded-lg bg-court-green hover:bg-[#235F3A] text-white font-bold text-xs cursor-pointer shadow-sm flex items-center gap-2 transition-all shrink-0">
            <Plus className="w-4 h-4" /> Post a Request
          </button>
        )}
      </div>

      <div className="flex bg-white p-1 rounded-xl border border-light-border shadow-sm w-fit">
        {(['open', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              filter === f ? 'bg-deep-navy text-white' : 'text-slate-gray hover:text-charcoal'
            }`}
          >
            {f === 'open' ? 'Open Requests' : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-xs text-slate-gray font-mono">Loading requests...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white shadow-sm">
          <UserPlus className="w-10 h-10 text-slate-gray mx-auto mb-3" />
          <h3 className="text-sm font-bold text-charcoal">No open requests</h3>
          <p className="text-xs text-slate-gray mt-1">Everyone's covered — nice.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const canDelete = isAdmin || r.requesterSub === currentUser?.userSub;
            const canClaim = isAuthenticated && r.status === 'open' && r.requesterSub !== currentUser?.userSub;
            return (
              <div key={r.id} className={`bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-4 ${r.status === 'filled' ? 'border-light-border opacity-70' : 'border-light-border'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.status === 'open' ? 'bg-soft-gold/10 text-soft-gold border border-soft-gold/20' : 'bg-court-green/10 text-court-green border border-court-green/20'}`}>
                  {r.status === 'open' ? <UserPlus className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-charcoal">{r.message}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-mono text-slate-gray">
                    <span>Posted by <span className="font-bold text-charcoal">{r.requesterName}</span></span>
                    {r.tournamentName && <span>&middot; {r.tournamentName}</span>}
                    {r.date && <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {r.date}</span>}
                    {r.status === 'filled' && <span className="text-court-green font-bold">&middot; Covered by {r.filledByName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canClaim && (
                    <button
                      onClick={async () => { await api.claimSubRequest(r.id); load(); }}
                      className="px-3 py-2 rounded-lg bg-court-green hover:bg-[#235F3A] text-white text-[10px] font-bold font-mono uppercase cursor-pointer"
                    >
                      I Can Cover
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={async () => { if (confirm('Delete this request?')) { await api.deleteSubRequest(r.id); load(); } }}
                      className="text-slate-gray hover:text-red-600 cursor-pointer p-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <PostSubRequestForm
          tournaments={tournaments}
          api={api}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
};

const PostSubRequestForm: React.FC<{ tournaments: any[]; api: any; onClose: () => void; onCreated: () => void }> = ({ tournaments, api, onClose, onCreated }) => {
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!message.trim()) { setError('Tell people what you need — e.g. "Need a doubles partner for Saturday finals."'); return; }

    setSubmitting(true);
    try {
      await api.createSubRequest({ message: message.trim(), date, tournamentId: tournamentId || undefined });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to post request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-light-border">
          <h3 className="font-display font-bold text-sm text-charcoal">Post a Request</h3>
          <button type="button" onClick={onClose} className="text-slate-gray hover:text-charcoal cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">What do you need?</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="e.g. Need a sub for my doubles match Saturday morning, injured my ankle." className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Date (optional)</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Tournament (optional)</label>
              <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5">
                <option value="">None</option>
                {tournaments.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-light-border">
          <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer disabled:opacity-60">
            {submitting ? 'Posting...' : 'Post Request'}
          </button>
        </div>
      </form>
    </div>
  );
};
