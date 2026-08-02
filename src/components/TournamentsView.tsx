/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppState } from '../AppContext';
import type { Tournament } from '../types';
import { CreateTournamentPanel } from './CreateTournamentPanel';
import { Activity, Calendar, MapPin, Users, Award, PlayCircle, PlusCircle, Trophy } from 'lucide-react';

type TourFilter = 'all' | 'active' | 'upcoming' | 'completed';

const today = () => new Date().toISOString().slice(0, 10);

// The real backend never sets a 'completed'/'upcoming' status field —
// status is always 'ACTIVE'. Lifecycle state is derived from dates here,
// the same way the backend itself derives "completed" for its public
// completed-tournaments endpoint.
const deriveStatus = (t: Tournament): 'active' | 'upcoming' | 'completed' => {
  const now = today();
  if (t.endDate && t.endDate < now) return 'completed';
  if (t.startDate && t.startDate > now) return 'upcoming';
  return 'active';
};

const isRegistrationOpen = (t: Tournament) => {
  const now = today();
  return (!t.registrationStartDate || t.registrationStartDate <= now) && (!t.registrationEndDate || t.registrationEndDate >= now);
};

export const TournamentsView: React.FC = () => {
  const { tournaments, navigateTo, isAdmin, isAuthenticated, api, refreshTournaments } = useAppState();
  const [filter, setFilter] = useState<TourFilter>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const filteredTournaments = tournaments.filter(t => {
    if (filter === 'all') return true;
    return deriveStatus(t) === filter;
  });

  const getFormatLabel = (t: Tournament) => (t.format === 'mlp_singles' ? 'MLP Singles' : 'Standard League');

  return (
    <div className="space-y-6" id="tournaments-directory">
      {/* Header and Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-light-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-5 h-5 text-court-green shrink-0" />
            <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">TOURNAMENT DIRECTORY</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase">
            Pickleball Brackets & Leagues
          </h1>
          <p className="text-slate-gray text-xs mt-1">
            Browse and enter official local, state, and club level tournaments.
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="flex bg-white p-1 rounded-xl border border-light-border shadow-sm self-start md:self-center">
          {(['all', 'active', 'upcoming', 'completed'] as TourFilter[]).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 text-xs font-bold font-mono tracking-wider rounded-lg transition-all uppercase cursor-pointer ${
                filter === status
                  ? 'bg-deep-navy text-white shadow-sm'
                  : 'text-slate-gray hover:text-charcoal'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Tournaments */}
      {filteredTournaments.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white max-w-lg mx-auto shadow-sm">
          <Calendar className="w-10 h-10 text-slate-gray mx-auto mb-3" />
          <h3 className="text-sm font-display font-bold text-charcoal">No Tournaments Found</h3>
          <p className="text-xs text-slate-gray font-sans font-medium mt-1">There are no tournaments matching the selected status filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="tournaments-cards-grid">
          {filteredTournaments.map(tour => {
            const status = deriveStatus(tour);
            const regOpen = isRegistrationOpen(tour);
            const teamsFilled = tour.teams?.length || 0;
            const teamsTarget = tour.teamCount || teamsFilled || 1;
            const progress = Math.min(100, Math.round((teamsFilled / teamsTarget) * 100));

            return (
              <div
                key={tour.id}
                onClick={() => navigateTo('tournament-hub', tour.id)}
                className="group bg-white border border-light-border hover:border-court-green/30 rounded-2xl p-5 pl-6.5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between h-[360px] cursor-pointer relative overflow-hidden"
              >
                {/* Visual Accent - Left Glowing Gradient Sidebar */}
                {status === 'active' ? (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green via-[#123E25] to-[#0A1F13] rounded-l-2xl z-20" />
                ) : status === 'upcoming' ? (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-soft-gold via-[#6b5212] to-[#2e2103] rounded-l-2xl z-20" />
                ) : (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-slate-400 via-slate-600 to-slate-800 rounded-l-2xl z-20" />
                )}

                <div className="space-y-4">
                  {/* Status & Format row */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider border uppercase ${
                      status === 'active'
                        ? 'bg-court-green/10 text-court-green border-court-green/20'
                        : status === 'upcoming'
                        ? 'bg-soft-gold/10 text-soft-gold border-soft-gold/20'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        status === 'active' ? 'bg-court-green animate-pulse' : status === 'upcoming' ? 'bg-soft-gold' : 'bg-slate-450'
                      }`} />
                      {status}
                    </span>

                    <span className="text-[10px] text-slate-gray font-bold font-mono uppercase">
                      {getFormatLabel(tour)}
                    </span>
                  </div>

                  {/* Title and logo */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      {tour.logoDataUrl ? (
                        <img src={tour.logoDataUrl} alt={tour.name} className="w-9 h-9 rounded-lg object-cover border border-light-border shadow-sm shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-court-green/10 border border-court-green/20 flex items-center justify-center text-court-green shrink-0">
                          <Trophy className="w-4 h-4" />
                        </div>
                      )}
                      <h3 className="text-base font-display font-bold text-charcoal group-hover:text-court-green transition-colors line-clamp-1">
                        {tour.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-gray line-clamp-3 leading-relaxed">
                      {tour.teamCount} teams of {tour.playersPerTeam} players &middot; hosted by {tour.ownerDisplayName || 'PaddleHubs'}
                    </p>
                  </div>
                </div>

                {/* Logistics */}
                <div className="border-t border-slate-100 pt-4 mt-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-gray">
                    <Calendar className="w-4 h-4 text-slate-gray/60" />
                    <span>{tour.startDate} to {tour.endDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-gray">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-gray/60" />
                      <span>{teamsFilled} / {teamsTarget} Teams</span>
                    </div>
                    
                    <span className={`text-[10px] font-mono font-bold ${
                      regOpen ? 'text-green-600' : 'text-slate-gray'
                    }`}>
                      {regOpen ? '● REG OPEN' : '● CLOSED'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar / Entry Action */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  {status === 'completed' ? (
                    <div className="flex items-center gap-2 text-xs text-soft-gold font-bold">
                      <Award className="w-4 h-4" />
                      <span>Tourney Completed</span>
                    </div>
                  ) : regOpen ? (
                    <button
                      onClick={() => navigateTo('register-bracket', tour.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-court-green hover:bg-[#235F3A] text-white text-[10px] font-mono font-bold uppercase cursor-pointer shadow-sm transition-all"
                    >
                      REGISTER
                    </button>
                  ) : (
                    <div className="flex-1 space-y-1.5 mr-4">
                      <div className="flex justify-between text-[10px] font-mono font-bold text-slate-gray">
                        <span>ROSTER PROGRESS</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-court-green h-full rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => navigateTo('tournament-hub', tour.id)}
                    className="text-xs text-court-green font-bold font-mono tracking-wide group-hover:translate-x-1 transition-transform flex items-center gap-1 bg-transparent border-none cursor-pointer"
                  >
                    <span>VIEW HUB</span>
                    <PlayCircle className="w-4 h-4 text-court-green" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Tournament — any signed-in user, not just admins, since
          the real backend has no admin check on tournament creation */}
      {isAuthenticated && (
        <div className="bg-white border border-light-border rounded-2xl shadow-sm overflow-hidden">
          {!showCreateForm ? (
            <div className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-charcoal">Create a New Tournament Bracket</h4>
                <p className="text-xs text-slate-gray">Launch a standard round-robin or MLP-style singles bracket — you'll be its owner.</p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2.5 rounded-lg bg-court-green text-white font-bold text-xs hover:bg-court-green/90 shadow-sm flex items-center gap-2 cursor-pointer transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Tournament</span>
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              <button onClick={() => setShowCreateForm(false)} className="text-xs font-bold font-mono text-slate-gray hover:text-charcoal cursor-pointer uppercase">&larr; Cancel</button>
              <CreateTournamentPanel api={api} onCreated={refreshTournaments} navigateTo={navigateTo} />
            </div>
          )}
        </div>
      )}

      {/* Admin Quick Link — remaining admin-only tools (managing every
          tournament regardless of ownership, registered users, etc.) */}
      {isAdmin && (
        <div className="bg-white border border-light-border p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-charcoal">Admin Tools</h4>
            <p className="text-xs text-slate-gray">Manage every tournament on the platform, regardless of who created it.</p>
          </div>
          <button
            onClick={() => navigateTo('admin')}
            className="px-4 py-2.5 rounded-lg bg-deep-navy text-white font-bold text-xs hover:bg-black shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Launch Admin Portal</span>
          </button>
        </div>
      )}
    </div>
  );
};
