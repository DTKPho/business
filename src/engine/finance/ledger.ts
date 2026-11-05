import type { GameState, TxCategory } from '../model/types'
import { yearOf } from '../core/time'

export const TX_LABEL: Record<TxCategory, string> = {
  salary: 'Salaires',
  rnd: 'Recherche & développement',
  production: 'Production de pièces',
  facility: 'Fonctionnement des installations',
  facilityUpgrade: 'Investissements installations',
  sponsor: 'Sponsors',
  prize: 'Primes FOM',
  engine: 'Fourniture moteur',
  windTunnel: 'Location soufflerie',
  transfer: 'Transferts & indemnités',
  operations: 'Opérations & logistique',
  shareholder: 'Apports des actionnaires',
  fine: 'Amendes',
  event: 'Événements',
}

/** Enregistre une transaction (montant positif = recette). */
export function addTx(state: GameState, amountEur: number, category: TxCategory, label: string, inCostCap = false): void {
  if (!amountEur) return
  const f = state.finances
  f.cashEur += amountEur
  if (inCostCap && amountEur < 0) f.costCap.spentUsd += -amountEur / f.eurPerUsd
  const last = f.ledger[f.ledger.length - 1]
  // Regroupe les dépenses récurrentes d'une même semaine pour garder un registre lisible.
  if (last && last.date === state.clock.date && last.category === category && last.label === label && last.inCostCap === inCostCap) {
    last.amountEur += amountEur
  } else {
    f.ledger.push({ date: state.clock.date, amountEur, category, inCostCap, label })
  }
  // Ne garde que la saison en cours et la précédente.
  if (f.ledger.length > 4000) {
    const minYear = state.clock.season - 1
    f.ledger = f.ledger.filter((t) => yearOf(t.date) >= minYear)
  }
}

export function seasonLedger(state: GameState, season = state.clock.season) {
  return state.finances.ledger.filter((t) => yearOf(t.date) === season)
}

export function totalsByCategory(state: GameState, season = state.clock.season): Record<string, { income: number; expense: number }> {
  const out: Record<string, { income: number; expense: number }> = {}
  for (const t of seasonLedger(state, season)) {
    const o = (out[t.category] ??= { income: 0, expense: 0 })
    if (t.amountEur >= 0) o.income += t.amountEur
    else o.expense += -t.amountEur
  }
  return out
}

export function usdToEur(state: GameState, usd: number): number {
  return usd * state.finances.eurPerUsd
}
