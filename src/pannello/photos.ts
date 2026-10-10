// New photos chosen in the panel. Each one is shrunk to at most 2400 px and
// re-encoded as JPEG in the browser, which also drops its location and
// camera data, then kept in this browser (IndexedDB) until Pubblica sends
// it with the rest of the edits.

const MAX_SIDE = 2400;
const QUALITY = 0.85;
const DB = 'pannello-photos';
const STORE = 'pending';

export const PHOTO_PREFIX = '@assets/foto/';

/** Photos waiting for Pubblica: file name -> preview address. */
const previews = new Map<string, string>();
/** Names already in the site's photo folder, so a new photo never takes one. */
let known: string[] = [];
export const setKnownPhotos = (names: string[]) => (known = names);

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Loads the photos left from an earlier visit, so their previews show. */
export async function loadPending() {
  try {
    const names = (await tx('readonly', (s) => s.getAllKeys())) as string[];
    for (const name of names) {
      const blob = (await tx('readonly', (s) => s.get(name))) as Blob | undefined;
      if (blob && !previews.has(name)) previews.set(name, URL.createObjectURL(blob));
    }
  } catch {
    /* storage blocked: new photos last until the tab closes */
  }
}

export const pendingPreview = (name: string) => previews.get(name);
export const pendingNames = () => [...previews.keys()];
/** Photos being prepared or just added are not in an edit yet: they are never treated as unused. */
const addedAt = new Map<string, number>();
export const unusedSince = (name: string) => Date.now() - (addedAt.get(name) ?? 0) > 120_000;
export const getPending = (name: string) => tx('readonly', (s) => s.get(name)) as Promise<Blob | undefined>;

export async function dropPending(names: string[]) {
  for (const name of names) {
    const url = previews.get(name);
    if (url) URL.revokeObjectURL(url);
    previews.delete(name);
    await tx('readwrite', (s) => s.delete(name)).catch(() => undefined);
  }
}

/** "Cavalli al pascolo.HEIC" -> "cavalli-al-pascolo" */
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'foto';

/**
 * Shrinks and cleans one photo and keeps it for Pubblica.
 * Returns the path to write in the content, e.g. "@assets/foto/galleria-cani-ab12.jpg".
 */
export async function addPhoto(file: File, prefix: string): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error(`«${file.name}» non è una foto che il browser sa aprire. Prova con un JPEG.`);
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Impossibile preparare la foto.'))), 'image/jpeg', QUALITY),
  );

  const used = new Set([...known, ...previews.keys()]);
  const stem = `${slug(prefix)}-${slug(file.name)}`.slice(0, 60);
  let name = `${stem}.jpg`;
  while (used.has(name)) name = `${stem}-${Math.random().toString(36).slice(2, 6)}.jpg`;

  await tx('readwrite', (s) => s.put(blob, name)).catch(() => undefined);
  previews.set(name, URL.createObjectURL(blob));
  addedAt.set(name, Date.now());
  return PHOTO_PREFIX + name;
}

/** The base64 body GitHub's blob endpoint expects. */
export function blobBody(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(JSON.stringify({ content: String(r.result).split(',')[1], encoding: 'base64' }));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Every photo file name an item's data refers to. */
export function photoRefs(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    const m = value.match(/assets\/foto\/([^/]+)$/);
    if (m) out.add(m[1]);
  } else if (Array.isArray(value)) value.forEach((v) => photoRefs(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => photoRefs(v, out));
  return out;
}
