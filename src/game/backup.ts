/**
 * Sauvegarde complète : la partie ET toutes les photos importées.
 * Sert à transférer une carrière d'une version du jeu à une autre
 * (localhost, Paddock.html, application de bureau) : chacune a son propre
 * stockage dans le navigateur.
 */
import type { GameState } from './types';
import { exportAllImages, importAllImages } from './imagestore';

export interface FullBackup {
  format: 'paddock-full';
  version: 1;
  savedAt: string;
  game: GameState;
  images: Record<string, string>;
}

export async function downloadFullBackup(game: GameState): Promise<number> {
  const images = await exportAllImages();
  const data: FullBackup = {
    format: 'paddock-full',
    version: 1,
    savedAt: new Date().toISOString(),
    // la clé API n'est jamais exportée
    game: { ...game, settings: { ...game.settings, claude: { ...game.settings.claude, apiKey: '' } } },
    images,
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `paddock-sauvegarde-complete-${game.player.lastName}-${game.season}-R${game.round + 1}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return Object.keys(images).length;
}

/**
 * Lit un fichier de sauvegarde (complète ou ancienne « partie seule »).
 * Restaure les photos puis renvoie la partie, ou null si le fichier est invalide.
 */
export async function readBackup(text: string): Promise<{ game: GameState; images: number } | null> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<FullBackup> & Partial<GameState>;
  if (d.format === 'paddock-full' && d.game?.player && d.game?.drivers) {
    const n = await importAllImages(d.images ?? {});
    return { game: d.game, images: n };
  }
  if (d.player && d.drivers) return { game: d as GameState, images: 0 };
  return null;
}
