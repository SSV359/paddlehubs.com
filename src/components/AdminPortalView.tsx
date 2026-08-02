/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppState } from '../AppContext';
import { CreateTournamentPanel } from './CreateTournamentPanel';
import {
  ShieldCheck,
  Award,
  PlusCircle,
  Calendar,
  Layers,
  Save,
  Check,
  AlertCircle,
  CheckCircle2,
  Wrench,
  QrCode,
  Link as LinkIcon,
  Copy,
  Trash2,
  Plus,
  Grid,
  Users,
  Activity,
} from 'lucide-react';

type AdminSubView = 'create-tour' | 'directory';

export const AdminPortalView: React.FC = () => {
  const { tournaments, navigateTo, refreshTournaments, api } = useAppState();
  const [activeAdminSubView, setActiveAdminSubView] = useState<AdminSubView>('create-tour');

  return (
    <div className="space-y-6" id="admin-portal-page">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <ShieldCheck className="w-5 h-5 text-court-green shrink-0" />
        <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">ADMIN OPERATIONS</span>
      </div>
      <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase -mt-4">
        Admin Portal
      </h1>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 bg-white p-1 rounded-xl border border-light-border shadow-sm self-start">
        {[
          { id: 'create-tour' as AdminSubView, label: 'Create Tournament', icon: PlusCircle },
          { id: 'directory' as AdminSubView, label: 'Manage Existing', icon: Grid },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveAdminSubView(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono tracking-wider rounded-lg transition-all cursor-pointer ${
                activeAdminSubView === tab.id ? 'bg-deep-navy text-white shadow-sm' : 'text-slate-gray hover:text-charcoal'
              }`}
            >
              <Icon className="w-4 h-4" /><span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeAdminSubView === 'create-tour' && <CreateTournamentPanel api={api} onCreated={refreshTournaments} navigateTo={navigateTo} />}
      {activeAdminSubView === 'directory' && <DirectoryPanel tournaments={tournaments} navigateTo={navigateTo} />}
    </div>
  );
};

const DirectoryPanel: React.FC<{ tournaments: any[]; navigateTo: any }> = ({ tournaments, navigateTo }) => (
  <div className="space-y-4 animate-fadeIn">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button onClick={() => navigateTo('registered-users')} className="bg-white border border-light-border rounded-2xl p-5 shadow-sm hover:border-court-green/40 transition-all cursor-pointer text-left flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-court-green/10 flex items-center justify-center text-court-green"><Users className="w-5 h-5" /></div>
        <div>
          <h4 className="font-bold text-sm text-charcoal">Registered Users</h4>
          <p className="text-[10px] text-slate-gray">View all Cognito accounts</p>
        </div>
      </button>
      <button onClick={() => navigateTo('analytics')} className="bg-white border border-light-border rounded-2xl p-5 shadow-sm hover:border-court-green/40 transition-all cursor-pointer text-left flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-court-green/10 flex items-center justify-center text-court-green"><Activity className="w-5 h-5" /></div>
        <div>
          <h4 className="font-bold text-sm text-charcoal">Site Analytics</h4>
          <p className="text-[10px] text-slate-gray">Traffic and page views</p>
        </div>
      </button>
    </div>

    <div className="bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-off-white p-4 border-b border-light-border">
        <h3 className="font-bold text-sm text-slate-gray font-mono uppercase tracking-wider">All Tournaments</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {tournaments.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-gray font-mono">No tournaments yet.</div>
        ) : tournaments.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <span className="text-sm font-bold text-charcoal block">{t.name}</span>
              <span className="text-[10px] text-slate-gray font-mono">{t.startDate} to {t.endDate} &middot; {t.teams?.length || 0} teams</span>
            </div>
            <button onClick={() => navigateTo('tournament-hub', t.id)} className="text-xs font-bold font-mono text-court-green hover:underline cursor-pointer uppercase">Manage &rarr;</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);
