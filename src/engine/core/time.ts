// Gestion des dates (ISO AAAA-MM-JJ, en UTC pour éviter les surprises de fuseau).

export function parseDate(iso: string): Date {
  return new Date(iso + 'T12:00:00Z')
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return toIso(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)
}

export function monthsBetween(a: string, b: string): number {
  const da = parseDate(a)
  const db = parseDate(b)
  let m = (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth())
  if (db.getUTCDate() < da.getUTCDate()) m -= 1
  return m
}

export function yearOf(iso: string): number {
  return parseDate(iso).getUTCFullYear()
}

export function monthOf(iso: string): number {
  return parseDate(iso).getUTCMonth()
}

export function ageAt(birthDate: string, iso: string): number {
  const b = parseDate(birthDate)
  const d = parseDate(iso)
  let age = d.getUTCFullYear() - b.getUTCFullYear()
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age--
  return age
}

/** Décale une date d'un nombre d'années en gardant le même jour de la semaine (approx.). */
export function shiftYearsSameWeekday(iso: string, years: number): string {
  const d = parseDate(iso)
  const target = new Date(d)
  target.setUTCFullYear(d.getUTCFullYear() + years)
  const diff = (d.getUTCDay() - target.getUTCDay() + 7) % 7
  const adj = diff > 3 ? diff - 7 : diff
  target.setUTCDate(target.getUTCDate() + adj)
  return toIso(target)
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function formatDate(iso: string): string {
  const d = parseDate(iso)
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
