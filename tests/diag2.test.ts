import { it } from 'vitest'
import { newTestGame, playWeekend, autoRecruit } from './helpers'
import { advance } from '../src/engine/season/loop'
import { startProject } from '../src/engine/car/rnd'
import { DATA } from '../src/engine/init/data'

it.skipIf(!process.env.DIAG)('économie sur 3 saisons avec R&D', () => {
  const s = newTestGame('eco')
  let k = 0
  for (let i = 0; i < 400 && s.clock.season < 2030; i++) {
    if (s.clock.phase === 'raceWeekend') playWeekend(s)
    else {
      const t = DATA.rndTemplates[k++ % DATA.rndTemplates.length]
      startProject(s, t.id, 'standard', false)
      const r = advance(s)
      if (!r.ok) autoRecruit(s)
      if (r.event === 'newSeason') autoRecruit(s)
    }
  }
  for (const h of s.history) console.log(h.season, 'P' + h.genesisPosition, h.genesisPoints + 'pts', 'valo', Math.round(h.valuationEur / 1e6))
  for (const f of s.finances.seasonSummaries) console.log(f.season, 'in', Math.round(f.incomeEur / 1e6), 'out', Math.round(f.expenseEur / 1e6), 'cap', Math.round(f.capSpentUsd / 1e6), f.breach)
  console.log('cash', Math.round(s.finances.cashEur / 1e6), 'car', JSON.stringify(s.cars.genesis.ratings), 'mclaren', JSON.stringify(s.cars.mclaren.ratings))
})
