import { useGame } from '../store/gameStore'
import type { GameState } from '../engine/model/types'

export function useGameState(): GameState {
  const g = useGame((s) => s.game)
  if (!g) throw new Error('Aucune partie chargée')
  return g
}

/** Exécute une action du moteur qui renvoie { ok, reason } et affiche un toast. */
export function useAction() {
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  return (fn: (s: GameState) => { ok: boolean; reason?: string } | void, success?: string) => {
    const r = act(fn)
    if (r && !r.ok) toast(r.reason ?? 'Action impossible.', 'bad')
    else if (success) toast(success, 'good')
    return r
  }
}
