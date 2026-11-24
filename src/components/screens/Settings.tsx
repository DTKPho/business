import { useState } from 'react';
import { DRIVERS } from '../../data/drivers';
import { TEAMS } from '../../data/teams';
import { useGame } from '../../game/store';
import { claudeTestKey, DEFAULT_CLAUDE_MODEL } from '../../game/social/claude';
import { downloadFullBackup } from '../../game/backup';
import { DriverPhoto, TeamLogo } from '../ui/media';

const MODELS = [
  { id: DEFAULT_CLAUDE_MODEL, label: 'Claude Opus 5.5 (recommandé)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (plus rapide)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (très économique)' },
];

export function SettingsScreen() {
  const g = useGame((s) => s.game!);
  const update = useGame((s) => s.updateSettings);
  const reset = useGame((s) => s.resetGame);
  const importSave = useGame((s) => s.importSave);
  const [test, setTest] = useState('');
  const [imgTarget, setImgTarget] = useState(DRIVERS[0].id);
  const [imgUrl, setImgUrl] = useState('');
  const st = g.settings;

  const toast = useGame((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const exportSave = async () => {
    setBusy(true);
    const n = await downloadFullBackup(useGame.getState().game!);
    setBusy(false);
    toast(`Sauvegarde complète téléchargée (partie + ${n} photo${n > 1 ? 's' : ''}).`, 'good');
  };

  return (
    <div className="page">
      <h1>⚙️ Réglages</h1>
      <div className="grid2">
        <section className="card">
          <h2>🤖 Mode IA (Claude)</h2>
          <p className="small">
            Optionnel. Avec une clé API Anthropic, les pilotes te répondent en messages privés et dans le groupe WhatsApp en incarnant réellement leur personnalité, et tes interviews sont analysées par un « rédacteur en chef » IA. Sans clé, le moteur local du jeu prend le relais.
          </p>
          <p className="small muted">La clé reste dans ton navigateur (localStorage) et sert uniquement aux appels directs à l’API Anthropic. Elle n’est jamais incluse dans les exports de sauvegarde. Chaque message consomme quelques tokens facturés sur ton compte Anthropic.</p>
          <label className="row">
            <input type="checkbox" checked={st.claude.enabled} onChange={(e) => update((s) => { s.claude.enabled = e.target.checked; })} /> Activer le mode IA
          </label>
          <label>
            Clé API
            <input type="password" value={st.claude.apiKey} placeholder="sk-ant-…" onChange={(e) => update((s) => { s.claude.apiKey = e.target.value; })} />
          </label>
          <label>
            Modèle
            <select value={st.claude.model} onChange={(e) => update((s) => { s.claude.model = e.target.value; })}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <p className="small muted">Langues : le groupe WhatsApp, Instagram et les interviews sont en anglais ; en privé, les pilotes francophones (Leclerc, Gasly, Ocon, Hadjar, Stroll) t’écrivent en français si ton pilote est francophone.</p>
          <button className="ghost" onClick={async () => { setTest('Test en cours…'); setTest(await claudeTestKey(useGame.getState().game!)); }}>
            📻 Tester la connexion
          </button>
          {test && <p className="small">{test}</p>}
        </section>
        <section className="card">
          <h2>🎮 Partie</h2>
          <label>
            Difficulté
            <select value={st.difficulty} onChange={(e) => update((s) => { s.difficulty = e.target.value as 'easy' | 'normal' | 'hard'; })}>
              <option value="easy">Facile</option>
              <option value="normal">Normal</option>
              <option value="hard">Difficile</option>
            </select>
          </label>
          <label className="row">
            <input type="checkbox" checked={!!st.showCheats} onChange={(e) => update((s) => { s.showCheats = e.target.checked; })} /> Afficher l’onglet 🎭 Triche
          </label>
          <h3>Sauvegarde</h3>
          <p className="small muted">
            La partie est sauvegardée automatiquement, mais chaque version du jeu (navigateur via npm, fichier Paddock.html, application Windows) a son propre stockage. Pour passer de l’une à l’autre : exporte la sauvegarde complète ici, puis importe-la dans l’autre version.
          </p>
          <div className="row wrap">
            <button className="primary" disabled={busy} onClick={exportSave}>
              {busy ? '⏳ Préparation…' : '💾 Exporter la sauvegarde complète (partie + photos)'}
            </button>
            <label className="btn ghost">
              📂 Importer une sauvegarde
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const msg = await importSave(await f.text());
                  if (msg) toast(msg, 'good');
                  else alert('Sauvegarde invalide');
                }}
              />
            </label>
            <button className="danger" onClick={() => confirm('Effacer définitivement cette carrière ?') && reset()}>
              🗑️ Nouvelle carrière
            </button>
          </div>
        </section>
      </div>
      <section className="card">
        <h2>🖼️ Visuels officiels</h2>
        <p className="small">
          Les portraits des pilotes, logos et voitures sont chargés depuis le CDN officiel de la F1 (media.formula1.com). Si une image ne s’affiche pas (URL changée par la F1), tu peux coller ici l’adresse d’une image de ton choix. Les visuels appartiennent à leurs ayants droit : ce jeu est un projet de fan non commercial.
        </p>
        <div className="row wrap">
          <select value={imgTarget} onChange={(e) => setImgTarget(e.target.value)}>
            <optgroup label="Pilotes">
              {DRIVERS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                </option>
              ))}
            </optgroup>
            <optgroup label="Logos d’écuries">
              {TEAMS.map((t) => (
                <option key={t.id} value={`team:${t.id}`}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          </select>
          <input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://… .png / .webp / .jpg" />
          <button className="primary sm" onClick={() => { update((s) => { if (imgUrl.trim()) s.imageOverrides[imgTarget] = imgUrl.trim(); else delete s.imageOverrides[imgTarget]; }); setImgUrl(''); }}>
            Appliquer
          </button>
          {imgTarget.startsWith('team:') ? <TeamLogo id={imgTarget.slice(5) as never} size={40} /> : <DriverPhoto id={imgTarget} size={48} />}
        </div>
        {Object.keys(st.imageOverrides).length > 0 && (
          <div className="small muted">
            Personnalisés : {Object.keys(st.imageOverrides).join(', ')}{' '}
            <button className="link" onClick={() => update((s) => { s.imageOverrides = {}; })}>
              tout réinitialiser
            </button>
          </div>
        )}
        <div className="photo-wall">
          {DRIVERS.map((d) => (
            <DriverPhoto key={d.id} id={d.id} size={54} />
          ))}
        </div>
      </section>
    </div>
  );
}
