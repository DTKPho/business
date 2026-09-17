import { useGameStore } from './game/store';
import { useGameLoop } from './game/useGameLoop';
import { TopBar } from './components/TopBar';
import { MapView } from './components/MapView';
import { CityPanel } from './components/CityPanel';
import { RoutePanel } from './components/RoutePanel';
import { EventLog } from './components/EventLog';

function App() {
  useGameLoop();

  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const selectedRouteId = useGameStore((s) => s.selectedRouteId);

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        <MapView />
        <aside className="side-panel">
          {selectedCityId && <CityPanel cityId={selectedCityId} />}
          {selectedRouteId && <RoutePanel routeId={selectedRouteId} />}
          {!selectedCityId && !selectedRouteId && (
            <div className="panel panel-placeholder">
              <h2>Bienvenue, marchand</h2>
              <p>
                Cliquez sur une ville pour consulter son marché, puis tracez une route vers une autre ville
                pour commencer à percevoir une commission sur le commerce qui y transite.
              </p>
            </div>
          )}
          <EventLog />
        </aside>
      </div>
    </div>
  );
}

export default App;
