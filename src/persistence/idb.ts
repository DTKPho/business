// Sauvegardes dans IndexedDB : une table de métadonnées (slots) et une table d'états complets.
import type { GameState } from '../engine/model/types'
import { serialize, deserialize } from '../engine/save/serialize'
import { constructorStandings } from '../engine/season/standings'

const DB_NAME = 'genesis-f1'
const DB_VERSION = 1

export interface SlotMeta {
  id: string
  name: string
  updatedAt: string
  season: number
  date: string
  phase: string
  position: number
  cashEur: number
  seed: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('slots')) db.createObjectStore('slots', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('states')) db.createObjectStore('states', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(stores, mode)
        let result: T | undefined
        const req = fn(t)
        if (req) req.onsuccess = () => (result = req.result)
        t.oncomplete = () => resolve(result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

export function slotMeta(id: string, state: GameState): SlotMeta {
  const pos = constructorStandings(state).find((c) => c.teamId === state.playerTeamId)?.position ?? 0
  return {
    id,
    name: state.meta.saveName,
    updatedAt: new Date().toISOString(),
    season: state.clock.season,
    date: state.clock.date,
    phase: state.clock.phase,
    position: pos,
    cashEur: state.finances.cashEur,
    seed: state.meta.seed,
  }
}

export async function saveSlot(id: string, state: GameState): Promise<void> {
  const meta = slotMeta(id, state)
  const data = serialize(state)
  await tx(['slots', 'states'], 'readwrite', (t) => {
    t.objectStore('slots').put(meta)
    t.objectStore('states').put({ id, data })
  })
}

export async function listSlots(): Promise<SlotMeta[]> {
  const res = await tx<SlotMeta[]>(['slots'], 'readonly', (t) => t.objectStore('slots').getAll())
  return (res ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadSlot(id: string): Promise<GameState> {
  const res = await tx<{ id: string; data: string }>(['states'], 'readonly', (t) => t.objectStore('states').get(id))
  if (!res) throw new Error('Emplacement de sauvegarde vide.')
  return deserialize(res.data)
}

export async function loadSlotRaw(id: string): Promise<string | undefined> {
  const res = await tx<{ id: string; data: string }>(['states'], 'readonly', (t) => t.objectStore('states').get(id))
  return res?.data
}

export async function deleteSlot(id: string): Promise<void> {
  await tx(['slots', 'states'], 'readwrite', (t) => {
    t.objectStore('slots').delete(id)
    t.objectStore('states').delete(id)
  })
}

export function newSlotId(): string {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

const LAST_SLOT_KEY = 'genesis-f1:last-slot'

export function rememberLastSlot(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_SLOT_KEY, id)
    else localStorage.removeItem(LAST_SLOT_KEY)
  } catch {
    /* stockage indisponible */
  }
}

export function lastSlot(): string | null {
  try {
    return localStorage.getItem(LAST_SLOT_KEY)
  } catch {
    return null
  }
}
