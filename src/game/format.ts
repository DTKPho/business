export function money(v: number): string {
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${sign}${(a / 1_000_000_000).toFixed(2)} Md€`;
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2)} M€`;
  if (a >= 10_000) return `${sign}${Math.round(a / 1000)} k€`;
  return `${sign}${Math.round(a).toLocaleString('fr-FR')} €`;
}

export function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)} M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)} k`;
  return String(Math.round(v));
}

export function lapTime(s: number | null | undefined): string {
  if (s == null || !isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(3).padStart(6, '0')}`;
}

export function gapStr(s: number): string {
  return `+${s.toFixed(3)}`;
}

export function raceTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function dateFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000);
}

export function weekday(iso: string): string {
  return ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][new Date(iso + 'T12:00:00Z').getUTCDay()];
}

export function ordinal(n: number): string {
  return n === 1 ? '1er' : `${n}e`;
}

export function pct(v: number): string {
  return `${Math.round(v)}%`;
}
