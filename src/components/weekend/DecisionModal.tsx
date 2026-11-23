import { useGame } from '../../game/store';

/** Fenêtre de décision (essais, qualifs, course) et son résultat. */
export function DecisionModal() {
  const g = useGame((s) => s.game);
  const outcome = useGame((s) => s.ui.outcome);
  const resolve = useGame((s) => s.resolveDecision);
  const clear = useGame((s) => s.clearOutcome);
  const d = g?.weekend?.race?.decision ?? g?.weekend?.decision ?? null;
  if (!d && !outcome) return null;
  if (d) {
    const lap = g?.weekend?.race ? `Tour ${g.weekend.race.lap}` : d.stage === 'quali' ? 'Qualifications' : 'Essais libres';
    return (
      <div className="decision-backdrop">
        <div className="card decision">
          <div className="eyebrow">⚠️ Décision — {lap}</div>
          <div className="row">
            <span className="dec-emoji">{d.emoji}</span>
            <h2>{d.title}</h2>
          </div>
          <p>{d.text}</p>
          {outcome && (
            <div className="outcome small">
              {outcome.emoji} <b>Décision précédente :</b> {outcome.text}
            </div>
          )}
          <div className="options">
            {d.options.map((o, i) => (
              <button key={i} onClick={() => resolve(i)}>
                <b>{o.label}</b>
                <small>{o.desc}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="decision-backdrop" onClick={clear}>
      <div className="card decision" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <span className="dec-emoji">{outcome!.emoji}</span>
          <h2>{outcome!.title}</h2>
        </div>
        <div className="outcome">{outcome!.text}</div>
        <button className="primary big" onClick={clear}>
          Continuer
        </button>
      </div>
    </div>
  );
}
