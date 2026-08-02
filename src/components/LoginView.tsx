/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LogIn, UserPlus, KeyRound, ShieldCheck } from 'lucide-react';
import { useAppState } from '../AppContext';
import { PaddleHubsLogo } from './PaddleHubsLogo';
import { NetDivider } from './NetDivider';

interface LoginViewProps {
  onLogin?: (role: 'player' | 'admin') => void;
}

// With Cognito Hosted UI, this app never collects a password directly —
// Sign In / Create Account / Forgot Password all redirect to Cognito's own
// hosted pages, which redirect back to /auth/callback once done. Avatar,
// DUPR rating, and display name are set afterward from the Profile screen.
export const LoginView: React.FC<LoginViewProps> = () => {
  const { login, signUp, forgotPassword } = useAppState();

  return (
    <div className="min-h-screen bg-gradient-to-br from-deep-navy via-[#0C1525] to-[#060B12] dark:from-[#060A12] dark:via-[#090F1B] dark:to-[#03060B] flex flex-col items-center justify-center p-4 relative overflow-hidden court-texture" id="login-root">
      {/* Background elegant accents */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-court-green/10 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gradient-to-tr from-soft-gold/10 to-transparent rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      <div className="w-full max-w-md relative z-10 space-y-6 animate-fadeIn">
        {/* Brand bar */}
        <div className="text-center space-y-3">
          <div className="flex flex-col items-center gap-4 hover:scale-105 transition-transform duration-300">
            <PaddleHubsLogo size={96} showText={true} textColorClass="text-white text-3xl" />
          </div>
          <NetDivider className="max-w-[200px] mx-auto" />
          <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase font-bold mt-2">
            PROFESSIONAL PICKLEBALL BRACKET NETWORK
          </p>
        </div>

        {/* Portal Card */}
        <div className="bg-white/95 dark:bg-[#0E1726]/95 backdrop-blur-md border border-light-border dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-court-green/10 border border-court-green/20 flex items-center justify-center mx-auto text-court-green">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-display font-black uppercase text-charcoal dark:text-white tracking-tight">Secure Athlete Portal</h3>
            <p className="text-xs text-slate-gray leading-normal">
              Sign in or create your account through our secure AWS-verified authentication gateway.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={login}
              className="w-full py-3 rounded-xl bg-court-green hover:bg-[#235F3A] font-bold text-xs text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer font-mono uppercase tracking-wider"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
            <button
              onClick={signUp}
              className="w-full py-3 rounded-xl border border-court-green/30 bg-court-green/5 hover:bg-court-green/10 font-bold text-xs text-court-green shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer font-mono uppercase tracking-wider"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </button>
            <button
              onClick={forgotPassword}
              className="w-full py-2.5 text-[10px] text-slate-gray hover:text-court-green font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Forgot Password?</span>
            </button>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-[10px] text-slate-gray/60 font-mono font-bold uppercase tracking-wider">
          © 2026 PaddleHubs — an open project by Sai Sidharth.
        </p>
      </div>
    </div>
  );
};
