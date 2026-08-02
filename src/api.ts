import { CONFIG } from './config';
import { getIdToken } from './auth';
import { normTournament, normMatch, normSchedule, normStandingsRow, normAuction } from './utils/rosterPlayer';
import type {
  Me,
  ClubMatch,
  Booking,
  Tournament,
  TournamentPublicInfo,
  TournamentRegistration,
  TournamentMatch,
  TournamentSchedule,
  TeamStandingRow,
  PlayerRankingRow,
  Auction,
  Playoffs,
  RegisteredUser,
  SiteAnalytics,
  StandingsOverride,
  RosterPlayer,
} from './types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: { auth?: boolean } = {}
): Promise<T> {
  const needsAuth = opts.auth !== false; // default: attach token if we have one
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (needsAuth) {
    const token = await getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ---------- Profile ----------
export const getMe = () => request<Me>('GET', '/me');
export const updateMe = (updates: Partial<Me> & { avatarDataUrl?: string; avatarColor?: string }) =>
  request<Me>('PUT', '/me', updates);

// ---------- Bookings (mine + club-wide) ----------
export const listMyBookings = () => request<{ items: Booking[] }>('GET', '/bookings');
export const listClubBookings = () => request<{ items: Booking[] }>('GET', '/club/bookings');
export const createBooking = (input: {
  date: string;
  time: string;
  court: string;
  duration?: number;
  players?: string;
}) => request<Booking>('POST', '/bookings', input);
export const deleteBooking = (id: string) => request<{ ok: true }>('DELETE', `/bookings/${id}`);
export const adminDeleteBooking = (id: string) =>
  request<{ ok: true }>('DELETE', `/admin/bookings/${id}`);

// ---------- Club-wide informal matches (mine + club-wide) ----------
export const listMyMatches = () => request<{ items: ClubMatch[] }>('GET', '/matches');
export const listClubMatches = () => request<{ items: ClubMatch[] }>('GET', '/club/matches');
export const createClubMatch = (input: {
  date: string;
  court: string;
  gameType: 'singles' | 'doubles';
  matchup: string;
  winner?: string;
  scoreA?: number;
  scoreB?: number;
  notes?: string;
}) => request<ClubMatch>('POST', '/matches', input);
export const deleteClubMatch = (id: string) => request<{ ok: true }>('DELETE', `/matches/${id}`);
export const adminDeleteClubMatch = (id: string) =>
  request<{ ok: true }>('DELETE', `/admin/matches/${id}`);

// ---------- Admin ----------
export const getRegisteredUsers = () =>
  request<{ count: number; onlineCount: number; users: RegisteredUser[] }>('GET', '/admin/users');
export const getSiteAnalytics = (days = 30) =>
  request<SiteAnalytics>('GET', `/admin/analytics?days=${days}`);

// ---------- Anonymous page-view tracking (public) ----------
export const recordPageview = (path: string, visitorId: string) =>
  request<{ ok: true }>('POST', '/analytics/pageview', { path, visitorId }, { auth: false });

// ---------- Tournaments ----------
export const listTournaments = () =>
  request<{ items: Tournament[] }>('GET', '/tournaments').then((r) => ({ items: r.items.map(normTournament) }));
export const listCompletedTournamentsPublic = () =>
  request<{ items: Partial<Tournament>[] }>('GET', '/public/tournaments/completed', undefined, {
    auth: false,
  });
export const getTournament = (id: string) => request<Tournament>('GET', `/tournaments/${id}`).then(normTournament);
export const createTournament = (
  input: Partial<Tournament> & { name: string; startDate: string; endDate: string }
) => request<Tournament>('POST', '/tournaments', input);
export const updateTournamentTeams = (
  id: string,
  input: { teamCount?: number; playersPerTeam?: number; teams: Tournament['teams'] }
) => request<Tournament>('PUT', `/tournaments/${id}`, input).then(normTournament);
export const deleteTournament = (id: string) =>
  request<{ ok: true }>('DELETE', `/tournaments/${id}`);

export const getTournamentPublicInfo = (id: string) =>
  request<TournamentPublicInfo>('GET', `/tournaments/${id}/public-info`, undefined, {
    auth: false,
  });
export const updateRegistrationWindow = (
  id: string,
  input: { registrationStartDate: string; registrationEndDate: string; registrationLimit?: number | null }
) => request<{ ok: true }>('PUT', `/tournaments/${id}/registration-window`, input);
export const updateTournamentLogo = (id: string, logoDataUrl: string) =>
  request<{ ok: true; logoDataUrl: string }>('PUT', `/tournaments/${id}/logo`, { logoDataUrl });
// Renaming a tournament after creation — needs a matching new Lambda
// route (PUT /tournaments/{id}/name), see the backend diff provided
// alongside this change. Not yet supported by the live backend as-is.
export const updateTournamentName = (id: string, name: string) =>
  request<{ ok: true; name: string }>('PUT', `/tournaments/${id}/name`, { name });

export const updatePlayerPool = (id: string, playerPool: RosterPlayer[]) =>
  request<{ ok: true; playerPool: RosterPlayer[] }>('PUT', `/tournaments/${id}/player-pool`, {
    playerPool,
  });
export const syncRegistrantsToPool = (id: string) =>
  request<{ ok: true; playerPool: RosterPlayer[]; syncedCount: number }>(
    'POST',
    `/tournaments/${id}/player-pool/sync-registrants`
  );

export const updateTeamStandingsOverride = (
  id: string,
  teamId: string,
  override: StandingsOverride | { clear: true }
) => request<{ ok: true }>('PUT', `/tournaments/${id}/teams/${teamId}/standings-override`, override);

// Public tournament registration (no login)
export const registerForTournament = (
  id: string,
  input: { name: string; email: string; phone?: string; notes?: string }
) => request<{ ok: true; id: string }>('POST', `/tournaments/${id}/register`, input, { auth: false });
export const listRegistrations = (id: string) =>
  request<{ items: TournamentRegistration[] }>('GET', `/tournaments/${id}/registrations`);
export const setRegistrationPaid = (id: string, regId: string, paid: boolean) =>
  request<{ ok: true }>('PUT', `/tournaments/${id}/registrations/${regId}`, { paid });
export const deleteRegistration = (id: string, regId: string) =>
  request<{ ok: true }>('DELETE', `/tournaments/${id}/registrations/${regId}`);

// Match schedule
export const getTournamentSchedule = (id: string) =>
  request<TournamentSchedule>('GET', `/tournaments/${id}/schedule`).then(normSchedule);
export const saveTournamentSchedule = (id: string, weeks: TournamentSchedule['weeks']) =>
  request<TournamentSchedule>('PUT', `/tournaments/${id}/schedule`, { weeks }).then(normSchedule);
export const deleteTournamentSchedule = (id: string) =>
  request<{ ok: true }>('DELETE', `/tournaments/${id}/schedule`);

// Tournament matches
export const listTournamentMatches = (id: string) =>
  request<{ items: TournamentMatch[] }>('GET', `/tournaments/${id}/matches`).then((r) => ({ items: r.items.map(normMatch) }));
export const createTournamentMatch = (
  id: string,
  input: Partial<TournamentMatch> & { teamAId: string; teamBId: string; games: unknown[] }
) => request<TournamentMatch>('POST', `/tournaments/${id}/matches`, input).then(normMatch);
export const updateTournamentMatch = (
  id: string,
  matchId: string,
  input: Partial<TournamentMatch>
) => request<TournamentMatch>('PUT', `/tournaments/${id}/matches/${matchId}`, input).then(normMatch);
export const clearTournamentMatchScore = (id: string, matchId: string) =>
  request<TournamentMatch>('PUT', `/tournaments/${id}/matches/${matchId}/clear-score`).then(normMatch);
export const deleteTournamentMatch = (id: string, matchId: string) =>
  request<{ ok: true }>('DELETE', `/tournaments/${id}/matches/${matchId}`);

// Standings (public read)
export const getTeamStandings = (id: string) =>
  request<{ tournamentId: string; standings: TeamStandingRow[] }>(
    'GET',
    `/tournaments/${id}/standings`,
    undefined,
    { auth: false }
  ).then((r) => ({ ...r, standings: r.standings.map(normStandingsRow) }));

// Playoffs
export const generatePlayoffs = (id: string) =>
  request<{ ok: true; playoffs: Playoffs }>('POST', `/tournaments/${id}/playoffs/generate`);
export const setPlayoffSlotMatch = (
  id: string,
  slot: 'semifinal1' | 'semifinal2' | 'championship' | 'thirdPlace',
  matchId: string
) => request<{ ok: true; playoffs: Playoffs }>('PUT', `/tournaments/${id}/playoffs/${slot}`, { matchId });
export const advancePlayoffs = (id: string) =>
  request<{ ok: true; playoffs: Playoffs }>('POST', `/tournaments/${id}/playoffs/advance`);

// Player Auction (draft). Admin setup/start/reset are authenticated;
// draw-card/pick/state are public but gated by a per-captain access token.
export const setupAuction = (
  id: string,
  input: {
    format: Auction['format'];
    captainTeamIds: string[];
    levels: { name: string; players: RosterPlayer[] }[];
  }
) => request<{ ok: true; auction: Auction }>('PUT', `/tournaments/${id}/auction/setup`, input).then((r) => ({ ...r, auction: normAuction(r.auction) }));
export const startAuctionRound = (id: string) =>
  request<{ ok: true; auction: Auction }>('POST', `/tournaments/${id}/auction/start-round`).then((r) => ({ ...r, auction: normAuction(r.auction) }));
export const resetAuction = (id: string) => request<{ ok: true }>('DELETE', `/tournaments/${id}/auction`);
export const getAuctionState = (id: string, captainToken?: string) =>
  request<{ ok: true; auction: Auction; currentTeamId: string | null; yourTeamId: string | null; isYourTurn: boolean }>(
    'GET',
    `/tournaments/${id}/auction${captainToken ? `?captainToken=${encodeURIComponent(captainToken)}` : ''}`,
    undefined,
    { auth: false }
  ).then((r) => ({ ...r, auction: normAuction(r.auction) }));
export const drawAuctionCard = (id: string, captainToken: string) =>
  request<{ ok: true; auction: Auction; yourCard: number }>(
    'POST',
    `/tournaments/${id}/auction/draw-card`,
    { captainToken },
    { auth: false }
  ).then((r) => ({ ...r, auction: normAuction(r.auction) }));
export const pickAuctionPlayer = (id: string, captainToken: string, player: RosterPlayer) =>
  request<{ ok: true; auction: Auction }>(
    'POST',
    `/tournaments/${id}/auction/pick`,
    { captainToken, playerName: player.name, playerEmail: player.email },
    { auth: false }
  ).then((r) => ({ ...r, auction: normAuction(r.auction) }));

// Player rankings (public, club-wide or scoped to a tournament)
export const getPlayerRankings = () =>
  request<{ standings: PlayerRankingRow[] }>('GET', '/player-rankings', undefined, { auth: false });
export const getTournamentPlayerRankings = (id: string) =>
  request<{ standings: PlayerRankingRow[] }>(
    'GET',
    `/tournaments/${id}/player-rankings`,
    undefined,
    { auth: false }
  );
