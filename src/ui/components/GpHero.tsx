import type { ReactNode } from 'react'
import type { CalendarEvent, Circuit } from '../../engine/model/types'
import { formatDate } from '../../engine/core/time'
import { TrackMap } from './TrackMap'

/** Bandeau propre à chaque Grand Prix : couleurs du pays, drapeau, tracé. */
export function GpHero({ event, circuit, total, right, children }: { event: CalendarEvent; circuit: Circuit; total: number; right?: ReactNode; children?: ReactNode }) {
  const [a, b] = circuit.accent ?? ['#ff5a1f', '#c08a5a']
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-700/70 text-white shadow-[0_10px_40px_-18px_rgb(0_0_0/0.5)]" style={{ background: `linear-gradient(120deg, #11141a 0%, #11141a 35%, ${a} 140%)` }}>
      <div className="absolute inset-y-0 right-0 w-1/2 opacity-[0.18]" style={{ background: `radial-gradient(circle at 70% 40%, ${b}, transparent 60%)` }} />
      <div className="pointer-events-none absolute -top-10 -right-6 h-[130%] w-[46%] opacity-25 [--track-stroke:#ffffff] [--track-casing:transparent]">
        <TrackMap circuitId={circuit.id} accent={a} className="h-full w-full" />
      </div>
      <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-7 sm:py-8">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
            <span className="rounded-md bg-white/15 px-2 py-0.5">
              Manche {event.round}/{total}
            </span>
            {event.sprint && <span className="rounded-md bg-[#ff5a1f] px-2 py-0.5">Sprint</span>}
            {(circuit.tags ?? []).map((t) => (
              <span key={t} className="rounded-md bg-white/10 px-2 py-0.5">
                {t}
              </span>
            ))}
          </div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="text-4xl leading-none">{circuit.flag}</span>
            {circuit.gpName}
          </h1>
          <p className="mt-1 text-sm text-white/75">
            {circuit.name} · {circuit.city} · {formatDate(event.date)}
          </p>
          {children}
        </div>
        {right}
      </div>
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${a}, ${b})` }} />
    </div>
  )
}
