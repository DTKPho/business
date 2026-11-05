import { create } from 'zustand'
import type { GameState } from '../engine/model/types'
import { createNewGame } from '../engine/init/newGame'
import { loadSlot, newSlotId, rememberLastSlot, saveSlot } from '../persistence/idb'

export type Screen =
  | 'dashboard'
  | 'inbox'
  | 'calendar'
  | 'weekend'
  | 'race'
  | 'standings'
  | 'car'
  | 'drivers'
  | 'staff'
  | 'market'
  | 'facilities'
  | 'finances'
  | 'board'
  | 'saves'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'good' | 'bad'
}

interface Store {
  game: GameState | null
  slotId: string | null
  screen: Screen
  toasts: Toast[]
  saving: boolean
  lastSavedAt: string | null
  focusPersonId: string | null
  setScreen: (s: Screen) => void
  openPerson: (id: string | null) => void
  newGame: (name: string, seed: string) => Promise<void>
  loadGame: (slotId: string) => Promise<void>
  adoptGame: (state: GameState) => Promise<void>
  quit: () => void
  /** Applique une fonction du moteur sur une copie de l'état puis sauvegarde (sauf save:false). */
  act: <T>(fn: (s: GameState) => T, opts?: { save?: boolean | 'now' }) => T
  saveNow: () => Promise<void>
  toast: (text: string, kind?: Toast['kind']) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastId = 0

export const useGame = create<Store>((set, get) => ({
  game: null,
  slotId: null,
  screen: 'dashboard',
  toasts: [],
  saving: false,
  lastSavedAt: null,
  focusPersonId: null,
  setScreen: (screen) => {
    set({ screen })
    window.scrollTo({ top: 0 })
  },
  openPerson: (id) => set({ focusPersonId: id }),
  newGame: async (name, seed) => {
    const game = createNewGame({ saveName: name || 'Carrière Genesis', seed })
    const slotId = newSlotId()
    set({ game, slotId, screen: 'dashboard' })
    rememberLastSlot(slotId)
    await get().saveNow()
  },
  loadGame: async (slotId) => {
    const game = await loadSlot(slotId)
    set({ game, slotId, screen: game.race ? 'race' : game.weekend ? 'weekend' : 'dashboard' })
    rememberLastSlot(slotId)
  },
  adoptGame: async (game) => {
    const slotId = newSlotId()
    set({ game, slotId, screen: 'dashboard' })
    rememberLastSlot(slotId)
    await get().saveNow()
  },
  quit: () => {
    void get().saveNow()
    rememberLastSlot(null)
    set({ game: null, slotId: null, screen: 'dashboard' })
  },
  act: (fn, opts = {}) => {
    const cur = get().game
    if (!cur) throw new Error('Aucune partie chargée')
    const next = structuredClone(cur)
    const result = fn(next)
    set({ game: next })
    if (opts.save === 'now') void get().saveNow()
    else if (opts.save !== false) {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => void get().saveNow(), 400)
    }
    return result
  },
  saveNow: async () => {
    const { game, slotId } = get()
    if (!game || !slotId) return
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    set({ saving: true })
    try {
      await saveSlot(slotId, game)
      set({ lastSavedAt: new Date().toISOString() })
    } catch (e) {
      get().toast(`Échec de la sauvegarde : ${(e as Error).message}`, 'bad')
    } finally {
      set({ saving: false })
    }
  },
  toast: (text, kind = 'info') => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, text, kind }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 4500)
  },
}))

// Aucune progression perdue : sauvegarde à la fermeture / mise en arrière-plan.
if (typeof window !== 'undefined') {
  const flush = () => void useGame.getState().saveNow()
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}
