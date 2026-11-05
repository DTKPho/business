import type { GameState } from '../model/types'
import { SCHEMA_VERSION } from '../init/newGame'
import { migrate } from './migrations'

export const SAVE_FORMAT = 'genesis-f1-save'

export interface SaveFile {
  format: typeof SAVE_FORMAT
  schemaVersion: number
  exportedAt: string
  state: GameState
}

export function serialize(state: GameState): string {
  const file: SaveFile = { format: SAVE_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), state }
  return JSON.stringify(file)
}

export function deserialize(json: string): GameState {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Fichier illisible : JSON invalide.')
  }
  const file = parsed as Partial<SaveFile>
  if (!file || file.format !== SAVE_FORMAT || !file.state) throw new Error("Ce fichier n'est pas une sauvegarde Genesis F1.")
  const state = migrate(file.state as GameState, file.schemaVersion ?? 0)
  validateState(state)
  return state
}

export function validateState(s: GameState): void {
  const required: (keyof GameState)[] = ['meta', 'clock', 'teams', 'drivers', 'staff', 'cars', 'calendar', 'finances', 'board', 'equity', 'facilities', 'sponsors', 'inbox']
  for (const k of required) if (!(k in s)) throw new Error(`Sauvegarde incomplète : champ « ${k} » manquant.`)
  if (!s.teams[s.playerTeamId]) throw new Error('Sauvegarde corrompue : écurie du joueur introuvable.')
}
