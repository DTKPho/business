import { useEffect } from 'react';
import { useGame } from './game/store';
import { Setup } from './components/screens/Setup';
import { Sidebar, TopBar, Toast } from './components/Layout';
import { Home } from './components/screens/Home';
import { Planner } from './components/screens/Planner';
import { Weekend } from './components/screens/Weekend';
import { Calendar } from './components/screens/Calendar';
import { Standings } from './components/screens/Standings';
import { Team } from './components/screens/Team';
import { Career } from './components/screens/Career';
import { Paddock } from './components/screens/Paddock';
import { Phone } from './components/screens/Phone';
import { News } from './components/screens/News';
import { Finances } from './components/screens/Finances';
import { Lifestyle } from './components/screens/Lifestyle';
import { Profile } from './components/screens/Profile';
import { SettingsScreen } from './components/screens/Settings';
import { SeasonEnd } from './components/screens/SeasonEnd';
import { Cheats } from './components/screens/Cheats';
import { useImage } from './game/imagestore';
import { TEAMS_BY_ID } from './data/teams';
import { CALENDAR } from './data/calendar';
import { PLAYER_ID } from './game/types';
import { teamOf } from './game/people';
import { circuitFallback, teamFallback } from './components/ui/backgrounds';

/** Couleur d'ambiance et fond propres à chaque onglet. */
const SCREEN_THEME: Record<string, { accent: string; bg: string }> = {
  planner: { accent: '#14b8a6', bg: 'radial-gradient(1100px 600px at 90% -10%, #0f3b3a 0%, transparent 60%), radial-gradient(800px 500px at -10% 110%, #0d2a3a, transparent 60%), #0b0f14' },
  phone: { accent: '#25d366', bg: 'radial-gradient(900px 600px at 50% -20%, #12332a 0%, transparent 60%), linear-gradient(180deg, #07130f, #0b0b10)' },
  news: { accent: '#f5c451', bg: 'radial-gradient(1000px 600px at 80% -10%, #3a2d10 0%, transparent 60%), repeating-linear-gradient(0deg, #ffffff05 0 1px, transparent 1px 28px), #100e0a' },
  standings: { accent: '#ffd84d', bg: 'radial-gradient(1000px 500px at 50% -20%, #3d3006 0%, transparent 60%), #0c0b08' },
  career: { accent: '#5b8cff', bg: 'radial-gradient(1000px 600px at 85% -10%, #12224d 0%, transparent 60%), repeating-linear-gradient(90deg, #ffffff04 0 1px, transparent 1px 40px), #0a0c14' },
  paddock: { accent: '#b36bff', bg: 'radial-gradient(1000px 600px at 15% -10%, #2a1446 0%, transparent 60%), radial-gradient(900px 500px at 100% 100%, #3a0d2a, transparent 60%), #0d0a12' },
  finances: { accent: '#2fd17a', bg: 'radial-gradient(1000px 600px at 85% -10%, #0f3a22 0%, transparent 60%), repeating-linear-gradient(0deg, #2fd17a08 0 1px, transparent 1px 34px), #08100c' },
  lifestyle: { accent: '#d4af37', bg: 'radial-gradient(1100px 600px at 80% -10%, #3d300f 0%, transparent 60%), radial-gradient(700px 400px at 0% 100%, #0f2a3d, transparent 60%), #0e0c08' },
  profile: { accent: '#38bdf8', bg: 'radial-gradient(1000px 600px at 20% -10%, #0c2c40 0%, transparent 60%), #090d12' },
  settings: { accent: '#9a9aae', bg: 'linear-gradient(180deg, #121218, #0b0b10)' },
  cheats: { accent: '#ff2bd6', bg: 'radial-gradient(900px 600px at 50% -10%, #3d0a35 0%, transparent 60%), repeating-linear-gradient(45deg, #ff2bd608 0 2px, transparent 2px 22px), #0d070d' },
};

function ScreenBackground({ screen }: { screen: string }) {
  const g = useGame((s) => s.game!);
  const team = teamOf(g, PLAYER_ID);
  const raceId = g.weekend?.raceId ?? CALENDAR[Math.min(23, g.round)].id;
  const key = screen === 'home' || screen === 'team' ? (team ? `team:${team}` : null) : screen === 'weekend' || screen === 'calendar' ? `circuit:${raceId}` : `screen:${screen}`;
  const url = useImage(key);
  const custom = useImage(`screen:${screen}`);
  const img = screen === 'home' || screen === 'team' || screen === 'weekend' || screen === 'calendar' ? url : custom;
  let fallback = SCREEN_THEME[screen]?.bg;
  if (!fallback) fallback = screen === 'weekend' || screen === 'calendar' ? circuitFallback(raceId) : team ? teamFallback(team) : '#0d0d13';
  const bg = img ? `linear-gradient(180deg, rgba(8,8,12,.55), rgba(8,8,12,.82) 45%, rgba(8,8,12,.94)), url("${img}") center / cover no-repeat` : fallback;
  return <div className="screen-bg" style={{ background: bg }} />;
}

export default function App() {
  const game = useGame((s) => s.game);
  const screen = useGame((s) => s.ui.screen);
  const phase = useGame((s) => s.game?.phase);

  useEffect(() => {
    document.title = game ? `Paddock — ${game.player.firstName} ${game.player.lastName}` : 'Paddock — Carrière F1';
  }, [game?.player.firstName, game?.player.lastName, game]);

  if (!game) return <Setup />;

  const views: Record<string, React.ReactNode> = {
    home: phase === 'offseason' ? <SeasonEnd /> : <Home />,
    planner: <Planner />,
    weekend: <Weekend />,
    calendar: <Calendar />,
    standings: <Standings />,
    team: <Team />,
    career: <Career />,
    paddock: <Paddock />,
    phone: <Phone />,
    news: <News />,
    finances: <Finances />,
    lifestyle: <Lifestyle />,
    profile: <Profile />,
    settings: <SettingsScreen />,
    cheats: <Cheats />,
  };

  const team = teamOf(game, PLAYER_ID);
  const accent = screen === 'home' || screen === 'team' ? (team ? TEAMS_BY_ID[team].color : '#e10600') : (SCREEN_THEME[screen]?.accent ?? '#e10600');
  return (
    <div className="shell" data-screen={screen} style={{ ['--theme' as string]: accent }}>
      <ScreenBackground screen={screen} />
      <Sidebar />
      <div className="main">
        <TopBar />
        <main className="content" key={screen}>{views[screen] ?? <Home />}</main>
      </div>
      <Toast />
    </div>
  );
}
