/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import type { RosterPlayer } from '../types';
import { toDataUrl } from '../utils/image';
import { compressImageFile } from '../utils/imageCompress';
import {
  User,
  Award,
  Trophy,
  Activity,
  ShieldCheck,
  Calendar,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Clock,
  Briefcase,
  Edit2,
  Save,
  X,
  Camera,
  Upload,
  ArrowLeft,
  Target
} from 'lucide-react';

const PRESET_AVATARS = [
  { name: 'Emerald', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
  { name: 'Ace', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
  { name: 'Sunset', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
  { name: 'Royal', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80' }
];
import { defaultAvatar } from '../utils/avatar';
const norm = (s: string) => (s || '').trim().toLowerCase();
const looksLikeEmail = (s: string) => s.includes('@');

// Matches a ranking row against an identity that can be an email, a
// name, or both — comparing email-to-email and name-to-name, never
// cross-comparing the two (that was the bug: falling back to comparing
// a row's name against the *current user's email* can never match,
// since one's a name and the other's an email).
const matchesIdentity = (row: { player: string; email?: string }, identity: { email?: string; name?: string }) => {
  if (identity.email && row.email && norm(row.email) === norm(identity.email)) return true;
  if (identity.name && norm(row.player) === norm(identity.name)) return true;
  return false;
};

export const ProfileView: React.FC = () => {
  const {
    activePlayerId,
    tournaments,
    clubMatches,
    clubBookings,
    playerRankings,
    currentUser,
    navigateTo,
    navigateBack,
    canNavigateBack,
    updateProfile,
    refreshPlayerRankings,
  } = useAppState();

  // The shared playerRankings cache is only ever populated once, at app
  // load — matches recorded in an earlier session (or before this page
  // was open) wouldn't show up here without an explicit refetch. Always
  // pull a fresh copy whenever this screen is opened.
  useEffect(() => { refreshPlayerRankings(); }, []);

  // activePlayerId is usually an email (from navigateTo('profile', p.email || p.name)
  // elsewhere in the app) but falls back to a plain name for legacy
  // entries with no email on record — so it has to be treated as
  // "email if it looks like one, otherwise a name" rather than always
  // one or the other.
  const isOwnProfile = !activePlayerId || (!!currentUser && norm(activePlayerId) === norm(currentUser.email));
  const targetIdentity = isOwnProfile
    ? { email: currentUser?.email, name: currentUser?.displayName }
    : (activePlayerId && looksLikeEmail(activePlayerId) ? { email: activePlayerId } : { name: activePlayerId });
  const playerRow = playerRankings.find((p) => matchesIdentity(p, targetIdentity));
  // Fall back to whatever name is available for display purposes only —
  // never for matching.
  const targetName = isOwnProfile ? (currentUser?.displayName || '') : (playerRow?.player || activePlayerId || '');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDuprId, setEditDuprId] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editDuprRating, setEditDuprRating] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editAvatarMode, setEditAvatarMode] = useState<'presets' | 'upload' | 'url'>('presets');
  const [editIsDragging, setEditIsDragging] = useState(false);

  const [compressingAvatar, setCompressingAvatar] = useState(false);
  const processEditFile = async (file: File) => {
    setEditError(null);
    setCompressingAvatar(true);
    try {
      const compressed = await compressImageFile(file);
      setEditAvatarUrl(compressed);
    } catch (err: any) {
      setEditError(err?.message || 'Could not process that image.');
    } finally {
      setCompressingAvatar(false);
    }
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processEditFile(file);
    }
  };

  const handleEditDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setEditIsDragging(true);
  };

  const handleEditDragLeave = () => {
    setEditIsDragging(false);
  };

  const handleEditDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setEditIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processEditFile(file);
    }
  };

  // Synchronize form states when the current user's profile loads
  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.displayName || '');
      setEditDuprId(currentUser.duprId || '');
      setEditAvatarUrl(currentUser.avatarDataUrl || '');
      setEditDuprRating(currentUser.duprRating != null ? currentUser.duprRating.toFixed(2) : '4.00');
    }
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (!editName.trim()) {
      setEditError('Please enter a username or player name.');
      return;
    }

    const ratingNum = parseFloat(editDuprRating);
    if (isNaN(ratingNum) || ratingNum < 2.0 || ratingNum > 8.0) {
      setEditError('DUPR rating must be between 2.00 and 8.00.');
      return;
    }

    setEditSaving(true);
    try {
      const avatarDataUrl = await toDataUrl(editAvatarUrl);
      await updateProfile({
        displayName: editName.trim(),
        duprId: editDuprId.trim(),
        duprRating: ratingNum,
        avatarDataUrl,
      });
      setIsEditing(false);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update profile.');
    } finally {
      setEditSaving(false);
    }
  };

  if (!isOwnProfile && !playerRow) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh] gap-4">
        <p className="text-sm font-mono text-slate-gray">No public profile found for "{targetName}".</p>
        {canNavigateBack && (
          <button
            onClick={navigateBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-gray hover:text-charcoal bg-white border border-light-border rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /><span>Back</span>
          </button>
        )}
      </div>
    );
  }

  if (isOwnProfile && !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-court-green border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-mono text-slate-gray">Loading player profile...</p>
      </div>
    );
  }

  const displayName = isOwnProfile ? currentUser!.displayName : (playerRow?.player || targetName);
  const displayAvatar = (isOwnProfile ? currentUser!.avatarDataUrl : playerRow?.avatarDataUrl) || defaultAvatar(displayName);
  const displayDupr = isOwnProfile ? currentUser!.duprRating : playerRow?.duprRating;
  const wins = playerRow?.wins ?? 0;
  const losses = playerRow?.losses ?? 0;
  const played = playerRow?.played ?? 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  // Team affiliation: find a team, in any tournament, rostering this
  // player — matched by email (falls back to name for legacy rostered
  // entries with no email on record).
  const isThisPlayer = (p: RosterPlayer) =>
    (targetIdentity.email && p.email ? norm(p.email) === norm(targetIdentity.email) : false) ||
    (targetIdentity.name ? norm(p.name) === norm(targetIdentity.name) : false) ||
    norm(p.name) === norm(displayName);
  let playerTeam: { id: string; name: string } | null = null;
  let playerTournamentId: string | null = null;
  for (const t of tournaments) {
    const team = (t.teams || []).find((tm) => tm.players.some(isThisPlayer));
    if (team) {
      playerTeam = team;
      playerTournamentId = t.id;
      break;
    }
  }

  const enteredTournaments = tournaments.filter((t) =>
    (t.teams || []).some((tm) => tm.players.some(isThisPlayer))
  );

  // Match history: club-wide informal matches mentioning this player's
  // name — the real backend has no single cross-tournament match feed
  // (per-tournament results live on the Tournament Details screen).
  const relatedMatches = isOwnProfile
    ? clubMatches.filter((m) => m.matchup.toLowerCase().includes(displayName.toLowerCase()))
    : [];

  const upcomingBookings = isOwnProfile
    ? clubBookings.filter((b) => b.ownerDisplayName === displayName && b.date >= new Date().toISOString().slice(0, 10))
    : [];

  return (
    <div className="space-y-6" id="player-profile-view">
      
      {/* Dynamic Back Button */}
      {canNavigateBack && (
        <button
          onClick={navigateBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-gray dark:text-slate-400 hover:text-charcoal dark:hover:text-white bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      )}

      {/* Profile Hero Card */}
      <div className="relative rounded-2xl overflow-hidden bg-deep-navy border border-deep-navy/80 p-6 sm:p-8 shadow-md court-texture">
        {/* Subtle decorative athletic elements, avoiding generic blurs */}
        <div className="absolute top-0 right-0 w-64 h-full bg-court-green/10 transform skew-x-12 origin-top-right"></div>
        <div className="absolute -bottom-8 left-12 w-48 h-12 bg-soft-gold/5 transform -rotate-12"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="relative group">
              <img
                src={displayAvatar}
                alt={displayName}
                className="w-20 h-20 rounded-xl object-cover border border-white/20 shadow-md group-hover:border-court-green transition-colors duration-300"
                referrerPolicy="no-referrer"
              />
              <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-deep-navy ${playerRow?.online ? 'bg-[#16A34A]' : 'bg-slate-500'}`} />
              {isOwnProfile && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl text-white cursor-pointer"
                  title="Update Avatar"
                >
                  <Camera className="w-5 h-5 text-white" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[10px] text-court-green font-bold font-mono tracking-wider bg-court-green/10 border border-court-green/20 px-2 py-0.5 rounded-full uppercase">
                  ACTIVE PLAYER
                </span>
                {isOwnProfile && (
                  <span className="text-[10px] text-court-green font-bold font-mono tracking-wider bg-court-green/10 border border-court-green/20 px-2 py-0.5 rounded-full uppercase">
                    Your Profile
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight uppercase leading-none">{displayName}</h1>
                {isOwnProfile && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer border border-transparent"
                    title="Edit Profile Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {isOwnProfile && <p className="text-slate-400 text-xs font-mono">{currentUser!.email}</p>}
            </div>
          </div>

          {/* Core rating and rank metrics */}
          <div className="flex gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8 justify-center">
            <div className="text-center sm:text-left">
              <span className="text-[9px] text-slate-400 font-bold font-mono tracking-widest block uppercase">DUPR Rating</span>
              <span className="text-3xl font-display font-extrabold text-court-green tracking-tight mt-1 block">
                {displayDupr != null ? displayDupr.toFixed(2) : '—'}
              </span>
            </div>
            <div className="text-center sm:text-left pl-4 border-l border-white/10">
              <span className="text-[9px] text-slate-400 font-bold font-mono tracking-widest block uppercase">ACTIVE SEED</span>
              <span className="text-3xl font-display font-extrabold text-white tracking-tight mt-1 block">
                {playerRow ? `#${playerRow.rank}` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Core Grid stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="profile-stats-grid">
        {/* Total Matches */}
        <div className="relative bg-gradient-to-br from-white via-[#F1F6FF] to-[#DBEAFE] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#101F3B] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/60 transition-all duration-300 overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 via-blue-900 to-[#172554] rounded-l-2xl z-20"></div>
          <div className="space-y-1 relative z-10 pl-2.5">
            <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
              Total Matches
            </span>
            <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
              {played}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 dark:from-blue-500/25 dark:to-blue-500/5 border border-blue-500/20 dark:border-blue-500/40 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0 relative z-10 transition-transform group-hover:translate-y-[-2px]">
            <Activity className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* Wins Recorded */}
        <div className="relative bg-gradient-to-br from-white via-[#EEFBF3] to-[#D1FAE5] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#0D2418] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-court-green/40 dark:hover:border-court-green/60 transition-all duration-300 overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-court-green/5 dark:bg-court-green/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-2xl z-20"></div>
          <div className="space-y-1 relative z-10 pl-2.5">
            <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
              Wins Recorded
            </span>
            <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
              {wins}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-court-green/15 to-court-green/5 dark:from-court-green/25 dark:to-court-green/5 border border-court-green/20 dark:border-court-green/40 flex items-center justify-center text-court-green shrink-0 relative z-10 transition-transform group-hover:rotate-12">
            <Trophy className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* Losses Recorded */}
        <div className="relative bg-gradient-to-br from-white via-[#FFF5F5] to-[#FEE2E2] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#2B121C] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-red-500/20 dark:hover:border-red-500/30 transition-all duration-300 overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 dark:bg-red-500/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-rose-600 via-[#7F1D1D] to-[#450A0A] rounded-l-2xl z-20"></div>
          <div className="space-y-1 relative z-10 pl-2.5">
            <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
              Losses Recorded
            </span>
            <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
              {losses}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500/15 to-transparent dark:from-red-500/25 dark:to-transparent border border-red-500/20 flex items-center justify-center text-red-500 shrink-0 relative z-10 transition-transform group-hover:scale-110">
            <Target className="w-5.5 h-5.5" />
          </div>
        </div>

        {/* True Win % */}
        <div className="relative bg-gradient-to-br from-white via-[#FFFDF0] to-[#FEF3C7] dark:from-[#132237] dark:via-[#162D3D] dark:to-[#2B2112] border border-light-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-soft-gold/30 dark:hover:border-soft-gold/40 transition-all duration-300 overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-soft-gold/5 dark:bg-soft-gold/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 via-[#78350F] to-[#451A03] rounded-l-2xl z-20"></div>
          <div className="space-y-1 relative z-10 pl-2.5">
            <span className="text-[10px] text-charcoal dark:text-white font-extrabold font-mono tracking-wider block uppercase leading-none">
              True Win %
            </span>
            <span className="text-3xl font-display font-black text-charcoal dark:text-white mt-1 block">
              {winRate}%
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-soft-gold/15 to-transparent dark:from-soft-gold/25 dark:to-transparent border border-soft-gold/20 flex items-center justify-center text-soft-gold shrink-0 relative z-10 transition-transform group-hover:scale-125">
            <TrendingUp className="w-5.5 h-5.5" />
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="profile-details-grid">
        
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Match History scoreboard */}
          <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">MATCH HISTORY RECORD</h3>

            {relatedMatches.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-light-border dark:border-slate-800 rounded-2xl bg-off-white dark:bg-slate-900/30 text-slate-gray text-xs font-sans font-medium">
                No match history records found.
              </div>
            ) : (
              <div className="space-y-3">
                {relatedMatches.map(match => {
                  const isWinner = match.winner && match.winner.toLowerCase().includes(displayName.toLowerCase());
                  const scoreLine = `${match.scoreA} vs ${match.scoreB}`;

                  return (
                    <div
                      key={match.id}
                      className="bg-off-white dark:bg-slate-900/40 border border-light-border dark:border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-gray font-mono block font-bold leading-none uppercase">
                          {match.matchup}
                        </span>
                        <span className="text-[10px] text-slate-gray font-mono block mt-1">Date: {match.date} &middot; {match.court}</span>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-left sm:text-right">
                          <span className="text-[9px] text-slate-gray font-mono block uppercase">SCORE LINE</span>
                          <span className="text-xs font-mono font-bold text-charcoal dark:text-white mt-1 block">{scoreLine}</span>
                        </div>

                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold ${
                          isWinner ? 'bg-court-green/10 text-court-green border border-court-green/20' : 'bg-red-50 text-error-red border border-red-100'
                        }`}>
                          {isWinner ? 'WIN' : 'LOSS'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Bookings */}
          <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">UPCOMING COURT BOOKINGS</h3>

            {upcomingBookings.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-light-border dark:border-slate-800 rounded-2xl bg-off-white dark:bg-slate-900/30 text-slate-gray text-xs font-sans font-medium">
                No scheduled bookings pending.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map(booking => (
                  <div
                    key={booking.id}
                    className="bg-off-white dark:bg-slate-900/40 border border-light-border dark:border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] text-court-green font-mono font-bold uppercase">
                        {booking.court}
                      </span>
                      <div className="text-xs font-bold text-charcoal dark:text-white mt-1">
                        {booking.players || 'Solo booking'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-gray font-mono">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-gray/60" />
                        <span>{booking.time} ({booking.date})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (Span 1) */}
        <div className="space-y-6">
          
          {/* Rank Trend */}
          <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">RANK TREND</h3>
            
            <div className="bg-off-white dark:bg-slate-900/40 p-4 rounded-xl border border-light-border dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[9px] text-slate-gray font-mono uppercase block font-bold">Current Rank</span>
                <span className="text-2xl font-display font-black text-charcoal dark:text-white">{playerRow ? `#${playerRow.rank}` : '—'}</span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold ${
                !playerRow?.rankChange ? 'text-slate-gray bg-slate-100 dark:bg-slate-800' :
                playerRow.rankChange > 0 ? 'text-court-green bg-court-green/10' : 'text-error-red bg-red-50'
              }`}>
                {!playerRow?.rankChange ? <Minus className="w-3.5 h-3.5" /> : playerRow.rankChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{playerRow?.rankChange ? Math.abs(playerRow.rankChange) : 'No change'}</span>
              </div>
            </div>
          </div>

          {/* Teams panel */}
          <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">AFFILIATION MATRIX</h3>

            {playerTeam ? (
              <div 
                onClick={() => navigateTo('team-hub', playerTeam!.id)}
                className="bg-off-white hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-800/60 border border-light-border dark:border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-court-green/10 flex items-center justify-center text-court-green text-xs font-bold font-mono">
                    T
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-gray font-mono block">TEAM COHORT</span>
                    <span className="text-xs font-bold text-charcoal dark:text-white mt-0.5 block group-hover:text-court-green transition-colors">
                      {playerTeam.name}
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-gray group-hover:text-court-green transition-colors" />
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-light-border rounded-xl bg-off-white text-slate-gray text-xs">
                Not currently rostered on a team.
              </div>
            )}
          </div>

          {/* Current Registered Tournaments */}
          <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">REGISTERED BRACKETS ({enteredTournaments.length})</h3>
            
            <div className="space-y-2">
              {enteredTournaments.map(tour => (
                <div
                  key={tour.id}
                  onClick={() => navigateTo('tournament-hub', tour.id)}
                  className="bg-off-white dark:bg-slate-900/40 p-3 rounded-lg border border-light-border dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/60 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <span className="text-xs text-charcoal dark:text-white font-bold group-hover:text-court-green transition-colors truncate max-w-[160px]">
                    {tour.name}
                  </span>
                  <span className="text-[10px] font-mono text-court-green font-bold">{tour.format === 'mlp_singles' ? 'MLP' : 'standard'}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Profile Edit Modal */}
      {isEditing && currentUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-light-border dark:border-slate-800 bg-off-white dark:bg-[#0F172A]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-court-green flex items-center justify-center text-white">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm text-charcoal dark:text-white uppercase tracking-tight">Edit Player Profile</h3>
                  <p className="text-[10px] font-mono text-slate-gray">Update your public stats card credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-gray hover:text-charcoal dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              {editError && (
                <div className="text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-3 rounded-xl leading-normal">
                  {editError}
                </div>
              )}

              {/* Username / Name */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-gray dark:text-slate-400 font-mono uppercase font-bold tracking-wider">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Player Name"
                  className="w-full bg-off-white dark:bg-slate-900/50 text-charcoal dark:text-white border border-light-border dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-court-green focus:ring-1 focus:ring-court-green"
                />
              </div>

              {/* Email Address (read-only — tied to your Cognito login) */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-gray dark:text-slate-400 font-mono uppercase font-bold tracking-wider">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full bg-off-white dark:bg-slate-900/50 text-slate-gray dark:text-slate-500 border border-light-border dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-semibold cursor-not-allowed"
                />
              </div>

              {/* DUPR Rating & DUPR ID */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-gray dark:text-slate-400 font-mono uppercase font-bold tracking-wider">DUPR Rating</label>
                  <input
                    type="number"
                    step="0.01"
                    min="2.0"
                    max="8.0"
                    required
                    value={editDuprRating}
                    onChange={(e) => setEditDuprRating(e.target.value)}
                    placeholder="4.00"
                    className="w-full bg-off-white dark:bg-slate-900/50 text-charcoal dark:text-white border border-light-border dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-court-green focus:ring-1 focus:ring-court-green"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-gray dark:text-slate-400 font-mono uppercase font-bold tracking-wider">DUPR ID</label>
                  <input
                    type="text"
                    value={editDuprId}
                    onChange={(e) => setEditDuprId(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-off-white dark:bg-slate-900/50 text-charcoal dark:text-white border border-light-border dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-court-green focus:ring-1 focus:ring-court-green"
                  />
                </div>
              </div>

              {/* Profile Avatar Select */}
              <div className="space-y-2">
                <label className="text-[9px] text-slate-gray dark:text-slate-400 font-mono uppercase font-bold tracking-wider block">Profile Avatar</label>
                <div className="flex items-center gap-3 bg-off-white dark:bg-slate-900/40 p-3 rounded-xl border border-light-border dark:border-slate-800/80">
                  <img
                    src={editAvatarUrl || defaultAvatar(editName || 'Player')}
                    alt="Preview"
                    className="w-12 h-12 rounded-xl object-cover border border-court-green/40 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 space-y-1.5">
                    {/* Sub-tabs for Edit Avatar */}
                    <div className="flex border-b border-light-border dark:border-slate-800 pb-1.5 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setEditAvatarMode('presets')}
                        className={`text-[9px] font-mono uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                          editAvatarMode === 'presets' ? 'text-court-green' : 'text-slate-gray hover:text-charcoal dark:hover:text-white'
                        }`}
                      >
                        Presets
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditAvatarMode('upload')}
                        className={`text-[9px] font-mono uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                          editAvatarMode === 'upload' ? 'text-court-green' : 'text-slate-gray hover:text-charcoal dark:hover:text-white'
                        }`}
                      >
                        Photo Library / File
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditAvatarMode('url')}
                        className={`text-[9px] font-mono uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                          editAvatarMode === 'url' ? 'text-court-green' : 'text-slate-gray hover:text-charcoal dark:hover:text-white'
                        }`}
                      >
                        Web URL
                      </button>
                    </div>

                    {editAvatarMode === 'presets' && (
                      <div className="pt-1">
                        <span className="text-[8px] font-mono text-slate-gray uppercase font-bold tracking-wider block mb-1">Select Preset Athlete Theme</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {PRESET_AVATARS.map((av) => (
                            <button
                              key={av.name}
                              type="button"
                              onClick={() => setEditAvatarUrl(av.url)}
                              className={`w-6 h-6 rounded-md overflow-hidden border-2 transition-all hover:scale-105 cursor-pointer ${
                                editAvatarUrl === av.url ? 'border-court-green scale-105 shadow-sm' : 'border-transparent opacity-75'
                              }`}
                            >
                              <img src={av.url} alt={av.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editAvatarMode === 'upload' && (
                      <div className="space-y-2 pt-1">
                        <label
                          onDragOver={handleEditDragOver}
                          onDragLeave={handleEditDragLeave}
                          onDrop={handleEditDrop}
                          className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-2.5 text-center cursor-pointer transition-all ${
                            editIsDragging
                              ? 'border-court-green bg-court-green/5 dark:bg-court-green/10'
                              : 'border-light-border dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900'
                          }`}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleEditFileChange}
                          />
                          <Upload className="w-4 h-4 text-court-green mb-1 animate-pulse" />
                          <span className="text-[9px] font-mono font-bold text-charcoal dark:text-white block">
                            {compressingAvatar ? 'Compressing...' : 'Access Photo Library / Files'}
                          </span>
                          <span className="text-[8px] text-slate-gray font-mono mt-0.5">
                            Tap to browse library or drag image here &middot; up to 1MB
                          </span>
                        </label>
                      </div>
                    )}

                    {editAvatarMode === 'url' && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[8px] font-mono text-slate-gray uppercase font-bold block">Or Paste Custom Image URL</span>
                        <input
                          type="text"
                          value={editAvatarUrl}
                          onChange={(e) => setEditAvatarUrl(e.target.value)}
                          placeholder="https://images.unsplash.com/..."
                          className="w-full bg-white dark:bg-slate-800 text-charcoal dark:text-white border border-light-border dark:border-slate-700 rounded-lg px-2 py-1 text-[9px] font-mono focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-slate-800 hover:bg-off-white dark:hover:bg-slate-800/50 text-xs font-bold text-slate-gray hover:text-charcoal dark:hover:text-white transition-all uppercase tracking-wider font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving || compressingAvatar}
                  className="flex-1 py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-xs font-bold text-white shadow-sm flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider font-mono cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>{editSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
