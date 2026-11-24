import { useEffect, useMemo, useState } from 'react';
import { CALENDAR } from '../../data/calendar';
import { TEAMS_BY_ID } from '../../data/teams';
import { useGame } from '../../game/store';
import { PLAYER_ID, type QualiEntry, type RaceResultEntry, type SetupValues, type TyreCompound } from '../../game/types';
import { lapTime, money } from '../../game/format';
import { SETUP_KEYS, SETUP_LABELS, TYRE_INFO } from '../../game/sim/pace';
import type { QualiRisk } from '../../game/sim/qualifying';
import { teamOf } from '../../game/people';
import { DriverName, DriverPhoto, Flag, TeamLogo, TyreDot } from '../ui/media';
import { InterviewPanel } from '../weekend/InterviewPanel';
import { RaceLive } from '../weekend/RaceLive';
import { DecisionModal } from '../weekend/DecisionModal';
import { RaceSummary } from '../weekend/Broadcast';
import type { AutoProfile } from '../../game/types';
import { VERDICT_FR, type Verdict } from '../../game/expectations';
import { CircuitProfile } from './Home';
import { Scene } from '../ui/scene';
import { circuitFallback } from '../ui/backgrounds';

const STAGE_LABEL: Record<string, string> = { media: 'Jeudi presse', fp: 'Essais libres', sprintQuali: 'Qualif sprint', sprint: 'Sprint', quali: 'Qualifications', race: 'Course', post: 'Après-course' };

export function Weekend() {
  const g = useGame((s) => s.game!);
  const startWeekend = useGame((s) => s.startWeekend);
  const w = g.weekend;
  const next = g.round < 24 ? CALENDAR[g.round] : null;

  if (!w) {
    return (
      <div className="page">
        <div className="card">
          <h2>Pas de week-end en cours</h2>
          {next && g.actionsLeft <= 0 ? (
            <button className="primary" onClick={startWeekend}>
              ✈️ Partir pour {next.city}
            </button>
          ) : (
            <p className="muted">{next ? `Encore ${g.actionsLeft} jour(s) avant ${next.name}. Organise-les dans le Planning.` : 'Saison terminée.'}</p>
          )}
        </div>
      </div>
    );
  }
  const c = CALENDAR.find((x) => x.id === w.raceId)!;
  const fc = w.weatherForecast;

  return (
    <div className="page weekend">
      <Scene imageKey={`circuit:${c.id}`} fallback={circuitFallback(c.id)} className="wk-head" upload="Image du circuit" overlay={0.4}>
        <div>
          <div className="eyebrow">
            Manche {w.round + 1} · {c.circuit}
          </div>
          <h1>
            <Flag code={c.country} size={28} /> {c.name}
          </h1>
        </div>
        <div className="weather">
          {['Essais', 'Qualif', 'Course'].map((l, i) => (
            <div key={l} className="wx">
              <span>{fc[i] > 0.5 ? '🌧️' : fc[i] > 0.25 ? '🌦️' : c.night ? '🌙' : '☀️'}</span>
              <b>{l}</b>
              <small>{Math.round(fc[i] * 100)} % pluie</small>
            </div>
          ))}
        </div>
      </Scene>
      <div className="stepper">
        {w.stages.map((s, i) => (
          <div key={s} className={`st ${i === w.stageIndex ? 'on' : i < w.stageIndex ? 'done' : ''}`}>
            {STAGE_LABEL[s]}
          </div>
        ))}
      </div>
      <AutoBar />
      {w.objective && w.stage !== 'post' && (
        <div className="objective">
          🎯 Objectif de l’équipe : <b>{w.objective.label}</b> <span className="muted small">(rythme estimé de ta voiture : ~P{w.objective.target})</span>
        </div>
      )}
      {w.stage === 'media' && <MediaStage />}
      {w.stage === 'fp' && <PracticeStage />}
      {(w.stage === 'quali' || w.stage === 'sprintQuali') && <QualiStage />}
      {(w.stage === 'race' || w.stage === 'sprint') && (w.race ? <RaceLive /> : <PreRace />)}
      {w.stage === 'post' && <PostRace />}
      <DecisionModal />
      {w.notes.length > 0 && w.stage !== 'post' && (
        <details className="card">
          <summary>Notes du week-end ({w.notes.length})</summary>
          {w.notes.map((n, i) => (
            <div key={i} className="small">
              {n}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function MediaStage() {
  const g = useGame((s) => s.game!);
  const advance = useGame((s) => s.advanceStage);
  const itw = g.interviews.find((i) => i.context === 'thursday' && i.day === g.day) ?? g.interviews.find((i) => i.context === 'thursday');
  const c = CALENDAR.find((x) => x.id === g.weekend!.raceId)!;
  return (
    <div className="grid2">
      <div>{itw && <InterviewPanel itw={itw} />}</div>
      <div className="card">
        <h3>Le circuit</h3>
        <p>{c.description}</p>
        <CircuitProfile id={c.id} />
        <p className="small muted">Longueur {c.lengthKm} km · {c.laps} tours · perte aux stands ≈ {c.pitLoss} s</p>
        <button className="primary" onClick={advance} disabled={!!itw && !itw.done}>
          Vers les essais libres →
        </button>
        {itw && !itw.done && <p className="small muted">Réponds (ou refuse) l’interview pour continuer.</p>}
      </div>
    </div>
  );
}

function PracticeStage() {
  const g = useGame((s) => s.game!);
  const w = g.weekend!;
  const setSetup = useGame((s) => s.setSetup);
  const run = useGame((s) => s.runPractice);
  const advance = useGame((s) => s.advanceStage);
  const team = TEAMS_BY_ID[teamOf(g, PLAYER_ID)!];
  const best = w.runs.length ? Math.min(...w.runs.map((r) => r.lapTime)) : null;
  return (
    <div className="grid2">
      <div className="card">
        <h2>🔧 Réglages de la voiture</h2>
        <p className="muted small">Ajuste les réglages, lance un relais, puis écoute ton ingénieur {team.engineerName}. Ton retour technique ({g.player.stats.feedback}) rend ses indications plus précises. {w.runsLeft} relais restant(s).</p>
        {SETUP_KEYS.map((k) => (
          <div key={k} className="setup-row">
            <div className="setup-label">
              <b>{SETUP_LABELS[k].name}</b>
              <span className="small muted">
                {SETUP_LABELS[k].low} ↔ {SETUP_LABELS[k].high}
              </span>
            </div>
            <input type="range" min={0} max={100} value={w.setup[k]} onChange={(e) => setSetup({ ...w.setup, [k]: Number(e.target.value) } as SetupValues)} />
            <span className="num">{w.setup[k]}</span>
          </div>
        ))}
        <div className="row wrap">
          <button className="primary" disabled={w.runsLeft <= 0} onClick={() => run('quali')}>
            ⏱️ Simulation de qualif
          </button>
          <button className="ghost" disabled={w.runsLeft <= 0} onClick={() => run('long')}>
            🛞 Long run
          </button>
          <button className="ghost" disabled={w.runsLeft <= 0} onClick={() => run('aero')}>
            📡 Mesures aéro (retour précis)
          </button>
        </div>
        <div className="confidence">
          Confiance dans la voiture : <b>{Math.round(w.setupConfidence * 100)} %</b>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${w.setupConfidence * 100}%`, background: w.setupConfidence > 0.8 ? 'var(--good)' : w.setupConfidence > 0.6 ? 'var(--warn)' : 'var(--bad)' }} />
          </div>
        </div>
        <button className="primary big" onClick={advance}>
          Terminer les essais →
        </button>
      </div>
      <div className="card">
        <h2>📻 Débriefing</h2>
        {(w.decisionLog ?? []).map((l, i) => (
          <div key={i} className="outcome small">
            {l}
          </div>
        ))}
        {!w.runs.length && <p className="muted">Aucun relais pour l’instant.</p>}
        {[...w.runs].reverse().map((r, i) => (
          <div key={i} className="run">
            <div className="row">
              <b>Relais {w.runs.length - i}</b> <span className="chip">{r.program === 'quali' ? 'Qualif' : r.program === 'long' ? 'Long run' : 'Aéro'}</span>
              <span className={`num ${r.lapTime === best ? 'purple' : ''}`}>{lapTime(r.lapTime)}</span>
            </div>
            {r.feedback.map((f, j) => (
              <div key={j} className="small">
                {f}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function QualiTable({ entries, sprint }: { entries: QualiEntry[]; sprint?: boolean }) {
  const g = useGame((s) => s.game!);
  const best = (k: 'q1' | 'q2' | 'q3') => Math.min(...entries.map((e) => e[k] ?? 9999));
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Pilote</th>
          <th>Écurie</th>
          <th>{sprint ? 'SQ1' : 'Q1'}</th>
          <th>{sprint ? 'SQ2' : 'Q2'}</th>
          <th>{sprint ? 'SQ3' : 'Q3'}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.driverId} className={e.driverId === PLAYER_ID ? 'me' : ''}>
            <td className="pos">{e.position}</td>
            <td>
              <div className="row">
                <DriverPhoto id={e.driverId} size={24} />
                <DriverName id={e.driverId} />
              </div>
            </td>
            <td>
              <TeamLogo id={teamOf(g, e.driverId)} size={18} />
            </td>
            {(['q1', 'q2', 'q3'] as const).map((k) => (
              <td key={k} className={`num ${e[k] !== null && e[k] === best(k) ? 'purple' : ''}`}>
                {e[k] !== null ? lapTime(e[k]) : ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QualiStage() {
  const g = useGame((s) => s.game!);
  const w = g.weekend!;
  const runQuali = useGame((s) => s.startQualiSession);
  const advance = useGame((s) => s.advanceStage);
  const [risks, setRisks] = useState<QualiRisk[]>(['normal', 'normal', 'normal']);
  const sprint = w.stage === 'sprintQuali';
  const entries = sprint ? w.sprintQuali : w.quali;
  const itw = !sprint ? g.interviews.find((i) => i.context === 'postQuali' && !i.done) : null;
  if (!entries) {
    return (
      <div className="card">
        <h2>{sprint ? 'Qualifications sprint' : 'Qualifications'}</h2>
        <p className="muted">Choisis ton niveau de prise de risque pour chaque segment. Attaquer fait gagner quelques dixièmes… ou finir dans le mur. Pluie prévue : {Math.round(w.rain.quali * 100)} % d’humidité.</p>
        <div className="risk-grid">
          {(sprint ? ['SQ'] : ['Q1', 'Q2', 'Q3']).map((label, i) => (
            <div key={label} className="risk">
              <b>{label}</b>
              {(['safe', 'normal', 'attack'] as QualiRisk[]).map((r) => (
                <button key={r} className={risks[i] === r ? 'primary sm' : 'ghost sm'} onClick={() => setRisks(risks.map((x, j) => (j === i ? r : x)))}>
                  {r === 'safe' ? '🛡️ Prudent' : r === 'normal' ? '⚖️ Normal' : '🔥 Attaque'}
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="small muted">Confiance réglages : {Math.round(w.setupConfidence * 100)} % · Mental : {g.player.stats.mental} · Stress : {Math.round(g.player.stress)}</p>
        <button className="primary big" onClick={() => runQuali(sprint ? [risks[0], risks[0], risks[0]] : risks)}>
          🚦 Lancer la séance
        </button>
      </div>
    );
  }
  const me = entries.find((e) => e.driverId === PLAYER_ID);
  return (
    <div className="grid2 wide-left">
      <div className="card">
        <h2>
          Résultats — vous êtes <span className="accent">P{me?.position}</span>
        </h2>
        <QualiTable entries={entries} sprint={sprint} />
      </div>
      <div>
        {itw && <InterviewPanel itw={itw} />}
        <div className="card">
          <button className="primary big" onClick={advance}>
            {sprint ? 'Vers la course sprint →' : 'Vers la course →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreRace() {
  const g = useGame((s) => s.game!);
  const w = g.weekend!;
  const start = useGame((s) => s.startRace);
  const setAuto = useGame((s) => s.setAuto);
  const c = CALENDAR.find((x) => x.id === w.raceId)!;
  const sprint = w.stage === 'sprint';
  const rain = sprint ? w.rain.sprint : w.rain.race;
  const [tyre, setTyre] = useState<TyreCompound>(sprint ? 'M' : 'M');
  const [plan, setPlan] = useState<TyreCompound[]>(c.tyreStress > 0.65 ? ['H', 'M'] : ['H']);
  const grid = (sprint ? w.sprintQuali : w.quali) ?? [];
  const myPos = grid.find((e) => e.driverId === PLAYER_ID)?.position;
  const strategies: { label: string; start: TyreCompound; plan: TyreCompound[] }[] = sprint
    ? [
        { label: 'Medium (sûr)', start: 'M', plan: [] },
        { label: 'Tendre (départ canon)', start: 'S', plan: [] },
      ]
    : [
        { label: '1 arrêt M → H', start: 'M', plan: ['H'] },
        { label: '1 arrêt H → M', start: 'H', plan: ['M'] },
        { label: '1 arrêt S → H', start: 'S', plan: ['H'] },
        { label: '2 arrêts M → H → M', start: 'M', plan: ['H', 'M'] },
        { label: '2 arrêts S → M → S', start: 'S', plan: ['M', 'S'] },
      ];
  return (
    <div className="grid2">
      <div className="card">
        <h2>🧠 Stratégie — départ P{myPos}</h2>
        <p className="muted small">
          Usure des pneus sur ce circuit : {Math.round(c.tyreStress * 100)} %. {rain > 0.2 ? '🌧️ Piste mouillée au départ : l’équipe montera des pneus pluie.' : 'Règle : en course sèche, deux composés différents sont obligatoires.'}
        </p>
        <div className="strat-list">
          {strategies.map((s) => (
            <button key={s.label} className={`strat ${tyre === s.start && plan.join() === s.plan.join() ? 'on' : ''}`} onClick={() => { setTyre(s.start); setPlan(s.plan); }}>
              <span className="row">
                <TyreDot c={s.start} />
                {s.plan.map((p, i) => (
                  <span key={i} className="row">
                    → <TyreDot c={p} />
                  </span>
                ))}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <p className="small muted">Tu pourras changer d’avis en course (bouton « Box ») selon l’usure, la météo et les safety cars.</p>
        <button className="primary big" onClick={() => { setAuto({ on: false }); start(tyre, plan); }}>
          🎮 {sprint ? 'Départ de la course sprint' : 'Mise en grille et départ'} (je pilote)
        </button>
        <button className="ghost big" onClick={() => { setAuto({ on: true }); start(tyre, plan); }}>
          🎬 Départ en mode TV (simulation auto)
        </button>
      </div>
      <div className="card">
        <h3>Grille de départ</h3>
        <div className="grid-list">
          {grid.map((e) => (
            <div key={e.driverId} className={`grid-slot ${e.position % 2 ? 'l' : 'r'} ${e.driverId === PLAYER_ID ? 'me' : ''}`}>
              <b>{e.position}</b> <DriverName id={e.driverId} short />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ResultTable({ res }: { res: RaceResultEntry[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Pilote</th>
          <th>Écurie</th>
          <th>Grille</th>
          <th>Écart</th>
          <th>Arrêts</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {res.map((e) => (
          <tr key={e.driverId} className={e.driverId === PLAYER_ID ? 'me' : ''}>
            <td className="pos">{e.dnf ? 'AB' : e.position}</td>
            <td>
              <div className="row">
                <DriverPhoto id={e.driverId} size={24} />
                <DriverName id={e.driverId} />
                {e.fastestLap && <span className="chip purple">⏱️</span>}
              </div>
            </td>
            <td>
              <TeamLogo id={e.teamId} size={18} />
            </td>
            <td className="num">{e.grid}</td>
            <td className="num small">{e.dnf ? <span className="neg">{e.dnf}</span> : e.gap}</td>
            <td className="num">{e.pits}</td>
            <td className="num">
              <b>{e.points || ''}</b>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PostRace() {
  const g = useGame((s) => s.game!);
  const w = g.weekend!;
  const end = useGame((s) => s.endWeekend);
  const setScreen = useGame((s) => s.setScreen);
  const itw = g.interviews.find((i) => i.context === 'postRace' && !i.done);
  const res = g.results[g.results.length - 1];
  const fin = useMemo(() => {
    try {
      return JSON.parse(String(g.flags['lastFinance'] ?? '[]')) as { label: string; amount: number }[];
    } catch {
      return [];
    }
  }, [g.flags]);
  const me = w.raceResult?.find((e) => e.driverId === PLAYER_ID);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="grid2 wide-left">
      <div>
        <div className="card post-hero">
          <div className="big-num">{me?.dnf ? 'AB' : `P${me?.position}`}</div>
          <div>
            <h2>{me?.position === 1 ? '🏆 VICTOIRE !' : me && me.position > 0 && me.position <= 3 ? '🍾 Podium !' : me?.dnf ? 'Abandon' : res?.playerVerdict === 'exceptional' ? '🤯 Exploit !' : res?.playerVerdict === 'great' ? '💪 Superbe course' : res?.playerVerdict === 'disaster' ? '😣 Dimanche difficile' : 'Arrivée'}</h2>
            <div>
              Note du week-end : <b className="accent">{res?.playerRating}/10</b> · {me?.points ?? 0} point(s)
            </div>
            {res?.playerVerdict && (
              <div className={`verdict ${VERDICT_FR[res.playerVerdict as Verdict].tone}`}>
                {VERDICT_FR[res.playerVerdict as Verdict].label}
                {res.playerExpected ? <span className="small"> · attendu ~P{res.playerExpected}{res.objective ? ` · objectif : ${res.objective.label}` : ''}</span> : null}
              </div>
            )}
          </div>
        </div>
        {(w.summaries ?? []).slice().reverse().map((sm, i) => (
          <RaceSummary key={i} sum={sm} />
        ))}
        {w.sprintResult && (
          <details className="card">
            <summary>Résultat du sprint</summary>
            <ResultTable res={w.sprintResult} />
          </details>
        )}
        <div className="card">{w.raceResult && <ResultTable res={w.raceResult} />}</div>
      </div>
      <div>
        {itw && <InterviewPanel itw={itw} />}
        <div className="card">
          <h3>💶 Bilan financier</h3>
          {fin.map((l, i) => (
            <div key={i} className="fin-line">
              <span>{l.label}</span>
              <b className={l.amount >= 0 ? 'pos' : 'neg'}>{money(l.amount)}</b>
            </div>
          ))}
          <div className="fin-line total">
            <span>Total</span>
            <b>{money(fin.reduce((a, l) => a + l.amount, 0))}</b>
          </div>
        </div>
        <div className="card">
          <button
            className="primary big"
            onClick={() => {
              end();
              setScreen('home');
            }}
          >
            🛫 Quitter le circuit
          </button>
          {itw && <p className="small muted">Partir sans répondre à la zone mixte nuit à ton professionnalisme.</p>}
        </div>
      </div>
    </div>
  );
}

export { TYRE_INFO };

function AutoBar() {
  const g = useGame((s) => s.game!);
  const w = g.weekend!;
  const setAuto = useGame((s) => s.setAuto);
  const autoWeekend = useGame((s) => s.autoWeekend);
  const a = w.auto ?? { on: false, profile: 'equilibre' as AutoProfile, stopDecisions: false };
  const racing = !!w.race || w.stage === 'post';
  const profiles: [AutoProfile, string][] = [
    ['prudent', '🛡️ Prudent'],
    ['equilibre', '⚖️ Équilibré'],
    ['agressif', '🔥 Agressif'],
  ];
  return (
    <div className="card auto-bar">
      <div className="row wrap">
        <b>🤖 Pilote automatique</b>
        {profiles.map(([p, l]) => (
          <button key={p} className={a.profile === p ? 'primary sm' : 'ghost sm'} onClick={() => setAuto({ profile: p })}>
            {l}
          </button>
        ))}
        <label className="row small">
          <input type="checkbox" checked={a.stopDecisions} onChange={(e) => setAuto({ stopDecisions: e.target.checked })} /> M’arrêter pour les décisions
        </label>
      </div>
      {!racing && (
        <button className="primary" onClick={autoWeekend} title="Essais, qualifs et décisions gérés automatiquement, puis départ en mode TV">
          ⚡ Simuler jusqu’à la course (mode TV)
        </button>
      )}
    </div>
  );
}
