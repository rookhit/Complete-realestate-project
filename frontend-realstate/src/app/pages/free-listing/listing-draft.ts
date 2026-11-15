// A half-written Free Listing, kept on this device for the signed-in account until it is sent, so a
// reload, a closed tab or a lapsed sign-in doesn't lose it:
// - the typed fields and ticks in localStorage ("nb-listing-draft:<user id>");
// - the picked photos (the files themselves) in IndexedDB, which can hold large files.
// Wiped when the listing is sent, when it is 30 days old, and for every account when someone
// presses Log Out (auth.tsx onSignedOut), so the next person at a shared computer never sees it.
// If the browser blocks storage, the form simply isn't kept.
import { onSignedOut } from "@/app/auth";
import { pickImage, type PickedImage } from "@/app/components/ui/image-upload";

const PREFIX = "nb-listing-draft:";
const DB_NAME = "nb-drafts";
const STORE = "listing-photos";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type StoredPhoto = { id: string; name: string; type: string; lastModified: number; blob: Blob };
type StoredPhotos = { savedAt: number; photos: StoredPhoto[] };

// ─── Fields (localStorage) ─────────────────────────────────────────────────────

/** The saved fields for this account, or null (none, too old, or unreadable). */
export function loadDraftFields<T extends object>(userId: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { savedAt?: number; fields?: T };
    if (!saved.fields || !saved.savedAt || Date.now() - saved.savedAt > MAX_AGE_MS) { localStorage.removeItem(PREFIX + userId); return null; }
    return saved.fields;
  } catch {
    return null;
  }
}

export function saveDraftFields<T extends object>(userId: string, fields: T): void {
  try { localStorage.setItem(PREFIX + userId, JSON.stringify({ savedAt: Date.now(), fields })); } catch { /* storage full or blocked */ }
}

// ─── Photos (IndexedDB) ────────────────────────────────────────────────────────

let db: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  db ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(err => { db = null; throw err; });
  return db;
}

/** Runs one request in a transaction on the photo store and resolves with its result. */
async function inStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const conn = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = conn.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** The photos picked earlier, as fresh previews (in the order they were picked). */
export async function loadDraftPhotos(userId: string): Promise<PickedImage[]> {
  try {
    const saved = await inStore<StoredPhotos | undefined>("readonly", s => s.get(userId));
    if (!saved || Date.now() - saved.savedAt > MAX_AGE_MS) return [];
    return saved.photos.map(p => pickImage(new File([p.blob], p.name, { type: p.type, lastModified: p.lastModified }), p.id));
  } catch {
    return [];
  }
}

export async function saveDraftPhotos(userId: string, images: PickedImage[]): Promise<void> {
  try {
    if (!images.length) { await inStore("readwrite", s => s.delete(userId)); return; }
    const value: StoredPhotos = {
      savedAt: Date.now(),
      photos: images.map(i => ({ id: i.id, name: i.file.name, type: i.file.type, lastModified: i.file.lastModified, blob: i.file })),
    };
    await inStore("readwrite", s => s.put(value, userId));
  } catch { /* storage full or blocked: the photos just aren't kept */ }
}

// ─── Clearing ──────────────────────────────────────────────────────────────────

/** The listing was sent: forget this account's draft. */
export async function clearDraft(userId: string): Promise<void> {
  try { localStorage.removeItem(PREFIX + userId); } catch { /* ignore */ }
  try { await inStore("readwrite", s => s.delete(userId)); } catch { /* ignore */ }
}

/** Log Out: forget every account's draft on this device. */
async function clearAllDrafts(): Promise<void> {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
  try { await inStore("readwrite", s => s.clear()); } catch { /* ignore */ }
}

onSignedOut(() => { void clearAllDrafts(); });
