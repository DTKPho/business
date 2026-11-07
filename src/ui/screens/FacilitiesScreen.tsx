import { useState } from 'react'
import { useGameState, useAction } from '../hooks'
import { Badge, Bar, Button, Card, Modal, PageTitle, Stat, Tile, cx } from '../components/ui'
import { facilityImage } from '../components/Scene'
import { BRANCH_LABEL, canUpgrade, cancelUpgrade, downgrade, monthlyFacilityCost, rushCost, rushUpgrade, sellValue, startUpgrade, teamAttractiveness, upgradeCost } from '../../engine/facilities/facilities'
import type { Facility, FacilityBranch } from '../../engine/model/types'
import { fmtEur } from '../../engine/core/money'

const EFFECT_LABEL: Record<string, (v: number) => string> = {
  aeroEfficiency: (v) => `Efficacité aéro ×${v.toFixed(2)}`,
  designPoints: (v) => `Points de design +${Math.round(v * 100)} %`,
  productionCost: (v) => `Coûts de production ${Math.round(v * 100)} %`,
  partQuality: (v) => `Qualité des pièces +${Math.round(v * 100)} %`,
  setupConfidence: (v) => `Confiance réglages +${v}`,
  driverGrowth: (v) => `Progression pilotes +${v.toFixed(1)}/an`,
  powertrainEfficiency: (v) => `Efficacité R&D moteur ×${v.toFixed(2)}`,
  hyundaiProgress: (v) => `Programme Hyundai +${Math.round(v * 100)} %`,
  morale: (v) => `Moral +${v}`,
  staffGrowth: (v) => `Progression du staff +${v.toFixed(2)}`,
  attractiveness: (v) => `Attractivité +${v}`,
  logisticsCost: (v) => `Coûts logistiques ${Math.round(v * 100)} %`,
  strategy: (v) => `Stratégie +${v}`,
  reliabilityOps: (v) => `Pannes −${Math.round(v * 100)} %`,
  pitTraining: (v) => `Arrêts aux stands −${(v * 0.15).toFixed(2)} s`,
  sponsorAppeal: (v) => `Valeur des offres sponsors +${Math.round(v * 100)} %`,
  sponsorSatisfaction: (v) => `Satisfaction sponsors +${v}/mois`,
}

export function effectLines(f: Facility, level: number): string[] {
  return f.effects.map((e) => EFFECT_LABEL[e.key]?.((e.base ?? 0) + e.perLevel * level) ?? e.key)
}

function LevelPips({ f }: { f: Facility }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: f.maxLevel }, (_, i) => (
        <span key={i} className={cx('h-1.5 w-5 rounded-full', i < f.level ? 'bg-magma-500' : f.upgrade && i === f.level ? 'bg-copper-400' : 'bg-ink-700')} />
      ))}
    </div>
  )
}

function status(f: Facility): { label: string; tone: 'warn' | 'copper' | 'good' | 'neutral' } {
  if (f.upgrade) return { label: `Travaux · ${Math.ceil(f.upgrade.weeksLeft)} sem.`, tone: 'copper' }
  if (f.level === 0) return { label: f.id === 'windTunnel' ? 'Louée' : 'Non construite', tone: 'warn' }
  if (f.level >= f.maxLevel) return { label: 'Niveau max', tone: 'good' }
  return { label: `Niveau ${f.level}`, tone: 'neutral' }
}

export function FacilitiesScreen() {
  const game = useGameState()
  const [open, setOpen] = useState<string | null>(null)
  const [branch, setBranch] = useState<FacilityBranch | 'all'>('all')
  const branches: FacilityBranch[] = ['carDevelopment', 'staff', 'operations']
  const works = Object.values(game.facilities).filter((f) => f.upgrade).length
  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Technique" title="Installations — campus de Brackley" sub="Cliquez sur une installation pour la visiter, l'améliorer ou la revendre." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat label="Coût de fonctionnement" value={`${fmtEur(monthlyFacilityCost(game))}/mois`} sub="Compté dans le plafond" />
        </Card>
        <Card>
          <Stat label="Attractivité" value={`${Math.round(teamAttractiveness(game))}/100`} sub="Recrutement et rétention" />
        </Card>
        <Card>
          <Stat label="Chantiers en cours" value={works} sub="Investissements hors plafond" />
        </Card>
      </div>
      <div className="glass inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-ink-700/70 p-1">
        {(['all', ...branches] as const).map((b) => (
          <button key={b} onClick={() => setBranch(b)} className={cx('rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap', branch === b ? 'bg-magma-500 text-white' : 'text-ink-300 hover:bg-ink-800')}>
            {b === 'all' ? 'Tout le campus' : BRANCH_LABEL[b]}
          </button>
        ))}
      </div>
      {branches
        .filter((b) => branch === 'all' || branch === b)
        .map((b) => (
          <section key={b}>
            <h2 className="mb-2 text-xs font-semibold tracking-[0.18em] text-ink-400 uppercase">{BRANCH_LABEL[b]}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.values(game.facilities)
                .filter((f) => f.branch === b)
                .map((f) => {
                  const st = status(f)
                  return (
                    <Tile key={f.id} onClick={() => setOpen(f.id)}>
                      <div className="relative aspect-[16/8] overflow-hidden">
                        <img src={facilityImage(f.id)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute top-2 right-2">
                          <Badge tone={st.tone} className="bg-ink-950/90">
                            {st.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{f.name}</span>
                          <LevelPips f={f} />
                        </div>
                        <div className="truncate text-xs text-ink-400">{effectLines(f, f.level)[0]}</div>
                      </div>
                    </Tile>
                  )
                })}
            </div>
          </section>
        ))}
      <FacilityModal id={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function FacilityModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const game = useGameState()
  const run = useAction()
  const f = id ? game.facilities[id] : null
  if (!f) return <Modal open={false} onClose={onClose} title="">{null}</Modal>
  const check = canUpgrade(game, f.id)
  const cost = upgradeCost(f)
  const st = status(f)
  const next = f.level < f.maxLevel ? f.levels[f.level] : null
  return (
    <Modal open onClose={onClose} title={f.name} wide>
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl">
          <img src={facilityImage(f.id)} alt={f.name} className="aspect-[16/7] w-full object-cover" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <Badge tone={st.tone} className="bg-ink-950/90">
              {st.label}
            </Badge>
            <span className="rounded-md bg-ink-950/90 px-2 py-1">
              <LevelPips f={f} />
            </span>
          </div>
        </div>
        <p className="text-sm text-ink-300">{f.description}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-ink-700/70 bg-ink-850 p-3 text-sm">
            <div className="mb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">Actuellement (niveau {f.level})</div>
            <ul className="space-y-0.5">
              {effectLines(f, f.level).map((l) => (
                <li key={l}>• {l}</li>
              ))}
            </ul>
            <div className="mt-2 text-xs text-ink-400">Fonctionnement : {fmtEur(f.levels[f.level]?.monthlyCostEur ?? 0)}/mois</div>
          </div>
          {next && (
            <div className="rounded-xl border border-magma-500/40 bg-magma-500/5 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold tracking-wide text-magma-500 uppercase">Niveau {f.level + 1}</div>
              <ul className="space-y-0.5">
                {effectLines(f, f.level + 1).map((l) => (
                  <li key={l}>• {l}</li>
                ))}
              </ul>
              <div className="mt-2 text-xs text-ink-400">
                Fonctionnement : {fmtEur(f.levels[f.level + 1]?.monthlyCostEur ?? 0)}/mois · chantier de {next.weeks} semaines
              </div>
            </div>
          )}
        </div>
        {f.upgrade && (
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>Travaux vers le niveau {f.upgrade.toLevel}</span>
              <span>{Math.ceil(f.upgrade.weeksLeft)} sem. restantes</span>
            </div>
            <Bar value={(f.levels[f.level].weeks || 1) - f.upgrade.weeksLeft} max={f.levels[f.level].weeks || 1} tone="copper" />
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-ink-700/70 pt-4">
          {!f.upgrade && f.level < f.maxLevel && (
            <Button variant="primary" disabled={!check.ok} title={check.reason} onClick={() => run((s) => startUpgrade(s, f.id), 'Travaux lancés.')}>
              {f.level === 0 ? (f.id === 'windTunnel' ? 'Construire notre soufflerie' : 'Construire') : `Améliorer au niveau ${f.level + 1}`} — {fmtEur(cost)}
            </Button>
          )}
          {f.upgrade && (
            <>
              <Button variant="primary" onClick={() => run((s) => rushUpgrade(s, f.id), 'Travaux accélérés.')}>
                Accélérer les travaux — {fmtEur(rushCost(f))}
              </Button>
              <Button variant="danger" onClick={() => confirm('Annuler le chantier ? 50 % du coût est remboursé.') && run((s) => cancelUpgrade(s, f.id), 'Chantier annulé.')}>
                Annuler le chantier
              </Button>
            </>
          )}
          {!f.upgrade && f.level > 0 && (
            <Button variant="ghost" onClick={() => confirm(`Revendre un niveau de ${f.name} pour ${fmtEur(sellValue(f))} ?`) && run((s) => downgrade(s, f.id), 'Niveau revendu.')}>
              Revendre un niveau (+{fmtEur(sellValue(f))})
            </Button>
          )}
          {!check.ok && !f.upgrade && f.level < f.maxLevel && <span className="self-center text-xs text-bad">{check.reason}</span>}
        </div>
      </div>
    </Modal>
  )
}

