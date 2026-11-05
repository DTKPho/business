// Accès typé aux fichiers JSON de src/data/ (modifiables librement).
import teamsJson from '../../data/teams.json'
import driversJson from '../../data/drivers.json'
import staffJson from '../../data/staff.json'
import circuitsJson from '../../data/circuits.json'
import calendarJson from '../../data/calendar-2027.json'
import puJson from '../../data/power-units.json'
import sponsorsJson from '../../data/sponsors.json'
import facilitiesJson from '../../data/facilities.json'
import boardJson from '../../data/board-objectives.json'
import rndJson from '../../data/rnd-templates.json'
import namesJson from '../../data/names.json'
import eventsJson from '../../data/events/random-events.json'
import configJson from '../../data/config.json'
import scenarioJson from '../../data/scenario.json'
import type {
  CarArea,
  Circuit,
  ConditionKind,
  DriverRatings,
  Effect,
  Facility,
  InboxCategory,
  Mentality,
  PowerUnitSupplier,
  PuType,
  ShareholderId,
  StaffRole,
  SweatId,
} from '../model/types'

export interface TeamData {
  id: string
  name: string
  shortName: string
  colors: { primary: string; secondary: string }
  base: string
  isPlayer: boolean
  reputation: number
  budgetTier: number
  aiProfile: 'aggressive' | 'balanced' | 'conservative'
  puContracts: { supplierId: string; from: number; to: number }[]
  car: Record<CarArea, number>
  pitCrew: { speed: number; consistency: number }
  lastConstructorPos: number
}

export interface DriverData {
  id: string
  firstName: string
  lastName: string
  nationality: string
  birthDate: string
  series: 'F1' | 'F2' | 'F3' | 'FA'
  teamId: string | null
  juniorTeam?: string
  affiliation?: string
  ratings: DriverRatings
  potential: number
  mentality: Mentality
  contract: { teamId: string; startSeason: number; endSeason: number; salaryEur: number; role: 'first' | 'second' | 'reserve'; inCostCap: boolean } | null
  career: { starts: number; wins: number; podiums: number; poles: number; points: number; titles: number; dnfs: number }
}

export interface StaffData {
  id: string
  firstName: string
  lastName: string
  nationality: string
  birthDate: string
  role: StaffRole
  teamId: string | null
  ratings: Record<string, number>
  salaryEur: number
  contractEnd: number | null
  assignedDriverId?: string
}

export interface CalendarData {
  season: number
  testing: string
  events: { round: number; circuitId: string; date: string; sprint: boolean; dateEstimated?: boolean }[]
}

export interface SponsorData {
  id: string
  name: string
  sector: string
  tier: 'title' | 'major' | 'partner'
  annualEur: number
  minReputation: number
  house?: boolean
}

export interface BoardTemplate {
  id: string
  by: ShareholderId
  kind: ConditionKind
  op: '<=' | '>='
  value: number | string
  weight: number
  description: string
}

export interface RndTemplate {
  id: string
  area: CarArea
  name: string
  dp: number
  designCostEur: number
  unitCostEur: number
  units: number
  gain: number
  productionWeeks: number
}

export interface EventTemplate {
  id: string
  category: InboxCategory
  weight: number
  title: string
  body: string
  choices: { id: string; label: string; effects: Effect[] }[]
}

export interface GameConfig {
  eurPerUsd: number
  costCapUsd: number
  costCapMinorBreachPct: number
  pointsRace: number[]
  pointsSprint: number[]
  fomPrizeUsdByPosition: number[]
  baseWorkforceWeeklyEur: number
  raceLogisticsEur: number
  windTunnelRentalWeeklyEur: number
  puAllocation: Record<PuType, number>
  puWearPerRace: Record<PuType, number>
  atrWindTunnelByPosition: number[]
  designPointsBase: number
}

export interface ScenarioData {
  startDate: string
  player: { firstName: string; lastName: string; birthDate: string; title: string; reputation: number; boardTrust: number }
  playerTeamId: string
  cashEur: number
  valuationEur: number
  hyundaiAnnualContributionEur: number
  equity: {
    stakes: Record<'hyundai' | 'redbird' | 'arctos' | 'liam', number>
    hyundaiFloor: number
    purchased: { pct: number; paidEur: number }
    founder: { pct: number; vestingStart: string; cliffMonths: number; durationMonths: number }
    sweat: { id: SweatId; label: string; pct: number }[]
    earnOuts: { thresholdEur: number; pct: number }[]
  }
  hyundaiProgram: {
    startSeason: number
    debutSeason: number
    budgetEur: number
    engineers: number
    secondedAtFerrari: number
    milestones: { id: string; label: string; at: number }[]
  }
}

export const DATA = {
  teams: teamsJson as TeamData[],
  drivers: driversJson as DriverData[],
  staff: staffJson as unknown as StaffData[],
  circuits: circuitsJson as Circuit[],
  calendar: calendarJson as CalendarData,
  powerUnits: puJson as PowerUnitSupplier[],
  sponsors: sponsorsJson as SponsorData[],
  facilities: facilitiesJson as Facility[],
  boardTemplates: boardJson as BoardTemplate[],
  rndTemplates: rndJson as RndTemplate[],
  names: namesJson as { first: string[]; last: string[]; nat: string[] },
  events: eventsJson as EventTemplate[],
  config: configJson as GameConfig,
  scenario: scenarioJson as ScenarioData,
}

export const CONFIG = DATA.config
