import { useGameState, useAction } from '../hooks'
import { Badge, Bar, Button, Card, PageTitle, Stat } from '../components/ui'
import { BRANCH_LABEL, canUpgrade, monthlyFacilityCost, startUpgrade, teamAttractiveness, upgradeCost } from '../../engine/facilities/facilities'
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

function effectText(f: Facility, level: number): string {
  return f.effects.map((e) => EFFECT_LABEL[e.key]?.((e.base ?? 0) + e.perLevel * level) ?? e.key).join(' · ')
}

export function FacilitiesScreen() {
  const game = useGameState()
  const branches: FacilityBranch[] = ['carDevelopment', 'staff', 'operations']
  return (
    <div className="space-y-5">
      <PageTitle title="Installations — campus de Brackley" sub="Les investissements d'infrastructure sont hors plafond ; les coûts de fonctionnement y sont inclus." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat label="Coût mensuel de fonctionnement" value={fmtEur(monthlyFacilityCost(game))} />
        </Card>
        <Card>
          <Stat label="Attractivité de l'écurie" value={`${Math.round(teamAttractiveness(game))}/100`} sub="Recrutement et rétention" />
        </Card>
        <Card>
          <Stat label="Soufflerie" value={game.facilities.windTunnel.level === 0 ? 'Louée' : `Niveau ${game.facilities.windTunnel.level}`} sub={game.facilities.windTunnel.level === 0 ? 'Location hebdomadaire en cours' : 'En propre'} />
        </Card>
      </div>
      {branches.map((b) => (
        <section key={b}>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-copper-300 uppercase">{BRANCH_LABEL[b]}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Object.values(game.facilities)
              .filter((f) => f.branch === b)
              .map((f) => (
                <FacilityCard key={f.id} f={f} />
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function FacilityCard({ f }: { f: Facility }) {
  const game = useGameState()
  const run = useAction()
  const check = canUpgrade(game, f.id)
  const next = f.levels[f.level]
  return (
    <Card title={f.name} actions={<Badge tone={f.level === 0 ? 'warn' : 'copper'}>Niv. {f.level}/{f.maxLevel}</Badge>}>
      <div className="space-y-2 text-sm">
        <p className="text-xs text-ink-400">{f.description}</p>
        <div className="text-xs">{effectText(f, f.level)}</div>
        <div className="text-xs text-ink-400">Fonctionnement : {fmtEur(f.levels[f.level]?.monthlyCostEur ?? 0)}/mois</div>
        {f.upgrade ? (
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>Travaux vers le niveau {f.upgrade.toLevel}</span>
              <span>{Math.ceil(f.upgrade.weeksLeft)} sem.</span>
            </div>
            <Bar value={(f.levels[f.level].weeks || 1) - f.upgrade.weeksLeft} max={f.levels[f.level].weeks || 1} tone="copper" />
          </div>
        ) : f.level < f.maxLevel ? (
          <div className="space-y-1.5 border-t border-ink-800 pt-2">
            <div className="text-xs text-ink-300">Niveau {f.level + 1} : {effectText(f, f.level + 1)}</div>
            <Button size="sm" variant="primary" disabled={!check.ok} title={check.reason} onClick={() => confirm(`Lancer les travaux pour ${fmtEur(upgradeCost(f))} ?`) && run((s) => startUpgrade(s, f.id), 'Travaux lancés.')}>
              Améliorer — {fmtEur(upgradeCost(f))} · {next.weeks} sem.
            </Button>
          </div>
        ) : (
          <div className="text-xs text-good">Niveau maximal</div>
        )}
      </div>
    </Card>
  )
}

