import { describe, expect, it } from 'vitest'
import { newTestGame, playUntil, autoRecruit } from './helpers'
import { ageAt } from '../src/engine/core/time'
import { supplierIdFor } from '../src/engine/car/car'

describe('carrière longue', () => {
  it('enchaîne quatre saisons sans fin de partie, Liam vieillit et passe au moteur Hyundai en 2030', () => {
    const s = newTestGame('career')
    for (const season of [2028, 2029, 2030, 2031]) {
      playUntil(s, (x) => x.clock.season === season, 600)
      autoRecruit(s) // remplace les contrats expirés
      expect(s.clock.phase).toBe('preseason')
    }
    expect(s.history).toHaveLength(4)
    expect(ageAt(s.player.birthDate, s.clock.date)).toBe(46)
    expect(supplierIdFor(s, 'genesis', 2030)).toBe('hyundai')
    expect(supplierIdFor(s, 'genesis', 2029)).toBe('ferrari')
    expect(s.hyundai.progress).toBeGreaterThan(60)
    for (const t of Object.values(s.teams)) if (!t.isPlayer) expect(t.driverIds).toHaveLength(2)
    expect(Object.values(s.drivers).filter((d) => d.series === 'F3' && !d.retired).length).toBeGreaterThanOrEqual(20)
    expect(JSON.stringify(s).length).toBeLessThan(3_000_000)
  }, 60_000)
})
