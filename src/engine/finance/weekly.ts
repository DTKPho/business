import type { GameState } from '../model/types'
import { CONFIG } from '../init/data'
import { addTx } from './ledger'
import { weeklySponsorIncome } from './sponsors'
import { isCustomer, supplierFor } from '../car/car'
import { facilityValue, monthlyFacilityCost } from '../facilities/facilities'
import { fullName } from '../people/ratings'
import { pushMessage } from '../inbox/messages'
import { fmtEur, fmtUsd } from '../core/money'

/** Flux hebdomadaires (au prorata du nombre de jours écoulés). */
export function weeklyFinances(state: GameState, weeks: number): void {
  const t = state.playerTeamId
  // Salaires : les pilotes et le directeur technique sont hors plafond.
  let driverPay = 0
  for (const d of Object.values(state.drivers)) if (d.teamId === t && d.contract) driverPay += d.contract.salaryEur
  if (driverPay) addTx(state, -(driverPay / 52) * weeks, 'salary', 'Salaires pilotes', false)
  let capPay = 0
  let nonCapPay = 0
  for (const s of Object.values(state.staff)) {
    if (s.teamId !== t || !s.contract) continue
    if (s.contract.inCostCap) capPay += s.contract.salaryEur
    else nonCapPay += s.contract.salaryEur
  }
  if (capPay) addTx(state, -(capPay / 52) * weeks, 'salary', 'Salaires encadrement technique', true)
  if (nonCapPay) addTx(state, -(nonCapPay / 52) * weeks, 'salary', 'Salaires hors plafond (personnel clé)', false)
  addTx(state, -CONFIG.baseWorkforceWeeklyEur * weeks, 'salary', 'Masse salariale (ingénieurs, mécaniciens, usine)', true)
  if (state.facilities.windTunnel.level === 0) addTx(state, -CONFIG.windTunnelRentalWeeklyEur * weeks, 'windTunnel', 'Location de soufflerie', true)
  if (isCustomer(state, t)) {
    const pu = supplierFor(state, t)
    addTx(state, -(pu.customerFeeEur / 52) * weeks, 'engine', `Fourniture moteurs ${pu.name}`, true)
  }
  weeklySponsorIncome(state, weeks)
  addTx(state, (state.board.annualContributionEur / 52) * weeks, 'shareholder', 'Apport annuel des actionnaires', false)
}

export function monthlyFinances(state: GameState): void {
  addTx(state, -monthlyFacilityCost(state), 'facility', 'Fonctionnement des installations', true)
  const pos = state.teams[state.playerTeamId].lastConstructorPos
  const prize = (CONFIG.fomPrizeUsdByPosition[pos - 1] ?? 60e6) * state.finances.eurPerUsd
  addTx(state, prize / 12, 'prize', 'Versement mensuel FOM', false)
}

export function raceWeekendCosts(state: GameState): void {
  const mul = 1 + facilityValue(state, 'logisticsCost')
  addTx(state, -CONFIG.raceLogisticsEur * mul, 'operations', 'Logistique & déplacements', true)
}

export function driverBonuses(state: GameState, rows: { driverId: string; points?: number; position: number; status?: string }[]): void {
  for (const r of rows) {
    const d = state.drivers[r.driverId]
    if (!d || d.teamId !== state.playerTeamId || !d.contract) continue
    const bonus = (r.points ?? 0) * (d.contract.bonusPerPointEur ?? 50_000) + (r.position === 1 && r.status === 'finished' ? (d.contract.bonusPerWinEur ?? 500_000) : 0)
    if (bonus) addTx(state, -bonus, 'salary', `Primes de résultat — ${fullName(d)}`, false)
  }
}

/** Projection des dépenses plafonnées jusqu'à la fin de saison. */
export function costCapProjection(state: GameState): number {
  const f = state.finances
  const start = `${state.clock.season}-01-01`
  const days = Math.max(7, (new Date(state.clock.date).getTime() - new Date(start).getTime()) / 86400000)
  const perDay = f.costCap.spentUsd / days
  return f.costCap.spentUsd + perDay * Math.max(0, 365 - days)
}

/** Contrôle du plafond en fin de saison. */
export function costCapVerdict(state: GameState): 'none' | 'minor' | 'major' {
  const f = state.finances
  const over = f.costCap.spentUsd - f.costCap.limitUsd
  if (over <= 0) return 'none'
  const pct = (over / f.costCap.limitUsd) * 100
  const fine = over * 1.5 * f.eurPerUsd
  addTx(state, -fine, 'fine', `Amende FIA : dépassement du plafond (${fmtUsd(over)})`, false)
  const team = state.teams[state.playerTeamId]
  if (pct < CONFIG.costCapMinorBreachPct) {
    team.reputation = Math.max(0, team.reputation - 4)
    state.board.satisfaction.arctos = Math.max(0, state.board.satisfaction.arctos - 12)
    pushMessage(state, { category: 'crisis', title: 'Dépassement mineur du plafond de dépenses', body: `La FIA constate un dépassement de ${pct.toFixed(1)} %. Amende : ${fmtEur(fine)}. Réputation et confiance d'Arctos en baisse.` })
    return 'minor'
  }
  team.reputation = Math.max(0, team.reputation - 10)
  state.board.satisfaction.arctos = Math.max(0, state.board.satisfaction.arctos - 25)
  state.board.satisfaction.hyundai = Math.max(0, state.board.satisfaction.hyundai - 10)
  state.finances.sanction = { season: state.clock.season + 1, dpFactor: 0.85 }
  pushMessage(state, { category: 'crisis', title: 'Dépassement majeur du plafond de dépenses', body: `La FIA sanctionne un dépassement de ${pct.toFixed(1)} % : amende de ${fmtEur(fine)} et réduction de 15 % des capacités de développement la saison prochaine.` })
  return 'major'
}
