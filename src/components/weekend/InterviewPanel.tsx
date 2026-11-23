import { useState } from 'react';
import { useGame } from '../../game/store';
import type { PendingInterview } from '../../game/types';
import { claudeAvailable } from '../../game/social/claude';

const CONTEXT_LABEL: Record<PendingInterview['context'], string> = {
  thursday: 'Conférence de presse du jeudi',
  postQuali: 'Zone mixte — après les qualifications',
  postRace: 'Zone mixte — après la course',
  feature: 'Interview longue (magazine)',
  tv: 'Plateau TV',
  podcast: 'Podcast',
};

export function InterviewPanel({ itw, onDone }: { itw: PendingInterview; onDone?: () => void }) {
  const submit = useGame((s) => s.submitInterview);
  const skip = useGame((s) => s.skipInterview);
  const g = useGame((s) => s.game!);
  const last = useGame((s) => s.ui.lastInterview);
  const clearLast = useGame((s) => s.clearLastInterview);
  const [answers, setAnswers] = useState<string[]>(itw.answers.length ? itw.answers : itw.questions.map(() => ''));
  const [busy, setBusy] = useState(false);
  const ai = claudeAvailable(g);

  if (itw.done) {
    return (
      <div className="card interview done">
        <div className="eyebrow">🎙️ {CONTEXT_LABEL[itw.context]} · {itw.outlet}</div>
        {last?.id === itw.id ? (
          <>
            <h3>📰 « {last.headline} »</h3>
            <p>{last.summary}</p>
            <div className="row wrap">
              {last.deltas.map((d) => (
                <span key={d.label} className={`chip ${d.label === 'Polémique' ? (d.value > 0 ? 'neg' : 'pos') : d.value > 0 ? 'pos' : 'neg'}`}>
                  {d.label} {d.value > 0 ? '+' : ''}
                  {d.value}
                </span>
              ))}
            </div>
            <button className="ghost sm" onClick={() => { clearLast(); onDone?.(); }}>
              OK
            </button>
          </>
        ) : (
          <p className="muted">Interview terminée.</p>
        )}
      </div>
    );
  }

  return (
    <div className="card interview">
      <div className="eyebrow">
        🎙️ {CONTEXT_LABEL[itw.context]} · <b>{itw.outlet}</b> — {itw.journalist} {ai && <span className="chip pos">🤖 analysé par Claude</span>}
      </div>
      <p className="muted small">Les journalistes posent leurs questions en anglais : réponds en anglais (ou en français). Ton ton (humble, drôle, arrogant, critique envers ton équipe ou un rival, loyal, évasif…) sera analysé : la presse, ton équipe, les fans et les pilotes cités réagiront.</p>
      {itw.questions.map((q, i) => (
        <div key={i} className="qa">
          <div className="question">
            <span className="mic">🎤</span> {q.text}
          </div>
          <textarea
            rows={3}
            value={answers[i] ?? ''}
            placeholder="Ta réponse…"
            onChange={(e) => {
              const a = [...answers];
              a[i] = e.target.value;
              setAnswers(a);
            }}
          />
        </div>
      ))}
      <div className="row">
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await submit(itw.id, answers);
            setBusy(false);
          }}
        >
          {busy ? 'Publication…' : 'Répondre aux journalistes'}
        </button>
        <button className="ghost" disabled={busy} onClick={() => skip(itw.id)}>
          Refuser l’interview
        </button>
      </div>
    </div>
  );
}
