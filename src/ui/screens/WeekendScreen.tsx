import { useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Button, Card, Empty, PageTitle, Select, Tabs, cx } from '../components/ui'
import { ResultTable } from '../components/ResultTable'
import { PuPanel } from '../components/PuPanel'
import { SESSION_LABEL, closeWeekend, completeRace, currentSession, nextEvent, runCurrentSession, setPracticeProgram } from '../../engine/season/weekend'
import { buildGrid } from '../../engine/race/race'
import { stintLength, COMPOUND_LABEL } from '../../engine/race/performance'
import type { Compound, PracticeProgram, SessionId } from '../../engine/model/types'
import { fullName } from '../../engine/people/ratings'
import { formatDate } from '../../engine/core/time'

const PROGRAMS: { value: PracticeProgram; label: string }[] = [
  { value: 'setup', label: 'Réglages (confiance)' },
  { value: 'tyres', label: 'Pneus (connaissance)' },
  { value: 'raceSim', label: 'Simulation de course (mixte)' },
]

export function WeekendScreen() {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const setScreen = useGame((s) => s.setScreen)
  const w = game.weekend
  const [tab, setTab] = useState<SessionId | 'pu'>('pu')
  const [compounds, setCompounds] = useState<Record<string, Compound | ''>>({})

  if (!w) {
    const ev = nextEvent(game)
    return (
      <div>
        <PageTitle title="Week-end de course" />
        <Empty>
          Aucun week-end en cours.
          {ev && ` Prochain rendez-vous : ${game.circuits[ev.circuitId].gpName}, le ${formatDate(ev.date)}. Utilisez « Continuer » pour avancer.`}
        </Empty>
      </div>
    )
  }
  const event = game.calendar.find((e) => e.round === w.round)!
  const circuit = game.circuits[event.circuitId]
  const session = currentSession(game)
  const team = game.teams[game.playerTeamId]
  const done = w.sessions.filter((s) => w.results[s])
  const shownTab = tab === 'pu' || w.results[tab] ? tab : 'pu'
  const isRaceSession = session === 'RACE' || session === 'SPRINT'
  const grid = isRaceSession ? buildGrid(game, session === 'SPRINT' ? 'sprint' : 'race') : []

  const run = (mode: 'live' | 'sim' | 'session') => {
    const sc = Object.fromEntries(Object.entries(compounds).filter(([, v]) => v)) as Record<string, Compound>
    if (mode === 'session') {
      const r = act((s) => runCurrentSession(s), { save: 'now' })
      if (r) setTab(r.session)
      return
    }
    if (mode === 'live') {
      act((s) => runCurrentSession(s, sc), { save: 'now' })
      setScreen('race')
      return
    }
    const r = act(
      (s) => {
        runCurrentSession(s, sc)
        return completeRace(s)
      },
      { save: 'now' },
    )
    if (r) {
      setTab(r.session)
      const mine = r.rows.filter((x) => x.teamId === game.playerTeamId)
      toast(`${SESSION_LABEL[r.session]} : ${mine.map((m) => `${fullName(game.drivers[m.driverId])} ${m.status === 'dnf' ? 'ABD' : `P${m.position}`}`).join(', ')}`)
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title={circuit.gpName}
        sub={`Manche ${w.round}/${game.calendar.length} · ${circuit.name} · ${circuit.city} · ${formatDate(event.date)}`}
        actions={event.sprint ? <Badge tone="magma">Week-end sprint</Badge> : undefined}
      />
      <div className="flex flex-wrap gap-2">
        {w.sessions.map((s, i) => (
          <div
            key={s}
            className={cx(
              'rounded-lg border px-3 py-1.5 text-xs',
              i < w.sessionIndex ? 'border-good/40 text-good' : i === w.sessionIndex ? 'border-magma-500 bg-magma-500/10 text-magma-400' : 'border-ink-700 text-ink-400',
            )}
          >
            {i < w.sessionIndex ? '✓ ' : ''}
            {SESSION_LABEL[s]}
          </div>
        ))}
      </div>

      <Card title={session ? SESSION_LABEL[session] : 'Week-end terminé'}>
        {session === 'FP1' || session === 'FP2' || session === 'FP3' ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-400">Choisissez le programme de roulage de chaque pilote. La confiance dans les réglages améliore le rythme ; la connaissance des pneus réduit leur dégradation.</p>
            {team.driverIds.map((id) => (
              <div key={id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-44 font-medium">{fullName(game.drivers[id])}</span>
                <Select value={w.practiceProgram[id] ?? 'setup'} onChange={(v) => act((s) => setPracticeProgram(s, id, v), { save: false })} options={PROGRAMS} />
                <span className="text-xs text-ink-400">
                  Confiance {Math.round(w.setupConfidence[id] ?? 0)} · Pneus {Math.round(w.tyreKnowledge[id] ?? 0)}
                </span>
              </div>
            ))}
            <Button variant="primary" onClick={() => run('session')}>
              Lancer la séance
            </Button>
          </div>
        ) : session === 'Q' || session === 'SQ' ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-400">Format Q1 / Q2 / Q3 : les 6 plus lents sont éliminés en Q1 puis en Q2. Vérifiez l'état du groupe propulseur avant de lancer la séance (onglet Moteur).</p>
            <Button variant="primary" onClick={() => run('session')}>
              Lancer les qualifications
            </Button>
          </div>
        ) : isRaceSession ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {team.driverIds.map((id) => (
                <div key={id} className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{fullName(game.drivers[id])}</span>
                    <Badge tone="copper">Grille : P{grid.indexOf(id) + 1}</Badge>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-ink-400">
                    Pneus de départ
                    <Select
                      value={compounds[id] ?? ''}
                      onChange={(v) => setCompounds({ ...compounds, [id]: v })}
                      options={[{ value: '' as const, label: 'Choix du directeur sportif' }, ...(['S', 'M', 'H', 'I', 'W'] as Compound[]).map((c) => ({ value: c, label: COMPOUND_LABEL[c] }))]}
                    />
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-400">
              Durée de relais estimée : tendre ~{stintLength('S', circuit)} tours · medium ~{stintLength('M', circuit)} · dur ~{stintLength('H', circuit)} ({session === 'SPRINT' ? 'sprint : pas d’arrêt obligatoire' : 'deux composés secs obligatoires sur piste sèche'}).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => run('live')}>
                ▶ Course en direct
              </Button>
              <Button onClick={() => run('sim')}>⏩ Simuler la course</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-400">Toutes les séances sont terminées. Clôturez le week-end pour mettre à jour le moral, les sponsors, le conseil et la boîte de réception.</p>
            <Button
              variant="primary"
              onClick={() => {
                act((s) => closeWeekend(s), { save: 'now' })
                toast('Week-end clôturé.', 'good')
                setScreen('dashboard')
              }}
            >
              Terminer le week-end
            </Button>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <Tabs value={shownTab} onChange={setTab} tabs={[{ id: 'pu' as const, label: 'Moteur' }, ...done.map((s) => ({ id: s, label: SESSION_LABEL[s] }))]} />
        <Card>{shownTab === 'pu' ? <PuPanel locked={isRaceSession && session === 'RACE' && !!game.race} /> : <ResultTable result={w.results[shownTab]!} />}</Card>
      </div>
    </div>
  )
}
