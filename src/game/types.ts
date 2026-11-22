// ─────────────────────────────────────────────────────────────
// Modèle de données central du jeu « Paddock — Carrière F1 »
// ─────────────────────────────────────────────────────────────

export type TeamId =
  | 'mclaren'
  | 'ferrari'
  | 'redbull'
  | 'mercedes'
  | 'astonmartin'
  | 'alpine'
  | 'williams'
  | 'racingbulls'
  | 'haas'
  | 'audi'
  | 'cadillac';

export const PLAYER_ID = 'player';

/** Attributs de pilotage (0-100). */
export interface DriverStats {
  pace: number; // vitesse pure sur un tour
  racecraft: number; // intelligence de course, gestion des duels
  overtaking: number;
  defending: number;
  consistency: number; // régularité, peu d'erreurs
  tyreManagement: number;
  wet: number; // pilotage sous la pluie
  starts: number; // départs
  feedback: number; // retour technique aux ingénieurs (réglages, développement)
  fitness: number; // condition physique
  mental: number; // résistance à la pression
}

export type StatKey = keyof DriverStats;

export interface Contract {
  teamId: TeamId;
  salary: number; // € par saison
  endSeason: number; // dernière saison couverte
  status: 'first' | 'equal' | 'second';
  winBonus: number; // € par victoire
  podiumBonus: number;
  pointBonus: number; // € par point
  titleBonus: number;
  releaseClause: number | null; // position au championnat en dessous de laquelle on peut partir
}

export interface Relationship {
  friendship: number; // -100..100
  respect: number; // 0..100
  rivalry: number; // 0..100 (tension sportive)
}

/** Pilote (IA) dans la grille. */
export interface DriverState {
  id: string;
  teamId: TeamId | null; // null = sans volant
  stats: DriverStats;
  form: number; // -10..10 forme du moment
  morale: number; // 0..100
  contract: Contract | null;
  retired: boolean;
  rel: Relationship; // relation avec le joueur
  lastMessageDay: number;
  unread: number;
}

export interface CarState {
  aero: number;
  power: number; // unité de puissance
  chassis: number; // mécanique/traction
  reliability: number;
  devPoints: number; // points de développement accumulés
}

export interface TeamState {
  id: TeamId;
  car: CarState;
  trust: number; // confiance de l'équipe envers le joueur (si joueur dans l'équipe)
  devFocus: 'aero' | 'power' | 'chassis' | 'reliability' | 'balanced';
  budget: number; // M€
  morale: number;
}

export type TyreCompound = 'S' | 'M' | 'H' | 'I' | 'W';

export type Background = 'f2champ' | 'f2runner' | 'superformula' | 'indycar' | 'rich';

export interface StaffMember {
  id: string;
  role: StaffRole;
  name: string;
  level: number; // 1..5
  salary: number; // par saison
}

export type StaffRole = 'manager' | 'trainer' | 'physio' | 'pr' | 'coach' | 'chef' | 'pilot';

export interface PersonalSponsor {
  id: string;
  brandId: string;
  perSeason: number;
  endSeason: number;
  obligations: number; // événements/posts requis par saison
  done: number;
}

export interface Player {
  firstName: string;
  lastName: string;
  code: string; // trigramme
  nationality: string; // code pays
  number: number;
  birthYear: number;
  photo: string | null; // dataURL ou URL perso
  helmet: { primary: string; secondary: string };
  background: Background;
  stats: DriverStats;
  xp: Partial<Record<StatKey, number>>; // progression fractionnaire
  morale: number; // 0..100
  energy: number; // 0..100
  stress: number; // 0..100
  followers: number;
  image: { likeability: number; professionalism: number; controversy: number }; // 0..100
  money: number;
  residence: ResidenceId;
  contract: Contract | null;
  staff: StaffMember[];
  assets: OwnedAsset[];
  sponsors: PersonalSponsor[];
  penaltyPoints: { points: number; season: number; race: number }[];
  career: CareerStats;
  seasonHistory: SeasonSummary[];
  partner: { name: string; affection: number } | null;
  foundation: { name: string; funds: number } | null;
  businesses: OwnedBusiness[];
  investments: Investment[];
  achievements: string[];
}

export interface OwnedBusiness {
  id: string;
  level: number;
  boughtDay: number;
}

export interface Investment {
  id: string;
  amount: number;
  value: number;
}

export interface CareerStats {
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  fastestLaps: number;
  dnfs: number;
  titles: number;
  sprintWins: number;
}

export interface SeasonSummary {
  season: number;
  teamId: TeamId;
  position: number;
  points: number;
  wins: number;
  podiums: number;
  champion: string;
  constructorsChampion: TeamId;
}

export type ResidenceId = 'monaco' | 'uk' | 'france' | 'switzerland' | 'dubai' | 'spain' | 'italy' | 'usa' | 'netherlands';

export interface OwnedAsset {
  id: string; // id du catalogue
  boughtDay: number;
  price: number;
}

// ───────────────────── Week-end ─────────────────────

export type SessionKind = 'media' | 'fp' | 'sprintQuali' | 'sprint' | 'quali' | 'race' | 'post';

export interface SetupValues {
  frontWing: number;
  rearWing: number;
  suspension: number;
  rideHeight: number;
  brakeBias: number;
}

export interface PracticeRun {
  setup: SetupValues;
  program: 'quali' | 'long' | 'aero';
  lapTime: number;
  feedback: string[];
  quality: number;
}

export interface QualiEntry {
  driverId: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  position: number;
}

export interface RaceCar {
  driverId: string;
  teamId: TeamId;
  pos: number;
  totalTime: number;
  lastLap: number;
  bestLap: number;
  tyre: TyreCompound;
  tyreAge: number;
  tyreWear: number; // 0..100
  usedCompounds: TyreCompound[];
  pits: number;
  plannedStops: number[]; // tours d'arrêt prévus (IA)
  plannedCompounds: TyreCompound[];
  dnf: string | null;
  penalties: number; // secondes
  battery: number; // 0..100 énergie électrique (Overtake mode)
  pace: number; // pace de base (s par tour)
  gapAhead: number;
  status: 'run' | 'pit' | 'out';
  damage: number; // 0..1 perte de performance
  lapsLed: number;
  startPos: number;
  positionsGained: number;
}

export type PaceMode = 'save' | 'normal' | 'push' | 'attack';

export interface RaceEvent {
  lap: number;
  kind: 'overtake' | 'pit' | 'dnf' | 'sc' | 'vsc' | 'scEnd' | 'rain' | 'penalty' | 'radio' | 'fastest' | 'incident' | 'info' | 'flag';
  text: string;
  involvesPlayer?: boolean;
}

export interface RaceState {
  kind: 'race' | 'sprint';
  lap: number;
  totalLaps: number;
  cars: RaceCar[];
  events: RaceEvent[];
  safetyCar: 'none' | 'sc' | 'vsc';
  scLaps: number;
  weather: { rain: number; trend: number; trackTemp: number; target?: number; pendingLap?: number; pendingTarget?: number }; // rain 0..1, trend = vitesse d'évolution
  playerMode: PaceMode;
  playerBoost: boolean;
  pendingPit: TyreCompound | null;
  teamOrder: { kind: 'letBy' | 'holdPosition' | 'swapBack'; target: string; lap: number; answered: boolean; accepted?: boolean } | null;
  finished: boolean;
  fastestLap: { driverId: string; time: number } | null;
  radio: string[];
  collisions: { a: string; b: string; lap: number; blame: string }[];
}

export interface RaceResultEntry {
  driverId: string;
  teamId: TeamId;
  position: number; // 0 si DNF
  grid: number;
  points: number;
  dnf: string | null;
  fastestLap: boolean;
  time: number;
  gap: string;
  pits: number;
}

export interface WeekendResult {
  season: number;
  round: number;
  raceId: string;
  quali: QualiEntry[];
  sprint: RaceResultEntry[] | null;
  race: RaceResultEntry[];
  playerRating: number; // note /10
}

export interface WeekendState {
  raceId: string;
  round: number;
  stage: SessionKind;
  stageIndex: number;
  stages: SessionKind[];
  setup: SetupValues;
  optimal: SetupValues; // caché
  runs: PracticeRun[];
  runsLeft: number;
  setupConfidence: number; // 0..1
  quali: QualiEntry[] | null;
  sprintQuali: QualiEntry[] | null;
  sprintResult: RaceResultEntry[] | null;
  race: RaceState | null;
  raceResult: RaceResultEntry[] | null;
  weatherForecast: number[]; // proba de pluie par session
  interviewsDone: string[];
  strategyPlan: TyreCompound[];
  notes: string[];
  rain: { fp: number; quali: number; sprint: number; race: number };
  teamOrderAnswer: 'accepted' | 'refused' | null;
  collisions: { a: string; b: string; lap: number; blame: string }[];
  pitlaneStart: boolean;
}

// ───────────────────── Social ─────────────────────

export interface ChatMessage {
  id: string;
  from: string; // driverId, 'player', 'tp:<teamId>', ...
  text: string;
  day: number;
  reactions?: Record<string, string>;
  pending?: boolean;
}

export interface Conversation {
  id: string; // driverId ou contact id
  messages: ChatMessage[];
  unread: number;
}

export interface SocialPost {
  id: string;
  author: string; // driverId | 'player' | team id | outlet
  text: string;
  kind: 'race' | 'lifestyle' | 'sponsor' | 'fans' | 'statement' | 'training' | 'meme';
  day: number;
  likes: number;
  comments: { author: string; text: string }[];
  image?: string; // emoji scène
  likedByPlayer?: boolean;
}

export interface NewsItem {
  id: string;
  day: number;
  outlet: string;
  title: string;
  body: string;
  tag: 'race' | 'transfer' | 'player' | 'paddock' | 'interview' | 'business' | 'rumour';
}

export interface MailItem {
  id: string;
  day: number;
  from: string;
  subject: string;
  body: string;
  read: boolean;
  action?: MailAction;
  resolved?: boolean;
}

export type MailAction =
  | { kind: 'sponsorOffer'; brandId: string; perSeason: number; seasons: number; obligations: number }
  | { kind: 'contractOffer'; offerId: string }
  | { kind: 'event'; eventId: string; reward: number }
  | { kind: 'info' };

export interface ContractOffer {
  id: string;
  teamId: TeamId;
  salary: number;
  years: number;
  status: Contract['status'];
  winBonus: number;
  podiumBonus: number;
  pointBonus: number;
  titleBonus: number;
  releaseClause: number | null;
  expiresDay: number;
  fromSeason: number;
  state: 'open' | 'negotiating' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';
  patience: number; // 0..100
  minSalary: number; // caché : plancher de l'équipe
  maxSalary: number; // caché : plafond de l'équipe
  rounds: number;
  history: { by: 'team' | 'player'; text: string }[];
}

export interface PendingInterview {
  id: string;
  context: 'thursday' | 'postQuali' | 'postRace' | 'feature' | 'tv' | 'podcast';
  outlet: string;
  journalist: string;
  questions: InterviewQuestion[];
  answers: string[];
  done: boolean;
  day: number;
}

export interface InterviewQuestion {
  text: string;
  topic: 'result' | 'teammate' | 'rival' | 'contract' | 'team' | 'personal' | 'controversy' | 'championship' | 'regulations' | 'fans' | 'future' | 'lifestyle';
  subject?: string; // driverId ou teamId concerné
}

export interface InterviewEffect {
  summary: string;
  headline: string;
  deltas: { label: string; value: number }[];
}

export interface CalendarDay {
  day: number;
  activityId: string | null;
}

export interface LogEntry {
  id: string;
  day: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'info';
}

export interface ClaudeSettings {
  enabled: boolean;
  apiKey: string;
  model: string;
}

export interface Settings {
  claude: ClaudeSettings;
  imageOverrides: Record<string, string>;
  simSpeed: number;
  difficulty: 'easy' | 'normal' | 'hard';
  driverLanguage: 'fr' | 'vo';
}

export type Screen =
  | 'home'
  | 'calendar'
  | 'weekend'
  | 'standings'
  | 'team'
  | 'career'
  | 'phone'
  | 'news'
  | 'finances'
  | 'lifestyle'
  | 'planner'
  | 'profile'
  | 'paddock'
  | 'settings';

export type PhoneApp = 'messages' | 'whatsapp' | 'insta' | 'mail';

export interface GameState {
  version: number;
  started: boolean;
  season: number;
  day: number; // jour absolu depuis le début de carrière
  date: string; // ISO de la date courante
  round: number; // index de la prochaine course (0-based) dans la saison
  phase: 'preseason' | 'season' | 'weekend' | 'offseason';
  player: Player;
  drivers: Record<string, DriverState>;
  teams: Record<TeamId, TeamState>;
  results: WeekendResult[]; // saison en cours
  allResults: WeekendResult[]; // historique
  weekend: WeekendState | null;
  conversations: Record<string, Conversation>;
  group: { messages: ChatMessage[]; unread: number; muted: boolean };
  feed: SocialPost[];
  news: NewsItem[];
  mail: MailItem[];
  offers: ContractOffer[];
  interviews: PendingInterview[];
  plannedDays: Record<string, string>; // date ISO -> activité
  actionsLeft: number; // actions disponibles avant le prochain GP
  log: LogEntry[];
  settings: Settings;
  teammateId: string | null;
  rookies: string[]; // ids des pilotes générés
  generatedDrivers: Record<string, GeneratedDriver>;
  seenEvents: string[];
  flags: Record<string, number | boolean | string>;
}

export interface GeneratedDriver {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  nationality: string;
  number: number;
  birthYear: number;
}
