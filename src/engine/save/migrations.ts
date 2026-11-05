import type { GameState } from '../model/types'
import { SCHEMA_VERSION } from '../init/newGame'

type Migration = (s: GameState) => GameState

/**
 * Migrations successives : MIGRATIONS[n] transforme une sauvegarde de version n en version n+1.
 * Ajoutez une entrée à chaque changement incompatible du modèle de données.
 */
const MIGRATIONS: Record<number, Migration> = {
  0: (s) => s,
}

export function migrate(state: GameState, fromVersion: number): GameState {
  let s = state
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const m = MIGRATIONS[v]
    if (m) s = m(s)
  }
  if (fromVersion > SCHEMA_VERSION) throw new Error('Sauvegarde créée par une version plus récente du jeu.')
  s.meta.schemaVersion = SCHEMA_VERSION
  s.finances.extraDesignPoints ??= 0
  if (s.weekend) s.weekend.form ??= {}
  return s
}
