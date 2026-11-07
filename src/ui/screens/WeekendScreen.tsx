import { useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Button, Card, Empty, Select, Stat, Tabs, TeamDot, cx } from '../components/ui'
import { ResultTable } from '../components/ResultTable'
import { PuPanel } from '../components/PuPanel'
import { GpHero } from '../components/GpHero'
import { TrackMap } from '../components/TrackMap'
import { LiveSession } from '../components/LiveSession'
import { PageHero } from '../components/PageHero'
import { SESSION_LABEL, closeWeekend, completeRace, currentSession, nextEvent, runAndCommitSession, runCurrentSession, setPracticeProgram } from '../../engine/season/weekend'
import { buildGrid } from '../../engine/race/race'
import { stintLength, COMPOUND_LABEL } from '../../engine/race/performance'
import type { Circuit, Compound, PracticeProgram, SessionId } from '../../engine/model/types'
import { fullName } from '../../engine/people/ratings'
import { formatDate } from '../../engine/core/time'

const PROGRAMS: { value: PracticeProgram; label: string; hint: string }[] = [
  { value: 'setup', label: 'Réglages', hint: 'Augmente la confiance du pilote dans la voiture' },
  { value: 'tyres', label: 'Pneus', hint: 'Mieux connaître les gommes : moins de dégradation' },
  { value: 'raceSim', label: 'Simulation de course', hint: 'Longs relais, un peu des deux' },
]

const SESSION_ICON: Record<SessionId, string> = { FP1: '①', FP2: '②', FP3: '③', SQ: '⏱', SPRINT: '⚡', Q: '⏱', RACE: '🏁' }

export function CircuitSheet({ circuit }: { circuit: Circuit }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-ink-700/70 bg-ink-850 p-3">
        <TrackMap circuitId={circuit.id} accent={circuit.accent?.[0]} className="mx-auto aspect-square w-full max-w-[460px]" />
        <p className="text-center text-[11px] text-ink-400">Trait de couleur : ligne de départ/arrivée</p>
      </div>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-300">{circuit.description}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Longueur" value={`${circuit.lengthKm.toFixed(3).replace('.', ',')} km`} />
          <Stat label="Tours" value={circuit.laps} />
          <Stat label="Virages" value={circuit.turns ?? '—'} />
          <Stat label="Distance" value={`${Math.round(circuit.lengthKm * circuit.laps)} km`} />
          <Stat label="1er GP" value={circuit.firstGp ?? '—'} />
          <Stat label="Risque de pluie" value={`${Math.round(circuit.rainChance * 100)} %`} />
        </div>
        <div className="space-y-2">
          {[
            ['Appui aérodynamique', circuit.traits.downforce],
            ['Sensibilité à la puissance', circuit.traits.powerSensitivity],
            ['Usure des pneus', circuit.traits.tyreWear],
            ['Facilité de dépassement', circuit.traits.overtaking],
            ['Probabilité de voiture de sécurité', circuit.traits.safetyCarProb],
          ].map(([label, v]) => (
            <div key={label as string} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 text-xs">
              <span className="text-ink-300">{label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full" style={{ width: `${(v as number) * 100}%`, background: circuit.accent?.[0] ?? '#ff5a1f' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-ink-400">Perte de temps dans la voie des stands : {circuit.traits.pitLossSec} s · tour de référence ≈ {Math.floor(circuit.baseLapSec / 60)}:{String(Math.round(circuit.baseLapSec % 60)).padStart(2, '0')}</div>
      </div>
    </div>
  )
}

export function WeekendScreen() {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const setScreen = useGame((s) => s.setScreen)
  const w = game.weekend
  const [tab, setTab] = useState<'program' | 'circuit' | 'results' | 'engine'>('program')
  const [resTab, setResTab] = useState<SessionId | null>(null)
  const [compounds, setCompounds] = useState<Record<string, Compound | ''>>({})

  if (!w) {
    const ev = nextEvent(game)
    if (!ev)
      return (
        <div>
          <PageHero scene="weekend" eyebrow="Course" title="Week-end de course" sub="La saison est terminée. Avancez pour rejoindre l'intersaison." />
        </div>
      )
    const c = game.circuits[ev.circuitId]
    return (
      <div className="space-y-5">
        <GpHero event={ev} circuit={c} total={game.calendar.length}>
          <p className="mt-3 text-sm text-white/80">Prochain rendez-vous. Utilisez « Continuer ▸ » pour rejoindre le paddock.</p>
        </GpHero>
        <Card title="Le circuit">
          <CircuitSheet circuit={c} />
        </Card>
      </div>
    )
  }

  const event = game.calendar.find((e) => e.round === w.round)!
  const circuit = game.circuits[event.circuitId]
  const accent = circuit.accent?.[0] ?? '#ff5a1f'
  const session = currentSession(game)
  const team = game.teams[game.playerTeamId]
  const done = w.sessions.filter((s) => w.results[s])
  const isRaceSession = session === 'RACE' || session === 'SPRINT'
  const grid = isRaceSession ? buildGrid(game, session === 'SPRINT' ? 'sprint' : 'race') : []

  if (w.pending) {
    return (
      <div className="space-y-5">
        <GpHero event={event} circuit={circuit} total={game.calendar.length} />
        <LiveSession pending={w.pending} circuitId={circuit.id} accent={accent} />
      </div>
    )
  }

  const watch = () => act((s) => runCurrentSession(s), { save: 'now' })
  const quick = () => {
    const r = act((s) => runAndCommitSession(s), { save: 'now' })
    if (r) {
      setResTab(r.session)
      const mine = r.rows.filter((x) => x.teamId === game.playerTeamId)
      toast(`${SESSION_LABEL[r.session]} : ${mine.map((m) => `${fullName(game.drivers[m.driverId])} P${m.position}`).join(', ')}`)
    }
  }
  const startRace = (mode: 'live' | 'sim') => {
    const sc = Object.fromEntries(Object.entries(compounds).filter(([, v]) => v)) as Record<string, Compound>
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
      setResTab(r.session)
      setTab('results')
      const mine = r.rows.filter((x) => x.teamId === game.playerTeamId)
      toast(`${SESSION_LABEL[r.session]} : ${mine.map((m) => `${fullName(game.drivers[m.driverId])} ${m.status === 'dnf' ? 'ABD' : `P${m.position}`}`).join(', ')}`)
    }
  }
  const shownRes = resTab && w.results[resTab] ? resTab : done[done.length - 1]

  return (
    <div className="space-y-5">
      <GpHero event={event} circuit={circuit} total={game.calendar.length} />
      <div className="glass flex gap-1 overflow-x-auto rounded-2xl border border-ink-700/70 p-1.5">
        {w.sessions.map((s, i) => (
          <div
            key={s}
            className={cx(
              'flex min-w-[120px] flex-1 items-center gap-2 rounded-xl px-3 py-2 text-xs',
              i < w.sessionIndex ? 'text-good' : i === w.sessionIndex ? 'bg-magma-500 font-semibold text-white' : 'text-ink-400',
            )}
          >
            <span className="text-base">{i < w.sessionIndex ? '✓' : SESSION_ICON[s]}</span>
            <span>{SESSION_LABEL[s]}</span>
          </div>
        ))}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'program', label: 'Séance en cours' },
          { id: 'circuit', label: 'Circuit' },
          { id: 'results', label: `Résultats${done.length ? ` (${done.length})` : ''}` },
          { id: 'engine', label: 'Moteur' },
        ]}
      />
      {tab === 'program' && (
        <Card title={session ? SESSION_LABEL[session] : 'Week-end terminé'}>
          {session === 'FP1' || session === 'FP2' || session === 'FP3' ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-400">Choisissez le programme de roulage de chaque pilote, puis suivez la séance en direct ou obtenez directement le résultat.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {team.driverIds.map((id) => (
                  <div key={id} className="rounded-xl border border-ink-700/70 bg-ink-850 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold">{fullName(game.drivers[id])}</span>
                      <span className="text-xs text-ink-400">
                        Confiance {Math.round(w.setupConfidence[id] ?? 0)} · Pneus {Math.round(w.tyreKnowledge[id] ?? 0)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PROGRAMS.map((p) => (
                        <button
                          key={p.value}
                          title={p.hint}
                          onClick={() => act((s) => setPracticeProgram(s, id, p.value), { save: false })}
                          className={cx('rounded-lg border px-2 py-1.5 text-xs', (w.practiceProgram[id] ?? 'setup') === p.value ? 'border-magma-500 bg-magma-500/10 font-semibold' : 'border-ink-700 hover:border-ink-600')}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={watch}>
                  ▶ Regarder la séance
                </Button>
                <Button onClick={quick}>⏩ Résultat immédiat</Button>
              </div>
            </div>
          ) : session === 'Q' || session === 'SQ' ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-400">Q1, Q2, Q3 : les six plus lents sont éliminés à chaque étape. Pensez à vérifier le moteur (onglet Moteur) : un composant neuf au-delà de l'allocation coûte des places sur la grille.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={watch}>
                  ▶ Regarder les qualifications
                </Button>
                <Button onClick={quick}>⏩ Résultat immédiat</Button>
              </div>
            </div>
          ) : isRaceSession ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {team.driverIds.map((id) => (
                  <div key={id} className="rounded-xl border border-ink-700/70 bg-ink-850 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{fullName(game.drivers[id])}</span>
                      <Badge tone="copper">Grille : P{grid.indexOf(id) + 1}</Badge>
                    </div>
                    <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-400">
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
              <details className="rounded-xl border border-ink-700/70 bg-ink-850 px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium">Grille de départ complète</summary>
                <ol className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                  {grid.map((id, i) => (
                    <li key={id} className={cx('flex items-center gap-1.5', game.drivers[id].teamId === team.id && 'font-semibold text-magma-500')}>
                      <span className="w-5 text-right text-ink-400 tabular">{i + 1}</span>
                      <TeamDot color={game.teams[game.drivers[id].teamId!].colors.primary} size={8} />
                      {fullName(game.drivers[id])}
                    </li>
                  ))}
                </ol>
              </details>
              <p className="text-xs text-ink-400">
                Relais estimés : tendre ~{stintLength('S', circuit)} tours · medium ~{stintLength('M', circuit)} · dur ~{stintLength('H', circuit)}. {session === 'SPRINT' ? 'Sprint : pas d’arrêt obligatoire.' : 'Deux composés secs obligatoires sur piste sèche.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => startRace('live')}>
                  ▶ Course en direct
                </Button>
                <Button onClick={() => startRace('sim')}>⏩ Simuler la course</Button>
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
      )}
      {tab === 'circuit' && (
        <Card title={`${circuit.flag ?? ''} ${circuit.name}`}>
          <CircuitSheet circuit={circuit} />
        </Card>
      )}
      {tab === 'results' &&
        (done.length === 0 || !shownRes ? (
          <Empty>Aucune séance terminée pour l'instant.</Empty>
        ) : (
          <div className="space-y-3">
            <Tabs value={shownRes} onChange={(v) => setResTab(v)} tabs={done.map((s) => ({ id: s, label: SESSION_LABEL[s] }))} />
            <Card>
              <ResultTable result={w.results[shownRes]!} />
            </Card>
          </div>
        ))}
      {tab === 'engine' && (
        <Card title="Groupe propulseur">
          <PuPanel locked={!!game.race} />
        </Card>
      )}
      <p className="text-center text-[11px] text-ink-400">Date : {formatDate(game.clock.date)}</p>
    </div>
  )
}
