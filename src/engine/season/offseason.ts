import type { GameState } from '../model/types'
import { CAR_AREAS, PU_TYPES } from '../model/types'
import { Rng } from '../core/rng'
import { constructorStandings, driverStandings } from './standings'
import { activeSponsors, makeSponsorOffer } from '../finance/sponsors'
import { addTx } from '../finance/ledger'
import { costCapVerdict } from '../finance/weekly'
import { evaluateBoard, generateBoardObjectives } from '../board/objectives'
import { conditionMet } from '../board/conditions'
import { checkEquity } from '../board/equity'
import { monthlyValuation } from '../board/valuation'
import { pushMessage } from '../inbox/messages'
import { seasonEndContracts, fillVacancies } from '../ai/aiTeams'
import { seasonEndPeople } from '../people/aging'
import { fullName } from '../people/ratings'
import { DATA } from '../init/data'
import { ageAt, shiftYearsSameWeekday } from '../core/time'
import { fmtEur } from '../core/money'
import { clamp } from '../core/money'
import { ensurePu } from '../car/car'

/** Après la dernière course : classements, bilans, objectifs, plafond, parts de Liam. */
export function endSeason(state: GameState): void {
  const rng = new Rng(state.meta.rng)
  const season = state.clock.season
  const cs = constructorStandings(state)
  const ds = driverStandings(state)
  const myPos = cs.find((c) => c.teamId === state.playerTeamId)!.position
  const notes: string[] = []
  // Titres
  if (ds[0]) {
    state.drivers[ds[0].driverId].career.titles += 1
    notes.push(`Champion du monde ${season} : ${fullName(state.drivers[ds[0].driverId])} (${ds[0].points} pts).`)
  }
  notes.push(`Champion constructeurs : ${state.teams[cs[0].teamId].name} (${cs[0].points} pts).`)
  notes.push(`Genesis termine ${myPos}e avec ${cs.find((c) => c.teamId === state.playerTeamId)!.points} points.`)
  // Réputation de fin de saison
  for (const c of cs) {
    const t = state.teams[c.teamId]
    t.reputation = clamp(t.reputation + (t.lastConstructorPos - c.position) * 1.5, 5, 100)
    t.lastConstructorPos = c.position
  }
  // Sponsors : objectifs
  for (const s of activeSponsors(state)) {
    for (const o of s.objectives) {
      o.met = conditionMet(state, o.condition)
      if (o.met) {
        addTx(state, o.bonusEur, 'sponsor', `Bonus ${s.name} : ${o.description}`)
        s.satisfaction = clamp(s.satisfaction + 10, 0, 100)
      } else s.satisfaction = clamp(s.satisfaction - 8, 0, 100)
    }
  }
  const breach = costCapVerdict(state)
  const boardNotes = evaluateBoard(state)
  monthlyValuation(state, rng)
  checkEquity(state, { seasonEndPosition: myPos })
  state.finances.seasonSummaries.push({
    season,
    incomeEur: state.finances.ledger.filter((t) => t.date.startsWith(String(season)) && t.amountEur > 0).reduce((s, t) => s + t.amountEur, 0),
    expenseEur: -state.finances.ledger.filter((t) => t.date.startsWith(String(season)) && t.amountEur < 0).reduce((s, t) => s + t.amountEur, 0),
    capSpentUsd: state.finances.costCap.spentUsd,
    capLimitUsd: state.finances.costCap.limitUsd,
    breach,
  })
  state.history.push({
    season,
    driverStandings: ds.slice(0, 22).map((d) => ({ driverId: d.driverId, teamId: d.teamId, points: d.points, name: fullName(state.drivers[d.driverId]) })),
    constructorStandings: cs.map((c) => ({ teamId: c.teamId, points: c.points, name: state.teams[c.teamId].name })),
    genesisPosition: myPos,
    genesisPoints: cs.find((c) => c.teamId === state.playerTeamId)!.points,
    valuationEur: state.board.valuationEur,
    liamStake: state.equity.stakes.liam,
  })
  if (state.player.boardTrust < 20) {
    pushMessage(state, {
      category: 'crisis',
      title: "Vote de défiance du conseil d'administration",
      body: `La confiance du conseil est tombée à ${state.player.boardTrust}/100. Hyundai exige des garanties : vous pouvez accepter une mise sous tutelle budgétaire (apport annuel réduit de 20 %) ou céder le contrôle opérationnel d'un projet clé.`,
      choices: [
        { id: 'tutelle', label: 'Accepter la tutelle budgétaire', effects: [{ kind: 'boardTrust', value: 20 }, { kind: 'boardSatisfaction', target: 'hyundai', value: 10 }, { kind: 'cash', value: -15_000_000 }] },
        { id: 'fight', label: 'Défendre votre projet devant le conseil', effects: [{ kind: 'boardTrust', value: 8 }, { kind: 'reputation', value: -3 }] },
      ],
    })
  }
  pushMessage(state, {
    category: 'board',
    title: `Bilan de la saison ${season}`,
    body: [...notes, '', "Objectifs du conseil :", ...boardNotes, '', `Plafond de dépenses : ${breach === 'none' ? 'respecté' : breach === 'minor' ? 'dépassement mineur' : 'dépassement majeur'}.`, `Valorisation : ${fmtEur(state.board.valuationEur)}. Confiance du conseil : ${state.player.boardTrust}/100.`].join('\n'),
  })
  state.clock.phase = 'postseason'
}

/** Passage à la nouvelle saison (début janvier). */
export function startNewSeason(state: GameState): void {
  const rng = new Rng(state.meta.rng)
  const notes: string[] = []
  notes.push(...seasonEndContracts(state, rng))
  notes.push(...seasonEndPeople(state, rng))
  const newSeason = state.clock.season + 1
  state.clock.season = newSeason
  state.clock.date = `${newSeason}-01-04`
  state.clock.phase = 'preseason'
  fillVacancies(state, rng, { announce: false })

  // Voitures : nouvelle génération
  const means = Object.fromEntries(CAR_AREAS.map((a) => [a, Object.values(state.cars).reduce((s, c) => s + c.ratings[a], 0) / Object.keys(state.cars).length]))
  for (const car of Object.values(state.cars)) {
    for (const a of CAR_AREAS) {
      car.ratings[a] = clamp(car.ratings[a] * 0.62 + means[a] * 0.38 + car.nextYearProgress[a] + rng.normal(0, 1.2) - 0.4, 40, 97)
      car.nextYearProgress[a] = 0
    }
    for (const p of car.projects) {
      if (p.status !== 'design' && p.status !== 'production') continue
      if (p.nextYear) p.nextYear = false
      else p.status = 'failed'
    }
    for (const id of Object.keys(car.pu)) for (const t of PU_TYPES) car.pu[id][t] = { used: 1, health: 100 }
    for (const id of state.teams[car.teamId].driverIds) ensurePu(car, id)
  }
  // Motoristes
  for (const pu of Object.values(state.powerUnits)) {
    if (pu.id === 'hyundai' && newSeason < state.hyundai.debutSeason) continue
    pu.power = clamp(pu.power + pu.devRate * rng.range(0, 1.6), 60, 96)
    pu.reliability = clamp(pu.reliability + rng.range(0, 1.6), 60, 96)
  }
  if (newSeason === state.hyundai.debutSeason) {
    pushMessage(state, { category: 'car', title: 'Le moteur Hyundai fait ses débuts', body: `Genesis passe au groupe propulseur Hyundai développé à Namyang (avancement final : ${Math.round(state.hyundai.progress)} %). Fin du contrat client avec Ferrari.` })
  }
  // Finances
  const f = state.finances
  f.costCap = { season: newSeason, limitUsd: Math.round(f.costCap.limitUsd * 1.03), spentUsd: 0 }
  // Calendrier : mêmes manches, dates décalées (à modifier dans calendar-2027.json)
  const years = newSeason - DATA.calendar.season
  state.calendar = DATA.calendar.events.map((e) => ({ round: e.round, circuitId: e.circuitId, sprint: e.sprint, date: shiftYearsSameWeekday(e.date, years), completed: false, dateEstimated: true }))
  state.results = []
  // Sponsors
  for (const s of Object.values(state.sponsors)) {
    if (s.status === 'expired') s.status = 'available'
    if (s.status !== 'active' || s.endSeason >= newSeason) continue
    if (s.house) {
      s.startSeason = newSeason
      s.endSeason = newSeason + 2
      s.annualEur = Math.round(s.annualEur * 1.04)
      continue
    }
    if (s.satisfaction >= 55) {
      s.status = 'available'
      makeSponsorOffer(state, s.id, rng)
    } else {
      s.status = 'available'
      notes.push(`${s.name} ne renouvelle pas son partenariat.`)
    }
  }
  for (const s of activeSponsors(state)) s.objectives = s.objectives.length ? s.objectives.map((o) => ({ ...o, met: undefined })) : s.objectives
  for (const t of Object.values(state.teams)) t.pitCrew.fatigue = 0
  generateBoardObjectives(state)
  pushMessage(state, {
    category: 'board',
    title: `Pré-saison ${newSeason}`,
    body: [`Liam Robert a désormais ${ageAt(state.player.birthDate, state.clock.date)} ans.`, ...notes].join('\n'),
  })
}
