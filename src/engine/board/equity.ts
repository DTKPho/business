import type { Equity, GameState, HolderId, ShareholderId, SweatId } from '../model/types'
import { monthsBetween } from '../core/time'
import { pushMessage } from '../inbox/messages'
import { fmtEur, fmtPct } from '../core/money'

export function vestedFounderPct(e: Equity, date: string): number {
  const m = monthsBetween(e.founder.vestingStart, date)
  if (m < e.founder.cliffMonths) return 0
  return Math.min(e.founder.pct, (e.founder.pct * m) / e.founder.durationMonths)
}

export function liamTotalPct(e: Equity): number {
  const sweat = e.sweat.filter((s) => s.unlockedAt).reduce((s, x) => s + x.pct, 0)
  const earn = e.earnOuts.filter((s) => s.unlockedAt).reduce((s, x) => s + x.pct, 0)
  return e.purchased.pct + e.founder.pct + sweat + earn
}

/** Répartit le capital : dilution au prorata, Hyundai ne descend jamais sous son plancher. */
export function recomputeStakes(e: Equity): void {
  const liam = liamTotalPct(e)
  const rest = 100 - liam
  const base = e.baseProportions
  const totalBase = base.hyundai + base.redbird + base.arctos
  let hy = (rest * base.hyundai) / totalBase
  if (hy < e.hyundaiFloor) hy = e.hyundaiFloor
  const others = rest - hy
  const rb = (others * base.redbird) / (base.redbird + base.arctos)
  const ar = others - rb
  e.stakes = { hyundai: round2(hy), redbird: round2(rb), arctos: round2(ar), liam: round2(liam) }
}

function round2(v: number) {
  return Math.round(v * 100) / 100
}

/** Valeur théorique des parts de Liam si départ maintenant. */
export function leaverScenario(state: GameState, kind: 'good' | 'bad') {
  const e = state.equity
  const vested = vestedFounderPct(e, state.clock.date)
  const sweat = e.sweat.filter((s) => s.unlockedAt).reduce((s, x) => s + x.pct, 0)
  const earn = e.earnOuts.filter((s) => s.unlockedAt).reduce((s, x) => s + x.pct, 0)
  if (kind === 'good') {
    const pct = e.purchased.pct + vested + sweat + earn
    return { pct, valueEur: (pct / 100) * state.board.valuationEur, note: 'Good leaver : conserve les parts acquises et la partie déjà acquise (vested) des parts de fondateur, valorisées au prix du marché.' }
  }
  const pct = e.purchased.pct
  return {
    pct,
    valueEur: Math.min(e.purchased.paidEur, (pct / 100) * state.board.valuationEur),
    note: 'Bad leaver : perd les parts de fondateur et la sweat equity ; les 5 % achetés sont rachetés au plus bas entre le prix payé et la valeur de marché.',
  }
}

function unlock(state: GameState, label: string, pct: number) {
  recomputeStakes(state.equity)
  pushMessage(state, {
    category: 'board',
    title: `Parts débloquées : +${fmtPct(pct, 0)} pour Liam Robert`,
    body: `${label}. Votre participation passe à ${fmtPct(state.equity.stakes.liam)} (≈ ${fmtEur((state.equity.stakes.liam / 100) * state.board.valuationEur)}).`,
  })
}

/** Vérifie les conditions de déblocage (appelé après chaque course et en fin de saison). */
export function checkEquity(state: GameState, opts: { seasonEndPosition?: number } = {}): void {
  const e = state.equity
  const teamId = state.playerTeamId
  const prevVested = e.founder.vestedPct
  e.founder.vestedPct = round2(vestedFounderPct(e, state.clock.date))
  if (prevVested === 0 && e.founder.vestedPct > 0) {
    pushMessage(state, {
      category: 'board',
      title: 'Fin de la période de cliff',
      body: `Un an après le début du vesting, ${fmtPct(e.founder.vestedPct)} de vos parts de fondateur sont acquises. Le reste s'acquiert chaque mois jusqu'à ${fmtPct(e.founder.pct, 0)}.`,
    })
  }
  // Vérifié après chaque course : les résultats de la saison en cours suffisent.
  const raceRows = state.results.flatMap((r) => r.race.filter((x) => x.teamId === teamId && x.status === 'finished'))
  const has = (id: SweatId) => e.sweat.find((s) => s.id === id)
  const tryUnlock = (id: SweatId, cond: boolean) => {
    const s = has(id)
    if (s && !s.unlockedAt && cond) {
      s.unlockedAt = state.clock.date
      unlock(state, `Objectif atteint : ${s.label}`, s.pct)
    }
  }
  tryUnlock('firstPodium', raceRows.some((r) => r.position <= 3))
  tryUnlock('firstWin', raceRows.some((r) => r.position === 1))
  if (opts.seasonEndPosition) {
    tryUnlock('top5Constructors', opts.seasonEndPosition <= 5)
    tryUnlock('top3Constructors', opts.seasonEndPosition <= 3)
  }
  for (const eo of e.earnOuts) {
    if (!eo.unlockedAt && state.board.valuationEur >= eo.thresholdEur) {
      eo.unlockedAt = state.clock.date
      unlock(state, `Earn-out : valorisation supérieure à ${fmtEur(eo.thresholdEur)}`, eo.pct)
    }
  }
}

export const HOLDER_COLORS: Record<HolderId, string> = {
  // Palette catégorielle validée (mode sombre), dans cet ordre : hyundai, liam, redbird, arctos.
  hyundai: '#5b8cff',
  liam: '#e8541a',
  redbird: '#1fa886',
  arctos: '#a8841a',
}

export function shareholders(): ShareholderId[] {
  return ['hyundai', 'redbird', 'arctos']
}
