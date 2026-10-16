import type { ComicRecord } from './types';

/**
 * Tiny promise wrapper around IndexedDB.
 * - `comics`: metadata + cover thumbnail (loaded at startup)
 * - `files`:  the original archive blob (loaded only when reading)
 */
const DB_NAME = 'psp-digital-comics';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('comics')) db.createObjectStore('comics', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAllComics(): Promise<ComicRecord[]> {
  const db = await openDb();
  return wrap(db.transaction('comics').objectStore('comics').getAll());
}

export async function addComic(record: ComicRecord, file: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['comics', 'files'], 'readwrite');
  tx.objectStore('comics').put(record);
  tx.objectStore('files').put({ id: record.id, blob: file });
  await done(tx);
}

export async function putComic(record: ComicRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('comics', 'readwrite');
  tx.objectStore('comics').put(record);
  await done(tx);
}

export async function deleteComic(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['comics', 'files'], 'readwrite');
  tx.objectStore('comics').delete(id);
  tx.objectStore('files').delete(id);
  await done(tx);
}

export async function getComicFile(id: string): Promise<Blob | null> {
  const db = await openDb();
  const row = await wrap<{ id: string; blob: Blob } | undefined>(
    db.transaction('files').objectStore('files').get(id),
  );
  return row?.blob ?? null;
}

/** Ask the browser not to evict the library under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est) return null;
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  } catch {
    return null;
  }
}
