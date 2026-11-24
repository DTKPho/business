/**
 * Images personnelles du joueur.
 *
 * Deux sources, par ordre de priorité :
 *  1. images importées dans le jeu (stockées dans IndexedDB du navigateur) ;
 *  2. fichiers déposés dans le dossier `images/` du projet (voir images/LISEZMOI.md),
 *     ex. images/teams/ferrari.jpg, images/circuits/mon.jpg, images/shop/yacht.png.
 */
import { useEffect, useState } from 'react';

// ───────── Fichiers du dossier images/ (résolus par Vite) ─────────
const files = import.meta.glob('/images/**/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG,WEBP}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const folderMap: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  // /images/teams/ferrari.jpg  →  team:ferrari
  const m = path.match(/^\/images\/([^/]+)\/(.+)\.[a-zA-Z]+$/);
  if (!m) continue;
  const [, folder, name] = m;
  const prefix: Record<string, string> = { teams: 'team', circuits: 'circuit', shop: 'shop', wallpapers: 'wallpaper', residences: 'residence', drivers: 'driver', screens: 'screen' };
  const p = prefix[folder] ?? folder;
  folderMap[`${p}:${name.toLowerCase()}`] = url;
}

export function folderImage(key: string): string | null {
  return folderMap[key.toLowerCase()] ?? null;
}

// ───────── IndexedDB ─────────
const DB = 'paddock-images';
const STORE = 'img';
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function idbGet(key: string): Promise<Blob | null> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve((r.result as Blob) ?? null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, blob: Blob | null): Promise<void> {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    if (blob) tx.objectStore(STORE).put(blob, key);
    else tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ───────── Cache + abonnements ─────────
const urlCache = new Map<string, string | null>();
const listeners = new Map<string, Set<() => void>>();

// ───────── Export / import de toutes les images (sauvegarde complète) ─────────
function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Toutes les images importées dans le jeu, encodées en data URL. */
export async function exportAllImages(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const d = await db();
    const keys: IDBValidKey[] = await new Promise((resolve) => {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve([]);
    });
    for (const k of keys) {
      const b = await idbGet(String(k));
      if (b) out[String(k)] = await blobToDataUrl(b);
    }
  } catch {
    /* IndexedDB indisponible */
  }
  return out;
}

/** Restaure des images exportées (remplace celles qui ont la même clé). */
export async function importAllImages(images: Record<string, string>): Promise<number> {
  let n = 0;
  for (const [key, dataUrl] of Object.entries(images)) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const old = urlCache.get(key);
      if (old) URL.revokeObjectURL(old);
      urlCache.delete(key);
      await idbSet(key, blob);
      notify(key);
      n++;
    } catch {
      /* image ignorée */
    }
  }
  return n;
}

function notify(key: string) {
  listeners.get(key)?.forEach((f) => f());
}

async function load(key: string): Promise<string | null> {
  if (urlCache.has(key)) return urlCache.get(key)!;
  const blob = await idbGet(key);
  const url = blob ? URL.createObjectURL(blob) : null;
  urlCache.set(key, url);
  return url;
}

/** Compresse une image importée (max `max` px, JPEG). */
export async function compress(file: File | Blob, max = 1800, quality = 0.84): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((resolve) => c.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function saveImage(key: string, file: File | Blob | null, max = 1800): Promise<void> {
  const old = urlCache.get(key);
  if (old) URL.revokeObjectURL(old);
  urlCache.delete(key);
  await idbSet(key, file ? await compress(file, max) : null);
  notify(key);
}

/** URL de l'image pour une clé : importée > dossier images/ > null. */
export function useImage(key: string | null | undefined): string | null {
  const [, force] = useState(0);
  const [url, setUrl] = useState<{ key: string | null | undefined; url: string | null }>({ key, url: key ? (urlCache.get(key) ?? null) : null });
  if (url.key !== key) setUrl({ key, url: key ? (urlCache.get(key) ?? null) : null });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const refresh = () => {
      load(key).then((u) => {
        if (alive) {
          setUrl({ key, url: u });
          force((n) => n + 1);
        }
      });
    };
    refresh();
    const set = listeners.get(key) ?? new Set();
    set.add(refresh);
    listeners.set(key, set);
    return () => {
      alive = false;
      set.delete(refresh);
    };
  }, [key]);
  if (!key) return null;
  return (url.key === key ? url.url : null) ?? folderImage(key);
}

export function newImageKey(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
