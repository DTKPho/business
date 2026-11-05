import type { Car, Driver, Facility, GameState, Sponsor, StaffMember, StaffRole, Team } from '../model/types'
import { CAR_AREAS } from '../model/types'
import { DATA } from './data'
import { Rng, createRngState } from '../core/rng'
import { ensurePu } from '../car/car'
import { generateStaff } from '../people/generate'
import { generateBoardObjectives } from '../board/objectives'
import { recomputeStakes } from '../board/equity'
import { pushMessage } from '../inbox/messages'
import { generateSponsorObjectives } from '../finance/sponsors'
import { yearOf } from '../core/time'


export const SCHEMA_VERSION = 1

const AI_ROLES: StaffRole[] = ['technicalDirector', 'headOfAero', 'chiefDesigner', 'sportingDirector', 'raceEngineer', 'raceEngineer', 'headOfScouting']

export function createNewGame(opts: { seed?: string; saveName?: string } = {}): GameState {
  const seed = opts.seed && opts.seed.trim() ? opts.seed.trim() : Math.random().toString(36).slice(2, 10)
  const rngState = createRngState(seed)
  const rng = new Rng(rngState)
  const sc = DATA.scenario
  const season = yearOf(sc.startDate)

  const state: GameState = {
    meta: { schemaVersion: SCHEMA_VERSION, seed, rng: rngState, createdAt: new Date().toISOString(), saveName: opts.saveName ?? 'Carrière Genesis', idCounter: 0 },
    clock: { date: sc.startDate, season, phase: 'preseason' },
    player: { ...sc.player },
    playerTeamId: sc.playerTeamId,
    teams: {},
    drivers: {},
    staff: {},
    cars: {},
    powerUnits: Object.fromEntries(DATA.powerUnits.map((p) => [p.id, { ...p }])),
    hyundai: {
      ...sc.hyundaiProgram,
      spentEur: 0,
      progress: 0,
      milestones: sc.hyundaiProgram.milestones.map((m) => ({ ...m })),
    },
    circuits: Object.fromEntries(DATA.circuits.map((c) => [c.id, structuredClone(c)])),
    calendar: DATA.calendar.events.map((e) => ({ ...e, completed: false })),
    weekend: null,
    race: null,
    results: [],
    finances: {
      cashEur: sc.cashEur,
      eurPerUsd: DATA.config.eurPerUsd,
      ledger: [],
      costCap: { season, limitUsd: DATA.config.costCapUsd, spentUsd: 0 },
      seasonSummaries: [],
      extraDesignPoints: 0,
    },
    board: {
      satisfaction: { hyundai: 62, redbird: 60, arctos: 60 },
      objectives: [],
      valuationEur: sc.valuationEur,
      valuationHistory: [{ date: sc.startDate, valueEur: sc.valuationEur }],
      annualContributionEur: sc.hyundaiAnnualContributionEur,
    },
    equity: {
      stakes: { ...sc.equity.stakes },
      baseProportions: { hyundai: sc.equity.stakes.hyundai, redbird: sc.equity.stakes.redbird, arctos: sc.equity.stakes.arctos },
      hyundaiFloor: sc.equity.hyundaiFloor,
      purchased: { ...sc.equity.purchased },
      founder: { ...sc.equity.founder, vestedPct: 0 },
      sweat: sc.equity.sweat.map((s) => ({ ...s })),
      earnOuts: sc.equity.earnOuts.map((s) => ({ ...s })),
      leaver: 'active',
    },
    facilities: Object.fromEntries(DATA.facilities.map((f) => [f.id, structuredClone(f) as Facility])),
    sponsors: {},
    inbox: [],
    history: [],
  }

  // Écuries & voitures
  for (const t of DATA.teams) {
    const team: Team = {
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      colors: t.colors,
      base: t.base,
      isPlayer: t.id === sc.playerTeamId,
      reputation: t.reputation,
      budgetTier: t.budgetTier,
      aiProfile: t.aiProfile,
      pitCrew: { ...t.pitCrew, fatigue: 0, trainingFocus: 'speed' },
      puContracts: t.puContracts.map((p) => ({ ...p })),
      driverIds: [],
      reserveDriverId: null,
      lastConstructorPos: t.lastConstructorPos,
    }
    state.teams[t.id] = team
    const car: Car = {
      teamId: t.id,
      ratings: { ...t.car },
      projects: [],
      nextYearProgress: Object.fromEntries(CAR_AREAS.map((a) => [a, 0])) as Car['nextYearProgress'],
      pu: {},
      pendingGridPenalty: {},
    }
    state.cars[t.id] = car
  }

  // Pilotes
  for (const d of DATA.drivers) {
    const driver: Driver = {
      kind: 'driver',
      ...structuredClone(d),
      teamId: d.series === 'F1' ? d.teamId : null,
      morale: 70,
      season: { points: 0, wins: 0, podiums: 0 },
      scoutSeed: rng.int(1, 1e9),
    }
    if (driver.contract && !state.teams[driver.contract.teamId]) driver.contract = null
    state.drivers[d.id] = driver
    if (driver.teamId && state.teams[driver.teamId]) {
      const team = state.teams[driver.teamId]
      if (team.driverIds.length < 2) team.driverIds.push(driver.id)
      ensurePu(state.cars[driver.teamId], driver.id)
    }
  }

  // Staff réel
  for (const s of DATA.staff) {
    const team = s.teamId && state.teams[s.teamId] ? s.teamId : null
    const member: StaffMember = {
      kind: 'staff',
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      nationality: s.nationality,
      birthDate: s.birthDate,
      role: s.role,
      teamId: team,
      ratings: { ...s.ratings },
      mentality: { ambition: rng.int(55, 90), loyalty: rng.int(50, 90), temperament: rng.int(50, 90), teamPlayer: rng.int(55, 90) },
      morale: 72,
      contract: team
        ? { teamId: team, startSeason: season - 1, endSeason: s.contractEnd ?? season, salaryEur: s.salaryEur, inCostCap: s.role !== 'technicalDirector' }
        : null,
      assignedDriverId: s.assignedDriverId ?? null,
      scoutSeed: rng.int(1, 1e9),
    }
    state.staff[s.id] = member
  }

  // Compléter le staff des écuries IA avec des profils générés
  for (const team of Object.values(state.teams)) {
    if (team.isPlayer) continue
    const quality = 64 + team.budgetTier * 3.5
    const counts: Record<string, number> = {}
    for (const r of AI_ROLES) {
      counts[r] = (counts[r] ?? 0) + 1
      const have = Object.values(state.staff).filter((s) => s.teamId === team.id && s.role === r).length
      if (have < counts[r]) generateStaff(state, rng, r, team.id, quality, season)
    }
    // Affecter les ingénieurs de course libres aux pilotes sans ingénieur
    const engineers = Object.values(state.staff).filter((s) => s.teamId === team.id && s.role === 'raceEngineer')
    for (const d of team.driverIds) {
      if (!engineers.some((e) => e.assignedDriverId === d)) {
        const free = engineers.find((e) => !e.assignedDriverId || !team.driverIds.includes(e.assignedDriverId))
        if (free) free.assignedDriverId = d
      }
    }
  }

  // Vivier de staff libre supplémentaire (marché)
  const poolRoles: StaffRole[] = ['technicalDirector', 'headOfAero', 'chiefDesigner', 'sportingDirector', 'raceEngineer', 'raceEngineer', 'raceEngineer', 'headOfScouting', 'headOfScouting']
  for (const r of poolRoles) {
    for (let i = 0; i < 3; i++) generateStaff(state, rng, r, null, rng.range(58, 78), season)
  }

  // Sponsors
  for (const s of DATA.sponsors) {
    const sp: Sponsor = {
      id: s.id,
      name: s.name,
      sector: s.sector,
      tier: s.tier,
      annualEur: s.annualEur,
      startSeason: season,
      endSeason: season + 2,
      objectives: [],
      satisfaction: 70,
      status: s.house ? 'active' : 'available',
      minReputation: s.minReputation,
      house: s.house,
    }
    state.sponsors[s.id] = sp
  }
  for (const sp of Object.values(state.sponsors)) if (sp.status === 'active') sp.objectives = generateSponsorObjectives(state, sp, rng)

  recomputeStakes(state.equity)
  generateBoardObjectives(state)

  pushMessage(state, {
    category: 'board',
    title: 'Bienvenue à Brackley, Liam',
    body:
      `Genesis Magma F1 Team reprend la place de Haas sur la grille ${season}. ` +
      `Le campus de Brackley est opérationnel, mais l'écurie n'a encore ni pilotes ni encadrement technique.\n\n` +
      `Priorités de la pré-saison :\n• Recruter deux pilotes titulaires (marché des transferts)\n• Nommer un directeur technique, un responsable aéro, un chef du bureau d'études, un directeur sportif, deux ingénieurs de course et un responsable du scouting\n• Lancer les premiers projets de R&D\n\n` +
      `Trésorerie : 250 M€. Plafond de dépenses : 215 M$. Premier Grand Prix : Bahreïn, le 14 mars.`,
  })
  pushMessage(state, {
    category: 'car',
    title: 'Programme moteur Hyundai : lancement à Namyang',
    body: `Hyundai engage 400 M€ sur 3 ans pour développer son propre groupe propulseur, avec 120 ingénieurs à Namyang et 4 ingénieurs détachés chez Ferrari. Genesis roulera avec un moteur Ferrari client de 2027 à 2029, puis avec le moteur Hyundai à partir de 2030.`,
  })
  return state
}
