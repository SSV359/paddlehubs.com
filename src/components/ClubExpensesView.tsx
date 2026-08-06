/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../AppContext';
import type { TournamentExpense, RosterPlayer } from '../types';
import { ExpenseSplitterCore } from './ExpenseSplitterCore';
import { DollarSign } from 'lucide-react';

const playerKey = (p: RosterPlayer) => p.email || p.name;

export const ClubExpensesView: React.FC = () => {
  const { tournaments, currentUser, isAuthenticated, isAdmin, api } = useAppState();
  const [expenses, setExpenses] = useState<TournamentExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.listClubExpenses().then((r: any) => setExpenses(r.items)).catch((e: any) => setError(e?.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // Combined across every tournament's registrant pool and every team
  // roster — the closest available proxy for "everyone in the club,"
  // since there's no separate club-membership list. Manual entry (below,
  // in the form) covers anyone this doesn't catch.
  const participants = useMemo(() => {
    const map = new Map<string, RosterPlayer>();
    for (const t of tournaments) {
      for (const p of t.playerPool || []) map.set(playerKey(p), p);
      for (const team of t.teams || []) for (const p of team.players) map.set(playerKey(p), p);
    }
    return Array.from(map.values());
  }, [tournaments]);

  return (
    <div className="space-y-6" id="club-expenses-view">
      <div className="flex items-center gap-2 mb-1.5">
        <DollarSign className="w-5 h-5 text-court-green shrink-0" />
        <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">SHARED COSTS</span>
      </div>
      <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase -mt-4">Split Costs</h1>
      <p className="text-slate-gray text-xs -mt-3">
        Track and split expenses across the whole club — not tied to any one tournament. For tournament-specific costs, use the Split Costs tab inside that tournament instead.
      </p>

      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}

      <ExpenseSplitterCore
        expenses={expenses}
        loading={loading}
        participants={participants}
        allowManualParticipant
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        isAdmin={isAdmin}
        lookupZelle={(email) => api.getPlayerProfileByEmail(email).catch(() => null)}
        onAdd={async (input) => { await api.createClubExpense(input); load(); }}
        onDelete={async (id) => { await api.deleteClubExpense(id); load(); }}
      />
    </div>
  );
};
