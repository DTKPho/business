import { useGameState } from '../hooks'
import { Badge, Bar, Card, PageTitle, Stat, Table, cx, td, th } from '../components/ui'
import { ValuationChart } from '../components/ValuationChart'
import { SHAREHOLDER_LABEL, objectiveProgress } from '../../engine/board/objectives'
import { HOLDER_COLORS, leaverScenario, vestedFounderPct } from '../../engine/board/equity'
import { fmtEur, fmtPct } from '../../engine/core/money'
import { ageAt, formatDate, monthsBetween } from '../../engine/core/time'
import type { HolderId, ShareholderId } from '../../engine/model/types'

const ORDER: HolderId[] = ['hyundai', 'liam', 'redbird', 'arctos']

export function BoardScreen() {
  const game = useGameState()
  const e = game.equity
  const b = game.board
  const vested = vestedFounderPct(e, game.clock.date)
  const months = monthsBetween(e.founder.vestingStart, game.clock.date)
  const good = leaverScenario(game, 'good')
  const bad = leaverScenario(game, 'bad')
  const fmtObj = (v: number, kind: string) => (kind === 'valuation' ? `${v.toFixed(2).replace('.', ',')} Md€` : kind === 'cashAbove' || kind === 'sponsorIncome' ? `${Math.round(v)} M€` : kind === 'costCapRespected' ? (v ? 'oui' : 'non') : kind === 'hyundaiProgress' ? `${v.toFixed(0)} %` : v >= 99 ? '—' : String(Math.round(v)))

  return (
    <div className="space-y-5">
      <PageTitle title="Conseil d'administration & actionnariat" sub={`${game.player.firstName} ${game.player.lastName}, ${ageAt(game.player.birthDate, game.clock.date)} ans · ${game.player.title}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Stat label="Valorisation" value={fmtEur(b.valuationEur)} />
        </Card>
        <Card>
          <Stat label="Participation de Liam" value={fmtPct(e.stakes.liam)} sub={`≈ ${fmtEur((e.stakes.liam / 100) * b.valuationEur)}`} />
        </Card>
        <Card>
          <Stat label="Confiance du conseil" value={`${game.player.boardTrust}/100`} tone={game.player.boardTrust < 35 ? 'bad' : game.player.boardTrust < 55 ? 'warn' : 'good'} />
        </Card>
        <Card>
          <Stat label="Apport annuel des actionnaires" value={fmtEur(b.annualContributionEur)} sub="Indexé sur la satisfaction de Hyundai" />
        </Card>
      </div>
      <Card title="Répartition du capital">
        <div className="flex h-7 w-full gap-0.5 overflow-hidden rounded-md" role="img" aria-label="Répartition du capital">
          {ORDER.map((h) => (
            <div key={h} className="h-full first:rounded-l-md last:rounded-r-md" style={{ width: `${e.stakes[h]}%`, background: HOLDER_COLORS[h] }} title={`${SHAREHOLDER_LABEL[h]} : ${fmtPct(e.stakes[h])}`} />
          ))}
        </div>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {ORDER.map((h) => (
            <li key={h} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: HOLDER_COLORS[h] }} />
              <span className="flex-1 text-ink-300">{SHAREHOLDER_LABEL[h]}</span>
              <span className="font-semibold tabular">{fmtPct(e.stakes[h])}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-400">Les parts gagnées par Liam diluent les autres actionnaires au prorata ; Hyundai ne descend jamais sous {e.hyundaiFloor} %.</p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Satisfaction des actionnaires">
          <div className="space-y-3">
            {(['hyundai', 'redbird', 'arctos'] as ShareholderId[]).map((s) => (
              <div key={s}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{SHAREHOLDER_LABEL[s]}</span>
                  <span className="tabular">{Math.round(b.satisfaction[s])}/100</span>
                </div>
                <Bar value={b.satisfaction[s]} tone={b.satisfaction[s] >= 60 ? 'good' : b.satisfaction[s] >= 40 ? 'warn' : 'bad'} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Évolution de la valorisation">
          <ValuationChart points={b.valuationHistory} thresholds={e.earnOuts.map((x) => x.thresholdEur)} />
        </Card>
      </div>
      <Card title={`Objectifs de la saison ${game.clock.season}`} pad={false}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Actionnaire</th>
              <th className={th}>Objectif</th>
              <th className={cx(th, 'text-right')}>Actuel</th>
              <th className={th}>État</th>
            </tr>
          </thead>
          <tbody>
            {b.objectives.map((o) => {
              const p = objectiveProgress(game, o)
              return (
                <tr key={o.id}>
                  <td className={td}>{SHAREHOLDER_LABEL[o.by]}</td>
                  <td className={cx(td, 'whitespace-normal')}>{o.description}</td>
                  <td className={cx(td, 'text-right tabular')}>{fmtObj(p.value, o.condition.kind)}</td>
                  <td className={td}>{o.status === 'met' ? <Badge tone="good">Atteint</Badge> : o.status === 'failed' ? <Badge tone="bad">Manqué</Badge> : p.met ? <Badge tone="good">En bonne voie</Badge> : <Badge tone="warn">À atteindre</Badge>}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Parts de Liam Robert">
          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span>Parts achetées</span>
              <span className="tabular">
                {fmtPct(e.purchased.pct, 0)} · payées {fmtEur(e.purchased.paidEur)}
              </span>
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Parts de fondateur (vesting 4 ans, cliff 1 an)</span>
                <span className="tabular">
                  {fmtPct(vested)} / {fmtPct(e.founder.pct, 0)} acquis
                </span>
              </div>
              <Bar value={vested} max={e.founder.pct} tone="copper" marker={(e.founder.pct * e.founder.cliffMonths) / e.founder.durationMonths} />
              <div className="mt-1 text-xs text-ink-400">{months < e.founder.cliffMonths ? `Cliff : ${e.founder.cliffMonths - Math.max(0, months)} mois restants` : `${Math.min(months, e.founder.durationMonths)}/${e.founder.durationMonths} mois écoulés`}</div>
            </div>
            <div>
              <div className="mb-1 font-medium">Sweat equity (4 × 2 %)</div>
              <ul className="space-y-1 text-xs">
                {e.sweat.map((s) => (
                  <li key={s.id} className={s.unlockedAt ? 'text-good' : 'text-ink-300'}>
                    {s.unlockedAt ? '✓' : '○'} {s.label} (+{s.pct} %){s.unlockedAt ? ` — débloqué le ${formatDate(s.unlockedAt)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 font-medium">Earn-out</div>
              <ul className="space-y-1 text-xs">
                {e.earnOuts.map((x) => (
                  <li key={x.thresholdEur} className={x.unlockedAt ? 'text-good' : 'text-ink-300'}>
                    {x.unlockedAt ? '✓' : '○'} Valorisation ≥ {fmtEur(x.thresholdEur)} (+{x.pct} %){!x.unlockedAt && ` — actuellement ${Math.round((b.valuationEur / x.thresholdEur) * 100)} %`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
        <Card title="Clauses de départ (good leaver / bad leaver)">
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-good/30 bg-good/5 p-3">
              <div className="flex justify-between font-medium">
                <span>Good leaver</span>
                <span className="tabular">
                  {fmtPct(good.pct)} · {fmtEur(good.valueEur)}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-400">{good.note}</p>
            </div>
            <div className="rounded-lg border border-bad/30 bg-bad/5 p-3">
              <div className="flex justify-between font-medium">
                <span>Bad leaver</span>
                <span className="tabular">
                  {fmtPct(bad.pct)} · {fmtEur(bad.valueEur)}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-400">{bad.note}</p>
            </div>
            <p className="text-xs text-ink-400">Une confiance du conseil durablement sous 20/100 déclenche un vote de défiance en fin de saison.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
