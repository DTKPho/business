import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Button, cx } from '../components/ui'
import { formatDate } from '../../engine/core/time'
import { fmtEur, fmtUsd } from '../../engine/core/money'
import { advance, advanceToNext } from '../../engine/season/loop'
import { nextEvent } from '../../engine/season/weekend'
import { costCapProjection } from '../../engine/finance/weekly'
import type { AdvanceResult } from '../../engine/season/loop'
import { exportToFile } from '../../persistence/exportImport'

const PHASE: Record<string, string> = { preseason: 'Pré-saison', season: 'Saison', raceWeekend: 'Week-end de course', postseason: 'Intersaison' }

export function TopBar() {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const setScreen = useGame((s) => s.setScreen)
  const setOverlay = useGame((s) => s.setOverlay)
  const quit = useGame((s) => s.quit)
  const saving = useGame((s) => s.saving)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const f = game.finances
  const capPct = (f.costCap.spentUsd / f.costCap.limitUsd) * 100
  const projection = costCapProjection(game)
  const ev = nextEvent(game)
  const circuit = ev ? game.circuits[ev.circuitId] : null

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

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

  const item = (label: string, fn: () => void, danger = false) => (
    <button
      onClick={() => {
        setMenu(false)
        fn()
      }}
      className={cx('block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-800', danger ? 'text-bad' : 'text-ink-100')}
    >
      {label}
    </button>
  )

  return (
    <header className="glass sticky top-0 z-30 border-b border-ink-700/70">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{formatDate(game.clock.date)}</div>
          <div className="text-[11px] text-ink-400">
            {PHASE[game.clock.phase]} {game.clock.season}
            {circuit && game.clock.phase !== 'raceWeekend' ? ` · Prochain : ${circuit.flag ?? ''} ${circuit.gpName.replace('Grand Prix ', 'GP ')}` : ''}
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg border border-ink-700/70 bg-ink-850 px-2.5 py-1">
            <span className="text-ink-400">Trésorerie </span>
            <span className={cx('tabular font-semibold', f.cashEur < 0 ? 'text-bad' : '')}>{fmtEur(f.cashEur)}</span>
          </span>
          <span className="flex items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-850 px-2.5 py-1" title={`Projection fin de saison : ${fmtUsd(projection)}`}>
            <span className="text-ink-400">Plafond</span>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-700">
              <span className={cx('block h-full', capPct > 100 ? 'bg-bad' : projection > f.costCap.limitUsd ? 'bg-warn' : 'bg-good')} style={{ width: `${Math.min(100, capPct)}%` }} />
            </span>
            <span className="tabular">{Math.round(capPct)} %</span>
          </span>
          <span className="rounded-lg border border-ink-700/70 bg-ink-850 px-2.5 py-1">
            <span className="text-ink-400">Conseil </span>
            <span className={cx('tabular font-semibold', game.player.boardTrust < 35 ? 'text-bad' : game.player.boardTrust < 55 ? 'text-warn' : 'text-good')}>{game.player.boardTrust}/100</span>
          </span>
          {game.meta.cheats?.used && <span className="rounded-lg bg-copper-400/15 px-2 py-1 text-[11px] text-copper-300">✦ triche</span>}
          <span className="hidden text-[11px] text-ink-400 sm:inline">{saving ? 'Sauvegarde…' : '✓ Sauvegardé'}</span>
        </div>
        <div className="flex items-center gap-2">
          {game.clock.phase === 'raceWeekend' ? (
            <Button variant="primary" onClick={() => setScreen('weekend')}>
              ⚑ Week-end en cours
            </Button>
          ) : (
            <>
              <Button onClick={() => handle(act(advance))} title="Avancer d'une semaine">
                +1 semaine
              </Button>
              <Button variant="primary" onClick={() => handle(act(advanceToNext, { save: 'now' }))} title="Avancer jusqu'au prochain événement important">
                Continuer ▸
              </Button>
            </>
          )}
          <div className="relative" ref={menuRef}>
            <Button onClick={() => setMenu(!menu)} title="Menu">
              ☰ Menu
            </Button>
            {menu && (
              <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-ink-700 bg-ink-950 p-1.5 shadow-2xl">
                {item('⚙  Paramètres d’affichage', () => setOverlay('settings'))}
                {item('✦  Menu de triche', () => setOverlay('cheats'))}
                {item('⛁  Sauvegardes', () => setScreen('saves'))}
                {item('⇩  Exporter la partie (JSON)', () => exportToFile(game))}
                <div className="my-1 border-t border-ink-700" />
                {item('⏏  Retour au menu principal', quit, true)}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
