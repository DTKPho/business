import { useRef, type ChangeEvent } from 'react';
import { useGameStore } from '../game/store';
import { formatMoney } from '../game/format';
import { charterTierDef, CHARTER_TIERS } from '../game/charter';
import type { ActiveScreen } from '../game/types';

const SCREENS: { id: ActiveScreen; label: string }[] = [
  { id: 'map', label: 'Carte' },
  { id: 'licenses', label: 'États & gouvernance' },
  { id: 'rivals', label: 'Rivaux' },
  { id: 'holding', label: 'Holding' },
];

export function TopBar() {
  const capital = useGameStore((s) => s.capital);
  const day = useGameStore((s) => s.day);
  const isNight = useGameStore((s) => s.isNight);
  const running = useGameStore((s) => s.running);
  const setRunning = useGameStore((s) => s.setRunning);
  const exportSave = useGameStore((s) => s.exportSave);
  const importSave = useGameStore((s) => s.importSave);
  const resetGame = useGameStore((s) => s.resetGame);
  const routesCount = useGameStore((s) => s.routes.length);
  const charterTier = useGameStore((s) => s.charterTier);
  const activeScreen = useGameStore((s) => s.activeScreen);
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const json = exportSave();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comptoir-1899-jour${day}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const ok = importSave(text);
      if (!ok) window.alert('Fichier de sauvegarde invalide.');
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  return (
    <header className="topbar-wrap">
      <div className="topbar">
        <div className="brand">
          <span className="brand-title">Comptoir &amp; Commissions</span>
          <span className="brand-subtitle">1899</span>
        </div>

        <div className="topbar-stats">
          <div className="stat">
            <span className="stat-label">Capital</span>
            <span className="stat-value">{formatMoney(capital)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Jour</span>
            <span className="stat-value">
              {day} {isNight ? '🌙' : '☀️'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Routes</span>
            <span className="stat-value">{routesCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Charte</span>
            <span className="stat-value charter-tier" title={charterTierDef(charterTier).description}>
              {charterTier}/{CHARTER_TIERS.length} — {charterTierDef(charterTier).name}
            </span>
          </div>
        </div>

        <div className="topbar-actions">
          <button type="button" onClick={() => setRunning(!running)} className={running ? '' : 'paused'}>
            {running ? '⏸ Pause' : '▶ Reprendre'}
          </button>
          <button type="button" onClick={handleExport}>
            Exporter
          </button>
          <button type="button" onClick={handleImportClick}>
            Importer
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (window.confirm('Recommencer une nouvelle partie ? Votre progression actuelle sera perdue.')) {
                resetGame();
              }
            }}
          >
            Nouvelle partie
          </button>
        </div>
      </div>
      <nav className="tab-nav">
        {SCREENS.map((screen) => (
          <button
            key={screen.id}
            type="button"
            className={activeScreen === screen.id ? 'tab active' : 'tab'}
            onClick={() => setActiveScreen(screen.id)}
          >
            {screen.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
