/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppNotification } from '../types';
import { Bell, Check, MessageCircle, DollarSign, CalendarClock, Sparkles } from 'lucide-react';

const iconFor = (notifType: string) => {
  switch (notifType) {
    case 'fixture_message': return MessageCircle;
    case 'expense_added': return DollarSign;
    case 'match_reminder': return CalendarClock;
    default: return Sparkles;
  }
};

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const NotificationBell: React.FC<{ api: any; isAuthenticated: boolean; navigateTo: (view: any, id?: string) => void }> = ({ api, isAuthenticated, navigateTo }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!isAuthenticated) return;
    api.listNotifications().then((r: any) => { setItems(r.items); setUnreadCount(r.unreadCount); }).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const openNotification = async (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      api.markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.link?.view) navigateTo(n.link.view, n.link.id);
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
    await api.markAllNotificationsRead().catch(() => {});
  };

  if (!isAuthenticated) {
    return (
      <button className="p-2 text-slate-gray dark:text-slate-400 rounded-lg cursor-not-allowed opacity-50" title="Sign in to see notifications">
        <Bell className="w-4.5 h-4.5" />
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-slate-gray dark:text-slate-400 hover:text-charcoal dark:hover:text-white rounded-lg hover:bg-off-white dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-court-green text-white text-[9px] font-mono font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto bg-white dark:bg-[#0E1726] border border-light-border dark:border-slate-800 rounded-2xl shadow-2xl z-50">
          <div className="flex items-center justify-between p-3 border-b border-light-border dark:border-slate-800 sticky top-0 bg-white dark:bg-[#0E1726]">
            <h3 className="font-display font-bold text-xs text-charcoal dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[9px] font-mono font-bold text-court-green hover:underline cursor-pointer uppercase flex items-center gap-1">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-6 h-6 text-slate-gray/40 mx-auto mb-2" />
              <p className="text-xs text-slate-gray">Nothing yet — you'll see match messages, expense splits, and reminders here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((n) => {
                const Icon = iconFor(n.notifType);
                return (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className={`w-full flex items-start gap-2.5 p-3 text-left cursor-pointer transition-all hover:bg-off-white dark:hover:bg-slate-900/50 ${!n.read ? 'bg-court-green/5 dark:bg-court-green/10' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!n.read ? 'bg-court-green/15 text-court-green' : 'bg-off-white dark:bg-slate-800 text-slate-gray'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${!n.read ? 'font-bold text-charcoal dark:text-white' : 'font-semibold text-slate-gray'}`}>{n.title}</p>
                      {n.body && <p className="text-[10px] text-slate-gray mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[9px] text-slate-gray/70 font-mono mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-court-green shrink-0 mt-1.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
