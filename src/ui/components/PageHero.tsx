import type { ReactNode } from 'react'
import { sceneUrl } from './Scene'

/** En-tête d'onglet : bandeau illustré, titre, actions et sous-onglets. */
export function PageHero({ scene, eyebrow, title, sub, actions, children }: { scene?: string; eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const url = scene ? sceneUrl(scene) : undefined
  return (
    <div className="mb-5 space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-ink-700/70 shadow-[0_10px_40px_-18px_rgb(0_0_0/0.4)]">
        {url && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} />}
        <div className="absolute inset-0" style={{ background: 'var(--hero-overlay)' }} />
        <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-7 sm:py-8">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-magma-500 uppercase">{eyebrow}</div>}
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {sub && <p className="mt-1 max-w-2xl text-sm text-ink-300">{sub}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}
