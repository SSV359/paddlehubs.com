/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { encodeProfileId } from '../utils/profileId';
import { useAppState } from '../AppContext';
import type { RegisteredUser } from '../types';
import { 
  Users, 
  Search, 
  Shield, 
  User, 
  Key, 
  Mail, 
  Award, 
  UserCheck, 
  ChevronRight, 
  AlertTriangle,
  Lock,
  Flame,
  TrendingUp,
  Cpu,
  Wifi
} from 'lucide-react';

export const RegisteredUsersView: React.FC = () => {
  const { navigateTo, loadRegisteredUsers } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRegisteredUsers()
      .then((r) => { setUsers(r.users); setOnlineCount(r.onlineCount); })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = users.filter(user => 
    (user.displayName || user.username).toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.isAdmin ? 'admin' : 'player').includes(searchTerm.toLowerCase())
  );

  const totalUsers = users.length;
  const adminCount = users.filter(u => u.isAdmin).length;
  const playerCount = totalUsers - adminCount;

  return (
    <div className="space-y-6 animate-fadeIn max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-court-green font-mono text-xs font-black uppercase tracking-widest mb-1.5">
            <Cpu className="w-4 h-4 text-court-green animate-pulse" />
            <span>Developer Creator Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-sans tracking-tight text-slate-900 dark:text-white uppercase">
            Registered Users Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-gray dark:text-slate-400 mt-1">
            Exclusive secure view showing all Cognito-authenticated accounts on PaddleHubs. Only administrators can access this dashboard.
          </p>
        </div>
      </div>

      {/* Security Banner */}
      <div className="p-4 bg-[#FFFBF0] dark:bg-[#251F10] border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3 shadow-sm">
        <Lock className="w-5 h-5 text-[#B38700] dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-[#8A6D1C] dark:text-amber-300 uppercase font-mono tracking-wider">AUTHORIZED ADMINISTRATOR ACCESS</h4>
          <p className="text-xs text-slate-gray dark:text-amber-400/80 mt-1 leading-normal">
            Your session is recognized as an <span className="font-semibold text-charcoal dark:text-white font-mono">Authorized System Administrator</span>. Active registrant accounts and status are exposed below for support and diagnostics. Passwords are never exposed — Cognito never returns them, to anyone.
          </p>
        </div>
      </div>

      {/* Metric Bento Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registrations */}
        <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="absolute right-0 top-0 w-32 h-32 bg-court-green/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
          <div>
            <p className="text-[10px] font-bold text-slate-gray font-mono uppercase tracking-wider">Total Accounts</p>
            <h3 className="text-2xl sm:text-3xl font-black font-mono text-deep-navy dark:text-white mt-1.5">{totalUsers}</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-court-green font-semibold mt-4">
            <Users className="w-3.5 h-3.5" />
            <span>Active Registrants</span>
          </div>
        </div>

        {/* Admin Accounts */}
        <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="absolute right-0 top-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
          <div>
            <p className="text-[10px] font-bold text-slate-gray font-mono uppercase tracking-wider">Admin Roles</p>
            <h3 className="text-2xl sm:text-3xl font-black font-mono text-rose-500 mt-1.5">{adminCount}</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-rose-500 font-semibold mt-4">
            <Shield className="w-3.5 h-3.5" />
            <span>Full System Access</span>
          </div>
        </div>

        {/* Player Accounts */}
        <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
          <div>
            <p className="text-[10px] font-bold text-slate-gray font-mono uppercase tracking-wider">Player Roles</p>
            <h3 className="text-2xl sm:text-3xl font-black font-mono text-indigo-500 dark:text-indigo-400 mt-1.5">{playerCount}</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold mt-4">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Athletes Registered</span>
          </div>
        </div>

        {/* Online Now */}
        <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
          <div>
            <p className="text-[10px] font-bold text-slate-gray font-mono uppercase tracking-wider">Online Now</p>
            <h3 className="text-2xl sm:text-3xl font-black font-mono text-amber-500 mt-1.5">{onlineCount}</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-semibold mt-4">
            <Wifi className="w-3.5 h-3.5" />
            <span>Active in last 5 min</span>
          </div>
        </div>
      </div>

      {/* Main Database Table Container */}
      <div className="bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm relative">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-court-green to-deep-navy rounded-l-2xl z-20"></div>

        {/* Search Header */}
        <div className="p-5 border-b border-light-border dark:border-slate-800 bg-[#F8FAF7]/50 dark:bg-[#111A2E]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-6.5">
          <div className="flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-court-green" />
            <h3 className="font-extrabold text-xs font-mono tracking-wider uppercase text-slate-gray dark:text-slate-300">
              AUTHENTICATED USER DATABASE ({filteredUsers.length})
            </h3>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-gray dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, role..."
              className="w-full text-xs font-mono pl-9.5 pr-4 py-2 bg-white dark:bg-slate-900 border border-light-border dark:border-slate-800 rounded-xl focus:border-court-green focus:outline-none focus:ring-1 focus:ring-court-green transition-all"
            />
          </div>
        </div>

        {/* Database Grid Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-light-border dark:border-slate-800 bg-[#F8FAF7]/20 dark:bg-[#111A2E]/20 text-slate-gray font-mono text-[10px] tracking-wider uppercase">
                <th className="py-4 px-6">User / Identity</th>
                <th className="py-4 px-6">Email Address</th>
                <th className="py-4 px-6 text-center w-32">Cognito Status</th>
                <th className="py-4 px-6 text-center w-32">Last Active</th>
                <th className="py-4 px-6 text-center w-28">Assigned Role</th>
                <th className="py-4 px-6 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-mono text-xs dark:text-slate-500">Loading directory...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-mono text-xs dark:text-slate-500">
                    No registered accounts matched your search parameters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const name = user.displayName || user.username;
                  const bgColors = [
                    'bg-red-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500',
                    'bg-indigo-500', 'bg-violet-500', 'bg-cyan-500',
                  ];
                  const placeholderBg = bgColors[Math.abs(name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % bgColors.length];

                  return (
                    <tr 
                      key={user.sub} 
                      className={`hover:bg-off-white/40 dark:hover:bg-slate-900/30 transition-all group ${
                        user.online ? 'bg-court-green/5 dark:bg-court-green/5' : ''
                      }`}
                    >
                      {/* Name / Profile identity */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${placeholderBg} text-white font-black text-xs flex items-center justify-center border border-light-border dark:border-slate-800 shadow-sm shrink-0 font-mono relative`}>
                            {name.substring(0, 2).toUpperCase()}
                            {user.online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-court-green border-2 border-white dark:border-[#0E1726]" />}
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-charcoal dark:text-slate-200 uppercase tracking-wide">
                              {name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-gray dark:text-slate-500 block">
                              Joined {user.createdAt ? user.createdAt.slice(0, 10) : '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email address */}
                      <td className="py-4 px-6 font-mono text-xs font-bold text-slate-gray dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-gray/60" />
                          <span>{user.email}</span>
                        </div>
                      </td>

                      {/* Cognito Status */}
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border font-mono font-extrabold text-[10px] uppercase ${
                          user.status === 'CONFIRMED' && user.enabled
                            ? 'bg-court-green/10 border-court-green/20 text-court-green'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-gray'
                        }`}>
                          {user.enabled ? user.status : 'DISABLED'}
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="py-4 px-6 text-center font-mono text-[10px] text-slate-gray dark:text-slate-400">
                        {user.online ? (
                          <span className="text-court-green font-bold">● ONLINE</span>
                        ) : user.lastActiveAt ? user.lastActiveAt.slice(0, 10) : '—'}
                      </td>

                      {/* Assigned Role */}
                      <td className="py-4 px-6 text-center">
                        {user.isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 font-mono font-bold text-[10px] text-rose-500 uppercase">
                            <Shield className="w-3 h-3" />
                            <span>Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 font-mono font-bold text-[10px] text-indigo-500 dark:text-indigo-400 uppercase">
                            <User className="w-3 h-3" />
                            <span>Player</span>
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-6 text-center">
                        {user.displayName ? (
                          <button
                            onClick={() => navigateTo('profile', encodeProfileId(user.email, user.displayName))}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold font-mono tracking-wider border border-light-border dark:border-slate-800 hover:border-court-green hover:text-court-green dark:hover:border-court-green rounded-lg transition-all cursor-pointer bg-white dark:bg-slate-900 hover:shadow-sm"
                          >
                            <span>VIEW PROFILE</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase italic">No Profile Yet</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
