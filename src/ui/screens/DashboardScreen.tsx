import type { ReactNode } from 'react'
import { useGame } from '../../store/gameStore'
import type { Screen } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Bar, Button, Card, PageTitle, Stat, TeamDot, Tile, cx } from '../components/ui'
import { TrackMap } from '../components/TrackMap'
import { nextEvent } from '../../engine/season/weekend'
import { constructorStandings, driverStandings } from '../../engine/season/standings'
import { daysBetween, formatDate } from '../../engine/core/time'
import { fmtEur, fmtPct } from '../../engine/core/money'
import { fullName, teamStaffByRole, STAFF_ROLE_LABEL } from '../../engine/people/ratings'
import { designPoints, MAX_PROJECTS } from '../../engine/car/rnd'
import { carScore, expectedOrder } from '../../engine/car/car'
import type { StaffRole } from '../../engine/model/types'
import { sponsorIncomeAnnual } from '../../engine/finance/sponsors'
import { pendingDecisions } from '../../engine/inbox/messages'

const ROLES: [StaffRole, number][] = [
  ['technicalDirector', 1],
  ['headOfAero', 1],
  ['chiefDesigner', 1],
  ['sportingDirector', 1],
  ['raceEngineer', 2],
  ['headOfScouting', 1],
]

const QUICK: { id: Screen; icon: string; label: string; hint: string }[] = [
  { id: 'car', icon: '⚙', label: 'Voiture & R&D', hint: 'Garage et projets' },
  { id: 'facilities', icon: '⌂', label: 'Installations', hint: 'Campus de Brackley' },
  { id: 'market', icon: '⇄', label: 'Marché', hint: 'Pilotes et staff' },
  { id: 'finances', icon: '€', label: 'Finances', hint: 'Budget et sponsors' },
  { id: 'board', icon: '◔', label: 'Conseil', hint: 'Objectifs et parts' },
  { id: 'calendar', icon: '▦', label: 'Calendrier', hint: 'Les 24 Grands Prix' },
]

export function DashboardScreen() {
  const game = useGameState()
  const setScreen = useGame((s) => s.setScreen)
  const openPerson = useGame((s) => s.openPerson)
  const team = game.teams[game.playerTeamId]
  const ev = nextEvent(game)
  const circuit = ev ? game.circuits[ev.circuitId] : null
  const cs = constructorStandings(game)
  const ds = driverStandings(game)
  const me = cs.find((c) => c.teamId === team.id)!
  const car = game.cars[team.id]
  const dp = designPoints(game)
  const rank = expectedOrder(game).indexOf(team.id) + 1
  const activeProjects = car.projects.filter((p) => p.status === 'design' || p.status === 'production')
  const designing = car.projects.filter((p) => p.status === 'design').length
  const missing = ROLES.flatMap(([r, n]) => {
    const have = teamStaffByRole(game, team.id, r).length
    return have < n ? [`${STAFF_ROLE_LABEL[r]}${n > 1 ? ` (${have}/${n})` : ''}`] : []
  })
  const pending = pendingDecisions(game)
  const expiring = [...Object.values(game.drivers), ...Object.values(game.staff)].filter((p) => p.teamId === team.id && p.contract && p.contract.endSeason <= game.clock.season).length

  const todo: { text: ReactNode; screen: Screen; tone: 'bad' | 'warn' | 'neutral' }[] = []
  if (team.driverIds.length < 2) todo.push({ text: `Recruter ${2 - team.driverIds.length} pilote(s) titulaire(s) — obligatoire avant le prochain GP`, screen: 'market', tone: 'bad' })
  if (missing.length) todo.push({ text: `Postes vacants : ${missing.join(', ')}`, screen: 'staff', tone: 'warn' })
  if (designing === 0) todo.push({ text: 'Aucun projet en conception : les points de design sont perdus', screen: 'car', tone: 'warn' })
  else if (activeProjects.length < MAX_PROJECTS) todo.push({ text: `${MAX_PROJECTS - activeProjects.length} emplacement(s) de projet R&D libre(s)`, screen: 'car', tone: 'neutral' })
  if (pending) todo.push({ text: `${pending} décision(s) en attente dans la boîte de réception`, screen: 'inbox', tone: 'warn' })
  if (expiring) todo.push({ text: `${expiring} contrat(s) expirent à la fin de la saison`, screen: 'staff', tone: 'neutral' })

  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={`QG de Brackley · saison ${game.clock.season}`}
        title={`Bonjour, ${game.player.firstName}`}
        sub={`${game.player.title} · ${team.name}`}
        actions={
          game.clock.phase === 'raceWeekend' ? (
            <Button variant="primary" onClick={() => setScreen('weekend')}>
              ⚑ Rejoindre le paddock
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile onClick={() => setScreen('standings')} className="p-4">
          <Stat label="Constructeurs" value={`P${me.position}`} sub={`${me.points} pts · ${me.podiums} podium(s)`} />
        </Tile>
        <Tile onClick={() => setScreen('finances')} className="p-4">
          <Stat label="Trésorerie" value={fmtEur(game.finances.cashEur)} tone={game.finances.cashEur < 30e6 ? 'bad' : undefined} sub={`Sponsors : ${fmtEur(sponsorIncomeAnnual(game))}/an`} />
        </Tile>
        <Tile onClick={() => setScreen('board')} className="p-4">
          <Stat label="Valorisation" value={fmtEur(game.board.valuationEur)} sub={`Liam : ${fmtPct(game.equity.stakes.liam)} ≈ ${fmtEur((game.equity.stakes.liam / 100) * game.board.valuationEur)}`} />
        </Tile>
        <Tile onClick={() => setScreen('car')} className="p-4">
          <Stat label="Voiture" value={carScore(game, team.id).toFixed(1)} sub={`${rank}e du plateau · ${Math.round(dp.total)} pts de design/sem.`} />
        </Tile>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="À faire">
          {todo.length === 0 ? (
            <p className="text-sm text-good">✓ Tout est en ordre. Continuez vers le prochain événement.</p>
          ) : (
            <ul className="space-y-2">
              {todo.map((t, i) => (
                <li key={i}>
                  <button onClick={() => setScreen(t.screen)} className="flex w-full items-center gap-3 rounded-xl border border-ink-700/70 bg-ink-850 px-3 py-2.5 text-left text-sm hover:border-magma-500/60">
                    <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', t.tone === 'bad' ? 'bg-bad' : t.tone === 'warn' ? 'bg-warn' : 'bg-ink-600')} />
                    <span className="flex-1">{t.text}</span>
                    <span className="text-ink-400">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {ev && circuit ? (
          <Tile onClick={() => setScreen('weekend')} className="overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="h-28 w-28 shrink-0 rounded-xl bg-ink-850 p-1">
                <TrackMap circuitId={circuit.id} accent={circuit.accent?.[0]} thin className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-magma-500 uppercase">Prochain Grand Prix</div>
                <div className="truncate text-lg font-semibold">
                  {circuit.flag} {circuit.gpName}
                </div>
                <div className="text-xs text-ink-400">
                  Manche {ev.round}/{game.calendar.length} · {circuit.city}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="copper">{formatDate(ev.date)}</Badge>
                  {ev.sprint && <Badge tone="magma">Sprint</Badge>}
                  <Badge>J−{Math.max(0, daysBetween(game.clock.date, ev.date))}</Badge>
                </div>
              </div>
            </div>
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${circuit.accent?.[0] ?? '#ff5a1f'}, ${circuit.accent?.[1] ?? '#c08a5a'})` }} />
          </Tile>
        ) : (
          <Card title="Saison terminée">
            <p className="text-sm text-ink-400">Avancez pour rejoindre l'intersaison.</p>
          </Card>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-[0.18em] text-ink-400 uppercase">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {QUICK.map((q) => (
            <Tile key={q.id} onClick={() => setScreen(q.id)} className="p-4">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-magma-500/12 text-xl text-magma-500">{q.icon}</div>
              <div className="text-sm font-semibold">{q.label}</div>
              <div className="text-xs text-ink-400">{q.hint}</div>
            </Tile>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Vos pilotes">
          {team.driverIds.length === 0 ? (
            <p className="text-sm text-ink-400">Aucun pilote sous contrat.</p>
          ) : (
            <ul className="space-y-2">
              {team.driverIds.map((id) => {
                const d = game.drivers[id]
                const st = ds.find((x) => x.driverId === id)
                return (
                  <li key={id}>
                    <button className="w-full rounded-xl border border-ink-700/70 bg-ink-850 p-2.5 text-left hover:border-magma-500/60" onClick={() => openPerson(id)}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{fullName(d)}</span>
                        <span className="text-xs text-ink-400">
                          P{st?.position ?? '—'} · {st?.points ?? 0} pts
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-400">
                        Moral <Bar value={d.morale} tone={d.morale >= 65 ? 'good' : d.morale >= 45 ? 'warn' : 'bad'} height={4} />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Card title="Dernières nouvelles" actions={<Button size="sm" variant="ghost" onClick={() => setScreen('inbox')}>Tout voir ›</Button>}>
          <ul className="divide-y divide-ink-700/60">
            {game.inbox.slice(0, 5).map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-magma-500" />}
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                {m.choices && !m.resolvedChoiceId && <Badge tone="warn">décision</Badge>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Constructeurs" actions={<Button size="sm" variant="ghost" onClick={() => setScreen('standings')}>Détails ›</Button>}>
          <ol className="space-y-1 text-sm">
            {cs.slice(0, 6).map((c) => (
              <li key={c.teamId} className={cx('flex items-center gap-2 rounded px-1.5 py-0.5', c.teamId === team.id && 'bg-magma-500/10 font-semibold')}>
                <span className="w-5 text-right text-ink-400 tabular">{c.position}</span>
                <TeamDot color={game.teams[c.teamId].colors.primary} />
                <span className="flex-1">{game.teams[c.teamId].shortName}</span>
                <span className="tabular">{c.points}</span>
              </li>
            ))}
            {me.position > 6 && (
              <li className="flex items-center gap-2 rounded bg-magma-500/10 px-1.5 py-0.5 font-semibold">
                <span className="w-5 text-right tabular">{me.position}</span>
                <TeamDot color={team.colors.primary} />
                <span className="flex-1">{team.shortName}</span>
                <span className="tabular">{me.points}</span>
              </li>
            )}
          </ol>
        </Card>
      </div>
    </div>
  )
}
