// Générateur pseudo-aléatoire à graine (sfc32). L'état est stocké dans la
// sauvegarde : même graine + mêmes décisions = même partie.
import type { RngState } from '../model/types'

function hashSeed(seed: string): RngState {
  // xmur3
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
  return { a: next(), b: next(), c: next(), d: next() }
}

export function createRngState(seed: string): RngState {
  const s = hashSeed(seed)
  const rng = new Rng(s)
  for (let i = 0; i < 15; i++) rng.next()
  return rng.state
}

export class Rng {
  state: RngState
  constructor(state: RngState) {
    this.state = state
  }

  /** Nombre dans [0, 1). Fait avancer l'état (muté en place). */
  next(): number {
    const s = this.state
    s.a >>>= 0
    s.b >>>= 0
    s.c >>>= 0
    s.d >>>= 0
    const t = (s.a + s.b) | 0
    s.a = s.b ^ (s.b >>> 9)
    s.b = (s.c + (s.c << 3)) | 0
    s.c = (s.c << 21) | (s.c >>> 11)
    s.d = (s.d + 1) | 0
    const r = (t + s.d) | 0
    s.c = (s.c + r) | 0
    return (r >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  /** Loi normale (Box-Muller). */
  normal(mean = 0, sd = 1): number {
    let u = 0
    while (u === 0) u = this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    const total = items.reduce((s, i) => s + Math.max(0, weight(i)), 0)
    let r = this.next() * total
    for (const i of items) {
      r -= Math.max(0, weight(i))
      if (r <= 0) return i
    }
    return items[items.length - 1]
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
}

/** Bruit déterministe et stable à partir d'un entier (pour le scouting). */
export function stableNoise(seed: number, salt: number): number {
  let x = (seed * 374761393 + salt * 668265263) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x ^= x >>> 16
  return ((x >>> 0) / 4294967296) * 2 - 1
}
