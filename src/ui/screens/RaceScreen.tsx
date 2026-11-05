import { useEffect, useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Bar, Button, Card, Select, Table, TeamDot, cx, td, th } from '../components/ui'
import { setRaceOrders, simulateToEnd, stepLap } from '../../engine/race/race'
import type { RaceOrders } from '../../engine/race/race'
import { completeRace, SESSION_LABEL } from '../../engine/season/weekend'
import { COMPOUND_COLOR, COMPOUND_LABEL } from '../../engine/race/performance'
import type { Compound, EngineMode, ErsMode, PaceMode, RaceCar, TeamOrder } from '../../engine/model/types'
import { fullName } from '../../engine/people/ratings'

const SPEEDS = [
  { id: 'pause', label: '❚❚', ms: 0 },
  { id: '1', label: '1×', ms: 1400 },
  { id: '2', label: '2×', ms: 650 },
  { id: '4', label: '4×', ms: 280 },
  { id: '8', label: '8×', ms: 90 },
] as const

export function RaceScreen() {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const setScreen = useGame((s) => s.setScreen)
  const toast = useGame((s) => s.toast)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]['id']>('pause')
  const race = game.race
  const ms = SPEEDS.find((s) => s.id === speed)!.ms

  const running = !!race && !race.finished
  useEffect(() => {
    if (!ms || !running) return
    const t = setInterval(() => {
      const g = useGame.getState().game
      if (!g?.race || g.race.finished) return
      const lap = g.race.lap + 1
      useGame.getState().act((s) => stepLap(s), { save: lap % 10 === 0 })
    }, ms)
    return () => clearInterval(t)
  }, [ms, running])

  if (!race) return null
  const circuit = game.circuits[race.circuitId]
  const cars = [...race.cars].sort((a, b) => a.position - b.position)
  const mine = cars.filter((c) => c.teamId === game.playerTeamId)
  const avgLap = circuit.baseLapSec + 2
  const wet = race.weather.wetness
  const order = (id: string, o: RaceOrders) => act((s) => setRaceOrders(s, id, o), { save: false })

  const finish = () => {
    const r = act((s) => completeRace(s), { save: 'now' })
    if (r) toast(`${SESSION_LABEL[r.session]} terminé.`, 'good')
    setScreen('weekend')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {race.kind === 'sprint' ? 'Course sprint' : circuit.gpName}
          </h1>
          <div className="text-sm text-ink-400">
            Tour <span className="font-semibold text-ink-100 tabular">{Math.min(race.lap, race.totalLaps)}</span> / {race.totalLaps} · {circuit.name}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {race.neutral.mode !== 'none' && <Badge tone="warn">{race.neutral.mode === 'sc' ? 'VOITURE DE SÉCURITÉ' : 'VSC'}</Badge>}
          <Badge tone={wet > 0.6 ? 'bad' : wet > 0.15 ? 'warn' : 'neutral'}>
            {race.weather.rain > 0 ? '🌧 Pluie' : wet > 0.1 ? '☁ Piste humide' : '☀ Sec'} · humidité {Math.round(wet * 100)} %
          </Badge>
          {!race.finished ? (
            <>
              <div className="flex rounded-lg border border-ink-600 bg-ink-800 p-0.5">
                {SPEEDS.map((s) => (
                  <button key={s.id} onClick={() => setSpeed(s.id)} className={cx('rounded-md px-2.5 py-1 text-xs', speed === s.id ? 'bg-magma-500 text-white' : 'text-ink-300 hover:text-ink-100')}>
                    {s.label}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={() => act((s) => stepLap(s), { save: false })} disabled={speed !== 'pause'}>
                +1 tour
              </Button>
              <Button size="sm" onClick={() => act((s) => simulateToEnd(s), { save: 'now' })}>
                ⏩ Simuler la fin
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={finish}>
              Voir le classement ▸
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card pad={false}>
          <Table>
            <thead>
              <tr>
                <th className={th}>P</th>
                <th className={th}>Pilote</th>
                <th className={cx(th, 'text-right')}>Écart</th>
                <th className={cx(th, 'text-right')}>Interv.</th>
                <th className={th}>Pneus</th>
                <th className={cx(th, 'text-right')}>Arrêts</th>
                <th className={cx(th, 'text-right')}>Dernier tour</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((c) => timingRow(c))}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-4">
          {mine.map((c) => (
            <DriverControls key={c.driverId} car={c} onOrder={(o) => order(c.driverId, o)} disabled={race.finished} />
          ))}
          <Card title="Direction de course">
            <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
              {[...race.log].reverse().slice(0, 60).map((l, i) => (
                <li key={i} className={cx(l.teamId === game.playerTeamId && 'text-magma-400', l.type === 'sc' && 'text-warn', l.type === 'dnf' && 'text-bad', l.type === 'weather' && 'text-[#5b8cff]')}>
                  <span className="mr-1.5 text-ink-600 tabular">T{l.lap}</span>
                  {l.text}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )

  function timingRow(car: RaceCar) {
    const team = game.teams[car.teamId]
    const mineRow = car.teamId === game.playerTeamId
    const laps = Math.floor(car.gapToLeader / avgLap)
    const gained = car.startPos - car.position
    return (
      <tr key={car.driverId} className={cx(mineRow && 'bg-magma-500/10', car.status === 'dnf' && 'text-ink-600')}>
        <td className={cx(td, 'tabular')}>
          {car.status === 'dnf' ? 'ABD' : car.position}
          {car.status !== 'dnf' && gained !== 0 && <span className={cx('ml-1 text-[10px]', gained > 0 ? 'text-good' : 'text-bad')}>{gained > 0 ? `▲${gained}` : `▼${-gained}`}</span>}
        </td>
        <td className={td}>
          <span className="flex items-center gap-1.5">
            <TeamDot color={team.colors.primary} />
            <span className={mineRow ? 'font-semibold' : ''}>{fullName(game.drivers[car.driverId])}</span>
          </span>
        </td>
        <td className={cx(td, 'text-right tabular')}>{car.status === 'dnf' ? car.dnfReason : car.position === 1 ? 'Leader' : laps >= 1 ? `+${laps} T` : `+${car.gapToLeader.toFixed(1)}`}</td>
        <td className={cx(td, 'text-right tabular')}>{car.status === 'dnf' || car.position === 1 ? '' : car.interval.toFixed(1)}</td>
        <td className={td}>
          {car.status !== 'dnf' && (
            <span className="flex items-center gap-1.5">
              <TyreIcon c={car.tyre.compound} />
              <span className="text-[11px] text-ink-400 tabular">
                {car.tyre.age}T · {Math.round(car.tyre.wear)}%
              </span>
            </span>
          )}
        </td>
        <td className={cx(td, 'text-right tabular')}>{car.pitStops}</td>
        <td className={cx(td, 'text-right tabular text-ink-300')}>{car.lastLap ? car.lastLap.toFixed(3) : '—'}</td>
      </tr>
    )
  }
}

export function TyreIcon({ c }: { c: Compound }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold" style={{ borderColor: COMPOUND_COLOR[c], color: COMPOUND_COLOR[c] }} title={COMPOUND_LABEL[c]}>
      {c}
    </span>
  )
}

function DriverControls({ car, onOrder, disabled }: { car: RaceCar; onOrder: (o: RaceOrders) => void; disabled: boolean }) {
  const game = useGameState()
  const d = game.drivers[car.driverId]
  const pu = game.cars[car.teamId].pu[car.driverId]
  const minHealth = pu ? Math.min(...Object.values(pu).map((u) => u.health)) : 100
  if (car.status !== 'running' && car.status !== 'finished') {
    return (
      <Card title={fullName(d)}>
        <p className="text-sm text-bad">Abandon : {car.dnfReason}</p>
      </Card>
    )
  }
  return (
    <Card
      title={`P${car.position} · ${fullName(d)}`}
      actions={
        <label className="flex items-center gap-1.5 text-xs text-ink-300">
          <input type="checkbox" checked={car.autoStrategy} disabled={disabled} onChange={(e) => onOrder({ autoStrategy: e.target.checked })} />
          Stratégie auto
        </label>
      }
    >
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="mb-1 text-ink-400">Rythme</div>
            <Select<PaceMode>
              className="w-full"
              value={car.pace}
              onChange={(v) => onOrder({ pace: v })}
              options={[
                { value: 'push', label: 'Attaque' },
                { value: 'standard', label: 'Normal' },
                { value: 'conserve', label: 'Gestion' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1 text-ink-400">Moteur</div>
            <Select<EngineMode>
              className="w-full"
              value={car.engineMode}
              onChange={(v) => onOrder({ engineMode: v })}
              options={[
                { value: 'high', label: 'Puissance' },
                { value: 'standard', label: 'Standard' },
                { value: 'low', label: 'Économie' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1 text-ink-400">ERS</div>
            <Select<ErsMode>
              className="w-full"
              value={car.ersMode}
              onChange={(v) => onOrder({ ersMode: v })}
              options={[
                { value: 'attack', label: 'Attaque' },
                { value: 'balanced', label: 'Équilibré' },
                { value: 'harvest', label: 'Recharge' },
              ]}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex justify-between text-ink-400">
              <span>Batterie</span>
              <span className="tabular">{Math.round(car.ersCharge)} %</span>
            </div>
            <Bar value={car.ersCharge} tone="blue" height={5} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-ink-400">
              <span>Usure pneus</span>
              <span className="tabular">{Math.round(car.tyre.wear)} %</span>
            </div>
            <Bar value={car.tyre.wear} tone={car.tyre.wear > 70 ? 'bad' : car.tyre.wear > 45 ? 'warn' : 'good'} height={5} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-ink-400">
              <span>Moteur (pire composant)</span>
              <span className="tabular">{Math.round(minHealth)} %</span>
            </div>
            <Bar value={minHealth} tone={minHealth > 50 ? 'good' : minHealth > 25 ? 'warn' : 'bad'} height={5} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-ink-400">
              <span>Dégâts</span>
              <span className="tabular">{Math.round(car.damage)}</span>
            </div>
            <Bar value={car.damage} max={50} tone="bad" height={5} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-400">Consigne :</span>
          <Select<TeamOrder>
            value={car.teamOrder}
            onChange={(v) => onOrder({ teamOrder: v })}
            options={[
              { value: 'free', label: 'Course libre' },
              { value: 'hold', label: 'Garder la position (ne pas attaquer l’équipier)' },
              { value: 'letPass', label: 'Laisser passer l’équipier' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-ink-400">Arrêt au prochain tour :</span>
          {(['S', 'M', 'H', 'I', 'W'] as Compound[]).map((c) => (
            <button
              key={c}
              disabled={disabled}
              onClick={() => onOrder({ pitRequest: car.pitRequest === c ? null : c })}
              className={cx('rounded-full p-0.5', car.pitRequest === c ? 'ring-2 ring-magma-500' : 'opacity-70 hover:opacity-100')}
              title={COMPOUND_LABEL[c]}
            >
              <TyreIcon c={c} />
            </button>
          ))}
          {car.pitRequest && <Badge tone="magma">Arrêt demandé : {COMPOUND_LABEL[car.pitRequest]}</Badge>}
        </div>
        {car.autoStrategy && car.plannedStops.length > 0 && <div className="text-ink-400">Arrêts prévus par le directeur sportif : tour {car.plannedStops.join(', ')}</div>}
      </div>
    </Card>
  )
}
