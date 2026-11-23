import { useRef, useState } from 'react';
import { useGame } from '../../game/store';
import { newImageKey, saveImage } from '../../game/imagestore';
import { Thumb } from './scene';

/** Galerie de photos personnelles (résidence, yacht, voiture…). */
export function Gallery({ owner, title = 'Mes photos' }: { owner: string; title?: string }) {
  const keys = useGame((s) => s.game?.player.gallery?.[owner]) ?? [];
  const update = useGame((s) => s.updateGallery);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="gallery-wrap">
      <div className="row between">
        <b className="small">{title} ({keys.length})</b>
        <button className="ghost sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? '⏳' : '➕'} Ajouter des photos
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (!files.length) return;
            setBusy(true);
            const added: string[] = [];
            for (const f of files) {
              const k = newImageKey(`gal-${owner}`);
              await saveImage(k, f, 1600);
              added.push(k);
            }
            update(owner, [...(useGame.getState().game?.player.gallery?.[owner] ?? []), ...added]);
            setBusy(false);
          }}
        />
      </div>
      {keys.length > 0 && (
        <div className="gallery">
          {keys.map((k) => (
            <div key={k} style={{ position: 'relative' }}>
              <Thumb imageKey={k} fallback="🖼️" />
              <button
                className="ghost sm del"
                style={{ position: 'absolute', top: 4, right: 4 }}
                onClick={async () => {
                  await saveImage(k, null);
                  update(owner, keys.filter((x) => x !== k));
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
