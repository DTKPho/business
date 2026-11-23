import type { RaceState, RaceSummary as Summary } from '../../game/types';
import { useGame } from '../../game/store';
import { lastNameOf } from '../../game/people';
import { PLAYER_ID } from '../../game/types';

/** Jauge d'intensité de la course. */
export function IntensityMeter({ r }: { r: RaceState }) {
  const v = r.intensity ?? 0;
  const label = v >= 7 ? '🔥🔥🔥 BOUILLANT' : v >= 4 ? '🔥 Chaud' : v >= 2 ? '👀 Animé' : '😴 Calme';
  return (
    <div className="intensity" title="Intensité du moment">
      <span className="small">{label}</span>
      <div className="intensity-bar">
        <div style={{ width: `${v * 10}%` }} />
      </div>
    </div>
  );
}

/** Bannière « moment fort » du dernier tour. */
export function HighlightBanner({ r }: { r: RaceState }) {
  const h = [...(r.highlights ?? [])].reverse().find((x) => x.weight >= 4 && x.lap >= r.lap - 1);
  if (!h) return null;
  return (
    <div key={`${h.lap}-${h.text}`} className={`hl-banner ${h.player ? 'me' : ''}`}>
      <span className="hl-emoji">{h.emoji}</span>
      <div>
        <div className="eyebrow">Moment fort · tour {h.lap}</div>
        <b>{h.text}</b>
      </div>
    </div>
  );
}

export function Commentary({ r }: { r: RaceState }) {
  const lines = [...(r.commentary ?? [])].reverse().slice(0, 6);
  return (
    <div className="card commentary">
      <h3>🎙️ Commentaires</h3>
      {lines.map((l, i) => (
        <div key={i} className={`small com-line ${i === 0 ? 'fresh' : ''}`}>
          {l}
        </div>
      ))}
      {!lines.length && <div className="muted small">Les commentateurs s’installent…</div>}
    </div>
  );
}

export function Battles({ r }: { r: RaceState }) {
  const g = useGame((s) => s.game!);
  const b = r.battles ?? [];
  if (!b.length) return null;
  return (
    <div className="battles">
      {b.slice(0, 3).map(([a, c]) => {
        const car = r.cars.find((x) => x.driverId === c)!;
        return (
          <span key={a + c} className={`chip ${a === PLAYER_ID || c === PLAYER_ID ? 'warn' : ''}`}>
            ⚔️ P{car.pos - 1} {lastNameOf(g, a)} vs {lastNameOf(g, c)} · {car.gapAhead.toFixed(2)} s
          </span>
        );
      })}
    </div>
  );
}

/** Graphique de la position du joueur tour par tour. */
export function PositionChart({ positions, total, startPos, height = 120 }: { positions: number[]; total: number; startPos: number; height?: number }) {
  const n = 22;
  const W = 600;
  const H = height;
  const pts = [startPos, ...positions].map((p, i) => ({ x: (i / Math.max(1, total)) * W, y: p ? ((p - 1) / (n - 1)) * (H - 16) + 8 : H - 4, dnf: !p }));
  const valid = pts.filter((p) => !p.dnf);
  const path = valid.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = positions.filter(Boolean).at(-1);
  return (
    <svg className="pos-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Évolution de ta position">
      {[1, 5, 10, 15, 20].map((p) => {
        const y = ((p - 1) / (n - 1)) * (H - 16) + 8;
        return (
          <g key={p}>
            <line x1="0" x2={W} y1={y} y2={y} className="grid-line" />
            <text x="4" y={y - 2} className="axis">
              P{p}
            </text>
          </g>
        );
      })}
      <path d={path} className="pos-line" />
      {valid.length > 0 && <circle cx={valid.at(-1)!.x} cy={valid.at(-1)!.y} r="5" className="pos-dot" />}
      {last && valid.length > 0 && (
        <text x={Math.min(W - 40, valid.at(-1)!.x + 8)} y={valid.at(-1)!.y + 4} className="pos-label">
          P{last}
        </text>
      )}
    </svg>
  );
}

/** Résumé d'une course : graphique + moments forts. */
export function RaceSummary({ sum }: { sum: Summary }) {
  return (
    <div className="card race-summary">
      <h3>🎬 Résumé {sum.kind === 'sprint' ? 'du sprint' : 'de la course'}</h3>
      <PositionChart positions={sum.myPositions} total={sum.totalLaps} startPos={sum.startPos} />
      <div className="timeline">
        {sum.highlights.map((h, i) => (
          <div key={i} className={`tl-item ${h.player ? 'me' : ''}`}>
            <span className="tl-lap">T{h.lap}</span>
            <span className="tl-emoji">{h.emoji}</span>
            <span className="small">{h.text}</span>
          </div>
        ))}
        {!sum.highlights.length && <div className="muted small">Course tranquille.</div>}
      </div>
    </div>
  );
}
