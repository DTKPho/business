import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Button, cx } from '../components/ui'
import { formatDate } from '../../engine/core/time'
import { fmtEur, fmtUsd } from '../../engine/core/money'
import { advance, advanceToNext } from '../../engine/season/loop'
import { nextEvent } from '../../engine/season/weekend'
import { costCapProjection } from '../../engine/finance/weekly'
import type { AdvanceResult } from '../../engine/season/loop'

const PHASE: Record<string, string> = { preseason: 'Pré-saison', season: 'Saison', raceWeekend: 'Week-end de course', postseason: 'Intersaison' }

export function TopBar() {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const setScreen = useGame((s) => s.setScreen)
  const saving = useGame((s) => s.saving)
  const f = game.finances
  const capPct = (f.costCap.spentUsd / f.costCap.limitUsd) * 100
  const projection = costCapProjection(game)
  const ev = nextEvent(game)
  const circuit = ev ? game.circuits[ev.circuitId] : null

  const handle = (r: AdvanceResult) => {
    if (!r.ok) return toast(r.reason ?? 'Impossible d’avancer.', 'bad')
    if (r.event === 'weekend') {
      toast('Week-end de course ! Direction le paddock.', 'good')
      setScreen('weekend')
    } else if (r.event === 'newSeason') {
      toast('Nouvelle saison : la pré-saison commence.', 'good')
      setScreen('inbox')
    } else if (r.reason) {
      toast(r.reason)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{formatDate(game.clock.date)}</div>
          <div className="text-[11px] text-ink-400">
            {PHASE[game.clock.phase]} {game.clock.season}
            {circuit && game.clock.phase !== 'raceWeekend' ? ` · Prochain : ${circuit.gpName.replace('Grand Prix ', 'GP ')} (${formatDate(ev!.date)})` : ''}
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <div>
            <span className="text-ink-400">Trésorerie </span>
            <span className={cx('tabular font-semibold', f.cashEur < 0 ? 'text-bad' : 'text-ink-100')}>{fmtEur(f.cashEur)}</span>
          </div>
          <div className="flex items-center gap-2" title={`Projection fin de saison : ${fmtUsd(projection)}`}>
            <span className="text-ink-400">Plafond</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-700">
              <div className={cx('h-full', capPct > 100 ? 'bg-bad' : projection > f.costCap.limitUsd ? 'bg-warn' : 'bg-good')} style={{ width: `${Math.min(100, capPct)}%` }} />
            </div>
            <span className="tabular">
              {fmtUsd(f.costCap.spentUsd, 0)} / {fmtUsd(f.costCap.limitUsd, 0)}
            </span>
          </div>
          <div>
            <span className="text-ink-400">Confiance du conseil </span>
            <span className={cx('tabular font-semibold', game.player.boardTrust < 35 ? 'text-bad' : game.player.boardTrust < 55 ? 'text-warn' : 'text-good')}>{game.player.boardTrust}/100</span>
          </div>
          <span className="text-[11px] text-ink-600">{saving ? 'Sauvegarde…' : 'Sauvegardé'}</span>
        </div>
        <div className="flex gap-2">
          {game.clock.phase === 'raceWeekend' ? (
            <Button variant="primary" onClick={() => setScreen('weekend')}>
              ⚑ Week-end en cours
            </Button>
          ) : (
            <>
              <Button onClick={() => handle(act(advance))} title="Avancer d'une semaine">
                Semaine suivante
              </Button>
              <Button variant="primary" onClick={() => handle(act(advanceToNext, { save: 'now' }))} title="Avancer jusqu'au prochain événement important">
                Continuer ▸
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
