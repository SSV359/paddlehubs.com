/** Mirrors PLAYERS_TABLE item shape from GET/PUT /me */
export interface Me {
  clubId: string;
  userSub: string;
  email: string;
  displayName: string;
  duprId?: string;
  duprRating?: number | null;
  avatarDataUrl?: string;
  avatarColor?: string;
  gender?: 'male' | 'female' | '';
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
}

export type GameType = 'singles' | 'doubles';

/** Club-wide, informal match (GET/POST /matches, /club/matches) */
export interface ClubMatch {
  id: string;
  type: 'MATCH';
  ownerSub: string;
  ownerEmail: string;
  ownerDisplayName: string;
  date: string;
  court: string;
  gameType: GameType;
  matchup: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  notes: string;
  createdAt: string;
}

/** Court reservation (GET/POST /bookings, /club/bookings) */
export interface Booking {
  id: string;
  type: 'BOOKING';
  ownerSub: string;
  ownerEmail: string;
  ownerDisplayName: string;
  weekKey: string;
  date: string;
  time: string;
  court: string;
  duration: number;
  players: string;
  createdAt: string;
}

/**
 * A player's identity for roster/match purposes: email is now the unique
 * matching key (not name), so two "John Smith"s don't collide in
 * rankings. email is '' only for legacy/manually-typed entries added
 * before this migration, or walk-ins with no account — those fall back
 * to name-based matching wherever the backend can't do better.
 */
export interface RosterPlayer {
  name: string;
  email: string;
}

export interface TournamentTeam {
  id: string;
  name: string;
  players: RosterPlayer[];
  color: string;
  captain: string; // the captain's email (falls back to name for legacy entries with no email)
  logoDataUrl?: string;
  standingsOverride?: StandingsOverride | null;
}

export interface StandingsOverride {
  points?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  pointsFor?: number;
  pointsAgainst?: number;
}

export type TournamentFormat = 'standard' | 'mlp_singles';

export interface MlpScoring {
  regWin: number;
  dbWin: number;
  dbLoss: number;
  regLoss: number;
}

export interface AuctionCaptain {
  teamId: string;
  teamName: string;
  captainName: string;
  accessToken?: string; // only present for the caller's own captain record
}

export interface AuctionLevel {
  name: string;
  players: RosterPlayer[];
}

export interface AuctionPick {
  round: number;
  teamId: string;
  teamName: string;
  playerName: string;
  level: string;
  pickedAt: string;
}

export type AuctionStatus = 'setup' | 'card_draw' | 'drafting' | 'round_complete' | 'completed';

export interface Auction {
  status: AuctionStatus;
  format: 'mens_singles' | 'womens_singles' | 'mens_doubles' | 'womens_doubles' | 'mixed_doubles';
  levels: AuctionLevel[];
  captains: AuctionCaptain[];
  currentRound: number;
  cardDraws: Record<string, number>;
  currentRoundOrder: string[];
  currentPickerIndex: number;
  picks: AuctionPick[];
  draftedPlayers: string[];
  createdAt: string;
}

export interface PlayoffSlot {
  teamAId: string;
  teamBId: string;
  matchId: string;
}

export interface Playoffs {
  seeds: string[];
  semifinal1: PlayoffSlot;
  semifinal2: PlayoffSlot;
  championship: PlayoffSlot;
  thirdPlace: PlayoffSlot;
  generatedAt: string;
}

export interface ScheduleFixture {
  fixtureId: string; // stable identity for this fixture — chat threads and reminders key off this, not array position
  teamAId: string;
  teamBId: string;
  court: string;
  gameType: GameType;
  gamesPlayed: number;
  teamAPlayers: RosterPlayer[];
  teamBPlayers: RosterPlayer[];
  matchId: string;
}

export interface FixtureMessage {
  id: string;
  fixtureId: string;
  tournamentId: string;
  senderSub: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface ScheduleWeek {
  week: number;
  date: string;
  skipped: boolean;
  fixtures: ScheduleFixture[];
}

export interface TournamentSchedule {
  weeks: ScheduleWeek[];
  updatedAt: string | null;
}

export interface Tournament {
  id: string;
  type: 'TOURNAMENT';
  name: string;
  startDate: string;
  endDate: string;
  registrationStartDate: string;
  registrationEndDate: string;
  registrationLimit: number | null;
  logoDataUrl: string;
  status: 'ACTIVE' | string;
  format: TournamentFormat;
  mlpScoring: MlpScoring | null;
  ownerSub: string;
  ownerEmail: string;
  ownerDisplayName: string;
  createdAt: string;
  updatedAt: string;
  teamCount: number;
  playersPerTeam: number;
  teams: TournamentTeam[];
  playerPool?: RosterPlayer[];
  auction?: Auction;
  playoffs?: Playoffs;
}

/** Public, unauthenticated view of a tournament (GET /tournaments/{id}/public-info) */
export interface TournamentPublicInfo {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  registrationStartDate: string;
  registrationEndDate: string;
  registrationLimit: number | null;
  registrationCount: number;
  logoDataUrl: string;
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  paid: boolean;
  createdAt: string;
}

export interface GameScore {
  a: number;
  b: number;
  playerA?: RosterPlayer;
  playerB?: RosterPlayer;
}

export interface DreamBreaker {
  played: boolean;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string;
}

/** Match recorded within a specific tournament (as opposed to a ClubMatch) */
export interface TournamentMatch {
  id: string;
  type: 'TMATCH';
  tournamentId: string;
  date: string;
  court: string;
  gameType: GameType;
  teamAId: string;
  teamBId: string;
  gamesPlayed: number;
  games: GameScore[];
  scoreA: number;
  scoreB: number;
  gamesWonA: number;
  gamesWonB: number;
  teamAPlayers: RosterPlayer[];
  teamBPlayers: RosterPlayer[];
  winnerTeamId: string;
  matchup: string;
  winner: string;
  dreamBreaker: DreamBreaker | null;
  notes: string;
  ownerSub: string;
  ownerEmail: string;
  ownerDisplayName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TeamStandingRow {
  teamId: string;
  teamName: string;
  players: RosterPlayer[];
  captain: string; // captain's email (or name, for legacy entries with no email)
  color: string;
  logoDataUrl?: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  played: number;
  pointsFor: number;
  pointsAgainst: number;
  overridden?: boolean;
  rank: number;
  playerGenders?: Record<string, string>;
}

export interface PlayerRankingRow {
  player: string; // display name
  email: string; // the real identity key — use this to match/link, not player
  points: number;
  wins: number;
  losses: number;
  ties: number;
  played: number;
  streak: number;
  duprId?: string;
  duprRating?: number | null;
  online?: boolean;
  avatarDataUrl?: string;
  avatarColor?: string;
  gender?: string;
  rank: number;
  rankChange: number | null;
}

export interface RegisteredUser {
  username: string;
  sub: string;
  email: string;
  emailVerified: boolean;
  status: string;
  enabled: boolean;
  createdAt: string;
  lastModifiedAt: string;
  isAdmin: boolean;
  displayName: string;
  lastActiveAt: string;
  online: boolean;
}

export interface SiteAnalytics {
  rangeDays: number;
  totalViews: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number }[];
  daily: { date: string; views: number }[];
}
