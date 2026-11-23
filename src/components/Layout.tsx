import { useEffect } from 'react';
import { useGame } from '../game/store';
import type { Screen } from '../game/types';
import { CALENDAR } from '../data/calendar';
import { compact, dateFr, money } from '../game/format';
import { DriverPhoto, Flag, TeamLogo } from './ui/media';
import { PLAYER_ID } from '../game/types';
import { teamOf } from '../game/people';

const NAV: { id: Screen; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: 'Accueil' },
  { id: 'planner', icon: '📅', label: 'Planning' },
  { id: 'weekend', icon: '🏁', label: 'Week-end' },
  { id: 'phone', icon: '📱', label: 'Téléphone' },
  { id: 'news', icon: '📰', label: 'Presse' },
  { id: 'standings', icon: '🏆', label: 'Classements' },
  { id: 'calendar', icon: '🗓️', label: 'Calendrier' },
  { id: 'team', icon: '🛠️', label: 'Écurie' },
  { id: 'career', icon: '✍️', label: 'Carrière' },
  { id: 'paddock', icon: '👥', label: 'Paddock' },
  { id: 'finances', icon: '💶', label: 'Finances' },
  { id: 'lifestyle', icon: '🛥️', label: 'Style de vie' },
  { id: 'profile', icon: '🧑‍🚀', label: 'Mon pilote' },
  { id: 'settings', icon: '⚙️', label: 'Réglages' },
  { id: 'cheats', icon: '🎭', label: 'Triche' },
];

export function Sidebar() {
  const screen = useGame((s) => s.ui.screen);
  const setScreen = useGame((s) => s.setScreen);
  const g = useGame((s) => s.game!);
  const unreadDM = Object.values(g.conversations).reduce((a, c) => a + c.unread, 0) + g.group.unread + g.mail.filter((m) => !m.read).length;
  const pendingItw = g.interviews.filter((i) => !i.done).length;
  const openOffers = g.offers.filter((o) => o.state === 'open' || o.state === 'negotiating').length;
  const badges: Partial<Record<Screen, number>> = { phone: unreadDM, news: pendingItw, career: openOffers };
  return (
    <nav className="sidebar">
      <div className="brand">
        PADDOCK<span>F1 CAREER</span>
      </div>
      {NAV.filter((n) => n.id !== 'cheats' || g.cheats?.enabled || g.settings.showCheats).map((n) => (
        <button key={n.id} className={`nav ${screen === n.id ? 'on' : ''} ${n.id === 'weekend' && g.weekend ? 'live' : ''}`} onClick={() => setScreen(n.id)}>
          <span className="nav-icon">{n.icon}</span>
          <span className="nav-label">{n.label}</span>
          {!!badges[n.id] && <span className="badge">{badges[n.id]}</span>}
        </button>
      ))}
    </nav>
  );
}

export function TopBar() {
  const g = useGame((s) => s.game!);
  const setScreen = useGame((s) => s.setScreen);
  const p = g.player;
  const next = g.round < 24 ? CALENDAR[g.round] : null;
  const team = teamOf(g, PLAYER_ID);
  return (
    <header className="topbar">
      <button className="tb-player" onClick={() => setScreen('profile')}>
        <DriverPhoto id={PLAYER_ID} size={36} />
        <div>
          <b>
            {p.firstName} {p.lastName}
          </b>
          <div className="small muted">
            {team ? <TeamLogo id={team} size={14} withName /> : 'Sans volant'} · #{p.number}
          </div>
        </div>
      </button>
      <div className="tb-date">
        <b>{dateFr(g.date)}</b>
        <span className="small muted">
          Saison {g.season} · {g.phase === 'weekend' ? 'Week-end de course' : next ? <>Prochain : <Flag code={next.country} size={12} /> {next.short} {g.actionsLeft > 0 ? `(J-${g.actionsLeft + 3})` : ''}</> : 'Intersaison'}
        </span>
      </div>
      <div className="tb-stats">
        <Gauge icon="⚡" label="Énergie" v={p.energy} />
        <Gauge icon="😊" label="Moral" v={p.morale} />
        <Gauge icon="😰" label="Stress" v={p.stress} invert />
        <div className="tb-stat" title="Abonnés">
          <span>📸</span>
          <b>{compact(p.followers)}</b>
        </div>
        <div className="tb-stat" title="Fortune">
          <span>💶</span>
          <b className={p.money < 0 ? 'neg' : ''}>{money(p.money)}</b>
        </div>
      </div>
    </header>
  );
}

function Gauge({ icon, label, v, invert }: { icon: string; label: string; v: number; invert?: boolean }) {
  const good = invert ? v < 40 : v > 60;
  const bad = invert ? v > 70 : v < 30;
  return (
    <div className="tb-stat" title={`${label} : ${Math.round(v)}/100`}>
      <span>{icon}</span>
      <div className="mini-bar">
        <div style={{ width: `${v}%`, background: bad ? 'var(--bad)' : good ? 'var(--good)' : 'var(--warn)' }} />
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useGame((s) => s.ui.toast);
  const clear = useGame((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clear, 4200);
    return () => clearTimeout(t);
  }, [toast, clear]);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone}`} onClick={clear}>
      {toast.text.split('\n').map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
