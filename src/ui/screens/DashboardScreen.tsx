import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Bar, Button, Card, PageTitle, Stat, TeamDot } from '../components/ui'
import { nextEvent } from '../../engine/season/weekend'
import { constructorStandings, driverStandings } from '../../engine/season/standings'
import { daysBetween, formatDate } from '../../engine/core/time'
import { fmtEur, fmtPct } from '../../engine/core/money'
import { fullName, teamStaffByRole, STAFF_ROLE_LABEL } from '../../engine/people/ratings'
import { designPoints } from '../../engine/car/rnd'
import { AREA_LABEL, carScore, expectedOrder } from '../../engine/car/car'
import type { StaffRole } from '../../engine/model/types'
import { sponsorIncomeAnnual } from '../../engine/finance/sponsors'

const ROLES: [StaffRole, number][] = [
  ['technicalDirector', 1],
  ['headOfAero', 1],
  ['chiefDesigner', 1],
  ['sportingDirector', 1],
  ['raceEngineer', 2],
  ['headOfScouting', 1],
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
  const missing = ROLES.flatMap(([r, n]) => {
    const have = teamStaffByRole(game, team.id, r).length
    return have < n ? [`${STAFF_ROLE_LABEL[r]}${n > 1 ? ` (${have}/${n})` : ''}`] : []
  })
  const recent = game.inbox.slice(0, 6)

  return (
    <div className="space-y-5">
      <PageTitle title="Tableau de bord" sub={`${game.player.firstName} ${game.player.lastName} · ${game.player.title} · ${team.base}`} />
      {(team.driverIds.length < 2 || missing.length > 0) && (
        <div className="rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm">
          <div className="mb-1 font-semibold text-warn">Recrutement à compléter</div>
          <ul className="list-inside list-disc text-ink-300">
            {team.driverIds.length < 2 && <li>Pilotes titulaires : {team.driverIds.length}/2 (obligatoire avant le prochain Grand Prix)</li>}
            {missing.map((m) => (
              <li key={m}>{m} : poste vacant</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => setScreen('market')}>
              Ouvrir le marché
            </Button>
            <Button size="sm" onClick={() => setScreen('staff')}>
              Voir le personnel
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Stat label="Constructeurs" value={`P${me.position}`} sub={`${me.points} pts · ${me.podiums} podium(s)`} />
        </Card>
        <Card>
          <Stat label="Trésorerie" value={fmtEur(game.finances.cashEur)} tone={game.finances.cashEur < 30e6 ? 'bad' : undefined} sub={`Sponsors : ${fmtEur(sponsorIncomeAnnual(game))}/an`} />
        </Card>
        <Card>
          <Stat label="Valorisation" value={fmtEur(game.board.valuationEur)} sub={`Liam : ${fmtPct(game.equity.stakes.liam)} ≈ ${fmtEur((game.equity.stakes.liam / 100) * game.board.valuationEur)}`} />
        </Card>
        <Card>
          <Stat label="Voiture" value={`${carScore(game, team.id).toFixed(1)}`} sub={`${rank}e plateau sur 11 · ${Math.round(dp.total)} pts de design/sem.`} />
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Prochain Grand Prix" className="lg:col-span-1">
          {ev && circuit ? (
            <div className="space-y-2 text-sm">
              <div className="text-lg font-semibold">{circuit.gpName}</div>
              <div className="text-ink-400">
                Manche {ev.round}/{game.calendar.length} · {circuit.name}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="copper">{formatDate(ev.date)}</Badge>
                {ev.sprint && <Badge tone="magma">Week-end sprint</Badge>}
                <Badge>{Math.max(0, daysBetween(game.clock.date, ev.date))} jours</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-ink-300">
                <span>Appui : {Math.round(circuit.traits.downforce * 100)}%</span>
                <span>Puissance : {Math.round(circuit.traits.powerSensitivity * 100)}%</span>
                <span>Usure pneus : {Math.round(circuit.traits.tyreWear * 100)}%</span>
                <span>Dépassements : {Math.round(circuit.traits.overtaking * 100)}%</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-400">Saison terminée. Avancez pour passer à l'intersaison.</p>
          )}
        </Card>
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
                    <button className="w-full rounded-lg border border-ink-700 bg-ink-850 p-2.5 text-left hover:border-copper-400" onClick={() => openPerson(id)}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{fullName(d)}</span>
                        <span className="text-xs text-ink-400">P{st?.position ?? '—'} · {st?.points ?? 0} pts</span>
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
        <Card title="Développement en cours" actions={<Button size="sm" variant="ghost" onClick={() => setScreen('car')}>Voir ▸</Button>}>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-ink-400">Aucun projet de R&D actif. Les points de design sont perdus !</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {activeProjects.map((p) => (
                <li key={p.id}>
                  <div className="flex justify-between text-xs">
                    <span>
                      {p.name} <span className="text-ink-400">· {AREA_LABEL[p.area]}</span>
                    </span>
                    <span className="text-ink-400">{p.status === 'design' ? `${Math.round((p.dpDone / p.dpRequired) * 100)} %` : `production ${Math.max(0, Math.ceil(p.productionWeeksLeft))} sem.`}</span>
                  </div>
                  <Bar value={p.status === 'design' ? p.dpDone : p.dpRequired} max={p.dpRequired} tone={p.status === 'design' ? 'magma' : 'copper'} height={4} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Boîte de réception" actions={<Button size="sm" variant="ghost" onClick={() => setScreen('inbox')}>Tout voir ▸</Button>}>
          <ul className="divide-y divide-ink-800">
            {recent.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-magma-500" />}
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                {m.choices && !m.resolvedChoiceId && <Badge tone="warn">décision</Badge>}
                <span className="shrink-0 text-[11px] text-ink-400">{formatDate(m.date)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Championnat constructeurs" actions={<Button size="sm" variant="ghost" onClick={() => setScreen('standings')}>Détails ▸</Button>}>
          <ol className="space-y-1 text-sm">
            {cs.map((c) => (
              <li key={c.teamId} className={`flex items-center gap-2 rounded px-1.5 py-0.5 ${c.teamId === team.id ? 'bg-magma-500/10' : ''}`}>
                <span className="w-6 text-right text-ink-400 tabular">{c.position}</span>
                <TeamDot color={game.teams[c.teamId].colors.primary} />
                <span className="flex-1">{game.teams[c.teamId].shortName}</span>
                <span className="tabular">{c.points}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}
