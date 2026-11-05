import type { Effect, GameState, Person } from '../model/types'

import { DATA } from '../init/data'
import { pushMessage } from './messages'
import { addTx } from '../finance/ledger'
import { acceptSponsor, activeSponsors, rejectSponsor } from '../finance/sponsors'
import { transferToRival } from '../people/morale'
import { investInHyundai } from '../car/powerUnit'
import { fullName } from '../people/ratings'
import { clamp } from '../core/money'
import { Rng } from '../core/rng'

/** Applique un effet. `ctx.driverId` remplace la cible « driver » des modèles d'événements. */
export function applyEffect(state: GameState, e: Effect, ctx: { driverId?: string } = {}): string | null {
  const b = state.board
  switch (e.kind) {
    case 'cash':
      addTx(state, e.value, 'event', 'Événement', !!e.inCostCap)
      return null
    case 'reputation': {
      const t = state.teams[state.playerTeamId]
      t.reputation = clamp(t.reputation + e.value, 0, 100)
      state.player.reputation = clamp(state.player.reputation + e.value / 2, 0, 100)
      return null
    }
    case 'morale': {
      const id = e.target === 'driver' ? ctx.driverId : e.target
      const p = id ? (state.drivers[id] ?? state.staff[id]) : undefined
      if (p) p.morale = clamp(p.morale + e.value, 0, 100)
      return null
    }
    case 'teamMorale':
      for (const p of [...Object.values(state.drivers), ...Object.values(state.staff)]) if (p.teamId === state.playerTeamId) p.morale = clamp(p.morale + e.value, 0, 100)
      return null
    case 'boardSatisfaction': {
      const keys = e.target && e.target !== 'all' ? [e.target as 'hyundai'] : (['hyundai', 'redbird', 'arctos'] as const)
      for (const k of keys) b.satisfaction[k] = clamp(b.satisfaction[k] + e.value, 0, 100)
      return null
    }
    case 'boardTrust':
      state.player.boardTrust = clamp(state.player.boardTrust + e.value, 0, 100)
      return null
    case 'sponsorSatisfaction':
      for (const s of activeSponsors(state)) s.satisfaction = clamp(s.satisfaction + e.value, 0, 100)
      return null
    case 'acceptSponsor': {
      const r = acceptSponsor(state, e.target!)
      return r.ok ? null : (r.reason ?? null)
    }
    case 'rejectSponsor':
      rejectSponsor(state, e.target!)
      return null
    case 'salaryRaise': {
      const [id] = (e.target ?? '').split('|')
      const p = state.drivers[id] ?? state.staff[id]
      if (!p || !p.contract || p.teamId !== state.playerTeamId) return 'Cette personne ne fait plus partie de l’écurie.'
      p.contract.salaryEur = Math.round(p.contract.salaryEur * (1 + e.value))
      p.morale = clamp(p.morale + 14, 0, 100)
      if (p.kind === 'driver' && p.contract.endSeason <= state.clock.season) p.contract.endSeason = state.clock.season + 2
      return null
    }
    case 'releaseStaff': {
      const [id, rival] = (e.target ?? '').split('|')
      transferToRival(state, id, rival, e.value)
      return null
    }
    case 'poachGamble': {
      const [id, rival] = (e.target ?? '').split('|')
      const p = (state.drivers[id] ?? state.staff[id]) as Person | undefined
      if (!p) return null
      const rng = new Rng(state.meta.rng)
      if (rng.chance(0.45)) transferToRival(state, id, rival, p.kind === 'staff' ? e.value : 0)
      else {
        p.morale = clamp(p.morale - 8, 0, 100)
        pushMessage(state, { category: p.kind === 'driver' ? 'driver' : 'staff', title: `${fullName(p)} reste… pour l'instant`, body: `${fullName(p)} a décliné l'offre de ${state.teams[rival].shortName}, mais son moral en a pris un coup.` })
      }
      return null
    }
    case 'designPoints':
      state.finances.extraDesignPoints += e.value
      return null
    case 'reliability': {
      const car = state.cars[state.playerTeamId]
      car.ratings.reliability = clamp(car.ratings.reliability + e.value, 30, 99)
      return null
    }
    case 'pitCrew': {
      const pc = state.teams[state.playerTeamId].pitCrew
      pc.speed = clamp(pc.speed + e.value, 30, 99)
      pc.consistency = clamp(pc.consistency + e.value / 2, 30, 99)
      return null
    }
    case 'investHyundai': {
      const r = investInHyundai(state, e.value)
      return r.ok ? null : (r.reason ?? null)
    }
    case 'none':
      return null
  }
}

export function resolveChoice(state: GameState, messageId: string, choiceId: string): { ok: boolean; reason?: string } {
  const m = state.inbox.find((x) => x.id === messageId)
  if (!m || !m.choices || m.resolvedChoiceId) return { ok: false, reason: 'Décision déjà prise ou expirée.' }
  const c = m.choices.find((x) => x.id === choiceId)
  if (!c) return { ok: false, reason: 'Choix inconnu.' }
  const ctx = {}
  for (const e of c.effects) {
    const err = applyEffect(state, e, ctx)
    if (err) return { ok: false, reason: err }
  }
  m.resolvedChoiceId = choiceId
  m.read = true
  return { ok: true }
}

/** Expiration des décisions non prises (offres déclinées par défaut). */
export function expireMessages(state: GameState): void {
  for (const m of state.inbox) {
    if (!m.choices || m.resolvedChoiceId || !m.expiresAt || m.expiresAt > state.clock.date) continue
    m.resolvedChoiceId = 'expired'
    for (const c of m.choices) for (const e of c.effects) if (e.kind === 'acceptSponsor') rejectSponsor(state, e.target!)
  }
}

export function weeklyRandomEvents(state: GameState, weeks: number, rng: Rng): void {
  if (!rng.chance(Math.min(0.6, 0.14 * weeks))) return
  const tpl = rng.weighted(DATA.events, (e) => e.weight)
  const drivers = state.teams[state.playerTeamId].driverIds
  const driverId = drivers.length ? rng.pick(drivers) : undefined
  if (tpl.body.includes('{driver}') && !driverId) return
  const rivals = Object.values(state.teams).filter((t) => !t.isPlayer)
  const team = rng.pick(rivals)
  const fill = (s: string) => s.replaceAll('{driver}', driverId ? fullName(state.drivers[driverId]) : '').replaceAll('{team}', team.name)
  pushMessage(state, {
    category: tpl.category,
    title: fill(tpl.title),
    body: fill(tpl.body),
    choices: tpl.choices.map((c) => ({ ...c, effects: c.effects.map((e) => ({ ...e, target: e.target === 'driver' ? driverId : e.target })) })),
  })
}
