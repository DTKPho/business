// Préférences d'affichage propres à cet appareil (thème, décors, animations).
import { create } from 'zustand'

export interface Settings {
  theme: 'light' | 'dark'
  scenes: boolean
  motion: boolean
}

const KEY = 'genesis-f1:settings'

function load(): Settings {
  const def: Settings = { theme: 'light', scenes: true, motion: true }
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...def, ...(JSON.parse(raw) as Partial<Settings>) } : def
  } catch {
    return def
  }
}

function apply(s: Settings) {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = s.theme
}

export const useSettings = create<Settings & { set: (p: Partial<Settings>) => void }>((set, get) => {
  const initial = load()
  apply(initial)
  return {
    ...initial,
    set: (p) => {
      const next = { theme: get().theme, scenes: get().scenes, motion: get().motion, ...p }
      apply(next)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* stockage indisponible */
      }
      set(p)
    },
  }
})
