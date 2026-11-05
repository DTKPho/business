import { useState } from 'react'
import { useGameState, useAction } from '../hooks'
import { Badge, Bar, Button, Card, Empty, PageTitle, Select, Stat, Table, td, th, cx } from '../components/ui'
import { PuPanel } from '../components/PuPanel'
import { AREA_LABEL, carScore, effectivePower, expectedOrder, reliabilityScore, supplierFor } from '../../engine/car/car'
import { AMBITION, MAX_PROJECTS, cancelProject, designPoints, previewProject, startProject } from '../../engine/car/rnd'
import { investInHyundai } from '../../engine/car/powerUnit'
import { DATA } from '../../engine/init/data'
import type { Ambition, CarArea } from '../../engine/model/types'
import { CAR_AREAS } from '../../engine/model/types'
import { fmtEur } from '../../engine/core/money'
import { formatDate } from '../../engine/core/time'

export function CarScreen() {
  const game = useGameState()
  const run = useAction()
  const teamId = game.playerTeamId
  const car = game.cars[teamId]
  const dp = designPoints(game)
  const pu = supplierFor(game, teamId)
  const [area, setArea] = useState<CarArea>('aero')
  const templates = DATA.rndTemplates.filter((t) => t.area === area)
  const [tpl, setTpl] = useState(templates[0].id)
  const [ambition, setAmbition] = useState<Ambition>('standard')
  const [nextYear, setNextYear] = useState(false)
  const tplId = templates.some((t) => t.id === tpl) ? tpl : templates[0].id
  const preview = previewProject(game, tplId, ambition, nextYear)
  const active = car.projects.filter((p) => p.status === 'design' || p.status === 'production')
  const history = car.projects.filter((p) => p.status === 'done' || p.status === 'failed').slice(-12).reverse()
  const rankOf = (a: CarArea) => Object.values(game.cars).filter((c) => c.ratings[a] > car.ratings[a]).length + 1
  const h = game.hyundai

  return (
    <div className="space-y-5">
      <PageTitle title="Voiture & R&D" sub={`Monoplace ${game.clock.season} · moteur ${pu.name}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Stat label="Performance globale" value={carScore(game, teamId).toFixed(1)} sub={`${expectedOrder(game).indexOf(teamId) + 1}e sur 11`} />
        </Card>
        <Card>
          <Stat label="Fiabilité (voiture + moteur)" value={reliabilityScore(game, teamId).toFixed(1)} />
        </Card>
        <Card>
          <Stat label="Points de design / semaine" value={Math.round(dp.total)} sub={`Aéro ×${dp.aeroMultiplier.toFixed(2)} (ATR ${Math.round(dp.atr * 100)} %)${dp.sanction < 1 ? ' · sanction FIA' : ''}`} />
        </Card>
        <Card>
          <Stat label="Puissance effective" value={effectivePower(game, teamId).toFixed(1)} sub={`${pu.name} : ${pu.power.toFixed(1)} ch. idx`} />
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Notes de la voiture">
          <div className="space-y-3">
            {CAR_AREAS.map((a) => (
              <div key={a}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{AREA_LABEL[a]}</span>
                  <span className="tabular">
                    {car.ratings[a].toFixed(1)} <span className="text-xs text-ink-400">· {rankOf(a)}e</span>
                    {car.nextYearProgress[a] > 0 && <span className="ml-2 text-xs text-copper-300">+{car.nextYearProgress[a].toFixed(1)} en {game.clock.season + 1}</span>}
                  </span>
                </div>
                <Bar value={car.ratings[a]} tone="magma" />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Le groupe motopropulseur combine le moteur du fournisseur (72 %) et l'intégration propre à l'écurie (28 %). Sans soufflerie en propre, l'efficacité aéro dépend de la location et du cluster CFD.
          </p>
        </Card>
        <Card title="Nouveau projet de R&D">
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Select<CarArea> value={area} onChange={(v) => setArea(v)} options={CAR_AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))} />
              <Select value={tplId} onChange={setTpl} options={templates.map((t) => ({ value: t.id, label: t.name }))} />
              <Select<Ambition> value={ambition} onChange={setAmbition} options={(Object.keys(AMBITION) as Ambition[]).map((k) => ({ value: k, label: AMBITION[k].label }))} />
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-300">
              <input type="checkbox" checked={nextYear} onChange={(e) => setNextYear(e.target.checked)} />
              Pour la voiture {game.clock.season + 1}
            </label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-ink-700 bg-ink-850 p-3 text-xs">
              <span className="text-ink-400">Points de design</span>
              <span className="tabular">
                {preview.dpRequired} (~{Math.ceil(preview.dpRequired / Math.max(1, (dp.total * (area === 'aero' ? dp.aeroMultiplier : area === 'powertrain' ? dp.powertrainMultiplier : 1)) / Math.max(1, active.filter((p) => p.status === 'design').length + 1)))} sem.)
              </span>
              <span className="text-ink-400">Coût de conception</span>
              <span className="tabular">{fmtEur(preview.designCostEur, 2)}</span>
              <span className="text-ink-400">Production</span>
              <span className="tabular">
                {preview.units} × {fmtEur(preview.unitCostEur, 2)} · {preview.productionWeeks} sem.
              </span>
              <span className="text-ink-400">Gain attendu</span>
              <span className="tabular">
                +{preview.expectedGain.toFixed(2)} (±{Math.round(preview.variance * 100)} %)
              </span>
              <span className="text-ink-400">Risque d'échec</span>
              <span className="tabular">{Math.round(preview.failureRisk * 100)} %</span>
              <span className="text-ink-400">Impact fiabilité</span>
              <span className={cx('tabular', preview.reliabilityImpact < 0 && 'text-warn')}>{preview.reliabilityImpact ? preview.reliabilityImpact : '—'}</span>
            </div>
            <Button variant="primary" disabled={active.length >= MAX_PROJECTS} onClick={() => run((s) => startProject(s, tplId, ambition, nextYear), 'Projet lancé.')}>
              Lancer le projet ({active.length}/{MAX_PROJECTS})
            </Button>
            <p className="text-[11px] text-ink-400">Les points de design sont partagés entre les projets en conception. Coûts comptés dans le plafond de dépenses.</p>
          </div>
        </Card>
      </div>
      <Card title="Projets en cours">
        {active.length === 0 ? (
          <Empty>Aucun projet en cours.</Empty>
        ) : (
          <div className="space-y-3">
            {active.map((p) => (
              <div key={p.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{p.name}</span> <span className="text-xs text-ink-400">· {AREA_LABEL[p.area]} · {AMBITION[p.ambition].label}</span>
                    {p.nextYear && <Badge tone="copper" className="ml-2">{game.clock.season + 1}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-400">
                    {p.status === 'design' ? `Conception ${Math.round(p.dpDone)}/${p.dpRequired}` : `Production : ${Math.max(0, Math.ceil(p.productionWeeksLeft))} sem.`}
                    {p.status === 'design' && (
                      <Button size="sm" variant="ghost" onClick={() => confirm('Abandonner ce projet ? Les coûts engagés sont perdus.') && run((s) => cancelProject(s, p.id))}>
                        Abandonner
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <Bar value={p.status === 'design' ? p.dpDone : p.productionWeeks - p.productionWeeksLeft} max={p.status === 'design' ? p.dpRequired : p.productionWeeks} tone={p.status === 'design' ? 'magma' : 'copper'} height={5} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Programme moteur Hyundai (Namyang)">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-400">Avancement</span>
              <span className="tabular">{h.progress.toFixed(1)} %</span>
            </div>
            <Bar value={h.progress} tone="blue" />
            <div className="grid grid-cols-2 gap-1 text-xs text-ink-300">
              <span>Budget Hyundai : {fmtEur(h.budgetEur)}</span>
              <span>Engagé : {fmtEur(h.spentEur)}</span>
              <span>{h.engineers} ingénieurs à Namyang</span>
              <span>{h.secondedAtFerrari} détachés chez Ferrari</span>
              <span>Débuts prévus : {h.debutSeason}</span>
              <span>Puissance projetée : {game.powerUnits.hyundai?.power.toFixed(1)}</span>
            </div>
            <ul className="space-y-1 text-xs">
              {h.milestones.map((m) => (
                <li key={m.id} className={m.reached ? 'text-good' : 'text-ink-400'}>
                  {m.reached ? '✓' : '○'} {m.label} ({m.at} %){m.reached ? ` — ${formatDate(m.reached)}` : ''}
                </li>
              ))}
            </ul>
            {h.progress < 100 && (
              <Button size="sm" onClick={() => run((s) => investInHyundai(s, 10_000_000), 'Contribution versée au programme moteur.')}>
                Contribuer 10 M€ (accélère le programme, hors plafond)
              </Button>
            )}
          </div>
        </Card>
        <Card title="Projets terminés">
          {history.length === 0 ? (
            <Empty>Aucun projet terminé.</Empty>
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
                    <td className={td}>{p.status === 'failed' ? <Badge tone="bad">Échec / abandon</Badge> : <span className={p.result! >= 0 ? 'text-good' : 'text-bad'}>{p.result! >= 0 ? '+' : ''}{p.result!.toFixed(2)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
      <Card title="Groupe propulseur — allocation de la saison">
        <PuPanel locked={!!game.race} />
      </Card>
    </div>
  )
}
