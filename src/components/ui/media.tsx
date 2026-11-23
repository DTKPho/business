import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const loaded = new Set<string>();
import { DRIVERS_BY_ID, driverPhotoCandidates, flagEmoji } from '../../data/drivers';
import { TEAMS_BY_ID, teamCarCandidates, teamLogoCandidates } from '../../data/teams';
import type { TeamId } from '../../game/types';
import { PLAYER_ID } from '../../game/types';
import { useGame } from '../../game/store';
import { identity, teamOf } from '../../game/people';

const failed = new Set<string>();

/** Image qui essaie plusieurs URL puis affiche un repli. */
export function SmartImage({ candidates, alt, className, style, fallback }: { candidates: string[]; alt: string; className?: string; style?: CSSProperties; fallback: ReactNode }) {
  const key = candidates.join('|');
  const [state, setState] = useState({ key, bump: 0 });
  if (state.key !== key) setState({ key, bump: 0 });
  const src = candidates.find((c) => c && !failed.has(c));
  // Si le CDN ne répond pas, on bascule sur le candidat suivant après 7 s
  useEffect(() => {
    if (!src || loaded.has(src)) return;
    const t = setTimeout(() => {
      if (!loaded.has(src)) {
        failed.add(src);
        setState((st) => ({ ...st, bump: st.bump + 1 }));
      }
    }, 7000);
    return () => clearTimeout(t);
  }, [src]);
  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onLoad={() => loaded.add(src)}
      onError={() => {
        failed.add(src);
        setState((st) => ({ ...st, bump: st.bump + 1 }));
      }}
    />
  );
}

export function Flag({ code, size = 16 }: { code: string; size?: number }) {
  return <span style={{ fontSize: size, lineHeight: 1 }} title={code}>{flagEmoji(code)}</span>;
}

/** Avatar neutre (silhouette) quand le joueur n'a pas mis de photo. */
export function Silhouette({ size = 64, tint = '#8a8aa0' }: { size?: number; tint?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="silhouette">
      <circle cx="50" cy="38" r="19" fill={tint} opacity="0.9" />
      <path d="M14 100 C14 74 30 62 50 62 C70 62 86 74 86 100 Z" fill={tint} opacity="0.9" />
    </svg>
  );
}

export function DriverPhoto({ id, size = 48, className = '', ring = true }: { id: string; size?: number; className?: string; ring?: boolean }) {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const idn = identity(game, id);
  const teamId = teamOf(game, id);
  const color = teamId ? TEAMS_BY_ID[teamId].color : '#555';
  const style: CSSProperties = { width: size, height: size, background: `radial-gradient(circle at 50% 30%, ${color}cc, ${color}33 70%, #0000)`, borderColor: ring ? color : 'transparent' };
  const initials = (
    <span className="avatar-initials" style={{ fontSize: size * 0.34 }}>
      {idn.firstName[0]}
      {idn.lastName[0]}
    </span>
  );
  if (id === PLAYER_ID) {
    const p = game.player;
    return (
      <div className={`avatar ${className}`} style={style}>
        {p.photo ? <img src={p.photo} alt={idn.name} /> : <Silhouette size={size} tint="#c9c9d6" />}
      </div>
    );
  }
  const def = DRIVERS_BY_ID[id];
  const override = game.settings.imageOverrides[id];
  const cands = [...(override ? [override] : []), ...(def ? driverPhotoCandidates(def, teamId) : [])];
  return (
    <div className={`avatar ${className}`} style={style}>
      <SmartImage candidates={cands} alt={idn.name} fallback={initials} />
    </div>
  );
}

export function TeamLogo({ id, size = 28, withName = false }: { id: TeamId | null; size?: number; withName?: boolean }) {
  const game = useGame((s) => s.game);
  if (!id) return <span className="muted">—</span>;
  const t = TEAMS_BY_ID[id];
  const override = game?.settings.imageOverrides[`team:${id}`];
  const badge = (
    <span className="team-badge" style={{ background: t.color, color: t.textOnColor, height: size, minWidth: size, fontSize: size * 0.38 }}>
      {t.short}
    </span>
  );
  return (
    <span className="team-logo" style={{ height: size }}>
      <span className="team-logo-box" style={{ height: size, width: size, background: `${t.color}22`, borderColor: `${t.color}88` }}>
        <SmartImage candidates={[...(override ? [override] : []), ...teamLogoCandidates(id)]} alt={t.name} style={{ maxHeight: size * 0.8, maxWidth: size * 0.85 }} fallback={badge} />
      </span>
      {withName && <span className="team-logo-name">{t.name}</span>}
    </span>
  );
}

export function TeamCar({ id, height = 80 }: { id: TeamId; height?: number }) {
  const t = TEAMS_BY_ID[id];
  const fallback = (
    <svg height={height} viewBox="0 0 300 80" aria-hidden>
      <path d="M10 55 L60 50 L95 38 L170 36 L215 44 L285 46 L290 56 L10 62 Z" fill={t.color} />
      <path d="M95 38 L120 26 L150 26 L160 36 Z" fill="#111" />
      <rect x="255" y="34" width="34" height="8" fill={t.secondary} />
      <rect x="6" y="48" width="30" height="6" fill={t.secondary} />
      <circle cx="70" cy="62" r="14" fill="#111" />
      <circle cx="235" cy="62" r="15" fill="#111" />
      <circle cx="70" cy="62" r="6" fill="#444" />
      <circle cx="235" cy="62" r="6" fill="#444" />
    </svg>
  );
  return <SmartImage candidates={teamCarCandidates(id)} alt={`Voiture ${t.name}`} style={{ height, objectFit: 'contain' }} fallback={fallback} />;
}

export function Bar({ value, max = 100, color, label, right }: { value: number; max?: number; color?: string; label?: ReactNode; right?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-row">
      {label && <span className="bar-label">{label}</span>}
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color ?? 'var(--accent)' }} />
      </div>
      {right !== undefined && <span className="bar-right">{right}</span>}
    </div>
  );
}

export function RelBadge({ value }: { value: number }) {
  const label = value > 60 ? 'Meilleur ami' : value > 30 ? 'Ami' : value > 10 ? 'Bonne entente' : value > -10 ? 'Neutre' : value > -40 ? 'Tendu' : 'Ennemi';
  const cls = value > 10 ? 'pos' : value < -10 ? 'neg' : '';
  return <span className={`chip ${cls}`}>{label}</span>;
}

export function DriverName({ id, short = false }: { id: string; short?: boolean }) {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const idn = identity(game, id);
  return (
    <span className={`driver-name ${id === PLAYER_ID ? 'is-player' : ''}`}>
      <Flag code={idn.nationality} size={13} /> {short ? idn.lastName : `${idn.firstName} ${idn.lastName}`}
    </span>
  );
}

export function TyreDot({ c, size = 18 }: { c: string; size?: number }) {
  const map: Record<string, string> = { S: '#ff2d2d', M: '#ffd400', H: '#f2f2f2', I: '#2fbf4a', W: '#1e7cff' };
  return (
    <span className="tyre" style={{ width: size, height: size, borderColor: map[c] ?? '#888', fontSize: size * 0.55 }}>
      {c}
    </span>
  );
}
