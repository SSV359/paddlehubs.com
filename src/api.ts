import { CONFIG } from './config';
import { getIdToken } from './auth';
import { normTournament, normMatch, normSchedule, normStandingsRow, normAuction } from './utils/rosterPlayer';
import type {
  Me,
  ClubMatch,
  Booking,
  Tournament,
  TournamentWinnerEntry,
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
  FixtureMessage,
  PublicPlayerProfile,
  ClubChatMessage,
  VideoRecord,
  TournamentExpense,
  ExpenseCategory,
  MarketplaceListing,
  PaddleCondition,
  AppNotification,
  SubRequest,
  LiveMatch,
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
export const linkFixtureMatch = (id: string, fixtureId: string, matchId: string) =>
  request<{ ok: true }>('POST', `/tournaments/${id}/schedule/link-match`, { fixtureId, matchId });
export const deleteTournamentSchedule = (id: string) =>
  request<{ ok: true }>('DELETE', `/tournaments/${id}/schedule`);

// Fixture chat — one thread per scheduled fixture, restricted to that
// fixture's own players (plus admin/owner). Naturally stays on-topic
// since it's scoped to a specific upcoming match, not a general inbox.
export const listFixtureMessages = (tournamentId: string, fixtureId: string) =>
  request<{ items: FixtureMessage[] }>('GET', `/tournaments/${tournamentId}/fixtures/${fixtureId}/messages`);
export const postFixtureMessage = (tournamentId: string, fixtureId: string, text: string) =>
  request<FixtureMessage>('POST', `/tournaments/${tournamentId}/fixtures/${fixtureId}/messages`, { text });

// Live scoreboard — an ephemeral scratch pad while a match is actively
// being played. "Finish" folds the accumulated games into a real match
// via createTournamentMatch (below), same as any other match entry.
export const listAllLiveMatches = () =>
  request<{ items: LiveMatch[] }>('GET', '/live', undefined, { auth: false });
export const listLiveMatches = (tournamentId: string) =>
  request<{ items: LiveMatch[] }>('GET', `/tournaments/${tournamentId}/live`);
export const getLiveMatch = (tournamentId: string, fixtureId: string) =>
  request<LiveMatch | { active: false }>('GET', `/tournaments/${tournamentId}/live/${fixtureId}`);
export const startLiveMatch = (tournamentId: string, fixtureId: string, input: { teamAId: string; teamBId: string; court: string; gameType: string }) =>
  request<LiveMatch>('POST', `/tournaments/${tournamentId}/live/${fixtureId}/start`, input);
export const updateLiveMatch = (tournamentId: string, fixtureId: string, action: string) =>
  request<LiveMatch>('POST', `/tournaments/${tournamentId}/live/${fixtureId}/update`, { action });
export const endLiveMatch = (tournamentId: string, fixtureId: string) =>
  request<{ ok: true }>('DELETE', `/tournaments/${tournamentId}/live/${fixtureId}`);

// Club-wide chat — one shared room, any authenticated player
export const listClubChatMessages = () =>
  request<{ items: ClubChatMessage[] }>('GET', '/club/chat');
export const postClubChatMessage = (text: string) =>
  request<ClubChatMessage>('POST', '/club/chat', { text });

// Video library — upload happens in two steps: get a presigned S3 URL,
// PUT the raw file straight to S3 (bypasses API Gateway's payload size
// limit entirely), then create the metadata record. AI commentary (via
// AWS Bedrock, on frames extracted client-side) runs server-side after
// that, asynchronously — the frontend polls aiStatus until it flips
// from "pending" to "done"/"failed".
export const presignVideoUpload = (contentType: string) =>
  request<{ id: string; uploadUrl: string; s3Key: string }>('POST', '/videos/presign', { contentType });

export const uploadVideoFile = (uploadUrl: string, file: File, onProgress?: (pct: number) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed.')));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
    xhr.send(file);
  });

export const createVideoRecord = (input: { id: string; title: string; s3Key: string; tournamentId?: string; matchLabel?: string; frames: string[] }) =>
  request<VideoRecord>('POST', '/videos', input);

export const listVideos = () => request<{ items: VideoRecord[] }>('GET', '/videos');
export const getVideoPlayUrl = (id: string) => request<{ url: string }>('GET', `/videos/${id}/play-url`);
export const deleteVideo = (id: string) => request<{ ok: true }>('DELETE', `/videos/${id}`);

// Expense splitting — Splitwise-style, scoped to one tournament
export const dedupePlayerPool = (tournamentId: string) =>
  request<{ ok: true; playerPool: RosterPlayer[]; removedCount: number }>('POST', `/tournaments/${tournamentId}/player-pool/dedupe`);

export const listExpenses = (tournamentId: string) =>
  request<{ items: TournamentExpense[] }>('GET', `/tournaments/${tournamentId}/expenses`);
export const createExpense = (
  tournamentId: string,
  input: { description: string; category: ExpenseCategory; amount: number; paidBy: RosterPlayer; splitAmong: RosterPlayer[] }
) => request<TournamentExpense>('POST', `/tournaments/${tournamentId}/expenses`, input);
export const deleteExpense = (tournamentId: string, expenseId: string) =>
  request<{ ok: true }>('DELETE', `/tournaments/${tournamentId}/expenses/${expenseId}`);

// Club-wide expense splitting — not tied to any tournament
export const listClubExpenses = () => request<{ items: TournamentExpense[] }>('GET', '/club/expenses');
export const createClubExpense = (input: { description: string; category: ExpenseCategory; amount: number; paidBy: RosterPlayer; splitAmong: RosterPlayer[] }) =>
  request<TournamentExpense>('POST', '/club/expenses', input);
export const deleteClubExpense = (expenseId: string) =>
  request<{ ok: true }>('DELETE', `/club/expenses/${expenseId}`);

// Marketplace — used paddle listings, club-wide
export const listMarketplace = () => request<{ items: MarketplaceListing[] }>('GET', '/marketplace');
export const createMarketplaceListing = (input: { title: string; brand: string; condition: PaddleCondition; price: number; description: string; photoDataUrl?: string }) =>
  request<MarketplaceListing>('POST', '/marketplace', input);
export const updateMarketplaceListing = (id: string, input: { status?: 'available' | 'sold' }) =>
  request<MarketplaceListing>('PUT', `/marketplace/${id}`, input);
export const deleteMarketplaceListing = (id: string) =>
  request<{ ok: true }>('DELETE', `/marketplace/${id}`);

// In-app notifications
export const listNotifications = () =>
  request<{ items: AppNotification[]; unreadCount: number }>('GET', '/notifications');
export const markNotificationRead = (id: string) =>
  request<{ ok: true }>('PUT', `/notifications/${id}/read`);
export const markAllNotificationsRead = () =>
  request<{ ok: true; updated: number }>('PUT', '/notifications/read-all');

// Tournament check-in (QR code, day-of)
export const checkInToTournament = (tournamentId: string) =>
  request<{ ok: true; checkedInAt: string }>('POST', `/tournaments/${tournamentId}/checkin`);
export const updateTournamentWinners = (
  tournamentId: string,
  input: { first?: TournamentWinnerEntry; second?: TournamentWinnerEntry; third?: TournamentWinnerEntry }
) => request<{ ok: true; winners: Tournament['winners'] }>('PUT', `/tournaments/${tournamentId}/winners`, input);

// "Need a Sub" board
export const listSubRequests = () => request<{ items: SubRequest[] }>('GET', '/sub-requests');
export const createSubRequest = (input: { message: string; date?: string; tournamentId?: string }) =>
  request<SubRequest>('POST', '/sub-requests', input);
export const claimSubRequest = (id: string) => request<{ ok: true }>('POST', `/sub-requests/${id}/claim`);
export const deleteSubRequest = (id: string) => request<{ ok: true }>('DELETE', `/sub-requests/${id}`);

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
export const recordPlayoffMatch = (
  tournamentId: string,
  slot: 'semifinal1' | 'semifinal2' | 'championship' | 'thirdPlace',
  input: Partial<TournamentMatch> & { games: unknown[] }
) => request<{ ok: true; match: TournamentMatch }>('POST', `/tournaments/${tournamentId}/playoffs/${slot}/record`, input);
export const linkExistingPlayoffMatch = (
  tournamentId: string,
  slot: 'semifinal1' | 'semifinal2' | 'championship' | 'thirdPlace',
  matchId: string
) => request<{ ok: true }>('POST', `/tournaments/${tournamentId}/playoffs/${slot}/link-existing`, { matchId });
export const unlinkPlayoffMatch = (
  tournamentId: string,
  slot: 'semifinal1' | 'semifinal2' | 'championship' | 'thirdPlace',
  matchId: string
) => request<{ ok: true }>('POST', `/tournaments/${tournamentId}/playoffs/${slot}/unlink`, { matchId });
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

// Direct account lookup by email — the fallback for players who haven't
// played a recorded match yet, so their real photo/DUPR still show up.
export const getPlayerProfileByEmail = (email: string) =>
  request<PublicPlayerProfile>('GET', `/players/lookup?email=${encodeURIComponent(email)}`, undefined, { auth: false });
