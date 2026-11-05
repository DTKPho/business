import type { GameState } from '../engine/model/types'
import { serialize, deserialize } from '../engine/save/serialize'

export function exportToFile(state: GameState): void {
  const blob = new Blob([serialize(state)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safe = state.meta.saveName.replace(/[^a-z0-9-_]+/gi, '_')
  a.href = url
  a.download = `genesis-f1_${safe}_${state.clock.date}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importFromFile(file: File): Promise<GameState> {
  const text = await file.text()
  return deserialize(text)
}
