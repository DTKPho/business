import { useState } from 'react';
import { useGame } from '../../game/store';
import type { NewsItem } from '../../game/types';
import { InterviewPanel } from '../weekend/InterviewPanel';

const TAGS: { id: NewsItem['tag'] | 'all'; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'player', label: 'Moi' },
  { id: 'race', label: 'Courses' },
  { id: 'interview', label: 'Interviews' },
  { id: 'transfer', label: 'Mercato' },
  { id: 'rumour', label: 'Rumeurs' },
  { id: 'paddock', label: 'Paddock' },
  { id: 'business', label: 'Business' },
];

export function News() {
  const g = useGame((s) => s.game!);
  const request = useGame((s) => s.requestInterview);
  const [tag, setTag] = useState<NewsItem['tag'] | 'all'>('all');
  const pending = g.interviews.filter((i) => !i.done);
  const items = g.news.filter((n) => tag === 'all' || n.tag === tag);
  return (
    <div className="page">
      <h1>📰 Presse & médias</h1>
      <div className="grid2 wide-left">
        <div>
          {pending.map((i) => (
            <InterviewPanel key={i.id} itw={i} />
          ))}
          <div className="tabs wrap">
            {TAGS.map((t) => (
              <button key={t.id} className={tag === t.id ? 'on' : ''} onClick={() => setTag(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="news-list">
            {items.map((n) => (
              <article key={n.id} className="card article">
                <div className="eyebrow">
                  <span className={`chip tag-${n.tag}`}>{n.outlet}</span> jour {n.day}
                </div>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </article>
            ))}
            {!items.length && <p className="muted">Aucun article.</p>}
          </div>
        </div>
        <aside>
          <div className="card">
            <h3>🎙️ Demander une interview</h3>
            <p className="small muted">Les médias te donnent de la visibilité… et des occasions de déraper. Chaque interview est écrite par toi.</p>
            <div className="col">
              <button className="ghost" onClick={() => request('feature')}>
                📖 Interview longue (magazine)
              </button>
              <button className="ghost" onClick={() => request('tv')}>
                📺 Plateau TV
              </button>
              <button className="ghost" onClick={() => request('podcast')}>
                🎧 Podcast fans
              </button>
            </div>
          </div>
          <div className="card">
            <h3>🪞 Ton image publique</h3>
            <div className="small">Sympathie : {Math.round(g.player.image.likeability)}/100</div>
            <div className="small">Professionnalisme : {Math.round(g.player.image.professionalism)}/100</div>
            <div className="small">Polémique : {Math.round(g.player.image.controversy)}/100</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
