/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { TournamentExpense, ExpenseCategory, RosterPlayer } from '../types';
import { ZelleQrModal } from './ZelleQrModal';
import { DollarSign, Plus, Trash2, Utensils, CircleDot, MapPinned, Plane, Shirt, Trophy, Package, ArrowRight, Check, Landmark } from 'lucide-react';

const CATEGORIES: { id: ExpenseCategory; label: string; icon: any }[] = [
  { id: 'food', label: 'Food & Drinks', icon: Utensils },
  { id: 'balls', label: 'Balls & Equipment', icon: CircleDot },
  { id: 'court', label: 'Court Fees', icon: MapPinned },
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'apparel', label: 'Apparel', icon: Shirt },
  { id: 'prizes', label: 'Prizes & Trophies', icon: Trophy },
  { id: 'other', label: 'Other', icon: Package },
];
const categoryMeta = (id: ExpenseCategory) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
const fmt = (n: number) => `$${n.toFixed(2)}`;
const playerKey = (p: RosterPlayer) => p.email || p.name;

export const ExpenseSplitterCore: React.FC<{
  expenses: TournamentExpense[];
  loading: boolean;
  participants: RosterPlayer[];
  allowManualParticipant?: boolean;
  isAuthenticated: boolean;
  currentUser: any;
  isAdmin: boolean;
  lookupZelle: (email: string) => Promise<{ name: string; zelleContact?: string } | null>;
  onAdd: (input: { description: string; category: ExpenseCategory; amount: number; paidBy: RosterPlayer; splitAmong: RosterPlayer[] }) => Promise<void>;
  onDelete: (expenseId: string) => Promise<void>;
}> = ({ expenses, loading, participants: baseParticipants, allowManualParticipant, isAuthenticated, currentUser, isAdmin, lookupZelle, onAdd, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [zelleTarget, setZelleTarget] = useState<{ name: string; contact: string } | null>(null);
  const [zelleLoadingKey, setZelleLoadingKey] = useState<string | null>(null);
  const [zelleNotFoundKey, setZelleNotFoundKey] = useState<string | null>(null);

  // The people list also always includes whoever appears in existing
  // expenses (paid-by or split-among) — someone manually added on a
  // past expense should still show up in balances/future splits even
  // if they're not in the "known" participant source anymore.
  const participants = useMemo(() => {
    const map = new Map<string, RosterPlayer>();
    for (const p of baseParticipants) map.set(playerKey(p), p);
    for (const e of expenses) {
      map.set(e.paidByEmail || e.paidByName, { name: e.paidByName, email: e.paidByEmail });
      for (const p of e.splitAmong) map.set(playerKey(p), p);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [baseParticipants, expenses]);

  const balances = useMemo(() => {
    const map = new Map<string, { name: string; amount: number }>();
    const ensure = (key: string, name: string) => {
      if (!map.has(key)) map.set(key, { name, amount: 0 });
      return map.get(key)!;
    };
    for (const e of expenses) {
      const payerKey = e.paidByEmail || e.paidByName;
      ensure(payerKey, e.paidByName).amount += e.amount;
      const share = e.amount / e.splitAmong.length;
      for (const p of e.splitAmong) ensure(playerKey(p), p.name).amount -= share;
    }
    return map;
  }, [expenses]);

  const settlements = useMemo(() => {
    const creditors = [...balances.entries()].filter(([, v]) => v.amount > 0.01).map(([k, v]) => ({ key: k, name: v.name, amount: v.amount })).sort((a, b) => b.amount - a.amount);
    const debtors = [...balances.entries()].filter(([, v]) => v.amount < -0.01).map(([k, v]) => ({ key: k, name: v.name, amount: -v.amount })).sort((a, b) => b.amount - a.amount);
    const out: { from: string; to: string; toKey: string; amount: number }[] = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci], d = debtors[di];
      const amt = Math.min(c.amount, d.amount);
      out.push({ from: d.name, to: c.name, toKey: c.key, amount: amt });
      c.amount -= amt; d.amount -= amt;
      if (c.amount < 0.01) ci++;
      if (d.amount < 0.01) di++;
    }
    return out;
  }, [balances]);

  const handlePayViaZelle = async (toKey: string, toName: string) => {
    if (!toKey.includes('@')) {
      setZelleNotFoundKey(toKey);
      setTimeout(() => setZelleNotFoundKey(null), 2500);
      return;
    }
    setZelleLoadingKey(toKey);
    try {
      const profile = await lookupZelle(toKey);
      if (profile?.zelleContact) {
        setZelleTarget({ name: profile.name || toName, contact: profile.zelleContact });
      } else {
        setZelleNotFoundKey(toKey);
        setTimeout(() => setZelleNotFoundKey(null), 2500);
      }
    } catch {
      setZelleNotFoundKey(toKey);
      setTimeout(() => setZelleNotFoundKey(null), 2500);
    } finally {
      setZelleLoadingKey(null);
    }
  };

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-sm text-charcoal">Shared Expenses</h3>
            <p className="text-[10px] text-slate-gray font-mono">{fmt(totalSpent)} total across {expenses.length} expense{expenses.length === 1 ? '' : 's'}</p>
          </div>
          {isAuthenticated && (
            <button onClick={() => setShowForm(!showForm)} className="px-3.5 py-2 rounded-lg bg-court-green hover:bg-[#235F3A] text-xs font-bold font-mono uppercase text-white transition-all cursor-pointer flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Add Expense'}
            </button>
          )}
        </div>

        {showForm && (
          <AddExpenseForm
            participants={participants}
            allowManualParticipant={allowManualParticipant}
            currentUser={currentUser}
            onAdd={async (input) => { await onAdd(input); setShowForm(false); }}
          />
        )}

        {loading ? (
          <div className="text-center py-10 text-xs text-slate-gray font-mono">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-light-border rounded-2xl bg-white text-slate-gray text-xs">
            No expenses logged yet — add the first one to start splitting costs.
          </div>
        ) : (
          <div className="space-y-2.5">
            {expenses.slice().reverse().map((e) => {
              const meta = categoryMeta(e.category);
              const Icon = meta.icon;
              const canDelete = isAdmin || e.createdBySub === currentUser?.userSub;
              return (
                <div key={e.id} className="bg-white border border-light-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-court-green/10 border border-court-green/20 flex items-center justify-center text-court-green shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-charcoal truncate">{e.description}</span>
                      <span className="text-sm font-mono font-black text-charcoal shrink-0">{fmt(e.amount)}</span>
                    </div>
                    <p className="text-[10px] text-slate-gray font-mono mt-0.5">
                      Paid by <span className="font-bold text-charcoal">{e.paidByName}</span> &middot; split {e.splitAmong.length} way{e.splitAmong.length === 1 ? '' : 's'} ({fmt(e.amount / e.splitAmong.length)} each)
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      onClick={async () => { if (confirm('Delete this expense?')) await onDelete(e.id); }}
                      className="text-slate-gray hover:text-red-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-deep-navy text-white rounded-2xl p-5 shadow-md border border-deep-navy/85 space-y-3">
          <h3 className="font-display text-[10px] font-medium text-court-green tracking-widest uppercase flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Balances
          </h3>
          {balances.size === 0 ? (
            <p className="text-xs text-slate-400">No expenses to balance yet.</p>
          ) : (
            <div className="space-y-2.5">
              {[...balances.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([key, v]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="font-semibold truncate">{v.name}</span>
                  <span className={`font-mono font-bold shrink-0 ${v.amount > 0.01 ? 'text-court-green' : v.amount < -0.01 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {v.amount > 0.01 ? `+${fmt(v.amount)}` : v.amount < -0.01 ? `-${fmt(Math.abs(v.amount))}` : 'settled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Settle Up</h3>
          {settlements.length === 0 ? (
            <p className="text-xs text-slate-gray flex items-center gap-1.5"><Check className="w-4 h-4 text-court-green" /> Everyone's square.</p>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, i) => (
                <div key={i} className="bg-off-white rounded-lg px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-charcoal truncate">{s.from}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-gray shrink-0" />
                    <span className="font-bold text-charcoal truncate">{s.to}</span>
                    <span className="ml-auto font-mono font-black text-court-green shrink-0">{fmt(s.amount)}</span>
                  </div>
                  <button
                    onClick={() => handlePayViaZelle(s.toKey, s.to)}
                    disabled={zelleLoadingKey === s.toKey}
                    className="w-full flex items-center justify-center gap-1.5 text-[9px] font-bold font-mono uppercase text-court-green hover:text-[#235F3A] cursor-pointer disabled:opacity-50 py-1"
                  >
                    <Landmark className="w-3 h-3" />
                    {zelleLoadingKey === s.toKey ? 'Looking up...' : zelleNotFoundKey === s.toKey ? 'No Zelle info on file' : 'Pay via Zelle'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {zelleTarget && (
        <ZelleQrModal name={zelleTarget.name} contact={zelleTarget.contact} onClose={() => setZelleTarget(null)} />
      )}
    </div>
  );
};

const AddExpenseForm: React.FC<{
  participants: RosterPlayer[];
  allowManualParticipant?: boolean;
  currentUser: any;
  onAdd: (input: { description: string; category: ExpenseCategory; amount: number; paidBy: RosterPlayer; splitAmong: RosterPlayer[] }) => Promise<void>;
}> = ({ participants, allowManualParticipant, currentUser, onAdd }) => {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [amount, setAmount] = useState('');
  const [paidByKey, setPaidByKey] = useState('');
  const [splitKeys, setSplitKeys] = useState<Set<string>>(new Set(participants.map(playerKey)));
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualAdded, setManualAdded] = useState<RosterPlayer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const me = participants.find((p) => p.email && currentUser?.email && p.email === currentUser.email);
    setPaidByKey(me ? playerKey(me) : participants[0] ? playerKey(participants[0]) : '');
  }, [participants.length]);

  const allPeople = useMemo(() => {
    const map = new Map<string, RosterPlayer>();
    for (const p of participants) map.set(playerKey(p), p);
    for (const p of manualAdded) map.set(playerKey(p), p);
    return Array.from(map.values());
  }, [participants, manualAdded]);

  const toggleSplit = (key: string) => {
    setSplitKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const addManualPerson = () => {
    const name = manualName.trim();
    if (!name) return;
    const p: RosterPlayer = { name, email: manualEmail.trim().toLowerCase() };
    setManualAdded((prev) => [...prev, p]);
    setSplitKeys((prev) => new Set(prev).add(playerKey(p)));
    setManualName('');
    setManualEmail('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!description.trim()) { setError('Description is required.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter a valid amount.'); return; }
    if (splitKeys.size === 0) { setError('Select at least one person to split with.'); return; }
    const paidBy = allPeople.find((p) => playerKey(p) === paidByKey);
    if (!paidBy) { setError('Select who paid.'); return; }

    setSubmitting(true);
    try {
      await onAdd({
        description: description.trim(),
        category,
        amount: amt,
        paidBy,
        splitAmong: allPeople.filter((p) => splitKeys.has(playerKey(p))),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to add expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-4">
      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Pickleballs for finals" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Amount ($)</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Category</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border cursor-pointer transition-all ${
                category === c.id ? 'bg-court-green text-white border-court-green' : 'bg-off-white text-slate-gray border-light-border hover:text-charcoal'
              }`}
            >
              <c.icon className="w-3.5 h-3.5" /> {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Paid By</label>
        <select value={paidByKey} onChange={(e) => setPaidByKey(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5">
          {allPeople.length === 0 && <option value="">No participants yet</option>}
          {allPeople.map((p) => <option key={playerKey(p)} value={playerKey(p)}>{p.name}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Split Among ({splitKeys.size})</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSplitKeys(new Set(allPeople.map(playerKey)))} className="text-[9px] font-mono font-bold text-court-green hover:underline cursor-pointer uppercase">All</button>
            <button type="button" onClick={() => setSplitKeys(new Set())} className="text-[9px] font-mono font-bold text-slate-gray hover:underline cursor-pointer uppercase">None</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-light-border rounded-lg bg-off-white">
          {allPeople.length === 0 ? (
            <p className="text-[10px] text-slate-gray">No one to split with yet — add someone manually below.</p>
          ) : allPeople.map((p) => (
            <button
              key={playerKey(p)}
              type="button"
              onClick={() => toggleSplit(playerKey(p))}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                splitKeys.has(playerKey(p)) ? 'bg-court-green/10 text-court-green border-court-green/30' : 'bg-white text-slate-gray border-light-border'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {allowManualParticipant && (
          <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 pt-1">
            <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Add someone by name..." className="text-xs bg-white border border-light-border rounded-lg px-2.5 py-2" />
            <input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="Email (optional)" className="text-xs bg-white border border-light-border rounded-lg px-2.5 py-2" />
            <button type="button" onClick={addManualPerson} className="px-3 py-2 bg-court-green/10 text-court-green rounded-lg text-[10px] font-bold font-mono uppercase cursor-pointer">Add</button>
          </div>
        )}
      </div>

      <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer disabled:opacity-60">
        {submitting ? 'Adding...' : 'Add Expense'}
      </button>
    </form>
  );
};
