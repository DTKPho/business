import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { saveImage, useImage } from '../../game/imagestore';

/** Bouton pour importer / retirer une image personnelle liée à une clé. */
export function ImageUpload({ imageKey, label = 'Mettre une image', max = 1800, compact = false }: { imageKey: string; label?: string; max?: number; compact?: boolean }) {
  const url = useImage(imageKey);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <span className={`img-upload ${compact ? 'compact' : ''}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="ghost sm"
        disabled={busy}
        onClick={() => input.current?.click()}
        title="Importer une image depuis ton ordinateur"
      >
        {busy ? '⏳' : '🖼️'} {compact ? '' : url ? 'Changer l’image' : label}
      </button>
      {url && !compact && (
        <button type="button" className="ghost sm" onClick={() => saveImage(imageKey, null)} title="Retirer l’image importée">
          ✕
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          await saveImage(imageKey, f, max);
          setBusy(false);
        }}
      />
    </span>
  );
}

/** Bandeau / fond avec image personnelle (ou repli graphique). */
export function Scene({ imageKey, fallback, children, className = '', style, overlay = 0.55, upload }: { imageKey: string | null; fallback: string; children?: ReactNode; className?: string; style?: CSSProperties; overlay?: number; upload?: string }) {
  const url = useImage(imageKey);
  const bg = url ? `linear-gradient(180deg, rgba(8,8,12,${overlay * 0.6}) 0%, rgba(8,8,12,${overlay}) 55%, rgba(8,8,12,${Math.min(0.95, overlay + 0.3)}) 100%), url("${url}") center / cover no-repeat` : fallback;
  return (
    <section className={`scene ${url ? 'has-img' : ''} ${className}`} style={{ background: bg, ...style }}>
      {upload && imageKey && (
        <div className="scene-upload">
          <ImageUpload imageKey={imageKey} label={upload} />
        </div>
      )}
      {children}
    </section>
  );
}

/** Vignette d'image (boutique, résidences, posts). */
export function Thumb({ imageKey, fallback, className = '', alt = '' }: { imageKey: string | null; fallback: ReactNode; className?: string; alt?: string }) {
  const url = useImage(imageKey);
  if (!url) return <div className={`thumb ${className}`}>{fallback}</div>;
  return (
    <div className={`thumb ${className}`}>
      <img src={url} alt={alt} />
    </div>
  );
}
