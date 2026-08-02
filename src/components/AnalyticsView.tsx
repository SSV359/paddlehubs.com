/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import type { SiteAnalytics } from '../types';
import { Activity, TrendingUp, Users, Eye } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { loadSiteAnalytics } = useAppState();
  const [data, setData] = useState<SiteAnalytics | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadSiteAnalytics(days).then(setData).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, [days]);

  const maxDaily = data ? Math.max(1, ...data.daily.map((d) => d.views)) : 1;

  return (
    <div className="space-y-6" id="analytics-view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-light-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-5 h-5 text-court-green shrink-0" />
            <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">TRAFFIC INSIGHTS</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase">Site Analytics</h1>
          <p className="text-slate-gray text-xs mt-1">Anonymous and logged-in visitor traffic across PaddleHubs.</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-white border border-light-border rounded-lg px-3 py-2 text-xs font-bold text-charcoal">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading || !data ? (
        <p className="text-xs text-slate-gray font-mono">Loading analytics...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-gray font-mono uppercase">Total Views</span>
              <h3 className="text-3xl font-black font-mono text-deep-navy">{data.totalViews}</h3>
              <span className="flex items-center gap-1 text-[10px] text-court-green font-semibold"><Eye className="w-3.5 h-3.5" /> Last {data.rangeDays} days</span>
            </div>
            <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-gray font-mono uppercase">Unique Visitors</span>
              <h3 className="text-3xl font-black font-mono text-deep-navy">{data.uniqueVisitors}</h3>
              <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-semibold"><Users className="w-3.5 h-3.5" /> Distinct sessions</span>
            </div>
            <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-gray font-mono uppercase">Top Page</span>
              <h3 className="text-xl font-black font-mono text-deep-navy truncate">{data.topPages[0]?.path || '—'}</h3>
              <span className="flex items-center gap-1 text-[10px] text-soft-gold font-semibold"><TrendingUp className="w-3.5 h-3.5" /> {data.topPages[0]?.views || 0} views</span>
            </div>
          </div>

          <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-display text-[10px] font-medium text-slate-gray tracking-widest uppercase">Daily Views</h3>
            <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
              {data.daily.map((d) => (
                <div key={d.date} className="flex flex-col items-center gap-1 group relative" style={{ minWidth: '10px' }}>
                  <div
                    className="w-2.5 bg-court-green rounded-t hover:bg-court-green/80 transition-all"
                    style={{ height: `${Math.max(4, (d.views / maxDaily) * 100)}px` }}
                    title={`${d.date}: ${d.views} views`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-off-white p-4 border-b border-light-border">
              <h3 className="font-bold text-sm text-slate-gray font-mono uppercase tracking-wider">Top Pages</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {data.topPages.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-gray font-mono">No page view data yet.</div>
              ) : data.topPages.map((p) => (
                <div key={p.path} className="flex items-center justify-between px-5 py-3">
                  <span className="text-xs font-mono text-charcoal">{p.path}</span>
                  <span className="text-xs font-bold font-mono text-court-green">{p.views} views</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
