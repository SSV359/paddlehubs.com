/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { Tournament, TournamentExpense, RosterPlayer } from '../types';
import { ExpenseSplitterCore } from './ExpenseSplitterCore';

const playerKey = (p: RosterPlayer) => p.email || p.name;

export const ExpensesPanel: React.FC<{ tour: Tournament; isAuthenticated: boolean; currentUser: any; isAdmin: boolean; api: any }> = ({ tour, isAuthenticated, currentUser, isAdmin, api }) => {
  const [expenses, setExpenses] = useState<TournamentExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.listExpenses(tour.id).then((r: any) => setExpenses(r.items)).catch((e: any) => setError(e?.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [tour.id]);

  // Everyone associated with this tournament — registered players plus
  // anyone rostered on a team, deduped by email (or name, for legacy
  // entries with no email).
  const participants = useMemo(() => {
    const map = new Map<string, RosterPlayer>();
    for (const p of tour.playerPool || []) map.set(playerKey(p), p);
    for (const t of tour.teams || []) for (const p of t.players) map.set(playerKey(p), p);
    return Array.from(map.values());
  }, [tour.playerPool, tour.teams]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}
      <ExpenseSplitterCore
        expenses={expenses}
        loading={loading}
        participants={participants}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        isAdmin={isAdmin}
        lookupZelle={(email) => api.getPlayerProfileByEmail(email).catch(() => null)}
        onAdd={async (input) => { await api.createExpense(tour.id, input); load(); }}
        onDelete={async (id) => { await api.deleteExpense(tour.id, id); load(); }}
      />
    </div>
  );
};
