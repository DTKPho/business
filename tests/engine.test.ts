import { describe, expect, it } from 'vitest'
import { Rng, createRngState } from '../src/engine/core/rng'
import { createNewGame } from '../src/engine/init/newGame'
import { newTestGame, playUntil, playWeekend } from './helpers'
import { advance } from '../src/engine/season/loop'
import { recomputeStakes, vestedFounderPct, checkEquity } from '../src/engine/board/equity'
import { serialize, deserialize } from '../src/engine/save/serialize'
import { addTx } from '../src/engine/finance/ledger'
import { costCapVerdict } from '../src/engine/finance/weekly'
import { startProject } from '../src/engine/car/rnd'
import { startUpgrade } from '../src/engine/facilities/facilities'
import { resolveChoice } from '../src/engine/inbox/events'
import { makeSponsorOffer } from '../src/engine/finance/sponsors'
import { signWithPlayer } from '../src/engine/people/contracts'

describe('générateur aléatoire', () => {
  it('est déterministe pour une même graine', () => {
    const a = new Rng(createRngState('abc'))
    const b = new Rng(createRngState('abc'))
    const c = new Rng(createRngState('abd'))
    const sa = Array.from({ length: 5 }, () => a.next())
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(sa)
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(sa)
    for (const v of sa) expect(v >= 0 && v < 1).toBe(true)
  })

  it('rejoue une saison à l’identique avec la même graine', () => {
    const run = () => {
      const s = newTestGame('replay')
      playUntil(s, (x) => x.calendar.filter((e) => e.completed).length >= 4)
      return JSON.stringify(s.results)
    }
    expect(run()).toEqual(run())
  })
})

describe('création de partie', () => {
  it('respecte la fiction de départ', () => {
    const s = createNewGame({ seed: 'x' })
    expect(Object.keys(s.teams)).toHaveLength(11)
    expect(s.teams.genesis.driverIds).toHaveLength(0)
    expect(s.finances.cashEur).toBe(250_000_000)
    expect(s.finances.costCap.limitUsd).toBe(215_000_000)
    expect(s.equity.stakes).toEqual({ hyundai: 58, redbird: 19, arctos: 14, liam: 9 })
    expect(s.board.valuationEur).toBe(3_000_000_000)
    expect(s.calendar).toHaveLength(24)
    expect(s.calendar.filter((e) => e.sprint)).toHaveLength(10)
    expect(s.facilities.windTunnel.level).toBe(0)
    expect(s.facilities.cfd.level).toBe(0)
    for (const t of Object.values(s.teams)) if (!t.isPlayer) expect(t.driverIds).toHaveLength(2)
  })

  it('bloque le premier Grand Prix sans deux pilotes', () => {
    const s = createNewGame({ seed: 'x' })
    let r = advance(s)
    for (let i = 0; i < 20 && r.ok; i++) r = advance(s)
    expect(r.ok).toBe(false)
  })
})

describe('parts de Liam', () => {
  it('vesting : rien avant le cliff, linéaire ensuite, plafonné à 4 %', () => {
    const s = createNewGame({ seed: 'x' })
    const e = s.equity
    expect(vestedFounderPct(e, '2027-12-31')).toBe(0)
    expect(vestedFounderPct(e, '2028-01-01')).toBeCloseTo(1, 5)
    expect(vestedFounderPct(e, '2029-01-01')).toBeCloseTo(2, 5)
    expect(vestedFounderPct(e, '2035-01-01')).toBe(4)
  })

  it('Hyundai ne descend jamais sous 51 %', () => {
    const s = createNewGame({ seed: 'x' })
    const e = s.equity
    for (const t of e.sweat) t.unlockedAt = '2030-01-01'
    for (const t of e.earnOuts) t.unlockedAt = '2030-01-01'
    recomputeStakes(e)
    expect(e.stakes.liam).toBe(21)
    expect(e.stakes.hyundai).toBe(51)
    expect(e.stakes.hyundai + e.stakes.redbird + e.stakes.arctos + e.stakes.liam).toBeCloseTo(100, 5)
    expect(e.stakes.redbird / e.stakes.arctos).toBeCloseTo(19 / 14, 2)
  })

  it('débloque la tranche « premier podium » et l’earn-out 6 Md€', () => {
    const s = createNewGame({ seed: 'x' })
    s.results.push({ round: 1, circuitId: 'bahrain', race: [{ driverId: 'a', teamId: 'genesis', position: 3, status: 'finished', points: 15 }] })
    s.board.valuationEur = 6.2e9
    checkEquity(s)
    expect(s.equity.sweat.find((x) => x.id === 'firstPodium')!.unlockedAt).toBeDefined()
    expect(s.equity.sweat.find((x) => x.id === 'firstWin')!.unlockedAt).toBeUndefined()
    expect(s.equity.earnOuts[0].unlockedAt).toBeDefined()
    expect(s.equity.stakes.liam).toBe(13)
  })
})

describe('finances', () => {
  it('compte les dépenses plafonnées en dollars et sanctionne un dépassement', () => {
    const s = createNewGame({ seed: 'x' })
    addTx(s, -92_000_000, 'rnd', 'test', true)
    expect(s.finances.costCap.spentUsd).toBeCloseTo(100_000_000, 0)
    addTx(s, -10_000_000, 'facilityUpgrade', 'hors plafond', false)
    expect(s.finances.costCap.spentUsd).toBeCloseTo(100_000_000, 0)
    expect(costCapVerdict(s)).toBe('none')
    addTx(s, -120_000_000, 'rnd', 'test', true)
    expect(costCapVerdict(s)).toBe('major')
    expect(s.finances.sanction?.dpFactor).toBe(0.85)
  })

  it('accepte une offre de sponsor depuis la boîte de réception', () => {
    const s = createNewGame({ seed: 'x' })
    const rng = new Rng(s.meta.rng)
    expect(makeSponsorOffer(s, 'dhl', rng)).toBe(true)
    const msg = s.inbox.find((m) => m.title.includes('DHL'))!
    expect(resolveChoice(s, msg.id, 'accept').ok).toBe(true)
    expect(s.sponsors.dhl.status).toBe('active')
  })
})

describe('R&D et installations', () => {
  it('un projet passe de la conception à la production puis améliore la voiture', () => {
    const s = newTestGame('rnd')
    const before = s.cars.genesis.ratings.chassis
    expect(startProject(s, 'brakes', 'conservative', false).ok).toBe(true)
    for (let i = 0; i < 12; i++) {
      if (s.clock.phase === 'raceWeekend') playWeekend(s)
      else advance(s)
    }
    const p = s.cars.genesis.projects[0]
    expect(['done', 'failed']).toContain(p.status)
    if (p.status === 'done') expect(s.cars.genesis.ratings.chassis).not.toBe(before)
  })

  it('construire une soufflerie coûte hors plafond', () => {
    const s = createNewGame({ seed: 'x' })
    const cash = s.finances.cashEur
    expect(startUpgrade(s, 'windTunnel').ok).toBe(true)
    expect(s.finances.cashEur).toBe(cash - 65_000_000)
    expect(s.finances.costCap.spentUsd).toBe(0)
    expect(startUpgrade(s, 'windTunnel').ok).toBe(false)
  })
})

describe('personnel', () => {
  it('un pilote sous contrat ailleurs exige une indemnité', () => {
    const s = createNewGame({ seed: 'x' })
    const cash = s.finances.cashEur
    const r = signWithPlayer(s, 'max-verstappen', { salaryEur: 200e6, years: 3, role: 'first' })
    if (r.accepted) {
      expect(s.finances.cashEur).toBeLessThan(cash)
      expect(s.teams.redbull.driverIds).not.toContain('max-verstappen')
    }
  })
})

describe('sauvegarde', () => {
  it('sérialise et relit une partie en cours de week-end', () => {
    const s = newTestGame('save')
    playUntil(s, (x) => x.clock.phase === 'raceWeekend')
    const back = deserialize(serialize(s))
    expect(back).toEqual(s)
  })

  it('refuse un fichier étranger', () => {
    expect(() => deserialize('{"foo":1}')).toThrow()
    expect(() => deserialize('pas du json')).toThrow()
  })
})
