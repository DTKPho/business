// Modèle de données complet de Genesis Magma F1 Team.
// Tout l'état d'une carrière tient dans `GameState`, sérialisable en JSON.

export type TeamId = string
export type PersonId = string
export type CircuitId = string
export type SponsorId = string
export type ShareholderId = 'hyundai' | 'redbird' | 'arctos'
export type HolderId = ShareholderId | 'liam'

export interface RngState {
  a: number
  b: number
  c: number
  d: number
}

export type SeasonPhase = 'preseason' | 'season' | 'raceWeekend' | 'postseason'

// ---------------------------------------------------------------- Personnes

export type Series = 'F1' | 'F2' | 'F3' | 'FA'

export interface Mentality {
  ambition: number // 0–100
  loyalty: number
  temperament: number // haut = calme
  teamPlayer: number
}

export interface Contract {
  teamId: TeamId
  startSeason: number
  endSeason: number
  salaryEur: number
  role?: 'first' | 'second' | 'reserve'
  bonusPerPointEur?: number
  bonusPerWinEur?: number
  releaseClauseEur?: number
  inCostCap: boolean
}

export interface DriverRatings {
  pace: number
  qualifying: number
  racecraft: number
  consistency: number
  tyreManagement: number
  wet: number
  feedback: number
  experience: number
}

export interface CareerStats {
  starts: number
  wins: number
  podiums: number
  poles: number
  points: number
  titles: number
  dnfs: number
}

export interface Driver {
  kind: 'driver'
  id: PersonId
  firstName: string
  lastName: string
  nationality: string
  birthDate: string
  series: Series
  teamId: TeamId | null
  juniorTeam?: string // équipe F2/F3
  leavingTo?: TeamId // a signé ailleurs pour la saison suivante
  affiliation?: string // programme junior (ferrari, redbull, …)
  ratings: DriverRatings
  potential: number
  mentality: Mentality
  morale: number
  contract: Contract | null
  career: CareerStats
  season: { points: number; wins: number; podiums: number; feederPos?: number }
  scoutSeed: number
  retired?: boolean
  generated?: boolean
}

export type StaffRole =
  | 'technicalDirector'
  | 'headOfAero'
  | 'chiefDesigner'
  | 'sportingDirector'
  | 'raceEngineer'
  | 'headOfScouting'

export interface StaffMember {
  kind: 'staff'
  id: PersonId
  firstName: string
  lastName: string
  nationality: string
  birthDate: string
  role: StaffRole
  teamId: TeamId | null
  ratings: Record<string, number>
  mentality: Mentality
  morale: number
  contract: Contract | null
  assignedDriverId?: PersonId | null
  generated?: boolean
  scoutSeed: number
  retired?: boolean
}

export type Person = Driver | StaffMember

// ---------------------------------------------------------------- Écuries

export interface PitCrew {
  speed: number
  consistency: number
  fatigue: number
  trainingFocus: 'speed' | 'consistency' | 'rest'
}

export interface Team {
  id: TeamId
  name: string
  shortName: string
  colors: { primary: string; secondary: string }
  base: string
  isPlayer: boolean
  reputation: number
  budgetTier: number // 1 (petit) – 5 (top)
  aiProfile: 'aggressive' | 'balanced' | 'conservative'
  pitCrew: PitCrew
  puContracts: { supplierId: string; from: number; to: number }[]
  driverIds: PersonId[] // titulaires (2 max)
  reserveDriverId?: PersonId | null
  lastConstructorPos: number
}

// ---------------------------------------------------------------- Voiture

export type CarArea = 'aero' | 'chassis' | 'powertrain' | 'reliability'
export const CAR_AREAS: CarArea[] = ['aero', 'chassis', 'powertrain', 'reliability']

export type Ambition = 'conservative' | 'standard' | 'aggressive'

export interface RnDProject {
  id: string
  area: CarArea
  templateId: string
  name: string
  ambition: Ambition
  nextYear: boolean
  dpRequired: number
  dpDone: number
  designCostEur: number
  unitCostEur: number
  units: number
  productionWeeks: number
  productionWeeksLeft: number
  expectedGain: number
  variance: number
  failureRisk: number
  reliabilityImpact: number
  status: 'design' | 'production' | 'done' | 'failed'
  result?: number
  startedAt: string
}

export type PuType = 'ICE' | 'TC' | 'MGUK' | 'ES' | 'CE' | 'EX'
export const PU_TYPES: PuType[] = ['ICE', 'TC', 'MGUK', 'ES', 'CE', 'EX']

export interface PuUnitState {
  used: number // unités utilisées cette saison
  health: number // santé de l'unité montée (0–100)
}

export interface Car {
  teamId: TeamId
  ratings: Record<CarArea, number>
  projects: RnDProject[]
  nextYearProgress: Record<CarArea, number>
  pu: Record<PersonId, Record<PuType, PuUnitState>>
  pendingGridPenalty: Record<PersonId, number>
}

export interface PowerUnitSupplier {
  id: string
  name: string
  power: number
  reliability: number
  driveability: number
  devRate: number
  customerFeeEur: number
}

export interface HyundaiProgram {
  startSeason: number
  debutSeason: number
  budgetEur: number
  spentEur: number
  progress: number // 0–100
  engineers: number
  secondedAtFerrari: number
  milestones: { id: string; label: string; at: number; reached?: string }[]
}

// ---------------------------------------------------------------- Circuits

export interface Circuit {
  id: CircuitId
  name: string
  gpName: string
  country: string
  city: string
  lengthKm: number
  laps: number
  baseLapSec: number
  traits: {
    downforce: number // 0–1
    powerSensitivity: number // 0–1
    tyreWear: number // 0–1
    overtaking: number // 0–1 (1 = facile)
    safetyCarProb: number // 0–1 par course
    pitLossSec: number
  }
  rainChance: number // 0–1
}

export interface CalendarEvent {
  round: number
  circuitId: CircuitId
  date: string // dimanche de course
  sprint: boolean
  completed: boolean
  dateEstimated?: boolean
}

// ---------------------------------------------------------------- Week-end & course

export type SessionId = 'FP1' | 'FP2' | 'FP3' | 'SQ' | 'SPRINT' | 'Q' | 'RACE'
export type PracticeProgram = 'setup' | 'tyres' | 'raceSim'
export type Compound = 'S' | 'M' | 'H' | 'I' | 'W'

export interface ResultRow {
  driverId: PersonId
  teamId: TeamId
  position: number
  time?: number
  gap?: number
  laps?: number
  status?: 'finished' | 'dnf' | 'dns'
  dnfReason?: string
  points?: number
  knockedOutIn?: 1 | 2 | 3
}

export interface SessionResult {
  session: SessionId
  rows: ResultRow[]
  notes: string[]
}

export interface WeekendState {
  round: number
  sessions: SessionId[]
  sessionIndex: number
  practiceProgram: Record<PersonId, PracticeProgram>
  setupConfidence: Record<PersonId, number>
  tyreKnowledge: Record<PersonId, number>
  results: Partial<Record<SessionId, SessionResult>>
  weatherBias: number // humidité du week-end (0–1)
  form: Record<string, number> // forme du week-end (s/tour) par écurie et par pilote
}

export type PaceMode = 'push' | 'standard' | 'conserve'
export type EngineMode = 'high' | 'standard' | 'low'
export type ErsMode = 'attack' | 'balanced' | 'harvest'
export type TeamOrder = 'free' | 'hold' | 'letPass'

export interface RaceCar {
  driverId: PersonId
  teamId: TeamId
  position: number
  startPos: number
  totalTime: number
  lastLap: number
  bestLap: number
  gapToLeader: number
  interval: number
  lapsCompleted: number
  tyre: { compound: Compound; age: number; wear: number }
  tyresUsed: Compound[]
  fuel: number
  pace: PaceMode
  engineMode: EngineMode
  ersMode: ErsMode
  ersCharge: number
  damage: number
  status: 'running' | 'dnf' | 'finished'
  dnfReason?: string
  pitStops: number
  pitRequest: Compound | null
  teamOrder: TeamOrder
  penaltySec: number
  autoStrategy: boolean
  plannedStops: number[] // tours prévus pour s'arrêter
}

export interface RaceLogEntry {
  lap: number
  type: 'info' | 'pit' | 'overtake' | 'incident' | 'sc' | 'weather' | 'dnf' | 'order'
  text: string
  teamId?: TeamId
}

export interface RaceState {
  kind: 'race' | 'sprint'
  round: number
  circuitId: CircuitId
  lap: number
  totalLaps: number
  weather: { wetness: number; rain: number; trend: number }
  neutral: { mode: 'none' | 'vsc' | 'sc'; lapsLeft: number }
  cars: RaceCar[]
  log: RaceLogEntry[]
  finished: boolean
  fastestLap: { driverId: PersonId; time: number } | null
}

export interface RoundResults {
  round: number
  circuitId: CircuitId
  sprint?: ResultRow[]
  race: ResultRow[]
  pole?: PersonId
}

// ---------------------------------------------------------------- Finances

export type TxCategory =
  | 'salary'
  | 'rnd'
  | 'production'
  | 'facility'
  | 'facilityUpgrade'
  | 'sponsor'
  | 'prize'
  | 'engine'
  | 'windTunnel'
  | 'transfer'
  | 'operations'
  | 'shareholder'
  | 'fine'
  | 'event'

export interface Transaction {
  date: string
  amountEur: number
  category: TxCategory
  inCostCap: boolean
  label: string
}

export interface Finances {
  cashEur: number
  eurPerUsd: number
  ledger: Transaction[]
  costCap: { season: number; limitUsd: number; spentUsd: number }
  seasonSummaries: {
    season: number
    incomeEur: number
    expenseEur: number
    capSpentUsd: number
    capLimitUsd: number
    breach: 'none' | 'minor' | 'major'
  }[]
  sanction?: { season: number; dpFactor: number }
  extraDesignPoints: number
}

export type ConditionKind =
  | 'constructorPosition'
  | 'bestRaceResult'
  | 'pointsTotal'
  | 'podiums'
  | 'wins'
  | 'pointsFinishes'
  | 'valuation'
  | 'cashAbove'
  | 'costCapRespected'
  | 'sponsorIncome'
  | 'hyundaiProgress'

export interface Condition {
  kind: ConditionKind
  op: '<=' | '>='
  value: number
}

export interface SponsorObjective {
  description: string
  condition: Condition
  bonusEur: number
  met?: boolean
}

export interface Sponsor {
  id: SponsorId
  name: string
  sector: string
  tier: 'title' | 'major' | 'partner'
  annualEur: number
  startSeason: number
  endSeason: number
  objectives: SponsorObjective[]
  satisfaction: number
  status: 'available' | 'offer' | 'active' | 'expired'
  minReputation: number
  house?: boolean
}

// ---------------------------------------------------------------- Conseil & parts

export interface BoardObjective {
  id: string
  by: ShareholderId
  description: string
  condition: Condition
  weight: number
  status: 'pending' | 'met' | 'failed'
}

export interface Board {
  satisfaction: Record<ShareholderId, number>
  objectives: BoardObjective[]
  valuationEur: number
  valuationHistory: { date: string; valueEur: number }[]
  annualContributionEur: number
}

export type SweatId = 'firstPodium' | 'top5Constructors' | 'firstWin' | 'top3Constructors'

export interface Equity {
  stakes: Record<HolderId, number>
  baseProportions: Record<ShareholderId, number>
  hyundaiFloor: number
  purchased: { pct: number; paidEur: number }
  founder: { pct: number; vestingStart: string; cliffMonths: number; durationMonths: number; vestedPct: number }
  sweat: { id: SweatId; label: string; pct: number; unlockedAt?: string }[]
  earnOuts: { thresholdEur: number; pct: number; unlockedAt?: string }[]
  leaver: 'active' | 'goodLeaver' | 'badLeaver'
}

// ---------------------------------------------------------------- Installations

export type FacilityBranch = 'carDevelopment' | 'staff' | 'operations'

export interface Facility {
  id: string
  branch: FacilityBranch
  name: string
  description: string
  level: number
  maxLevel: number
  levels: { monthlyCostEur: number; upgradeCostEur: number; weeks: number }[]
  effects: { key: string; perLevel: number; base?: number }[]
  upgrade?: { toLevel: number; weeksLeft: number }
}

// ---------------------------------------------------------------- Boîte de réception

export type EffectKind =
  | 'cash'
  | 'reputation'
  | 'morale'
  | 'teamMorale'
  | 'boardSatisfaction'
  | 'boardTrust'
  | 'sponsorSatisfaction'
  | 'acceptSponsor'
  | 'rejectSponsor'
  | 'salaryRaise'
  | 'releaseStaff'
  | 'designPoints'
  | 'reliability'
  | 'pitCrew'
  | 'poachGamble'
  | 'investHyundai'
  | 'none'

export interface Effect {
  kind: EffectKind
  value: number
  target?: string
  inCostCap?: boolean
}

export type InboxCategory =
  | 'board'
  | 'sponsor'
  | 'staff'
  | 'driver'
  | 'rumour'
  | 'crisis'
  | 'race'
  | 'finance'
  | 'car'
  | 'facility'

export interface InboxMessage {
  id: string
  date: string
  category: InboxCategory
  title: string
  body: string
  read: boolean
  choices?: { id: string; label: string; effects: Effect[] }[]
  resolvedChoiceId?: string
  expiresAt?: string
}

// ---------------------------------------------------------------- Racine

export interface PlayerProfile {
  firstName: string
  lastName: string
  birthDate: string
  title: string
  reputation: number
  boardTrust: number
}

export interface SeasonArchive {
  season: number
  driverStandings: { driverId: PersonId; teamId: TeamId; points: number; name: string }[]
  constructorStandings: { teamId: TeamId; points: number; name: string }[]
  genesisPosition: number
  genesisPoints: number
  valuationEur: number
  liamStake: number
}

export interface GameState {
  meta: {
    schemaVersion: number
    seed: string
    rng: RngState
    createdAt: string
    saveName: string
    idCounter: number
  }
  clock: { date: string; season: number; phase: SeasonPhase }
  player: PlayerProfile
  playerTeamId: TeamId
  teams: Record<TeamId, Team>
  drivers: Record<PersonId, Driver>
  staff: Record<PersonId, StaffMember>
  cars: Record<TeamId, Car>
  powerUnits: Record<string, PowerUnitSupplier>
  hyundai: HyundaiProgram
  circuits: Record<CircuitId, Circuit>
  calendar: CalendarEvent[]
  weekend: WeekendState | null
  race: RaceState | null
  results: RoundResults[]
  finances: Finances
  board: Board
  equity: Equity
  facilities: Record<string, Facility>
  sponsors: Record<SponsorId, Sponsor>
  inbox: InboxMessage[]
  history: SeasonArchive[]
}
