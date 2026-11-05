import type { GameState } from '../model/types'

export function nextId(state: GameState, prefix: string): string {
  state.meta.idCounter += 1
  return `${prefix}-${state.meta.idCounter}`
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
