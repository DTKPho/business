import type { ReactNode } from 'react'
import { useEffect } from 'react'

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ')
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-ink-700 bg-ink-900', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-ink-100 uppercase">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  title,
  size = 'md',
  className,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  disabled?: boolean
  title?: string
  size?: 'sm' | 'md'
  className?: string
  type?: 'button' | 'submit'
}) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-magma-500 text-white hover:bg-magma-400 disabled:bg-ink-700 disabled:text-ink-400',
    secondary: 'bg-ink-800 text-ink-100 border border-ink-600 hover:border-copper-400 disabled:text-ink-400 disabled:hover:border-ink-600',
    ghost: 'text-ink-300 hover:text-ink-100 hover:bg-ink-800 disabled:text-ink-600',
    danger: 'bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25 disabled:opacity-40',
  }
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm',
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'magma' | 'good' | 'warn' | 'bad' | 'copper'; className?: string }) {
  const t = {
    neutral: 'bg-ink-800 text-ink-300 border-ink-600',
    magma: 'bg-magma-500/15 text-magma-400 border-magma-500/40',
    good: 'bg-good/10 text-good border-good/30',
    warn: 'bg-warn/10 text-warn border-warn/30',
    bad: 'bg-bad/10 text-bad border-bad/30',
    copper: 'bg-copper-400/10 text-copper-300 border-copper-400/30',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap', t, className)}>{children}</span>
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] tracking-wide text-ink-400 uppercase">{label}</div>
      <div className={cx('tabular truncate text-xl font-semibold', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>{value}</div>
      {sub && <div className="truncate text-xs text-ink-400">{sub}</div>}
    </div>
  )
}

/** Barre de progression horizontale (0–max). */
export function Bar({ value, max = 100, tone = 'magma', height = 6, marker }: { value: number; max?: number; tone?: 'magma' | 'good' | 'warn' | 'bad' | 'copper' | 'blue'; height?: number; marker?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color = { magma: 'bg-magma-500', good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', copper: 'bg-copper-400', blue: 'bg-[#5b8cff]' }[tone]
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-ink-700" style={{ height }}>
      <div className={cx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      {marker !== undefined && <div className="absolute top-0 h-full w-0.5 bg-ink-100" style={{ left: `${Math.min(100, (marker / max) * 100)}%` }} />}
    </div>
  )
}

export function ratingTone(v: number): 'good' | 'copper' | 'warn' | 'bad' {
  if (v >= 85) return 'good'
  if (v >= 75) return 'copper'
  if (v >= 62) return 'warn'
  return 'bad'
}

export function RatingRow({ label, value, margin = 0 }: { label: string; value: number; margin?: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1.2fr)] items-center gap-2 text-xs">
      <span className="truncate text-ink-300">{label}</span>
      <span className="tabular text-right font-medium">
        {margin ? '≈' : ''}
        {Math.round(value)}
        {margin ? <span className="text-ink-400"> ±{margin}</span> : null}
      </span>
      <Bar value={value} tone={ratingTone(value)} height={5} />
    </div>
  )
}

export function TeamDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: color, width: size, height: size }} />
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-ink-700 bg-ink-900 sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-900 px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button className="rounded p-1 text-ink-400 hover:text-ink-100" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg border border-ink-700 bg-ink-900 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx('rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors', value === t.id ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-100')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function PageTitle({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink-400">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-ink-700 p-6 text-center text-sm text-ink-400">{children}</div>
}

export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cx('rounded-lg border border-ink-600 bg-ink-800 px-2 py-1.5 text-sm text-ink-100 outline-none focus:border-copper-400', className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

export const th = 'px-2 py-2 text-left text-[11px] font-medium tracking-wide text-ink-400 uppercase whitespace-nowrap'
export const td = 'px-2 py-1.5 border-t border-ink-800 whitespace-nowrap'
