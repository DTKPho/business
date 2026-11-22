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
  };

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopBar />
        <main className="content">{views[screen] ?? <Home />}</main>
      </div>
      <Toast />
    </div>
  );
}
