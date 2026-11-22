import { useEffect, useRef, useState } from 'react';
import { DRIVERS_BY_ID } from '../../data/drivers';
import { TEAMS_BY_ID } from '../../data/teams';
import { useGame } from '../../game/store';
import { PLAYER_ID, type PhoneApp, type SocialPost, type TeamId } from '../../game/types';
import { compact, dateFr } from '../../game/format';
import { identity, teamOf } from '../../game/people';
import { claudeAvailable } from '../../game/social/claude';
import { DriverPhoto, TeamLogo } from '../ui/media';

const APPS: { id: PhoneApp; icon: string; label: string }[] = [
  { id: 'messages', icon: '💬', label: 'Messages' },
  { id: 'whatsapp', icon: '🟢', label: 'WhatsApp' },
  { id: 'insta', icon: '📸', label: 'Paddockgram' },
  { id: 'mail', icon: '✉️', label: 'Mail' },
];

export function Phone() {
  const app = useGame((s) => s.ui.phoneApp);
  const setApp = useGame((s) => s.setPhoneApp);
  const g = useGame((s) => s.game!);
  const unread: Record<PhoneApp, number> = {
    messages: Object.values(g.conversations).reduce((a, c) => a + c.unread, 0),
    whatsapp: g.group.unread,
    insta: 0,
    mail: g.mail.filter((m) => !m.read).length,
  };
  return (
    <div className="page phone-page">
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-status">
          <span>{dateFr(g.date)}</span>
          <span>📶 🔋 {Math.round(g.player.energy)}%</span>
        </div>
        <div className="phone-screen">
          {app === 'messages' && <Messages />}
          {app === 'whatsapp' && <Group />}
          {app === 'insta' && <Insta />}
          {app === 'mail' && <Mail />}
        </div>
        <div className="phone-dock">
          {APPS.map((a) => (
            <button key={a.id} className={app === a.id ? 'on' : ''} onClick={() => setApp(a.id, null)}>
              <span>{a.icon}</span>
              <small>{a.label}</small>
              {unread[a.id] > 0 && <span className="badge">{unread[a.id]}</span>}
            </button>
          ))}
        </div>
      </div>
      {claudeAvailable(g) ? (
        <p className="small muted center">🤖 Mode IA activé : les pilotes répondent via Claude en incarnant leur personnalité.</p>
      ) : (
        <p className="small muted center">Astuce : active le mode IA (Réglages) pour des conversations encore plus naturelles avec les pilotes.</p>
      )}
    </div>
  );
}

function contactName(g: ReturnType<typeof useGame.getState>['game'], id: string): string {
  if (!g) return id;
  if (id.startsWith('tp:')) {
    const t = TEAMS_BY_ID[id.slice(3) as TeamId];
    return `${t.principal} (${t.name})`;
  }
  return identity(g, id).name;
}

function ContactAvatar({ id, size = 40 }: { id: string; size?: number }) {
  if (id.startsWith('tp:')) return <TeamLogo id={id.slice(3) as TeamId} size={size} />;
  return <DriverPhoto id={id} size={size} />;
}

function Messages() {
  const g = useGame((s) => s.game!);
  const open = useGame((s) => s.ui.openConversation);
  const setApp = useGame((s) => s.setPhoneApp);
  const [newTo, setNewTo] = useState('');
  if (open) return <Chat id={open} />;
  const convs = Object.values(g.conversations).sort((a, b) => (b.messages.at(-1)?.day ?? 0) - (a.messages.at(-1)?.day ?? 0) || b.unread - a.unread);
  const team = teamOf(g, PLAYER_ID);
  return (
    <div className="app">
      <div className="app-head">
        <h3>Messages</h3>
        <select value={newTo} onChange={(e) => e.target.value && setApp('messages', e.target.value)}>
          <option value="">✏️ Nouveau…</option>
          {team && <option value={`tp:${team}`}>{TEAMS_BY_ID[team].principal} (Team Principal)</option>}
          {Object.values(g.drivers)
            .filter((d) => DRIVERS_BY_ID[d.id] && !d.retired)
            .sort((a, b) => b.rel.friendship - a.rel.friendship)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {DRIVERS_BY_ID[d.id].firstName} {DRIVERS_BY_ID[d.id].lastName}
              </option>
            ))}
        </select>
      </div>
      <div className="conv-list">
        {!convs.length && <p className="muted center">Aucune conversation. Écris à un pilote !</p>}
        {convs.map((c) => {
          const last = c.messages.at(-1);
          return (
            <button key={c.id} className="conv" onClick={() => { setNewTo(''); setApp('messages', c.id); }}>
              <ContactAvatar id={c.id} />
              <div className="conv-body">
                <b>{contactName(g, c.id)}</b>
                <span className="small muted ellipsis">
                  {last?.from === PLAYER_ID ? 'Toi : ' : ''}
                  {last?.text}
                </span>
              </div>
              {c.unread > 0 && <span className="badge">{c.unread}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chat({ id }: { id: string }) {
  const g = useGame((s) => s.game!);
  const send = useGame((s) => s.sendDM);
  const setApp = useGame((s) => s.setPhoneApp);
  const markRead = useGame((s) => s.markConversationRead);
  const typing = useGame((s) => s.ui.typing[id]);
  const [text, setText] = useState('');
  const conv = g.conversations[id];
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conv?.unread) markRead(id);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv?.messages.length, conv?.unread, id, markRead, typing]);
  const d = g.drivers[id];
  const submit = () => {
    if (!text.trim()) return;
    send(id, text);
    setText('');
  };
  return (
    <div className="app chat">
      <div className="app-head">
        <button className="ghost sm" onClick={() => setApp('messages', null)}>
          ←
        </button>
        <ContactAvatar id={id} size={32} />
        <div>
          <b>{contactName(g, id)}</b>
          {d && <div className="small muted">Amitié {Math.round(d.rel.friendship)} · Rivalité {Math.round(d.rel.rivalry)}</div>}
        </div>
      </div>
      <div className="bubbles">
        {conv?.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.from === PLAYER_ID ? 'me' : 'them'}`}>
            {m.text}
          </div>
        ))}
        {typing && <div className="bubble them typing">…</div>}
        <div ref={endRef} />
      </div>
      <div className="composer">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Message… (invite au golf, chambre, excuse-toi, demande conseil…)" />
        <button className="primary" onClick={submit}>
          ➤
        </button>
      </div>
    </div>
  );
}

function Group() {
  const g = useGame((s) => s.game!);
  const send = useGame((s) => s.sendGroup);
  const markRead = useGame((s) => s.markGroupRead);
  const typing = useGame((s) => s.ui.typing.group);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (g.group.unread) markRead();
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [g.group.messages.length, g.group.unread, markRead, typing]);
  const submit = () => {
    if (!text.trim()) return;
    send(text);
    setText('');
  };
  const members = Object.values(g.drivers).filter((d) => d.teamId && !d.retired).length + 1;
  return (
    <div className="app chat wa">
      <div className="app-head wa-head">
        <span className="wa-icon">🏎️</span>
        <div>
          <b>F1 Drivers 🏁</b>
          <div className="small muted">{members} participants</div>
        </div>
      </div>
      <div className="bubbles">
        {g.group.messages.map((m, i, arr) => {
          const showDay = i === 0 || arr[i - 1].day !== m.day;
          const me = m.from === PLAYER_ID;
          const t = teamOf(g, m.from);
          return (
            <div key={m.id}>
              {showDay && <div className="day-sep">Jour {m.day}</div>}
              <div className={`wa-msg ${me ? 'me' : ''}`}>
                {!me && <DriverPhoto id={m.from} size={26} ring={false} />}
                <div className={`bubble ${me ? 'me' : 'them'}`}>
                  {!me && (
                    <div className="wa-name" style={{ color: t ? TEAMS_BY_ID[t].color : '#aaa' }}>
                      {identity(g, m.from).firstName} {identity(g, m.from).lastName}
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}
        {typing && <div className="bubble them typing">quelqu’un écrit…</div>}
        <div ref={endRef} />
      </div>
      <div className="composer">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Écris au groupe… (propose un padel, chambre Max, parle sécurité…)" />
        <button className="primary" onClick={submit}>
          ➤
        </button>
      </div>
    </div>
  );
}

function authorName(g: NonNullable<ReturnType<typeof useGame.getState>['game']>, id: string) {
  if (id === PLAYER_ID || DRIVERS_BY_ID[id] || g.generatedDrivers[id]) return identity(g, id).name;
  if (TEAMS_BY_ID[id as TeamId]) return TEAMS_BY_ID[id as TeamId].name;
  return id;
}

function Insta() {
  const g = useGame((s) => s.game!);
  const create = useGame((s) => s.createPost);
  const like = useGame((s) => s.likePost);
  const [kind, setKind] = useState<SocialPost['kind']>('lifestyle');
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'feed' | 'me'>('feed');
  const posts = tab === 'me' ? g.feed.filter((p) => p.author === PLAYER_ID) : g.feed;
  const myPosts = g.feed.filter((p) => p.author === PLAYER_ID);
  return (
    <div className="app insta">
      <div className="app-head">
        <h3>Paddockgram</h3>
        <div className="tabs sm">
          <button className={tab === 'feed' ? 'on' : ''} onClick={() => setTab('feed')}>Fil</button>
          <button className={tab === 'me' ? 'on' : ''} onClick={() => setTab('me')}>Mon profil</button>
        </div>
      </div>
      {tab === 'me' && (
        <div className="insta-profile">
          <DriverPhoto id={PLAYER_ID} size={64} />
          <div className="stat-box"><b>{myPosts.length}</b><span>posts</span></div>
          <div className="stat-box"><b>{compact(g.player.followers)}</b><span>abonnés</span></div>
          <div className="stat-box"><b>{Math.round(g.player.image.likeability)}</b><span>sympathie</span></div>
        </div>
      )}
      <div className="composer col">
        <div className="row">
          <select value={kind} onChange={(e) => setKind(e.target.value as SocialPost['kind'])}>
            <option value="race">🏁 Course</option>
            <option value="lifestyle">🌅 Lifestyle</option>
            <option value="training">🏋️ Entraînement</option>
            <option value="fans">❤️ Message aux fans</option>
            <option value="sponsor">⌚ Post sponsorisé</option>
            <option value="statement">📝 Déclaration</option>
            <option value="meme">😂 Mème</option>
          </select>
          <button className="primary sm" disabled={!text.trim()} onClick={() => { create(kind, text); setText(''); setTab('me'); }}>
            Publier
          </button>
        </div>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Légende de ta publication…" />
      </div>
      <div className="posts">
        {posts.slice(0, 40).map((p) => (
          <div key={p.id} className="post">
            <div className="post-head">
              {DRIVERS_BY_ID[p.author] || p.author === PLAYER_ID || g.generatedDrivers[p.author] ? <DriverPhoto id={p.author} size={30} /> : TEAMS_BY_ID[p.author as TeamId] ? <TeamLogo id={p.author as TeamId} size={30} /> : null}
              <b>{authorName(g, p.author)}</b>
              <span className="small muted">· jour {p.day}</span>
            </div>
            <div className="post-img">{p.image}</div>
            <div className="post-actions">
              <button className={`ghost sm ${p.likedByPlayer ? 'liked' : ''}`} onClick={() => like(p.id)}>
                {p.likedByPlayer ? '❤️' : '🤍'} {compact(p.likes)}
              </button>
            </div>
            <div className="post-text">
              <b>{authorName(g, p.author)}</b> {p.text}
            </div>
            {p.comments.slice(0, 4).map((c, i) => (
              <div key={i} className="small comment">
                <b>{DRIVERS_BY_ID[c.author] ? `${DRIVERS_BY_ID[c.author].firstName} ${DRIVERS_BY_ID[c.author].lastName} ✔️` : c.author}</b> {c.text}
              </div>
            ))}
          </div>
        ))}
        {!posts.length && <p className="muted center">Rien pour l’instant.</p>}
      </div>
    </div>
  );
}

function Mail() {
  const g = useGame((s) => s.game!);
  const read = useGame((s) => s.readMail);
  const resolve = useGame((s) => s.resolveMail);
  const setScreen = useGame((s) => s.setScreen);
  const [open, setOpen] = useState<string | null>(null);
  const m = open ? g.mail.find((x) => x.id === open) : null;
  if (m) {
    const a = m.action;
    return (
      <div className="app mail">
        <div className="app-head">
          <button className="ghost sm" onClick={() => setOpen(null)}>
            ←
          </button>
          <b className="ellipsis">{m.subject}</b>
        </div>
        <div className="mail-body">
          <div className="small muted">De : {m.from} · jour {m.day}</div>
          <pre>{m.body}</pre>
          {a && !m.resolved && a.kind === 'sponsorOffer' && (
            <div className="row">
              <button className="primary" onClick={() => resolve(m.id, true)}>
                Accepter le partenariat
              </button>
              <button className="ghost" onClick={() => resolve(m.id, false)}>
                Décliner
              </button>
            </div>
          )}
          {a && !m.resolved && a.kind === 'event' && (
            <div className="row">
              <button className="primary" onClick={() => resolve(m.id, true)}>
                Participer
              </button>
              <button className="ghost" onClick={() => resolve(m.id, false)}>
                Décliner
              </button>
            </div>
          )}
          {a?.kind === 'contractOffer' && (
            <button className="primary" onClick={() => setScreen('career')}>
              Voir l’offre dans Carrière →
            </button>
          )}
          {m.resolved && <p className="muted small">Traité.</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="app mail">
      <div className="app-head">
        <h3>Boîte de réception</h3>
      </div>
      <div className="conv-list">
        {g.mail.map((x) => (
          <button key={x.id} className={`conv ${x.read ? '' : 'unread'}`} onClick={() => { read(x.id); setOpen(x.id); }}>
            <div className="conv-body">
              <b>{x.from}</b>
              <span className="small ellipsis">{x.subject}</span>
            </div>
            {!x.read && <span className="dot" />}
          </button>
        ))}
      </div>
    </div>
  );
}
