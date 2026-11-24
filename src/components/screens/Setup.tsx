import { useMemo, useState } from 'react';
import { COUNTRY_NAMES, DRIVERS } from '../../data/drivers';
import { TEAMS, TEAMS_BY_ID } from '../../data/teams';
import { RESIDENCES } from '../../data/lifestyle';
import { BACKGROUNDS, playerBaseStats, STAT_KEYS, STAT_LABELS, START_SEASON } from '../../game/init';
import type { Background, DriverStats, ResidenceId, TeamId } from '../../game/types';
import { useGame } from '../../game/store';
import { overall } from '../../game/people';
import { Bar, Flag, Silhouette, SmartImage, TeamCar, TeamLogo } from '../ui/media';
import { driverPhotoCandidates } from '../../data/drivers';

import { resizeImage } from '../ui/image';

const POINTS = 12;

export function Setup() {
  const newGame = useGame((s) => s.newGame);
  const importSave = useGame((s) => s.importSave);
  const [step, setStep] = useState(0);
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [code, setCode] = useState('');
  const [nat, setNat] = useState('FR');
  const [num, setNum] = useState(21);
  const [birth, setBirth] = useState(2005);
  const [photo, setPhoto] = useState<string | null>(null);
  const helmet = { primary: '#0a2a6b', secondary: '#f5c400' };
  const [bg, setBg] = useState<Background>('f2champ');
  const [bonus, setBonus] = useState<Partial<DriverStats>>({});
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [teamId, setTeamId] = useState<TeamId | null>(null);
  const [replaceId, setReplace] = useState<string | null>(null);
  const [residence, setResidence] = useState<ResidenceId>('monaco');

  const used = Object.values(bonus).reduce((a, b) => a + (b ?? 0), 0);
  const stats = useMemo(() => playerBaseStats(bg, bonus), [bg, bonus]);
  const takenNumbers = new Set(DRIVERS.map((d) => d.number));
  const teams = TEAMS.filter((t) => (difficulty === 'easy' ? true : difficulty === 'normal' ? t.prestige <= 82 || bg === 'rich' && t.id === 'astonmartin' : t.prestige <= 70)).sort((a, b) => b.prestige - a.prestige);

  const canNext = [firstName.trim() && lastName.trim() && !takenNumbers.has(num), true, true, teamId && replaceId, true][step];

  const start = () => {
    if (!teamId || !replaceId) return;
    newGame({ firstName, lastName, code: code || lastName.slice(0, 3), nationality: nat, number: num, birthYear: birth, background: bg, helmet, photo, bonus, teamId, replaceId, residence, difficulty });
  };

  return (
    <div className="setup">
      <div className="setup-hero">
        <div className="brand-big">
          PADDOCK<span>CARRIÈRE F1 · {START_SEASON}</span>
        </div>
        <p className="muted">Crée ton pilote, signe ton premier contrat et vis la vie d’un pilote de Formule 1 : courses, presse, négociations, amitiés, rivalités et vie hors des circuits.</p>
        <div className="steps">
          {['Identité', 'Parcours', 'Attributs', 'Écurie', 'Départ'].map((l, i) => (
            <div key={l} className={`step ${i === step ? 'on' : i < step ? 'done' : ''}`}>
              <b>{i + 1}</b> {l}
            </div>
          ))}
        </div>
      </div>

      <div className="card resume-card">
        <div>
          <b>🔁 Tu as déjà une carrière dans une autre version du jeu ?</b>
          <div className="small muted">Dans l’ancienne version, va dans Réglages → « Exporter la sauvegarde complète », puis importe le fichier ici : ta carrière et tes photos reviennent.</div>
        </div>
        <label className="btn primary">
          📂 Importer ma sauvegarde
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const msg = await importSave(await f.text());
              if (!msg) alert('Sauvegarde invalide');
            }}
          />
        </label>
      </div>

      <div className="setup-body card">
        {step === 0 && (
          <div className="grid2">
            <div className="form">
              <label>Prénom<input value={firstName} onChange={(e) => setFirst(e.target.value)} placeholder="Ex : Liam" /></label>
              <label>Nom<input value={lastName} onChange={(e) => setLast(e.target.value)} placeholder="Ex : Moreau" /></label>
              <label>Trigramme (affiché en course)<input value={code} maxLength={3} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={lastName.slice(0, 3).toUpperCase() || 'MOR'} /></label>
              <label>
                Nationalité
                <select value={nat} onChange={(e) => setNat(e.target.value)}>
                  {Object.entries(COUNTRY_NAMES)
                    .sort((a, b) => a[1].localeCompare(b[1]))
                    .map(([c, n]) => (
                      <option key={c} value={c}>
                        {n}
                      </option>
                    ))}
                </select>
              </label>
              <div className="row">
                <label>
                  Numéro
                  <input type="number" min={2} max={99} value={num} onChange={(e) => setNum(Number(e.target.value))} />
                  {takenNumbers.has(num) && <small className="neg">Numéro déjà pris</small>}
                </label>
                <label>
                  Année de naissance
                  <input type="number" min={1990} max={2009} value={birth} onChange={(e) => setBirth(Number(e.target.value))} />
                  <small className="muted">{START_SEASON - birth} ans en {START_SEASON}</small>
                </label>
              </div>
            </div>
            <div className="form">
              <div className="photo-pick">
                <div className="avatar" style={{ width: 120, height: 120, borderColor: '#55556a' }}>
                  {photo ? <img src={photo} alt="" /> : <Silhouette size={120} tint="#c9c9d6" />}
                </div>
                <div>
                  <label className="btn">
                    📷 Importer ta photo
                    <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files?.[0] && setPhoto(await resizeImage(e.target.files[0]))} />
                  </label>
                  {photo && (
                    <button className="ghost" onClick={() => setPhoto(null)}>
                      Retirer
                    </button>
                  )}
                  <p className="muted small">Sinon, une silhouette neutre sert d’avatar.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="cards">
            {(Object.keys(BACKGROUNDS) as Background[]).map((k) => {
              const b = BACKGROUNDS[k];
              return (
                <button key={k} className={`pick ${bg === k ? 'on' : ''}`} onClick={() => setBg(k)}>
                  <h3>{b.name}</h3>
                  <p>{b.desc}</p>
                  <div className="muted small">
                    Niveau de base {b.base} · {(b.money / 1e6).toFixed(1)} M€ · {(b.followers / 1000).toFixed(0)} k abonnés
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="grid2">
            <div>
              <h3>
                Répartis {POINTS} points de talent <span className="muted">({POINTS - used} restants)</span>
              </h3>
              {STAT_KEYS.map((k) => (
                <div key={k} className="stat-edit">
                  <span>{STAT_LABELS[k]}</span>
                  <button className="ghost sm" disabled={!bonus[k]} onClick={() => setBonus({ ...bonus, [k]: (bonus[k] ?? 0) - 1 })}>
                    −
                  </button>
                  <Bar value={stats[k]} color={bonus[k] ? 'var(--good)' : undefined} right={stats[k]} />
                  <button className="ghost sm" disabled={used >= POINTS || (bonus[k] ?? 0) >= 6} onClick={() => setBonus({ ...bonus, [k]: (bonus[k] ?? 0) + 1 })}>
                    +
                  </button>
                </div>
              ))}
            </div>
            <div className="card inner">
              <h3>Note globale</h3>
              <div className="big-num">{overall(stats)}</div>
              <p className="muted">Pour comparaison : Verstappen 97, Norris 93, Albon 85, Stroll 76. Ta note progressera avec l’expérience, l’entraînement, ton staff et ton travail au simulateur.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="row wrap">
              <span className="muted">Difficulté :</span>
              {(['easy', 'normal', 'hard'] as const).map((d) => (
                <button key={d} className={difficulty === d ? 'primary sm' : 'ghost sm'} onClick={() => { setDifficulty(d); setTeamId(null); setReplace(null); }}>
                  {d === 'easy' ? 'Facile (toutes les écuries)' : d === 'normal' ? 'Normal (milieu de grille)' : 'Difficile (fond de grille)'}
                </button>
              ))}
            </div>
            <p className="muted">Choisis l’écurie qui t’offre ton premier volant, puis le pilote dont tu prends la place (il devient agent libre et pourra revenir…).</p>
            <div className="team-pick">
              {teams.map((t) => (
                <button key={t.id} className={`team-card ${teamId === t.id ? 'on' : ''}`} style={{ borderColor: t.color }} onClick={() => { setTeamId(t.id); setReplace(null); }}>
                  <div className="row">
                    <TeamLogo id={t.id} size={34} />
                    <div>
                      <b>{t.name}</b>
                      <div className="muted small">{t.principal} · moteur {t.engine}</div>
                    </div>
                  </div>
                  <TeamCar id={t.id} height={54} />
                </button>
              ))}
            </div>
            {teamId && (
              <div className="replace">
                <h3>Qui remplaces-tu chez {TEAMS_BY_ID[teamId].name} ?</h3>
                <div className="row wrap">
                  {DRIVERS.filter((d) => d.teamId === teamId).map((d) => (
                    <button key={d.id} className={`driver-pick ${replaceId === d.id ? 'on' : ''}`} onClick={() => setReplace(d.id)}>
                      <div className="avatar" style={{ width: 64, height: 64, borderColor: TEAMS_BY_ID[teamId].color }}>
                        <SmartImage candidates={driverPhotoCandidates(d, teamId)} alt={d.lastName} fallback={<span className="avatar-initials">{d.code}</span>} />
                      </div>
                      <div>
                        <b>
                          <Flag code={d.nationality} /> {d.firstName} {d.lastName}
                        </b>
                        <div className="muted small">Note {d.rating} · n°{d.number}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="grid2">
            <div>
              <h3>Résidence fiscale</h3>
              <div className="cards small">
                {RESIDENCES.map((r) => (
                  <button key={r.id} className={`pick ${residence === r.id ? 'on' : ''}`} onClick={() => setResidence(r.id)}>
                    <b>
                      <Flag code={r.flag} /> {r.name}
                    </b>
                    <div className="small muted">Impôt {Math.round(r.taxRate * 100)} % · coût de vie {(r.livingCost / 1000).toFixed(0)} k€/an</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="card inner">
              <h3>Récapitulatif</h3>
              <p>
                <b>
                  <Flag code={nat} /> {firstName} {lastName}
                </b>{' '}
                · n°{num} · {BACKGROUNDS[bg].name}
              </p>
              {teamId && (
                <p>
                  <TeamLogo id={teamId} withName /> à la place de {DRIVERS.find((d) => d.id === replaceId)?.lastName}
                </p>
              )}
              <p className="muted">Note globale {overall(stats)} · difficulté {difficulty}</p>
              <button className="primary big" onClick={start}>
                🏁 Lancer ma carrière
              </button>
            </div>
          </div>
        )}

        <div className="setup-nav">
          <button className="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ← Retour
          </button>
          {step < 4 && (
            <button className="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Continuer →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
