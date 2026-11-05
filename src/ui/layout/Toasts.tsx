import { useGame } from '../../store/gameStore'
import { cx } from '../components/ui'

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed right-3 bottom-3 left-3 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'pointer-events-auto w-full rounded-lg border px-3 py-2 text-sm shadow-lg whitespace-pre-line',
            t.kind === 'good' && 'border-good/40 bg-ink-850 text-good',
            t.kind === 'bad' && 'border-bad/40 bg-ink-850 text-bad',
            t.kind === 'info' && 'border-ink-600 bg-ink-850 text-ink-100',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
