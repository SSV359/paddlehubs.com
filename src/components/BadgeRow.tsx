/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { PlayerRankingRow } from '../types';
import { Trophy, Flame, Award, Crown, Shield, Zap } from 'lucide-react';

export interface Badge {
  id: string;
  label: string;
  icon: any;
  color: string;
}

export function computeBadges(row: PlayerRankingRow | undefined | null): Badge[] {
  if (!row) return [];
  const badges: Badge[] = [];

  if (row.rank === 1) badges.push({ id: 'champion', label: 'Club Champion', icon: Crown, color: 'text-soft-gold bg-soft-gold/10 border-soft-gold/20' });
  if (row.wins >= 1) badges.push({ id: 'first_win', label: 'First Win', icon: Trophy, color: 'text-court-green bg-court-green/10 border-court-green/20' });
  if (row.streak >= 3) badges.push({ id: 'hot_streak', label: `${row.streak}-Win Streak`, icon: Flame, color: 'text-orange-600 bg-orange-50 border-orange-200' });
  if (row.wins >= 10) badges.push({ id: 'veteran', label: 'Veteran (10+ Wins)', icon: Shield, color: 'text-blue-600 bg-blue-50 border-blue-200' });
  if (row.played >= 15) badges.push({ id: 'iron_player', label: 'Iron Player (15+ Matches)', icon: Zap, color: 'text-purple-600 bg-purple-50 border-purple-200' });
  if (row.played > 0 && row.wins / row.played >= 0.75 && row.played >= 4) {
    badges.push({ id: 'sharpshooter', label: '75%+ Win Rate', icon: Award, color: 'text-rose-600 bg-rose-50 border-rose-200' });
  }

  return badges;
}

export const BadgeRow: React.FC<{ row: PlayerRankingRow | undefined | null; size?: 'sm' | 'md' }> = ({ row, size = 'md' }) => {
  const badges = computeBadges(row);
  if (badges.length === 0) return null;

  const pad = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span key={b.id} className={`inline-flex items-center gap-1 rounded-lg border font-bold font-mono uppercase ${pad} ${textSize} ${b.color}`}>
          <b.icon className={iconSize} /> {b.label}
        </span>
      ))}
    </div>
  );
};
