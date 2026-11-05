import { useGame } from '../../store/gameStore'
import { useGameState } from "../hooks"
import { Badge, Bar, Button, Card, PageTitle, Stat, Table, cx, td, th } from '../components/ui'
import { TX_LABEL, seasonLedger, totalsByCategory } from '../../engine/finance/ledger'
import { costCapProjection } from '../../engine/finance/weekly'
import { TIER_LABEL, TIER_SLOTS, activeSponsors, approachSponsor, slotsUsed, sponsorIncomeAnnual } from '../../engine/finance/sponsors'
import { conditionMet } from '../../engine/board/conditions'
import { fmtEur, fmtUsd } from '../../engine/core/money'
import { formatDate } from '../../engine/core/time'
import { Rng } from '../../engine/core/rng'
import type { TxCategory } from '../../engine/model/types'

export function FinancesScreen() {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const f = game.finances
  const proj = costCapProjection(game)
  const totals = totalsByCategory(game)
  const income = Object.values(totals).reduce((s, t) => s + t.income, 0)
  const expense = Object.values(totals).reduce((s, t) => s + t.expense, 0)
  const ledger = seasonLedger(game).slice(-60).reverse()
  const rep = game.teams[game.playerTeamId].reputation
  const available = Object.values(game.sponsors).filter((s) => s.status === 'available' || s.status === 'offer' || s.status === 'expired')
  const capPct = (f.costCap.spentUsd / f.costCap.limitUsd) * 100

  return (
    <div className="space-y-5">
      <PageTitle title="Finances" sub={`Saison ${game.clock.season} · taux de conversion 1 $ = ${f.eurPerUsd.toFixed(2)} €`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Stat label="Trésorerie" value={fmtEur(f.cashEur)} tone={f.cashEur < 0 ? 'bad' : undefined} />
        </Card>
        <Card>
          <Stat label="Recettes de la saison" value={fmtEur(income)} />
        </Card>
        <Card>
          <Stat label="Dépenses de la saison" value={fmtEur(expense)} />
        </Card>
        <Card>
          <Stat label="Revenus sponsors annuels" value={fmtEur(sponsorIncomeAnnual(game))} />
        </Card>
      </div>
      <Card title="Plafond de dépenses (cost cap)">
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span>
              Dépensé : <strong className="tabular">{fmtUsd(f.costCap.spentUsd)}</strong> sur {fmtUsd(f.costCap.limitUsd)} ({capPct.toFixed(1)} %)
            </span>
            <span className={cx('tabular', proj > f.costCap.limitUsd ? 'text-warn' : 'text-good')}>Projection fin de saison : {fmtUsd(proj)}</span>
          </div>
          <Bar value={f.costCap.spentUsd} max={f.costCap.limitUsd} tone={capPct > 100 ? 'bad' : proj > f.costCap.limitUsd ? 'warn' : 'good'} height={10} marker={Math.min(proj, f.costCap.limitUsd)} />
          <p className="text-xs text-ink-400">Hors plafond : salaires des pilotes et du directeur technique, investissements d'infrastructure, indemnités de transfert, programme moteur Hyundai. Dépassement &lt; 5 % : amende ; au-delà : amende et −15 % de capacité de développement.</p>
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Répartition par poste (saison)">
          <Table>
            <thead>
              <tr>
                <th className={th}>Poste</th>
                <th className={cx(th, 'text-right')}>Recettes</th>
                <th className={cx(th, 'text-right')}>Dépenses</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(totals)
                .sort((a, b) => b[1].expense + b[1].income - (a[1].expense + a[1].income))
                .map(([k, v]) => (
                  <tr key={k}>
                    <td className={td}>{TX_LABEL[k as TxCategory] ?? k}</td>
                    <td className={cx(td, 'text-right tabular text-good')}>{v.income ? fmtEur(v.income) : ''}</td>
                    <td className={cx(td, 'text-right tabular')}>{v.expense ? fmtEur(v.expense) : ''}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Card>
        <Card title="Sponsors actifs">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {(Object.keys(TIER_SLOTS) as (keyof typeof TIER_SLOTS)[]).map((t) => (
              <Badge key={t}>
                {TIER_LABEL[t]} : {slotsUsed(game, t)}/{TIER_SLOTS[t]}
              </Badge>
            ))}
          </div>
          <ul className="space-y-3">
            {activeSponsors(game).map((s) => (
              <li key={s.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {s.name} <span className="text-xs text-ink-400">· {s.sector}</span>
                  </span>
                  <span className="text-xs">
                    <Badge tone={s.tier === 'title' ? 'magma' : s.tier === 'major' ? 'copper' : 'neutral'}>{TIER_LABEL[s.tier]}</Badge> {fmtEur(s.annualEur)}/an → {s.endSeason}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-400">
                  Satisfaction <Bar value={s.satisfaction} tone={s.satisfaction >= 60 ? 'good' : s.satisfaction >= 40 ? 'warn' : 'bad'} height={4} />
                </div>
                {s.objectives.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {s.objectives.map((o, i) => (
                      <li key={i} className={conditionMet(game, o.condition) ? 'text-good' : 'text-ink-300'}>
                        {conditionMet(game, o.condition) ? '✓' : '○'} {o.description} (+{fmtEur(o.bonusEur)})
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Marques à démarcher">
        <Table>
          <thead>
            <tr>
              <th className={th}>Marque</th>
              <th className={th}>Secteur</th>
              <th className={th}>Niveau</th>
              <th className={cx(th, 'text-right')}>Réputation requise</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {available.map((s) => (
              <tr key={s.id}>
                <td className={td}>{s.name}</td>
                <td className={td}>{s.sector}</td>
                <td className={td}>{TIER_LABEL[s.tier]}</td>
                <td className={cx(td, 'text-right tabular', s.minReputation > rep && 'text-bad')}>{s.minReputation}</td>
                <td className={cx(td, 'text-right')}>
                  {s.status === 'offer' ? (
                    <Badge tone="warn">Offre en attente</Badge>
                  ) : s.status === 'expired' ? (
                    <Badge>Refus cette saison</Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        const r = act((st) => approachSponsor(st, s.id, new Rng(st.meta.rng)), { save: 'now' })
                        toast(r.reason, r.ok ? 'good' : 'bad')
                      }}
                    >
                      Démarcher
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-ink-400">Réputation actuelle de Genesis : {Math.round(rep)}/100. Un refus bloque la marque jusqu'à la saison suivante.</p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Dernières opérations">
          <ul className="max-h-96 divide-y divide-ink-800 overflow-y-auto text-xs">
            {ledger.map((t, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5">
                <span className="w-20 shrink-0 text-ink-400">{formatDate(t.date)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {t.label} {t.inCostCap && <span className="text-[10px] text-ink-600">(plafond)</span>}
                </span>
                <span className={cx('tabular', t.amountEur >= 0 ? 'text-good' : 'text-ink-100')}>{fmtEur(t.amountEur, 2)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Bilans des saisons passées">
          {f.seasonSummaries.length === 0 ? (
            <p className="text-sm text-ink-400">Disponible après la première saison.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>Saison</th>
                  <th className={cx(th, 'text-right')}>Recettes</th>
                  <th className={cx(th, 'text-right')}>Dépenses</th>
                  <th className={cx(th, 'text-right')}>Plafond</th>
                </tr>
              </thead>
              <tbody>
                {[...f.seasonSummaries].reverse().map((s) => (
                  <tr key={s.season}>
                    <td className={td}>{s.season}</td>
                    <td className={cx(td, 'text-right tabular')}>{fmtEur(s.incomeEur)}</td>
                    <td className={cx(td, 'text-right tabular')}>{fmtEur(s.expenseEur)}</td>
                    <td className={cx(td, 'text-right tabular', s.breach !== 'none' && 'text-bad')}>
                      {fmtUsd(s.capSpentUsd, 0)} / {fmtUsd(s.capLimitUsd, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}
