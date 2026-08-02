import type { RosterPlayer, Tournament, TournamentTeam, TournamentMatch, TournamentSchedule, TeamStandingRow, Auction } from '../types';

/**
 * Existing tournaments' team rosters, match player fields, and auction
 * levels were saved as plain strings before the email-identity
 * migration. The rest of the app now assumes every player is always a
 * {name, email} object — reading .email off an old plain string is
 * undefined, and calling .trim() on that throws, which is what was
 * producing the blank screen. Every read from the API funnels through
 * these normalizers so both old and new data work without crashing,
 * regardless of whether a given tournament's data has been re-saved
 * since the backend migration went live.
 */
export function normPlayer(p: unknown): RosterPlayer | null {
  if (!p) return null;
  if (typeof p === 'string') {
    const name = p.trim();
    return name ? { name, email: '' } : null;
  }
  const obj = p as { name?: unknown; email?: unknown };
  const name = String(obj.name || '').trim();
  if (!name) return null;
  return { name, email: String(obj.email || '').trim().toLowerCase() };
}

export function normPlayers(arr: unknown): RosterPlayer[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(normPlayer).filter((p): p is RosterPlayer => p !== null);
}

export function normTeam(t: any): TournamentTeam {
  return { ...t, players: normPlayers(t?.players) };
}

export function normTournament(t: any): Tournament {
  if (!t) return t;
  return {
    ...t,
    teams: Array.isArray(t.teams) ? t.teams.map(normTeam) : [],
    playerPool: normPlayers(t.playerPool),
  };
}

export function normMatch(m: any): TournamentMatch {
  if (!m) return m;
  return {
    ...m,
    teamAPlayers: normPlayers(m.teamAPlayers),
    teamBPlayers: normPlayers(m.teamBPlayers),
    games: Array.isArray(m.games)
      ? m.games.map((g: any) => ({ ...g, playerA: g.playerA ? normPlayer(g.playerA) || undefined : undefined, playerB: g.playerB ? normPlayer(g.playerB) || undefined : undefined }))
      : m.games,
  };
}

export function normSchedule(s: any): TournamentSchedule {
  if (!s) return s;
  return {
    ...s,
    weeks: Array.isArray(s.weeks)
      ? s.weeks.map((w: any) => ({
          ...w,
          fixtures: Array.isArray(w.fixtures)
            ? w.fixtures.map((f: any) => ({ ...f, teamAPlayers: normPlayers(f.teamAPlayers), teamBPlayers: normPlayers(f.teamBPlayers) }))
            : [],
        }))
      : [],
  };
}

export function normStandingsRow(r: any): TeamStandingRow {
  return { ...r, players: normPlayers(r?.players) };
}

export function normAuction(a: any): Auction {
  if (!a) return a;
  return {
    ...a,
    levels: Array.isArray(a.levels) ? a.levels.map((l: any) => ({ ...l, players: normPlayers(l.players) })) : [],
  };
}
