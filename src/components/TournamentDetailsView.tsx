/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppState } from '../AppContext';
import { AuctionRoom } from './AuctionRoom';
import { NetDivider } from './NetDivider';
import type {
  Tournament,
  TeamStandingRow,
  PlayerRankingRow,
  TournamentMatch,
  TournamentSchedule,
  TournamentRegistration,
  TournamentTeam,
  RosterPlayer,
  Me,
} from '../types';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Trophy,
  Users,
  Info,
  History,
  FileText,
  Bookmark,
  ChevronRight,
  ArrowUpRight,
  Award,
  Zap,
  Sparkles,
  Search,
  Trash2,
  Plus,
  Edit,
  UserPlus,
  Settings,
  Check,
  CheckSquare,
  Square,
  X,
  AlertCircle,
  Flame,
  Share2,
  Medal,
  Gavel,
  MessageCircle,
  Send,
} from 'lucide-react';

type SubTab = 'overview' | 'standings' | 'player-rankings' | 'teams' | 'matches' | 'schedule' | 'registrations' | 'playoffs' | 'auction';

const today = () => new Date().toISOString().slice(0, 10);
const deriveStatus = (t: Tournament) => {
  const now = today();
  if (t.endDate && t.endDate < now) return 'completed';
  if (t.startDate && t.startDate > now) return 'upcoming';
  return 'active';
};

export const TournamentDetailsView: React.FC = () => {
  const {
    activeTournamentId,
    tournaments,
    navigateTo,
    navigateBack,
    canNavigateBack,
    isAdmin,
    isAuthenticated,
    currentUser,
    refreshTournaments,
    refreshPlayerRankings,
    api,
  } = useAppState();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; message: string; onConfirm: () => void }>({
    show: false, message: '', onConfirm: () => {},
  });
  const triggerConfirm = (message: string, onConfirm: () => void) => setConfirmModal({ show: true, message, onConfirm });

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const tour = tournaments.find(t => t.id === activeTournamentId);

  // Lazily-loaded per-tab data
  const [standings, setStandings] = useState<TeamStandingRow[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [schedule, setSchedule] = useState<TournamentSchedule | null>(null);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);

  // Real backend permission model: almost every mutating endpoint on a
  // tournament (teams, schedule, matches, registrations, playoffs,
  // auction) already accepts "admin OR the tournament's owner" — the
  // frontend was only ever exposing the admin half of that. isOwner
  // fills in the other half; canEdit is the shorthand used everywhere
  // an editing control needs to show for either. Deleting the whole
  // tournament is intentionally kept separate (owner-only, see below).
  const isOwner = !!currentUser && !!tour && tour.ownerSub === currentUser.userSub;
  const canEdit = isAdmin || isOwner;

  const loadTabData = useCallback(async (tab: SubTab) => {
    if (!tour) return;
    setLoadingTab(true);
    try {
      if (tab === 'standings') setStandings((await api.getTeamStandings(tour.id)).standings);
      else if (tab === 'matches') setMatches((await api.listTournamentMatches(tour.id)).items);
      else if (tab === 'schedule') {
        const [sched, m] = await Promise.all([api.getTournamentSchedule(tour.id), api.listTournamentMatches(tour.id)]);
        setSchedule(sched);
        setMatches(m.items);
      }
      else if (tab === 'registrations' && canEdit) setRegistrations((await api.listRegistrations(tour.id)).items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTab(false);
    }
  }, [tour?.id, canEdit]);

  useEffect(() => { loadTabData(activeSubTab); }, [activeSubTab, loadTabData]);

  if (!tour) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-sm">Tournament not found or session expired.</p>
        <button onClick={() => navigateTo('tournaments')} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">
          Back to Directory
        </button>
      </div>
    );
  }

  const status = deriveStatus(tour);
  const teamsFilled = tour.teams?.length || 0;
  const teamsTarget = tour.teamCount || teamsFilled || 1;
  const capacityPct = Math.min(100, Math.round((teamsFilled / teamsTarget) * 100));
  const regOpen = today() >= tour.registrationStartDate && today() <= tour.registrationEndDate;

  const handleDelete = () => {
    triggerConfirm(`Are you sure you want to delete the tournament "${tour.name}"? This action cannot be undone.`, async () => {
      try {
        await api.deleteTournament(tour.id);
        await refreshTournaments();
        navigateTo('tournaments');
      } catch (e: any) {
        alert(e?.message || 'Failed to delete tournament.');
      }
    });
  };

  const startEditingTitle = () => { setTitleDraft(tour.name); setTitleError(null); setEditingTitle(true); };
  const saveTitle = async () => {
    if (!titleDraft.trim()) { setTitleError('Name cannot be empty.'); return; }
    setTitleSaving(true);
    setTitleError(null);
    try {
      await api.updateTournamentName(tour.id, titleDraft.trim());
      await refreshTournaments();
      setEditingTitle(false);
    } catch (e: any) {
      setTitleError(e?.message || 'Failed to rename tournament.');
    } finally {
      setTitleSaving(false);
    }
  };

  const tabs: { id: SubTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'standings', label: 'Team Standings', icon: Trophy },
    { id: 'player-rankings', label: 'Player Rankings', icon: Award },
    { id: 'teams', label: 'Teams & Roster', icon: Users },
    { id: 'matches', label: 'Match History', icon: History },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'auction', label: 'Player Auction', icon: Gavel },
    // Only the owner or an admin can see who's registered — not just any
    // logged-in user — and both can manage (view/edit/delete) that list.
    ...(canEdit ? [{ id: 'registrations' as SubTab, label: 'Registrations', icon: UserPlus }] : []),
    ...(canEdit ? [{ id: 'playoffs' as SubTab, label: 'Playoffs', icon: Medal }] : []),
  ];

  return (
    <div className="space-y-6" id="tournament-hub-page">
      {/* Back link */}
      <button
        onClick={() => { if (canNavigateBack) navigateBack(); else navigateTo('tournaments'); }}
        className="inline-flex items-center gap-1.5 text-xs text-slate-gray hover:text-charcoal transition-colors font-bold font-mono tracking-wider uppercase cursor-pointer"
        id="back-to-tours-btn"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Tournament Identity Header */}
      <div className="relative rounded-2xl overflow-hidden bg-white border border-light-border p-6 pl-7 sm:p-8 sm:pl-9.5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-2xl z-20"></div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-court-green/5 rounded-full blur-3xl -mr-12 -mt-12 -z-10"></div>

        <div className="relative z-10 space-y-4 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider border uppercase ${
              status === 'active' ? 'bg-court-green/10 text-court-green border-court-green/20' : status === 'upcoming' ? 'bg-soft-gold/10 text-soft-gold border-soft-gold/20' : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {status}
            </span>
            <span className="text-light-border text-xs font-semibold font-mono">|</span>
            <span className="text-[10px] text-court-green font-bold font-mono tracking-wider uppercase bg-court-green/10 px-2.5 py-0.5 rounded border border-court-green/20">
              {tour.format === 'mlp_singles' ? 'MLP Singles' : 'Standard'} Format
            </span>
            <span className="text-light-border text-xs font-semibold font-mono">|</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase ${regOpen ? 'text-green-600' : 'text-slate-gray'}`}>
              &#9679; {regOpen ? 'Registration Open' : 'Registration Closed'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {tour.logoDataUrl ? (
              <img src={tour.logoDataUrl} alt={tour.name} className="w-12 h-12 rounded-xl object-cover border border-light-border shadow-sm shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-court-green/10 border border-court-green/20 flex items-center justify-center text-court-green shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
            )}
            {editingTitle ? (
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    autoFocus
                    className="text-xl sm:text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase bg-off-white border border-court-green rounded-lg px-3 py-1.5 flex-1"
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  />
                  <button onClick={saveTitle} disabled={titleSaving} className="px-3 py-1.5 rounded-lg bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase cursor-pointer disabled:opacity-60">
                    {titleSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingTitle(false)} className="px-3 py-1.5 rounded-lg border border-light-border text-xs font-bold font-mono uppercase text-slate-gray hover:text-charcoal cursor-pointer">
                    Cancel
                  </button>
                </div>
                {titleError && <p className="text-xs font-semibold text-red-600">{titleError}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-charcoal tracking-tight uppercase">
                  {tour.name}
                </h1>
                {canEdit && (
                  <button onClick={startEditingTitle} className="p-1.5 rounded-lg text-slate-gray hover:text-court-green hover:bg-court-green/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" title="Rename tournament">
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <NetDivider light className="max-w-[120px] mt-2" />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-4 text-xs text-slate-gray border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-gray/60" />
              <span>{tour.startDate} to {tour.endDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-gray/60" />
              <span>{teamsFilled} / {teamsTarget} Teams &middot; {tour.playersPerTeam} players each</span>
            </div>
          </div>
        </div>

        {/* Interactive Registration Action Callout */}
        <div className="bg-off-white border border-light-border p-4 rounded-xl w-full md:w-64 shrink-0 space-y-3 relative z-10">
          <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-slate-gray">
            <span>ROSTER CAPACITY</span>
            <span className="text-court-green">{capacityPct}% FULL</span>
          </div>

          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-court-green transition-all duration-500" style={{ width: `${capacityPct}%` }}></div>
          </div>

          <button
            onClick={() => { if (regOpen) navigateTo('register-bracket', tour.id); else alert('Registration for this bracket is closed.'); }}
            className={`w-full py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider text-center transition-all cursor-pointer shadow-sm ${
              regOpen ? 'bg-court-green hover:bg-[#235F3A] text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {regOpen ? 'Register Athlete / Team' : 'Registration Closed'}
          </button>

          {isOwner && (
            <button
              onClick={handleDelete}
              className="w-full py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider text-center bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 mt-2"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Delete Bracket</span>
            </button>
          )}
        </div>
      </div>

      {/* Internal Navigation Sub-tabs */}
      <div className="flex border-b border-light-border overflow-x-auto gap-2 py-1 scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider rounded-lg transition-all border cursor-pointer shrink-0 ${
                isActive ? 'bg-deep-navy border-deep-navy text-white shadow-sm' : 'bg-transparent border-transparent text-slate-gray hover:text-charcoal hover:bg-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-transparent" id="subtab-panel-container">
        {activeSubTab === 'overview' && <OverviewPanel tour={tour} isAdmin={canEdit} api={api} onChanged={refreshTournaments} />}
        {activeSubTab === 'standings' && <StandingsPanel standings={standings} loading={loadingTab} navigateTo={navigateTo} />}
        {activeSubTab === 'player-rankings' && <RankingsPanel tour={tour} api={api} navigateTo={navigateTo} />}
        {activeSubTab === 'teams' && (
          <TeamsPanel tour={tour} isAdmin={canEdit} navigateTo={navigateTo} onSaved={refreshTournaments} api={api} />
        )}
        {activeSubTab === 'matches' && (
          <MatchesPanel tour={tour} matches={matches} loading={loadingTab} isAdmin={canEdit} isAuthenticated={isAuthenticated} api={api} onChanged={() => { loadTabData('matches'); refreshPlayerRankings(); }} />
        )}
        {activeSubTab === 'schedule' && (
          <SchedulePanel
            tour={tour}
            schedule={schedule}
            matches={matches}
            loading={loadingTab}
            isAdmin={canEdit}
            isAuthenticated={isAuthenticated}
            currentUser={currentUser}
            api={api}
            onChanged={() => { loadTabData('schedule'); loadTabData('matches'); refreshPlayerRankings(); }}
          />
        )}
        {activeSubTab === 'registrations' && canEdit && (
          <RegistrationsPanel tour={tour} registrations={registrations} loading={loadingTab} api={api} onChanged={() => loadTabData('registrations')} />
        )}
        {activeSubTab === 'playoffs' && canEdit && (
          <PlayoffsPanel tour={tour} api={api} onChanged={refreshTournaments} />
        )}
        {activeSubTab === 'auction' && <AuctionRoom tournament={tour} isAdmin={canEdit} onChanged={refreshTournaments} api={api} />}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-light-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <p className="text-sm text-charcoal font-semibold">{confirmModal.message}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmModal({ show: false, message: '', onConfirm: () => {} })}
                className="flex-1 py-2.5 rounded-xl border border-light-border text-xs font-bold text-slate-gray hover:text-charcoal transition-all uppercase tracking-wider font-mono cursor-pointer"
              >Cancel</button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal({ show: false, message: '', onConfirm: () => {} }); }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-all uppercase tracking-wider font-mono cursor-pointer"
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------- Overview ----------------
const OverviewPanel: React.FC<{ tour: Tournament; isAdmin: boolean; api: any; onChanged: () => void }> = ({ tour, isAdmin, api, onChanged }) => {
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError('Logo must be a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 130_000) {
      setLogoError('That image is too large — try a smaller file (under ~130KB).');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file')));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      await api.updateTournamentLogo(tour.id, dataUrl);
      onChanged();
    } catch (err: any) {
      setLogoError(err?.message || 'Failed to upload logo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-light-border rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="font-display font-bold text-lg text-charcoal">About the Tournament</h3>
          <p className="text-slate-gray text-sm leading-relaxed">
            {tour.teamCount} teams of {tour.playersPerTeam} players compete in a {tour.format === 'mlp_singles' ? 'Major League Pickleball-style singles' : 'standard'} format, hosted by {tour.ownerDisplayName || 'PaddleHubs'}.
          </p>
        </div>
        {tour.playerPool && tour.playerPool.length > 0 && (
          <div className="bg-white border border-light-border rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="font-display font-bold text-lg text-charcoal">Player Pool ({tour.playerPool.length})</h3>
            <div className="flex flex-wrap gap-2">
              {tour.playerPool.map((p) => (
                <span key={p.email || p.name} className="text-xs font-mono bg-off-white border border-light-border px-2.5 py-1 rounded-lg text-charcoal">{p.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="space-y-6">
        <RegistrationWindowCard tour={tour} isAdmin={isAdmin} api={api} onChanged={onChanged} />
        {isAdmin && (
          <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Tournament Logo</h3>
            {logoError && <p className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 p-2 rounded-lg">{logoError}</p>}
            <div className="flex items-center gap-3">
              {tour.logoDataUrl ? (
                <img src={tour.logoDataUrl} alt={tour.name} className="w-14 h-14 rounded-xl object-cover border border-light-border" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-off-white border border-dashed border-light-border flex items-center justify-center text-slate-gray text-[9px] font-mono text-center">No Logo</div>
              )}
              <label className="flex-1 text-center py-2.5 rounded-xl border border-light-border hover:border-court-green text-[10px] font-bold font-mono uppercase text-slate-gray hover:text-court-green cursor-pointer transition-all">
                {uploading ? 'Uploading...' : 'Upload Logo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} disabled={uploading} />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Editable Registration Window — reopening/closing registration or
// changing the cap is just this endpoint; there was previously no UI
// for it at all, only a read-only display.
const RegistrationWindowCard: React.FC<{ tour: Tournament; isAdmin: boolean; api: any; onChanged: () => void }> = ({ tour, isAdmin, api, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(tour.registrationStartDate || '');
  const [end, setEnd] = useState(tour.registrationEndDate || '');
  const [limit, setLimit] = useState(tour.registrationLimit != null ? String(tour.registrationLimit) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setStart(tour.registrationStartDate || '');
    setEnd(tour.registrationEndDate || '');
    setLimit(tour.registrationLimit != null ? String(tour.registrationLimit) : '');
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!start || !end) { setError('Both dates are required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.updateRegistrationWindow(tour.id, {
        registrationStartDate: start,
        registrationEndDate: end,
        registrationLimit: limit ? Number(limit) : null,
      });
      await onChanged();
      setEditing(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to update registration window.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Registration Window</h3>
        {isAdmin && !editing && (
          <button onClick={startEditing} className="text-[10px] font-mono font-bold text-court-green hover:underline cursor-pointer uppercase">
            {(!tour.registrationEndDate || tour.registrationEndDate < today()) ? 'Reopen' : 'Edit'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {error && <p className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 p-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Opens</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-2 py-1.5" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Closes</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-2 py-1.5" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Limit (optional)</label>
            <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Unlimited" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-2 py-1.5" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-lg border border-light-border text-[10px] font-bold font-mono uppercase text-slate-gray hover:text-charcoal cursor-pointer">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg bg-court-green hover:bg-[#235F3A] text-[10px] font-bold font-mono uppercase text-white cursor-pointer disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-gray space-y-1.5 font-mono">
          <div className="flex justify-between"><span>Opens</span><span className="text-charcoal font-bold">{tour.registrationStartDate || '—'}</span></div>
          <div className="flex justify-between"><span>Closes</span><span className="text-charcoal font-bold">{tour.registrationEndDate || '—'}</span></div>
          {tour.registrationLimit ? <div className="flex justify-between"><span>Limit</span><span className="text-charcoal font-bold">{tour.registrationLimit}</span></div> : null}
        </div>
      )}
    </div>
  );
};

// ---------------- Standings ----------------
const StandingsPanel: React.FC<{ standings: TeamStandingRow[]; loading: boolean; navigateTo: any }> = ({ standings, loading, navigateTo }) => (
  <div className="bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm animate-fadeIn">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-off-white border-b border-light-border text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase">
            <th className="py-4 px-6 w-16 text-center">Rank</th>
            <th className="py-4 px-6">Team</th>
            <th className="py-4 px-6 text-center">Wins</th>
            <th className="py-4 px-6 text-center">Losses</th>
            <th className="py-4 px-6 text-center">Ties</th>
            <th className="py-4 px-6 text-center">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr><td colSpan={6} className="py-10 text-center text-xs text-slate-gray font-mono">Loading standings...</td></tr>
          ) : standings.length === 0 ? (
            <tr><td colSpan={6} className="py-10 text-center text-xs text-slate-gray font-mono">No teams saved yet.</td></tr>
          ) : standings.map((s) => (
            <tr key={s.teamId} className="hover:bg-off-white/40 transition-all">
              <td className="py-4 px-6 text-center font-mono font-bold text-sm">
                {s.rank <= 3 ? <Medal className={`w-5 h-5 mx-auto ${s.rank === 1 ? 'text-soft-gold' : s.rank === 2 ? 'text-slate-400' : 'text-amber-700'}`} /> : s.rank}
              </td>
              <td className="py-4 px-6">
                <button onClick={() => navigateTo('team-hub', s.teamId)} className="flex items-center gap-2.5 hover:text-court-green cursor-pointer">
                  {s.logoDataUrl ? (
                    <img src={s.logoDataUrl} alt={s.teamName} className="w-8 h-8 rounded-lg object-cover border border-light-border" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black font-mono" style={{ backgroundColor: `${s.color}1A`, borderColor: `${s.color}33`, color: s.color }}>
                      {s.teamName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="font-bold text-sm text-charcoal">{s.teamName}</span>
                </button>
              </td>
              <td className="py-4 px-6 text-center font-mono font-bold">{s.wins}</td>
              <td className="py-4 px-6 text-center font-mono font-bold text-slate-gray">{s.losses}</td>
              <td className="py-4 px-6 text-center font-mono font-bold text-slate-gray">{s.ties}</td>
              <td className="py-4 px-6 text-center">
                <span className="inline-flex px-3 py-1 rounded-lg bg-court-green/10 text-court-green border border-court-green/20 font-mono font-bold text-xs">{s.points} PTS</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ---------------- Player Rankings ----------------
const RankingsPanel: React.FC<{ tour: Tournament; api: any; navigateTo: any }> = ({ tour, api, navigateTo }) => {
  const [scope, setScope] = useState<'tournament' | 'overall'>('tournament');
  const [rankings, setRankings] = useState<PlayerRankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const req = scope === 'overall' ? api.getPlayerRankings() : api.getTournamentPlayerRankings(tour.id);
    req.then((r: { standings: PlayerRankingRow[] }) => setRankings(r.standings)).catch(() => setRankings([])).finally(() => setLoading(false));
  }, [scope, tour.id]);

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex bg-white p-1 rounded-xl border border-light-border shadow-sm self-start w-fit">
        <button
          onClick={() => setScope('tournament')}
          className={`px-4 py-2 text-xs font-bold font-mono tracking-wider rounded-lg transition-all cursor-pointer ${scope === 'tournament' ? 'bg-deep-navy text-white shadow-sm' : 'text-slate-gray hover:text-charcoal'}`}
        >THIS TOURNAMENT</button>
        <button
          onClick={() => setScope('overall')}
          className={`px-4 py-2 text-xs font-bold font-mono tracking-wider rounded-lg transition-all cursor-pointer ${scope === 'overall' ? 'bg-deep-navy text-white shadow-sm' : 'text-slate-gray hover:text-charcoal'}`}
        >OVERALL (ALL TOURNAMENTS)</button>
      </div>

      <div className="bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-off-white border-b border-light-border text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase">
                <th className="py-4 px-6 w-16 text-center">Rank</th>
                <th className="py-4 px-6">Player</th>
                <th className="py-4 px-6 text-center">Wins</th>
                <th className="py-4 px-6 text-center">Losses</th>
                <th className="py-4 px-6 text-center">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-xs text-slate-gray font-mono">Loading rankings...</td></tr>
              ) : rankings.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-xs text-slate-gray font-mono">No ranked matches yet.</td></tr>
              ) : rankings.map((r) => (
                <tr key={r.player} className="hover:bg-off-white/40 transition-all">
                  <td className="py-4 px-6 text-center font-mono font-bold text-sm">{r.rank}</td>
                  <td className="py-4 px-6">
                    <button onClick={() => navigateTo('profile', r.email || r.player)} className="font-bold text-sm text-charcoal hover:text-court-green cursor-pointer">{r.player}</button>
                  </td>
                  <td className="py-4 px-6 text-center font-mono font-bold">{r.wins}</td>
                  <td className="py-4 px-6 text-center font-mono font-bold text-slate-gray">{r.losses}</td>
                  <td className="py-4 px-6 text-center font-mono text-xs">{r.streak > 0 ? `${r.streak}W` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------- Teams & Roster (admin editable) ----------------
const TeamsPanel: React.FC<{ tour: Tournament; isAdmin: boolean; navigateTo: any; onSaved: () => void; api: any }> = ({ tour, isAdmin, navigateTo, onSaved, api }) => {
  const [teams, setTeams] = useState<TournamentTeam[]>(tour.teams || []);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualName, setManualName] = useState<Record<string, string>>({});
  const [manualEmail, setManualEmail] = useState<Record<string, string>>({});

  useEffect(() => setTeams(tour.teams || []), [tour.id, tour.teams]);

  const normEmail = (e: string) => e.trim().toLowerCase();

  // Players registered for this tournament that haven't been assigned to
  // any roster yet. Matched/deduped by email — the real identity key —
  // not by name, so two people who happen to share a name don't collide.
  const assignedEmails = new Set(teams.flatMap((t) => t.players.map((p) => normEmail(p.email)).filter(Boolean)));
  const unassignedPool = (tour.playerPool || []).filter((p) => !p.email || !assignedEmails.has(normEmail(p.email)));

  const addTeam = () => {
    setTeams((prev) => [...prev, { id: `new-${Date.now()}`, name: `Team ${prev.length + 1}`, players: [], color: '#1E5631', captain: '' }]);
  };
  const updateTeam = (idx: number, patch: Partial<TournamentTeam>) => {
    setTeams((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };
  const removeTeam = (idx: number) => setTeams((prev) => prev.filter((_, i) => i !== idx));
  const addPlayer = (idx: number, player: RosterPlayer) => {
    if (!player.name.trim()) return;
    setTeams((prev) => prev.map((t, i) => (i === idx ? { ...t, players: [...t.players, player] } : t)));
  };
  const addManualPlayer = (idx: number) => {
    const name = (manualName[idx] || '').trim();
    const email = normEmail(manualEmail[idx] || '');
    if (!name) return;
    addPlayer(idx, { name, email });
    setManualName({ ...manualName, [idx]: '' });
    setManualEmail({ ...manualEmail, [idx]: '' });
  };
  const removePlayer = (idx: number, playerIdx: number) => {
    setTeams((prev) => prev.map((t, i) => (i === idx ? { ...t, players: t.players.filter((_, pi) => pi !== playerIdx) } : t)));
  };
  // Captain is stored as the captain's email (or name, for a legacy
  // player with no email on record).
  const captainValueFor = (p: RosterPlayer) => p.email || p.name;
  const captainDisplayName = (team: TournamentTeam) => team.players.find((p) => captainValueFor(p) === team.captain)?.name || team.captain;

  const syncRegistrants = async () => {
    setSyncing(true);
    setError(null);
    try {
      await api.syncRegistrantsToPool(tour.id);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Failed to sync registrants.');
    } finally {
      setSyncing(false);
    }
  };

  const [logoErrors, setLogoErrors] = useState<Record<number, string>>({});
  const handleTeamLogoFile = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoErrors((prev) => ({ ...prev, [idx]: '' }));
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoErrors((prev) => ({ ...prev, [idx]: 'Must be PNG, JPEG, or WebP.' }));
      return;
    }
    if (file.size > 130_000) {
      setLogoErrors((prev) => ({ ...prev, [idx]: 'Too large — under ~130KB.' }));
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file')));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      updateTeam(idx, { logoDataUrl: dataUrl });
    } catch (err: any) {
      setLogoErrors((prev) => ({ ...prev, [idx]: err?.message || 'Upload failed.' }));
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateTournamentTeams(tour.id, { teamCount: teams.length, playersPerTeam: tour.playersPerTeam, teams });
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Failed to save teams.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addTeam} className="px-3.5 py-2 rounded-lg bg-white border border-light-border hover:border-court-green text-xs font-bold font-mono uppercase text-charcoal hover:text-court-green transition-all cursor-pointer flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Team
          </button>
          <button onClick={syncRegistrants} disabled={syncing} className="px-3.5 py-2 rounded-lg bg-white border border-light-border hover:border-court-green text-xs font-bold font-mono uppercase text-charcoal hover:text-court-green transition-all cursor-pointer disabled:opacity-60">
            {syncing ? 'Syncing...' : 'Sync Registered Players'}
          </button>
          <button onClick={save} disabled={saving} className="px-3.5 py-2 rounded-lg bg-court-green hover:bg-[#235F3A] text-xs font-bold font-mono uppercase text-white transition-all cursor-pointer disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Roster Changes'}
          </button>
          <span className="text-[10px] text-slate-gray font-mono">
            {unassignedPool.length} registered player{unassignedPool.length === 1 ? '' : 's'} not yet on a team
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((team, idx) => (
          <div key={team.id} className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: team.color }} />
            <div className="flex items-center gap-2 pl-2">
              {team.logoDataUrl ? (
                <img src={team.logoDataUrl} alt={team.name} className="w-8 h-8 rounded-lg object-cover border border-light-border shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black font-mono shrink-0" style={{ backgroundColor: team.color }}>
                  {team.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              {isAdmin ? (
                <input value={team.name} onChange={(e) => updateTeam(idx, { name: e.target.value })} className="font-display font-bold text-sm text-charcoal bg-off-white border border-light-border rounded-lg px-2 py-1 flex-1" />
              ) : (
                <button onClick={() => navigateTo('team-hub', team.id)} className="font-display font-bold text-sm text-charcoal hover:text-court-green cursor-pointer">{team.name}</button>
              )}
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <input type="color" value={team.color} onChange={(e) => updateTeam(idx, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-light-border" />
                  <button onClick={() => removeTeam(idx)} className="p-1 text-slate-gray hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="pl-2 flex items-center gap-2">
                <label className="text-[9px] font-mono uppercase text-court-green hover:underline cursor-pointer">
                  {team.logoDataUrl ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleTeamLogoFile(idx, e)} />
                </label>
                {logoErrors[idx] && <span className="text-[9px] text-red-600 font-mono">{logoErrors[idx]}</span>}
              </div>
            )}

            {isAdmin && (
              <select value={team.captain} onChange={(e) => updateTeam(idx, { captain: e.target.value })} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-2 py-1.5 pl-2">
                <option value="">-- Set Captain --</option>
                {team.players.map((p) => (
                  <option key={captainValueFor(p)} value={captainValueFor(p)}>{p.name}{p.email ? ` (${p.email})` : ''}</option>
                ))}
              </select>
            )}
            {!isAdmin && <p className="text-[10px] text-slate-gray font-mono pl-2">Captain: {team.captain ? captainDisplayName(team) : '—'}</p>}

            <div className="space-y-1.5 pl-2">
              {team.players.map((p, pIdx) => (
                <div key={p.email || `${p.name}-${pIdx}`} className="flex items-center justify-between text-xs bg-off-white border border-light-border rounded-lg px-2.5 py-1.5">
                  <button onClick={() => navigateTo('profile', p.email || p.name)} className="text-charcoal hover:text-court-green cursor-pointer font-semibold text-left">
                    {p.name}
                    {p.email && <span className="text-[9px] text-slate-gray font-mono block">{p.email}</span>}
                  </button>
                  {isAdmin && <button onClick={() => removePlayer(idx, pIdx)} className="text-slate-gray hover:text-red-600 cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>

            {isAdmin && (
              <div className="space-y-1.5 pl-2">
                {unassignedPool.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const found = unassignedPool.find((p) => (p.email || p.name) === e.target.value);
                      if (found) addPlayer(idx, found);
                    }}
                    className="w-full text-xs bg-off-white border border-light-border rounded-lg px-2 py-1.5"
                  >
                    <option value="">-- Add Registered Player --</option>
                    {unassignedPool.map((p) => (
                      <option key={p.email || p.name} value={p.email || p.name}>{p.name}{p.email ? ` (${p.email})` : ''}</option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    value={manualName[idx] || ''}
                    onChange={(e) => setManualName({ ...manualName, [idx]: e.target.value })}
                    placeholder="Name (manual entry)"
                    className="text-xs bg-white border border-light-border rounded-lg px-2 py-1.5"
                  />
                  <input
                    value={manualEmail[idx] || ''}
                    onChange={(e) => setManualEmail({ ...manualEmail, [idx]: e.target.value })}
                    placeholder="Email (optional)"
                    className="text-xs bg-white border border-light-border rounded-lg px-2 py-1.5"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualPlayer(idx); } }}
                  />
                </div>
                <button onClick={() => addManualPlayer(idx)} className="w-full py-1.5 bg-court-green/10 text-court-green rounded-lg text-[10px] font-bold font-mono uppercase cursor-pointer flex items-center justify-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Manually
                </button>
                <p className="text-[9px] text-slate-gray font-mono">Email is optional but strongly recommended — without it, rankings for this player may collide with anyone else sharing their name.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------- Matches ----------------
const MatchesPanel: React.FC<{ tour: Tournament; matches: TournamentMatch[]; loading: boolean; isAdmin: boolean; isAuthenticated: boolean; api: any; onChanged: () => void }> = ({ tour, matches, loading, isAdmin, isAuthenticated, api, onChanged }) => {
  const [showForm, setShowForm] = useState(false);
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [teamAPlayers, setTeamAPlayers] = useState<RosterPlayer[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<RosterPlayer[]>([]);
  const [date, setDate] = useState(today());
  const [court, setCourt] = useState('Court 1');
  const [gameType, setGameType] = useState<'singles' | 'doubles'>('doubles');
  const [scoreA, setScoreA] = useState('11');
  const [scoreB, setScoreB] = useState('9');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const teams = tour.teams || [];
  const requiredPerSide = gameType === 'singles' ? 1 : 2;
  const teamA = teams.find((t) => t.id === teamAId);
  const teamB = teams.find((t) => t.id === teamBId);
  const playerKey = (p: RosterPlayer) => p.email || p.name;

  // Changing team or game type invalidates any player picks that no longer apply.
  useEffect(() => { setTeamAPlayers([]); }, [teamAId, gameType]);
  useEffect(() => { setTeamBPlayers([]); }, [teamBId, gameType]);

  const togglePlayer = (side: 'A' | 'B', player: RosterPlayer) => {
    const key = playerKey(player);
    if (side === 'A') {
      setTeamAPlayers((prev) => (prev.some((p) => playerKey(p) === key) ? prev.filter((p) => playerKey(p) !== key) : prev.length < requiredPerSide ? [...prev, player] : prev));
    } else {
      setTeamBPlayers((prev) => (prev.some((p) => playerKey(p) === key) ? prev.filter((p) => playerKey(p) !== key) : prev.length < requiredPerSide ? [...prev, player] : prev));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!teamAId || !teamBId || teamAId === teamBId) { setError('Pick two different teams.'); return; }
    if (teamAPlayers.length > 0 && teamAPlayers.length !== requiredPerSide) { setError(`Select exactly ${requiredPerSide} player(s) for ${teamA?.name}, or none.`); return; }
    if (teamBPlayers.length > 0 && teamBPlayers.length !== requiredPerSide) { setError(`Select exactly ${requiredPerSide} player(s) for ${teamB?.name}, or none.`); return; }
    setSubmitting(true);
    try {
      await api.createTournamentMatch(tour.id, {
        date, court, gameType, teamAId, teamBId, gamesPlayed: 1,
        games: [{ a: Number(scoreA), b: Number(scoreB) }],
        teamAPlayers, teamBPlayers,
      });
      setShowForm(false);
      setTeamAPlayers([]); setTeamBPlayers([]);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to record match.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {isAuthenticated && teams.length >= 2 && (
        <button onClick={() => setShowForm(!showForm)} className="px-3.5 py-2 rounded-lg bg-court-green hover:bg-[#235F3A] text-xs font-bold font-mono uppercase text-white transition-all cursor-pointer flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Record Match'}
        </button>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
          <div className="grid grid-cols-3 gap-3">
            <select value={teamAId} onChange={(e) => setTeamAId(e.target.value)} className="text-xs bg-off-white border border-light-border rounded-lg px-2 py-2" required>
              <option value="">Team A</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={teamBId} onChange={(e) => setTeamBId(e.target.value)} className="text-xs bg-off-white border border-light-border rounded-lg px-2 py-2" required>
              <option value="">Team B</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={gameType} onChange={(e) => setGameType(e.target.value as 'singles' | 'doubles')} className="text-xs bg-off-white border border-light-border rounded-lg px-2 py-2">
              <option value="doubles">Doubles</option>
              <option value="singles">Singles</option>
            </select>
          </div>

          {(teamA || teamB) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[9px] font-mono uppercase text-slate-gray font-bold block">
                  {teamA ? `${teamA.name} — pick ${requiredPerSide}` : 'Select Team A first'}
                </span>
                {(teamA?.players || []).map((p) => (
                  <label key={playerKey(p)} className="flex items-center gap-2 text-xs bg-off-white rounded-lg px-2 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={teamAPlayers.some((x) => playerKey(x) === playerKey(p))} onChange={() => togglePlayer('A', p)} />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-mono uppercase text-slate-gray font-bold block">
                  {teamB ? `${teamB.name} — pick ${requiredPerSide}` : 'Select Team B first'}
                </span>
                {(teamB?.players || []).map((p) => (
                  <label key={playerKey(p)} className="flex items-center gap-2 text-xs bg-off-white rounded-lg px-2 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={teamBPlayers.some((x) => playerKey(x) === playerKey(p))} onChange={() => togglePlayer('B', p)} />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-xs bg-off-white border border-light-border rounded-lg px-2 py-2" />
            <input value={court} onChange={(e) => setCourt(e.target.value)} placeholder="Court" className="text-xs bg-off-white border border-light-border rounded-lg px-2 py-2" />
            <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className="text-xs bg-off-white border border-light-border rounded-lg px-2 py-2" />
            <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className="text-xs bg-off-white border border-light-border rounded-lg px-2 py-2" />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer disabled:opacity-60">
            {submitting ? 'Saving...' : 'Save Match'}
          </button>
        </form>
      )}

      <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-3">
        {loading ? (
          <div className="text-center py-6 text-xs text-slate-gray font-mono">Loading matches...</div>
        ) : matches.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs">No matches recorded yet.</div>
        ) : matches.map((m) => (
          <div key={m.id} className="bg-off-white border border-light-border p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-slate-gray uppercase font-bold block">{m.date} &middot; {m.court}</span>
              <span className="text-xs font-bold text-charcoal mt-1 block">{m.matchup}</span>
              {(m.teamAPlayers?.length || m.teamBPlayers?.length) ? (
                <span className="text-[10px] text-slate-gray font-mono block mt-0.5">{m.teamAPlayers.map((p) => p.name).join(' & ')} vs {m.teamBPlayers.map((p) => p.name).join(' & ')}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono font-bold text-charcoal">{m.scoreA} - {m.scoreB}</span>
              {(isAdmin) && (
                <button onClick={async () => { if (confirm('Delete this match?')) { await api.deleteTournamentMatch(tour.id, m.id); onChanged(); } }} className="text-slate-gray hover:text-red-600 cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// ---------------- Schedule ----------------
const SchedulePanel: React.FC<{
  tour: Tournament;
  schedule: TournamentSchedule | null;
  matches: TournamentMatch[];
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  currentUser: Me | null;
  api: any;
  onChanged: () => void;
}> = ({ tour, schedule, matches, loading, isAdmin, isAuthenticated, currentUser, api, onChanged }) => {
  const [recordingFixture, setRecordingFixture] = useState<{ weekIdx: number; fixtureIdx: number } | null>(null);
  const [chatFixture, setChatFixture] = useState<{ fixtureId: string; label: string } | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  // MLP-style events run as same-day/short-interval "Rounds"; standard
  // leagues run as multi-week "Weeks" — tied to the tournament's existing
  // scoring format so there's no extra field to keep in sync.
  const periodLabel = tour.format === 'mlp_singles' ? 'Round' : 'Week';

  const matchById = new Map(matches.map((m) => [m.id, m]));

  const linkFixtureToMatch = async (weekIdx: number, fixtureIdx: number, matchId: string) => {
    if (!schedule) return;
    const weeks = schedule.weeks.map((w, wi) =>
      wi !== weekIdx ? w : { ...w, fixtures: w.fixtures.map((f, fi) => (fi !== fixtureIdx ? f : { ...f, matchId })) }
    );
    try {
      await api.saveTournamentSchedule(tour.id, weeks);
    } catch (e) {
      console.error('Failed to link fixture to match:', e);
    }
  };

  return (
    <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">
          {tour.format === 'mlp_singles' ? 'Round-by-Round Plan' : 'Weekly Fixture Plan'}
        </h3>
        {isAdmin && (
          <button
            onClick={() => setShowGenerator(!showGenerator)}
            className="px-3 py-1.5 rounded-lg bg-court-green/10 border border-court-green/20 text-court-green text-[10px] font-bold font-mono uppercase tracking-wider cursor-pointer hover:bg-court-green/20 transition-all"
          >
            {showGenerator ? 'Cancel' : schedule && schedule.weeks.length > 0 ? 'Regenerate Schedule' : `Generate ${periodLabel}s`}
          </button>
        )}
      </div>

      {showGenerator && (
        <ScheduleGenerator
          tour={tour}
          periodLabel={periodLabel}
          api={api}
          onGenerated={() => { setShowGenerator(false); onChanged(); }}
        />
      )}

      {loading ? (
        <div className="text-center py-6 text-xs text-slate-gray font-mono">Loading schedule...</div>
      ) : !schedule || schedule.weeks.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs">
          No schedule has been built for this tournament yet{isAdmin ? ` — use "Generate ${periodLabel}s" above` : ''}.
        </div>
      ) : (
        <div className="space-y-4">
          {schedule.weeks.map((w, weekIdx) => (
            <div key={w.week} className="border border-light-border rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-charcoal">{periodLabel} {w.week} &middot; {w.date}</span>
                {w.skipped && <span className="text-[10px] font-mono text-soft-gold bg-soft-gold/10 px-2 py-0.5 rounded">SKIPPED</span>}
              </div>
              {!w.skipped && (
                <div className="space-y-1.5">
                  {w.fixtures.map((f, fixtureIdx) => {
                    const teamA = (tour.teams || []).find(t => t.id === f.teamAId);
                    const teamB = (tour.teams || []).find(t => t.id === f.teamBId);
                    const recordedMatch = f.matchId ? matchById.get(f.matchId) : undefined;
                    const myEmail = (currentUser?.email || '').trim().toLowerCase();
                    const isParticipant = [...f.teamAPlayers, ...f.teamBPlayers].some((p) => p.email && p.email === myEmail);
                    const canChat = isAuthenticated && (isAdmin || isParticipant) && !!f.fixtureId;

                    return (
                      <div key={fixtureIdx} className="flex items-stretch gap-1.5">
                        <button
                          onClick={() => isAuthenticated && !recordedMatch && setRecordingFixture({ weekIdx, fixtureIdx })}
                          disabled={!isAuthenticated || !!recordedMatch}
                          className={`flex-1 flex justify-between items-center text-xs rounded-lg px-3 py-2 transition-all ${
                            recordedMatch ? 'bg-court-green/5 border border-court-green/20 cursor-default' : 'bg-off-white hover:bg-court-green/5 cursor-pointer border border-transparent hover:border-court-green/20'
                          }`}
                        >
                          <span className="text-left">
                            <span className="font-semibold text-charcoal block">{teamA?.name || 'TBD'} vs {teamB?.name || 'TBD'}</span>
                            {(f.teamAPlayers?.length || f.teamBPlayers?.length) ? (
                              <span className="text-[10px] text-slate-gray font-mono block mt-0.5">{f.teamAPlayers.map((p) => p.name).join(' & ') || '—'} vs {f.teamBPlayers.map((p) => p.name).join(' & ') || '—'}</span>
                            ) : null}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            {recordedMatch ? (
                              <span className="font-mono font-bold text-court-green">{recordedMatch.scoreA} - {recordedMatch.scoreB} &bull; Recorded</span>
                            ) : (
                              <>
                                <span className="text-slate-gray font-mono">{f.court}</span>
                                {isAuthenticated && <span className="text-[10px] font-mono text-court-green font-bold uppercase">Record &rarr;</span>}
                              </>
                            )}
                          </span>
                        </button>
                        {canChat && (
                          <button
                            onClick={() => setChatFixture({ fixtureId: f.fixtureId, label: `${teamA?.name || 'TBD'} vs ${teamB?.name || 'TBD'}` })}
                            title="Chat about this match"
                            className="shrink-0 w-9 rounded-lg border border-light-border bg-white hover:border-court-green hover:bg-court-green/5 text-slate-gray hover:text-court-green transition-all cursor-pointer flex items-center justify-center"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {(() => {
                    const teamsInRound = new Set(w.fixtures.flatMap((f) => [f.teamAId, f.teamBId]));
                    const byeTeams = (tour.teams || []).filter((t) => !teamsInRound.has(t.id));
                    return byeTeams.map((t) => (
                      <div key={t.id} className="flex justify-between items-center text-xs rounded-lg px-3 py-2 bg-soft-gold/5 border border-dashed border-soft-gold/20">
                        <span className="font-semibold text-charcoal">{t.name}</span>
                        <span className="text-[10px] font-mono text-soft-gold font-bold uppercase">BYE</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {recordingFixture && schedule && (
        <RecordFixtureModal
          tour={tour}
          fixture={schedule.weeks[recordingFixture.weekIdx].fixtures[recordingFixture.fixtureIdx]}
          weekDate={schedule.weeks[recordingFixture.weekIdx].date}
          api={api}
          onClose={() => setRecordingFixture(null)}
          onRecorded={async (matchId) => {
            await linkFixtureToMatch(recordingFixture.weekIdx, recordingFixture.fixtureIdx, matchId);
            setRecordingFixture(null);
            onChanged();
          }}
        />
      )}

      {chatFixture && (
        <FixtureChatModal
          tour={tour}
          fixtureId={chatFixture.fixtureId}
          label={chatFixture.label}
          currentUser={currentUser}
          api={api}
          onClose={() => setChatFixture(null)}
        />
      )}
    </div>
  );
};

const RecordFixtureModal: React.FC<{
  tour: Tournament;
  fixture: TournamentSchedule['weeks'][number]['fixtures'][number];
  weekDate: string;
  api: any;
  onClose: () => void;
  onRecorded: (matchId: string) => void;
}> = ({ tour, fixture, weekDate, api, onClose, onRecorded }) => {
  const teamA = (tour.teams || []).find(t => t.id === fixture.teamAId);
  const teamB = (tour.teams || []).find(t => t.id === fixture.teamBId);
  const requiredPerSide = fixture.gameType === 'singles' ? 1 : 2;

  const [teamAPlayers, setTeamAPlayers] = useState<RosterPlayer[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<RosterPlayer[]>([]);
  const [scoreA, setScoreA] = useState('11');
  const [scoreB, setScoreB] = useState('9');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const playerKey = (p: RosterPlayer) => p.email || p.name;

  const togglePlayer = (side: 'A' | 'B', player: RosterPlayer) => {
    const key = playerKey(player);
    if (side === 'A') {
      setTeamAPlayers((prev) => (prev.some((p) => playerKey(p) === key) ? prev.filter((p) => playerKey(p) !== key) : prev.length < requiredPerSide ? [...prev, player] : prev));
    } else {
      setTeamBPlayers((prev) => (prev.some((p) => playerKey(p) === key) ? prev.filter((p) => playerKey(p) !== key) : prev.length < requiredPerSide ? [...prev, player] : prev));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (teamAPlayers.length > 0 && teamAPlayers.length !== requiredPerSide) { setError(`Select exactly ${requiredPerSide} player(s) for ${teamA?.name}, or none.`); return; }
    if (teamBPlayers.length > 0 && teamBPlayers.length !== requiredPerSide) { setError(`Select exactly ${requiredPerSide} player(s) for ${teamB?.name}, or none.`); return; }

    setSubmitting(true);
    try {
      const match = await api.createTournamentMatch(tour.id, {
        date: weekDate,
        court: fixture.court,
        gameType: fixture.gameType,
        teamAId: fixture.teamAId,
        teamBId: fixture.teamBId,
        gamesPlayed: 1,
        games: [{ a: Number(scoreA), b: Number(scoreB) }],
        teamAPlayers,
        teamBPlayers,
      });
      onRecorded(match.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to record match.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white border border-light-border rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-charcoal">Record Match Result</h3>
          <button type="button" onClick={onClose} className="text-slate-gray hover:text-charcoal cursor-pointer">&times;</button>
        </div>
        <p className="text-xs text-slate-gray font-mono">{weekDate} &middot; {fixture.court} &middot; {fixture.gameType}</p>
        {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          {/* Team A */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-charcoal block">{teamA?.name || 'Team A'}</span>
            <span className="text-[9px] font-mono text-slate-gray uppercase block">Select {requiredPerSide} player{requiredPerSide > 1 ? 's' : ''} (optional)</span>
            <div className="space-y-1">
              {(teamA?.players || []).map((p) => (
                <label key={playerKey(p)} className="flex items-center gap-2 text-xs bg-off-white rounded-lg px-2 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={teamAPlayers.some((x) => playerKey(x) === playerKey(p))} onChange={() => togglePlayer('A', p)} />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
            <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-2 py-2 mt-2" placeholder="Score" />
          </div>
          {/* Team B */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-charcoal block">{teamB?.name || 'Team B'}</span>
            <span className="text-[9px] font-mono text-slate-gray uppercase block">Select {requiredPerSide} player{requiredPerSide > 1 ? 's' : ''} (optional)</span>
            <div className="space-y-1">
              {(teamB?.players || []).map((p) => (
                <label key={playerKey(p)} className="flex items-center gap-2 text-xs bg-off-white rounded-lg px-2 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={teamBPlayers.some((x) => playerKey(x) === playerKey(p))} onChange={() => togglePlayer('B', p)} />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
            <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-2 py-2 mt-2" placeholder="Score" />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer disabled:opacity-60">
          {submitting ? 'Saving...' : 'Save Match Result'}
        </button>
      </form>
    </div>
  );
};

// ---------------- Schedule Generator (round-robin, inline) ----------------
// ---------------- Fixture Chat ----------------
const FixtureChatModal: React.FC<{ tour: Tournament; fixtureId: string; label: string; currentUser: Me | null; api: any; onClose: () => void }> = ({ tour, fixtureId, label, currentUser, api, onClose }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.listFixtureMessages(tour.id, fixtureId);
      setMessages(r.items);
    } catch (e: any) {
      setError(e?.message || 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [tour.id, fixtureId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      await api.postFixtureMessage(tour.id, fixtureId, trimmed);
      setText('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-light-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-light-border">
          <div>
            <h3 className="font-display font-bold text-sm text-charcoal">Match Chat</h3>
            <p className="text-[10px] text-slate-gray font-mono">{label}</p>
          </div>
          <button onClick={onClose} className="text-slate-gray hover:text-charcoal cursor-pointer">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <p className="text-xs text-slate-gray font-mono text-center py-6">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-slate-gray text-center py-6">No messages yet — say hi and sort out your match time.</p>
          ) : messages.map((m) => {
            const mine = m.senderSub === currentUser?.userSub;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-3 py-2 ${mine ? 'bg-court-green text-white' : 'bg-off-white border border-light-border text-charcoal'}`}>
                  {!mine && <span className="text-[9px] font-mono font-bold text-court-green block mb-0.5">{m.senderName}</span>}
                  <span className="text-xs">{m.text}</span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-[10px] text-red-600 font-semibold px-4 pb-1">{error}</p>}

        <div className="p-3 border-t border-light-border flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
            placeholder="Message about this match..."
            className="flex-1 text-xs bg-off-white border border-light-border rounded-xl px-3 py-2.5"
          />
          <button onClick={send} disabled={sending || !text.trim()} className="w-10 h-10 rounded-xl bg-court-green hover:bg-[#235F3A] text-white flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ScheduleGenerator: React.FC<{ tour: Tournament; periodLabel: string; api: any; onGenerated: () => void }> = ({ tour, periodLabel, api, onGenerated }) => {
  const teams = tour.teams || [];
  const allPlayers = teams.flatMap((t) => t.players);

  // Singles-format tournaments default to a full PLAYER-vs-PLAYER round
  // robin (every player faces every other player at least once) rather
  // than team-vs-team, since a "team" in a singles event is often just a
  // single player anyway. Doubles/standard tournaments still pair teams.
  const [pairBy, setPairBy] = useState<'teams' | 'players'>(tour.format === 'mlp_singles' ? 'players' : 'teams');

  const fullRoundCount = (n: number) => (n < 2 ? 0 : n % 2 === 0 ? n - 1 : n);

  const [startDate, setStartDate] = useState(tour.startDate || '');
  const [periodCount, setPeriodCount] = useState(fullRoundCount(teams.length) || 6);
  // MLP-style rounds typically run same-day (0 days apart); standard
  // leagues run weekly (7 days apart) — sensible default per format,
  // still adjustable.
  const [daysBetween, setDaysBetween] = useState(tour.format === 'mlp_singles' ? 0 : 7);
  const [court, setCourt] = useState('Court 1');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Circle-method round-robin: rotates all-but-one entrant around a fixed
  // anchor each round, pairing opposite ends of the remaining sequence.
  // Pads with a bye for odd entrant counts. Generic over teams or players
  // so both modes share the same, correct algorithm.
  function circleMethod<T>(entrants: T[]): [T, T][][] {
    if (entrants.length < 2) return [];
    const arr = (entrants as (T | null)[]).slice();
    if (arr.length % 2 !== 0) arr.push(null);
    const n = arr.length;
    const rounds: [T, T][][] = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs: [T, T][] = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        if (a !== null && b !== null) pairs.push([a, b]);
      }
      rounds.push(pairs);
      arr.splice(1, 0, arr.pop()!);
    }
    return rounds;
  }

  const submit = async () => {
    setError(null);
    if (!startDate) { setError('Pick a start date.'); return; }
    if (teams.length < 2) { setError('Save at least 2 teams first (Teams & Roster tab).'); return; }

    // Always pair TEAMS first via the circle method — this is what makes
    // each team face a different opponent each round (and gives an
    // automatic, rotating bye for odd team counts). Pairing individual
    // players directly (flattened across teams) was the earlier bug:
    // since each team's roster sits contiguously in the flattened list,
    // the mirror-pairing math paired whole team blocks against each
    // other, producing the same team matchup repeated once per roster
    // slot instead of a real round-robin.
    const teamRounds = circleMethod(teams.map((t) => t.id));
    if (teamRounds.length === 0) { setError('Could not generate fixtures.'); return; }

    let rounds: { fixtureId: string; teamAId: string; teamBId: string; teamAPlayers: RosterPlayer[]; teamBPlayers: RosterPlayer[] }[][];

    if (pairBy === 'teams') {
      rounds = teamRounds.map((pairs) => pairs.map(([a, b]) => ({ fixtureId: crypto.randomUUID(), teamAId: a, teamBId: b, teamAPlayers: [], teamBPlayers: [] })));
    } else {
      const byId = new Map(teams.map((t) => [t.id, t]));
      rounds = teamRounds.map((pairs) =>
        pairs.flatMap(([aId, bId]) => {
          const teamA = byId.get(aId);
          const teamB = byId.get(bId);
          if (!teamA || !teamB) return [];
          // Shuffle each side's roster per round so, when roster sizes
          // don't match evenly, who sits out on the bye is randomized
          // round to round rather than always the same trailing player.
          const rosterA = [...teamA.players].sort(() => Math.random() - 0.5);
          const rosterB = [...teamB.players].sort(() => Math.random() - 0.5);
          const slots = Math.min(rosterA.length, rosterB.length);
          const games: { fixtureId: string; teamAId: string; teamBId: string; teamAPlayers: RosterPlayer[]; teamBPlayers: RosterPlayer[] }[] = [];
          for (let i = 0; i < slots; i++) {
            games.push({ fixtureId: crypto.randomUUID(), teamAId: aId, teamBId: bId, teamAPlayers: [rosterA[i]], teamBPlayers: [rosterB[i]] });
          }
          return games;
        })
      );
    }

    setSubmitting(true);
    try {
      const weeksPayload = rounds.slice(0, periodCount).map((fixtures, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i * daysBetween);
        return {
          week: i + 1,
          date: d.toISOString().slice(0, 10),
          skipped: false,
          fixtures: fixtures.map((f) => ({
            ...f,
            court,
            gameType: pairBy === 'players' ? 'singles' : 'doubles',
            gamesPlayed: 1,
          })),
        };
      });
      await api.saveTournamentSchedule(tour.id, weeksPayload);
      onGenerated();
    } catch (err: any) {
      setError(err?.message || 'Failed to generate schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-off-white border border-light-border rounded-xl p-4 space-y-3">
      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}
      <p className="text-xs text-slate-gray leading-relaxed">
        Generates a round-robin plan. This replaces any existing schedule — already-recorded matches stay untouched.
      </p>

      <div className="flex bg-white p-1 rounded-lg border border-light-border w-fit">
        <button
          type="button"
          onClick={() => setPairBy('teams')}
          className={`px-3 py-1.5 text-[10px] font-bold font-mono uppercase rounded-md transition-all cursor-pointer ${pairBy === 'teams' ? 'bg-deep-navy text-white' : 'text-slate-gray'}`}
        >Team vs Team</button>
        <button
          type="button"
          onClick={() => setPairBy('players')}
          className={`px-3 py-1.5 text-[10px] font-bold font-mono uppercase rounded-md transition-all cursor-pointer ${pairBy === 'players' ? 'bg-deep-navy text-white' : 'text-slate-gray'}`}
        >Every Player vs Every Player</button>
      </div>
      {pairBy === 'players' && (
        <p className="text-[10px] text-slate-gray font-mono">
          {teams.length} teams, {allPlayers.length} players total &middot; {fullRoundCount(teams.length)} {periodLabel.toLowerCase()}s for every team (and their players) to face every other team once. If two paired teams have uneven roster sizes, the extra player(s) get a random bye that {periodLabel.toLowerCase()}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-xs bg-white border border-light-border rounded-lg px-3 py-2" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Default Court</label>
          <input value={court} onChange={(e) => setCourt(e.target.value)} className="w-full text-xs bg-white border border-light-border rounded-lg px-3 py-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Number of {periodLabel}s</label>
          <input type="number" min={1} max={40} value={periodCount} onChange={(e) => setPeriodCount(Number(e.target.value))} className="w-full text-xs bg-white border border-light-border rounded-lg px-3 py-2" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Days Between {periodLabel}s</label>
          <input type="number" min={0} max={30} value={daysBetween} onChange={(e) => setDaysBetween(Number(e.target.value))} className="w-full text-xs bg-white border border-light-border rounded-lg px-3 py-2" />
          <span className="text-[9px] text-slate-gray font-mono">0 = same-day rounds, 7 = weekly</span>
        </div>
      </div>
      <button onClick={submit} disabled={submitting} className="w-full py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer disabled:opacity-60">
        {submitting ? 'Generating...' : `Generate ${periodLabel} Schedule`}
      </button>
    </div>
  );
};

// ---------------- Registrations (admin) ----------------
const RegistrationsPanel: React.FC<{ tour: Tournament; registrations: TournamentRegistration[]; loading: boolean; api: any; onChanged: () => void }> = ({ tour, registrations, loading, api, onChanged }) => (
  <div className="bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm animate-fadeIn">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-off-white border-b border-light-border text-[10px] font-semibold font-display tracking-widest text-slate-gray uppercase">
            <th className="py-4 px-6">Name</th>
            <th className="py-4 px-6">Email</th>
            <th className="py-4 px-6">Phone</th>
            <th className="py-4 px-6 text-center">Paid</th>
            <th className="py-4 px-6 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr><td colSpan={5} className="py-10 text-center text-xs text-slate-gray font-mono">Loading registrations...</td></tr>
          ) : registrations.length === 0 ? (
            <tr><td colSpan={5} className="py-10 text-center text-xs text-slate-gray font-mono">No registrations yet.</td></tr>
          ) : registrations.map((r) => (
            <tr key={r.id} className="hover:bg-off-white/40">
              <td className="py-3 px-6 text-xs font-bold text-charcoal">{r.name}</td>
              <td className="py-3 px-6 text-xs font-mono text-slate-gray">{r.email}</td>
              <td className="py-3 px-6 text-xs font-mono text-slate-gray">{r.phone || '—'}</td>
              <td className="py-3 px-6 text-center">
                <button
                  onClick={async () => { await api.setRegistrationPaid(tour.id, r.id, !r.paid); onChanged(); }}
                  className={`text-[10px] font-mono font-bold px-2 py-1 rounded cursor-pointer ${r.paid ? 'bg-court-green/10 text-court-green' : 'bg-slate-100 text-slate-500'}`}
                >
                  {r.paid ? 'PAID' : 'UNPAID'}
                </button>
              </td>
              <td className="py-3 px-6 text-center">
                <button onClick={async () => { if (confirm('Remove this registration?')) { await api.deleteRegistration(tour.id, r.id); onChanged(); } }} className="text-slate-gray hover:text-red-600 cursor-pointer">
                  <Trash2 className="w-4 h-4 mx-auto" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ---------------- Playoffs (admin) ----------------
const PlayoffsPanel: React.FC<{ tour: Tournament; api: any; onChanged: () => void }> = ({ tour, api, onChanged }) => {
  const [error, setError] = useState<string | null>(null);
  const generate = async () => {
    try { await api.generatePlayoffs(tour.id); onChanged(); } catch (e: any) { setError(e?.message || 'Failed to generate bracket.'); }
  };
  const advance = async () => {
    try { await api.advancePlayoffs(tour.id); onChanged(); } catch (e: any) { setError(e?.message || 'Failed to advance bracket.'); }
  };
  const teamName = (id: string) => (tour.teams || []).find(t => t.id === id)?.name || 'TBD';

  return (
    <div className="space-y-4 animate-fadeIn">
      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button onClick={generate} className="px-3.5 py-2 rounded-lg bg-court-green hover:bg-[#235F3A] text-xs font-bold font-mono uppercase text-white cursor-pointer">Generate Bracket (Top 4)</button>
        {tour.playoffs && <button onClick={advance} className="px-3.5 py-2 rounded-lg bg-deep-navy hover:bg-black text-xs font-bold font-mono uppercase text-white cursor-pointer">Advance to Finals</button>}
      </div>
      {tour.playoffs && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['semifinal1', 'semifinal2', 'championship', 'thirdPlace'] as const).map((slot) => {
            const s = tour.playoffs![slot];
            return (
              <div key={slot} className="bg-white border border-light-border rounded-xl p-4 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-gray font-bold">{slot.replace(/([A-Z0-9])/g, ' $1')}</span>
                <p className="text-sm font-bold text-charcoal">{teamName(s.teamAId)} vs {teamName(s.teamBId)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
