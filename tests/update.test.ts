import { describe, expect, it } from 'vitest'
import { createNewGame } from '../src/engine/init/newGame'
import { newTestGame } from './helpers'
import { stepLap } from '../src/engine/race/race'
import { advance } from '../src/engine/season/loop'
import { commitPendingSession, currentSession, runCurrentSession } from '../src/engine/season/weekend'
import { CHEATS } from '../src/engine/cheats'
import { cancelUpgrade, downgrade, rushUpgrade, startUpgrade } from '../src/engine/facilities/facilities'
import { signWithPlayer } from '../src/engine/people/contracts'
import { DATA } from '../src/engine/init/data'

function toWeekend(seed: string) {
  const s = newTestGame(seed)
  for (let i = 0; i < 20 && s.clock.phase !== 'raceWeekend'; i++) advance(s)
  return s
}

describe('niveaux de départ', () => {
  it('chaque niveau applique budget, voiture et installations', () => {
    for (const l of DATA.startLevels) {
      const s = createNewGame({ seed: 'lvl', startLevel: l.id })
      expect(s.finances.cashEur).toBe(l.cashEur)
      expect(s.cars.genesis.ratings).toEqual(l.car)
      expect(s.teams.genesis.reputation).toBe(l.reputation)
      for (const [f, lvl] of Object.entries(l.facilityLevels)) expect(s.facilities[f].level).toBe(lvl)
      const staff = Object.values(s.staff).filter((x) => x.teamId === 'genesis').length
      expect(staff).toBe(l.autoStaff > 0 ? 7 : 0)
    }
  })

  it('options : encadrement et pilotes automatiques', () => {
    const s = createNewGame({ seed: 'opt', startLevel: 'zero', autoStaff: true, autoDrivers: true })
    expect(s.teams.genesis.driverIds).toHaveLength(2)
    const engineers = Object.values(s.staff).filter((x) => x.teamId === 'genesis' && x.role === 'raceEngineer')
    expect(engineers.map((e) => e.assignedDriverId).sort()).toEqual([...s.teams.genesis.driverIds].sort())
  })
})

describe('séances regardables', () => {
  it('les essais produisent une chronologie cohérente avec le classement', () => {
    const s = toWeekend('live')
    runCurrentSession(s)
    const p = s.weekend!.pending!
    expect(p.session).toBe(currentSession(s))
    for (const row of p.result.rows) {
      const timed = p.laps.filter((l) => l.driverId === row.driverId && l.timed)
      expect(Math.min(...timed.map((l) => l.lapTime))).toBeCloseTo(row.time!, 6)
      for (const l of p.laps.filter((x) => x.driverId === row.driverId)) expect(l.end).toBeGreaterThan(l.start)
    }
    const idx = s.weekend!.sessionIndex
    commitPendingSession(s)
    expect(s.weekend!.sessionIndex).toBe(idx + 1)
    expect(s.weekend!.pending).toBeNull()
  })

  it('les qualifications éliminent 6 pilotes en Q1 et Q2', () => {
    const s = toWeekend('quali')
    while (currentSession(s) !== 'Q' && currentSession(s) !== 'SQ') {
      if (currentSession(s) === 'SPRINT') {
        runCurrentSession(s)
        s.race = null
        s.weekend!.sessionIndex++
      } else {
        runCurrentSession(s)
        commitPendingSession(s)
      }
    }
    runCurrentSession(s)
    const p = s.weekend!.pending!
    expect(p.segments).toHaveLength(3)
    expect(p.segments![0].eliminated).toHaveLength(6)
    expect(p.segments![1].eliminated).toHaveLength(6)
    const q3 = p.result.rows.filter((r) => r.knockedOutIn === 3)
    expect(q3).toHaveLength(10)
    for (const id of p.segments![0].eliminated) expect(p.laps.some((l) => l.driverId === id && l.segment === 2)).toBe(false)
  })

  it('le radar dispose du temps de début et de fin de chaque tour', () => {
    const s = toWeekend('radar')
    while (currentSession(s) !== 'SPRINT' && currentSession(s) !== 'RACE') {
      runCurrentSession(s)
      commitPendingSession(s)
    }
    runCurrentSession(s)
    stepLap(s)
    for (const c of s.race!.cars.filter((x) => x.status === 'running')) {
      expect(c.totalTime).toBeGreaterThan(c.prevTotal)
      expect(c.totalTime - c.prevTotal).toBeGreaterThan(60)
    }
  })
})

describe('triche et installations', () => {
  it('les triches modifient l’état et marquent la partie', () => {
    const s = createNewGame({ seed: 'cheat' })
    const cash = s.finances.cashEur
    CHEATS.addCash(s, 50e6)
    expect(s.finances.cashEur).toBe(cash + 50e6)
    expect(s.meta.cheats?.used).toBe(true)
    CHEATS.maxCar(s)
    expect(s.cars.genesis.ratings.aero).toBe(99)
    CHEATS.unlockAllEquity(s)
    expect(s.equity.stakes.liam).toBe(21)
    expect(s.equity.stakes.hyundai).toBe(51)
    CHEATS.setFlag(s, 'alwaysAccept', true)
    expect(signWithPlayer(s, 'max-verstappen', { salaryEur: 1e6, years: 1, role: 'first' }).accepted).toBe(true)
  })

  it('accélérer, annuler et revendre une installation', () => {
    const s = createNewGame({ seed: 'fac' })
    expect(startUpgrade(s, 'cfd').ok).toBe(true)
    const weeks = s.facilities.cfd.upgrade!.weeksLeft
    expect(rushUpgrade(s, 'cfd').ok).toBe(true)
    expect(s.facilities.cfd.upgrade!.weeksLeft).toBe(Math.ceil(weeks / 2))
    const cash = s.finances.cashEur
    expect(cancelUpgrade(s, 'cfd').ok).toBe(true)
    expect(s.finances.cashEur).toBe(cash + 6_000_000)
    const lvl = s.facilities.factory.level
    expect(downgrade(s, 'factory').ok).toBe(true)
    expect(s.facilities.factory.level).toBe(lvl - 1)
  })
})
