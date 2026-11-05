export function fmtEur(v: number, digits = 1): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} Md€`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(digits)} M€`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)} k€`
  return `${sign}${abs.toFixed(0)} €`
}

export function fmtUsd(v: number, digits = 1): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} Md$`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(digits)} M$`
  return `${sign}${(abs / 1e3).toFixed(0)} k$`
}

export function fmtPct(v: number, digits = 2): string {
  return `${v.toFixed(digits).replace('.', ',')} %`
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function round(v: number, digits = 0): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}
