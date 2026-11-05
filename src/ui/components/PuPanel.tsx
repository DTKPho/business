import { useGameState, useAction } from '../hooks'
import { Badge, Bar, Button } from './ui'
import { PU_TYPES } from '../../engine/model/types'
import { CONFIG } from '../../engine/init/data'
import { PU_LABEL, installComponent } from '../../engine/car/powerUnit'
import { fullName } from '../../engine/people/ratings'
import { ensurePu } from '../../engine/car/car'

export function PuPanel({ locked }: { locked?: boolean }) {
  const game = useGameState()
  const run = useAction()
  const team = game.teams[game.playerTeamId]
  const car = game.cars[team.id]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {team.driverIds.map((id) => {
        const pu = car.pu[id]
        if (!pu) return null
        const pen = car.pendingGridPenalty[id] ?? 0
        return (
          <div key={id} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">{fullName(game.drivers[id])}</span>
              {pen > 0 && <Badge tone="bad">Pénalité grille : {pen} places</Badge>}
            </div>
            <div className="space-y-2">
              {PU_TYPES.map((t) => {
                const u = pu[t]
                const alloc = CONFIG.puAllocation[t]
                return (
                  <div key={t} className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                    <span className="truncate text-ink-300" title={PU_LABEL[t]}>
                      {PU_LABEL[t]}
                    </span>
                    <span className={u.used > alloc ? 'text-bad tabular' : 'text-ink-400 tabular'}>
                      {u.used}/{alloc}
                    </span>
                    <Bar value={u.health} tone={u.health > 50 ? 'good' : u.health > 25 ? 'warn' : 'bad'} height={5} />
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={locked}
                      title={u.used >= alloc ? 'Allocation dépassée : pénalité sur la grille' : 'Monter une unité neuve'}
                      onClick={() => {
                        if (u.used >= alloc && !confirm(`Allocation dépassée : pénalité de ${u.used === alloc ? 10 : 5} places sur la grille du Grand Prix. Continuer ?`)) return
                        run((s) => {
                          ensurePu(s.cars[team.id], id)
                          installComponent(s, team.id, id, t)
                        }, 'Nouvelle unité montée.')
                      }}
                    >
                      Neuf
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
