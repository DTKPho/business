import { useState } from 'react'
import { useGameState, useAction } from '../hooks'
import { Badge, Bar, Button, Card, Disclosure, Empty, Modal, PageTitle, Stat, Table, Tabs, cx, td, th } from '../components/ui'
import { PuPanel } from '../components/PuPanel'
import { AREA_LABEL, carScore, effectivePower, expectedOrder, reliabilityScore, supplierFor } from '../../engine/car/car'
import { AMBITION, MAX_PROJECTS, cancelProject, designPoints, previewProject, startProject } from '../../engine/car/rnd'
import { investInHyundai } from '../../engine/car/powerUnit'
import { DATA } from '../../engine/init/data'
import type { Ambition, CarArea } from '../../engine/model/types'
import { CAR_AREAS } from '../../engine/model/types'
import { fmtEur } from '../../engine/core/money'
import { formatDate } from '../../engine/core/time'

type Tab = 'overview' | 'projects' | 'engine' | 'hyundai'

const AREA_ICON: Record<CarArea, string> = { aero: '🌀', chassis: '🧩', powertrain: '⚡', reliability: '🛡' }
const AREA_HELP: Record<CarArea, string> = {
  aero: 'Appui et efficacité : décisif sur les circuits sinueux (Monaco, Hongrie, Singapour).',
  chassis: 'Suspension, poids, freinage : comportement général de la voiture.',
  powertrain: "Intégration du moteur fournisseur : refroidissement, ERS, installation. Pèse lourd à Monza, Bakou, Las Vegas.",
  reliability: 'Risque de panne en course et durée de vie des pièces.',
}

export function CarScreen() {
  const game = useGameState()
  const run = useAction()
  const [tab, setTab] = useState<Tab>('overview')
  const [newOpen, setNewOpen] = useState<CarArea | null>(null)
  const teamId = game.playerTeamId
  const car = game.cars[teamId]
  const dp = designPoints(game)
  const pu = supplierFor(game, teamId)
  const active = car.projects.filter((p) => p.status === 'design' || p.status === 'production')
  const history = car.projects.filter((p) => p.status === 'done' || p.status === 'failed').slice(-15).reverse()
  const rankOf = (a: CarArea) => Object.values(game.cars).filter((c) => c.ratings[a] > car.ratings[a]).length + 1
  const h = game.hyundai

  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="Technique"
        title="Voiture & R&D"
        sub={`Monoplace ${game.clock.season} · moteur ${pu.name} · ${expectedOrder(game).indexOf(teamId) + 1}e voiture du plateau`}
        actions={
          <Button variant="primary" disabled={active.length >= MAX_PROJECTS} onClick={() => setNewOpen('aero')}>
            + Nouveau projet ({active.length}/{MAX_PROJECTS})
          </Button>
        }
      >
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Aperçu' },
            { id: 'projects', label: `Projets${active.length ? ` (${active.length})` : ''}` },
            { id: 'engine', label: 'Moteur & allocation' },
            { id: 'hyundai', label: 'Programme Hyundai' },
          ]}
        />
      </PageTitle>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <Stat label="Performance globale" value={carScore(game, teamId).toFixed(1)} sub={`${expectedOrder(game).indexOf(teamId) + 1}e sur 11`} />
            </Card>
            <Card>
              <Stat label="Fiabilité" value={reliabilityScore(game, teamId).toFixed(1)} sub="Voiture + moteur" />
            </Card>
            <Card>
              <Stat label="Points de design / sem." value={Math.round(dp.total)} sub={dp.sanction < 1 ? 'Sanction FIA en cours' : `Restriction aéro (ATR) : ${Math.round(dp.atr * 100)} %`} />
            </Card>
            <Card>
              <Stat label="Puissance effective" value={effectivePower(game, teamId).toFixed(1)} sub={pu.name} />
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {CAR_AREAS.map((a) => {
              const proj = active.filter((p) => p.area === a)
              return (
                <Card key={a}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        <span>{AREA_ICON[a]}</span>
                        {AREA_LABEL[a]}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-400">{AREA_HELP[a]}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold tabular">{car.ratings[a].toFixed(1)}</div>
                      <div className="text-[11px] text-ink-400">{rankOf(a)}e du plateau</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Bar value={car.ratings[a]} tone="magma" height={8} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-ink-400">
                      {proj.length ? `${proj.length} projet(s) en cours` : 'Aucun projet en cours'}
                      {car.nextYearProgress[a] > 0 && <span className="ml-2 text-copper-300">+{car.nextYearProgress[a].toFixed(1)} pour {game.clock.season + 1}</span>}
                    </span>
                    <Button size="sm" disabled={active.length >= MAX_PROJECTS} onClick={() => setNewOpen(a)}>
                      Développer
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
          <Disclosure title="Comment sont calculés les points de design ?" summary={`${Math.round(dp.total)} / semaine`}>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <span className="text-ink-400">Encadrement technique</span>
              <span>×{dp.staff.toFixed(2)}</span>
              <span className="text-ink-400">Bureau d'études et CFD</span>
              <span>×{dp.facilities.toFixed(2)}</span>
              <span className="text-ink-400">Rendement aéro (soufflerie, CFD, ATR)</span>
              <span>×{dp.aeroMultiplier.toFixed(2)}</span>
              <span className="text-ink-400">Rendement moteur (laboratoire)</span>
              <span>×{dp.powertrainMultiplier.toFixed(2)}</span>
            </div>
            <p className="mt-2 text-xs text-ink-400">Les points sont partagés entre les projets en conception. Sans projet actif, ils sont perdus.</p>
          </Disclosure>
        </div>
      )}

      {tab === 'projects' && (
        <div className="space-y-4">
          {active.length === 0 ? (
            <Empty>
              Aucun projet en cours.{' '}
              <button className="font-semibold text-magma-500" onClick={() => setNewOpen('aero')}>
                Lancer un projet
              </button>
            </Empty>
          ) : (
            active.map((p) => (
              <Card key={p.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="mr-1">{AREA_ICON[p.area]}</span>
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-xs text-ink-400">
                      {' '}
                      · {AREA_LABEL[p.area]} · {AMBITION[p.ambition].label}
                    </span>
                    {p.nextYear && (
                      <Badge tone="copper" className="ml-2">
                        Voiture {game.clock.season + 1}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-400">
                    {p.status === 'design' ? `Conception ${Math.round(p.dpDone)}/${p.dpRequired} pts` : `En production : ${Math.max(0, Math.ceil(p.productionWeeksLeft))} sem.`}
                    {p.status === 'design' && (
                      <Button size="sm" variant="ghost" onClick={() => confirm('Abandonner ce projet ? Les coûts engagés sont perdus.') && run((s) => cancelProject(s, p.id))}>
                        Abandonner
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <Bar value={p.status === 'design' ? p.dpDone : p.productionWeeks - p.productionWeeksLeft} max={p.status === 'design' ? p.dpRequired : p.productionWeeks} tone={p.status === 'design' ? 'magma' : 'copper'} height={7} />
                </div>
                <div className="mt-2 text-xs text-ink-400">
                  Gain attendu +{p.expectedGain.toFixed(2)} · risque d'échec {Math.round(p.failureRisk * 100)} % · démarré le {formatDate(p.startedAt)}
                </div>
              </Card>
            ))
          )}
          <Disclosure title="Historique des pièces" summary={`${history.length} pièce(s)`}>
            {history.length === 0 ? (
              <p className="text-sm text-ink-400">Aucune pièce terminée.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Pièce</th>
                    <th className={th}>Domaine</th>
                    <th className={th}>Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id}>
                      <td className={td}>{p.name}</td>
                      <td className={td}>{AREA_LABEL[p.area]}</td>
                      <td className={td}>
                        {p.status === 'failed' ? (
                          <Badge tone="bad">Échec / abandon</Badge>
                        ) : (
                          <span className={p.result! >= 0 ? 'text-good' : 'text-bad'}>
                            {p.result! >= 0 ? '+' : ''}
                            {p.result!.toFixed(2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Disclosure>
        </div>
      )}

      {tab === 'engine' && (
        <Card title={`Groupe propulseur ${pu.name} — allocation de la saison`}>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Puissance" value={pu.power.toFixed(1)} />
            <Stat label="Fiabilité" value={pu.reliability.toFixed(1)} />
            <Stat label="Agrément" value={pu.driveability.toFixed(1)} />
          </div>
          <PuPanel locked={!!game.race} />
        </Card>
      )}

      {tab === 'hyundai' && (
        <Card title="Programme moteur Hyundai — Namyang">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3 text-sm">
              <div className="flex items-end justify-between">
                <span className="text-ink-400">Avancement</span>
                <span className="text-3xl font-bold tabular">{h.progress.toFixed(1)} %</span>
              </div>
              <Bar value={h.progress} tone="blue" height={10} />
              <div className="grid grid-cols-2 gap-2 text-xs text-ink-300">
                <span>Budget Hyundai : {fmtEur(h.budgetEur)}</span>
                <span>Engagé : {fmtEur(h.spentEur)}</span>
                <span>{h.engineers} ingénieurs à Namyang</span>
                <span>{h.secondedAtFerrari} détachés chez Ferrari</span>
                <span>Débuts prévus : {h.debutSeason}</span>
                <span>Puissance projetée : {game.powerUnits.hyundai?.power.toFixed(1)}</span>
              </div>
              {h.progress < 100 && (
                <Button onClick={() => run((s) => investInHyundai(s, 10_000_000), 'Contribution versée au programme moteur.')}>Contribuer 10 M€ (hors plafond)</Button>
              )}
            </div>
            <ol className="space-y-2">
              {h.milestones.map((m) => (
                <li key={m.id} className={cx('flex items-start gap-3 rounded-xl border px-3 py-2 text-sm', m.reached ? 'border-good/40 bg-good/5' : 'border-ink-700/70 bg-ink-850')}>
                  <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', m.reached ? 'bg-good text-white' : 'bg-ink-700 text-ink-400')}>{m.reached ? '✓' : m.at}</span>
                  <span>
                    {m.label}
                    <span className="block text-xs text-ink-400">{m.reached ? `Atteint le ${formatDate(m.reached)}` : `À ${m.at} % d'avancement`}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      )}

      <NewProjectModal area={newOpen} onClose={() => setNewOpen(null)} />
    </div>
  )
}

function NewProjectModal({ area: initial, onClose }: { area: CarArea | null; onClose: () => void }) {
  const game = useGameState()
  const run = useAction()
  const [area, setArea] = useState<CarArea>(initial ?? 'aero')
  const [tpl, setTpl] = useState<string | null>(null)
  const [ambition, setAmbition] = useState<Ambition>('standard')
  const [nextYear, setNextYear] = useState(false)
  const [lastInitial, setLastInitial] = useState(initial)
  if (initial !== lastInitial) {
    setLastInitial(initial)
    if (initial) {
      setArea(initial)
      setTpl(null)
    }
  }
  if (!initial) return <Modal open={false} onClose={onClose} title="">{null}</Modal>
  const templates = DATA.rndTemplates.filter((t) => t.area === area)
  const tplId = tpl && templates.some((t) => t.id === tpl) ? tpl : templates[0].id
  const p = previewProject(game, tplId, ambition, nextYear)
  const dp = designPoints(game)
  const designing = game.cars[game.playerTeamId].projects.filter((x) => x.status === 'design').length + 1
  const mul = area === 'aero' ? dp.aeroMultiplier : area === 'powertrain' ? dp.powertrainMultiplier : 1
  const weeks = Math.ceil(p.dpRequired / Math.max(1, (dp.total * mul) / designing))
  return (
    <Modal open onClose={onClose} title="Nouveau projet de R&D" wide>
      <div className="space-y-5">
        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-widest text-ink-400 uppercase">1. Domaine</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CAR_AREAS.map((a) => (
              <button key={a} onClick={() => setArea(a)} className={cx('rounded-xl border px-3 py-2.5 text-left text-sm', area === a ? 'border-magma-500 bg-magma-500/10 font-semibold' : 'border-ink-700 hover:border-ink-600')}>
                <span className="mr-1">{AREA_ICON[a]}</span>
                {AREA_LABEL[a]}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-widest text-ink-400 uppercase">2. Pièce</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((t) => (
              <button key={t.id} onClick={() => setTpl(t.id)} className={cx('rounded-xl border px-3 py-2.5 text-left text-sm', tplId === t.id ? 'border-magma-500 bg-magma-500/10' : 'border-ink-700 hover:border-ink-600')}>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-ink-400">
                  Gain de base +{t.gain} · {t.dp} pts de design
                </div>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-widest text-ink-400 uppercase">3. Ambition</h4>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(AMBITION) as Ambition[]).map((k) => (
              <button key={k} onClick={() => setAmbition(k)} className={cx('rounded-xl border px-3 py-2.5 text-left text-sm', ambition === k ? 'border-magma-500 bg-magma-500/10 font-semibold' : 'border-ink-700 hover:border-ink-600')}>
                {AMBITION[k].label}
                <div className="text-xs font-normal text-ink-400">
                  Échec {Math.round(AMBITION[k].failure * 100)} % · gain ×{AMBITION[k].gain}
                </div>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={nextYear} onChange={(e) => setNextYear(e.target.checked)} />
            Réserver la pièce pour la voiture {game.clock.season + 1}
          </label>
        </section>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl border border-ink-700/70 bg-ink-850 p-4 text-sm sm:grid-cols-3">
          <Stat label="Durée de conception" value={`~${weeks} sem.`} sub={`${p.dpRequired} pts`} />
          <Stat label="Coût de conception" value={fmtEur(p.designCostEur, 2)} />
          <Stat label="Production" value={fmtEur(p.unitCostEur * p.units, 2)} sub={`${p.units} unités · ${p.productionWeeks} sem.`} />
          <Stat label="Gain attendu" value={`+${p.expectedGain.toFixed(2)}`} sub={`± ${Math.round(p.variance * 100)} %`} />
          <Stat label="Risque d'échec" value={`${Math.round(p.failureRisk * 100)} %`} />
          <Stat label="Impact fiabilité" value={p.reliabilityImpact ? String(p.reliabilityImpact) : '—'} tone={p.reliabilityImpact < 0 ? 'warn' : undefined} />
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={() => {
              const r = run((s) => startProject(s, tplId, ambition, nextYear), 'Projet lancé.')
              if (!r || r.ok) onClose()
            }}
          >
            Lancer le projet
          </Button>
        </div>
      </div>
    </Modal>
  )
}
