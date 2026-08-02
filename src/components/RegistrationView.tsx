/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import type { TournamentPublicInfo } from '../types';
import {
  QrCode,
  Link as LinkIcon,
  Copy,
  CheckCircle2,
  Users,
  Trophy,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const RegistrationView: React.FC = () => {
  // Registration is a PUBLIC endpoint on the real backend — no login
  // required, and it doesn't create teams/pairs. It's a simple contact
  // form; an admin later builds rosters from the registrant pool (see
  // "Sync Registrants" in the Admin Portal). This is simpler than the
  // original zip's login-gated team/doubles-partner picker, which has
  // no equivalent on the real API.
  const { activeTournamentId, navigateTo, api } = useAppState();

  const [tour, setTour] = useState<TournamentPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTournamentId) { setLoading(false); return; }
    api.getTournamentPublicInfo(activeTournamentId)
      .then(setTour)
      .catch((e) => setLoadError(e.message || 'Could not load this tournament.'))
      .finally(() => setLoading(false));
  }, [activeTournamentId]);

  const [fullName, setFullName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-court-green border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-mono text-slate-gray">Loading tournament...</p>
      </div>
    );
  }

  if (!tour || loadError) {
    return (
      <div className="text-center py-16 bg-white border border-light-border rounded-2xl p-6">
        <p className="text-slate-gray text-xs font-mono">{loadError || 'No active tournament selected for registration.'}</p>
        <button
          onClick={() => navigateTo('tournaments')}
          className="mt-4 px-4 py-2 bg-deep-navy text-white text-xs font-mono font-bold rounded-lg uppercase"
        >
          View Tournaments
        </button>
      </div>
    );
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !emailAddress.trim()) {
      setErrorMsg('Please enter your full name and email address.');
      return;
    }

    setSubmitting(true);
    try {
      await api.registerForTournament(tour.id, {
        name: fullName.trim(),
        email: emailAddress.trim().toLowerCase(),
        phone: phone.trim(),
        notes: notes.trim(),
      });
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?register=${tour.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate a real, dynamic, and fully scannable QR Code utilizing a secure public API
  const renderSVGQRCode = (customLink?: string) => {
    const qrData = customLink || `${window.location.origin}${window.location.pathname}?register=${tour.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=0e1726&data=${encodeURIComponent(qrData)}`;
    
    return (
      <div className="relative w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden group shadow-sm hover:shadow transition-shadow" id="real-qr-code-wrapper">
        <img 
          src={qrUrl} 
          alt="PaddleHubs Bracket QR Code" 
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  };

  const spotsLeft = tour.registrationLimit ? Math.max(0, tour.registrationLimit - tour.registrationCount) : null;
  const registrationClosed = new Date().toISOString().slice(0, 10) > tour.registrationEndDate || spotsLeft === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="player-registration-panel">
      {/* Header card with bracket details */}
      <div className="relative bg-white border border-light-border rounded-2xl p-6 pl-7 sm:p-8 sm:pl-9.5 shadow-sm overflow-hidden">
        {/* Left Glow Accent Gradient Sidebar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-2xl z-20"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-court-green/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="text-[10px] text-court-green font-bold font-mono tracking-widest uppercase bg-court-green/10 border border-court-green/20 px-3 py-1 rounded-full">
              bracket registration
            </span>
            <h1 className="text-xl sm:text-2xl font-display font-black text-charcoal tracking-tight uppercase">
              {tour.name}
            </h1>
            <div className="flex flex-wrap gap-4 pt-2 text-[11px] text-slate-gray font-mono">
              <span>&#128197; {tour.startDate} to {tour.endDate}</span>
              <span>&#128101; {tour.registrationLimit ? `${tour.registrationCount} / ${tour.registrationLimit} Registered` : `${tour.registrationCount} Registered`}</span>
              <span>&#9200; Registration closes {tour.registrationEndDate}</span>
            </div>
          </div>
          
          <div className="bg-off-white border border-light-border rounded-2xl p-4 flex flex-col items-center justify-center shrink-0 w-full md:w-44 text-center">
            {renderSVGQRCode()}
            <span className="text-[9px] text-slate-gray font-mono font-bold uppercase tracking-wider mt-2.5">
              SCAN TO INVITE FRIENDS
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Registration form or Success badge */}
        <div className="relative md:col-span-2 bg-white border border-light-border rounded-2xl p-6 pl-7.5 shadow-sm overflow-hidden">
          {/* Left Glow Accent Gradient Sidebar */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 via-blue-900 to-[#172554] rounded-l-2xl z-20"></div>
          {success ? (
            <div className="text-center py-8 space-y-4 animate-scaleUp">
              <div className="w-16 h-16 bg-court-green/10 text-court-green rounded-full flex items-center justify-center mx-auto border border-court-green/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-extrabold text-lg text-charcoal uppercase">Registration Confirmed!</h3>
                <p className="text-xs text-slate-gray max-w-md mx-auto leading-relaxed">
                  Congratulations! You're on the roster for this tournament. The organizer will build teams from the registrant pool ahead of the event.
                </p>
              </div>

              <div className="p-4 bg-off-white border border-light-border rounded-xl inline-block text-left max-w-sm w-full font-mono text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-200 pb-1.5 font-bold">
                  <span>TOURNAMENT</span>
                  <span className="text-court-green uppercase">{tour.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>REGISTERED AS</span>
                  <span>{fullName}</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigateTo('dashboard')}
                  className="px-6 py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-xs font-mono font-bold text-white uppercase tracking-wider transition-all"
                >
                  Go To Personal Dashboard
                </button>
              </div>
            </div>
          ) : registrationClosed ? (
            <div className="p-4 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-800">Registration Closed</p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  {spotsLeft === 0
                    ? 'This tournament has reached its registration limit.'
                    : `Registration closed on ${tour.registrationEndDate}.`}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">REGISTRATION GATEWAY</h3>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-gray font-mono uppercase font-bold">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white text-charcoal border border-light-border text-xs p-3 rounded-xl focus:border-court-green focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-gray font-mono uppercase font-bold">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. player@paddlehubs.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="w-full bg-white text-charcoal border border-light-border text-xs p-3 rounded-xl focus:border-court-green focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-gray font-mono uppercase font-bold">Phone (Optional)</label>
                <input
                  type="tel"
                  placeholder="e.g. (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white text-charcoal border border-light-border text-xs p-3 rounded-xl focus:border-court-green focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-gray font-mono uppercase font-bold">Notes (Optional)</label>
                <textarea
                  placeholder="Preferred partner, availability, anything the organizer should know..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-white text-charcoal border border-light-border text-xs p-3 rounded-xl focus:border-court-green focus:outline-none resize-none"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-600 font-medium font-mono">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-court-green hover:bg-[#235F3A] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Confirm and Register'}</span>
              </button>
            </form>
          )}
        </div>

        {/* RIGHT COLUMN: Instructions & Invites */}
        <div className="space-y-6">
          {/* Quick Info Box */}
          <div className="bg-[#0B1220] text-white border border-deep-navy rounded-2xl p-6 space-y-4 shadow-sm">
            <h4 className="font-display text-[9px] font-medium text-court-green tracking-widest uppercase">HOW TO GET STARTED</h4>
            
            <ul className="space-y-3.5 text-xs text-slate-300">
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-court-green text-white font-bold font-mono text-[10px] flex items-center justify-center shrink-0">1</span>
                <span>Submit your name and contact details to join the registrant pool.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-court-green text-white font-bold font-mono text-[10px] flex items-center justify-center shrink-0">2</span>
                <span>The organizer builds teams and rosters ahead of the event.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-court-green text-white font-bold font-mono text-[10px] flex items-center justify-center shrink-0">3</span>
                <span>Once teams are set, sign in to check your matches, court allocations, and scores.</span>
              </li>
            </ul>
          </div>

          {/* Invitation Copy Box */}
          <div className="bg-white border border-light-border rounded-2xl p-5 space-y-4 shadow-sm">
            <h4 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">SHARE REGISTRATION</h4>
            <p className="text-xs text-slate-gray leading-normal">
              Share this registration link with your fellow club members, partners, or team members to invite them to this active tournament!
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}${window.location.pathname}?register=${tour.id}`}
                className="flex-1 bg-off-white text-slate-gray border border-light-border text-[10px] p-2.5 rounded-xl font-mono focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="p-2.5 rounded-xl bg-court-green text-white hover:bg-[#235F3A] transition-all shrink-0 cursor-pointer flex items-center justify-center"
                title="Copy Link"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copied && <p className="text-[10px] text-court-green font-bold font-mono text-center">Registration link copied to clipboard!</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
