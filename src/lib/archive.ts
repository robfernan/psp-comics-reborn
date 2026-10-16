import JSZip from 'jszip';
import type { ComicRecord, ReadingMode } from './types';

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const ARCHIVE_RE = /\.(cbz|zip)$/i;

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp',
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const mimeFor = (name: string) => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/jpeg';

/** Image entries in reading order, ignoring macOS junk and hidden files. */
function imageEntries(zip: JSZip): JSZip.JSZipObject[] {
  return Object.values(zip.files)
    .filter((e) => !e.dir && IMAGE_RE.test(e.name) && !/(^|\/)(__MACOSX|\.)/.test(e.name))
    .sort((a, b) => collator.compare(a.name, b.name));
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const cleanTitle = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';

/** Render a small cover thumbnail so the library never has to unzip archives. */
async function makeThumbnail(blob: Blob, maxWidth = 420): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / bmp.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/webp', 0.85));
  } catch {
    return blob;
  }
}

/** Tall, narrow pages are almost always webtoon/manhwa strips. */
async function detectFromProportions(entries: JSZip.JSZipObject[]): Promise<ReadingMode> {
  const sample = entries.slice(1, 4);
  if (sample.length === 0) return 'paged';
  let ratios = 0;
  let counted = 0;
  for (const entry of sample) {
    try {
      const bmp = await createImageBitmap(await entry.async('blob'));
      ratios += bmp.height / bmp.width;
      counted += 1;
      bmp.close();
    } catch {
      /* skip unreadable sample */
    }
  }
  return counted && ratios / counted > 2 ? 'webtoon' : 'paged';
}

interface ComicInfo {
  title?: string;
  series?: string;
  number?: string;
  manga?: boolean;
}

/** Parse ComicInfo.xml (ComicRack / Komga / Kavita standard) when present. */
async function readComicInfo(zip: JSZip): Promise<ComicInfo> {
  const entry = Object.values(zip.files).find((e) => /(^|\/)comicinfo\.xml$/i.test(e.name));
  if (!entry) return {};
  try {
    const doc = new DOMParser().parseFromString(await entry.async('text'), 'application/xml');
    const text = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent?.trim() || undefined;
    return {
      title: text('Title'),
      series: text('Series'),
      number: text('Number'),
      manga: /yesandrighttoleft/i.test(text('Manga') ?? ''),
    };
  } catch {
    return {};
  }
}

async function buildRecord(zip: JSZip, fileName: string, size: number): Promise<ComicRecord | null> {
  const entries = imageEntries(zip);
  if (entries.length === 0) return null;

  const [info, cover, proportionMode] = await Promise.all([
    readComicInfo(zip),
    entries[0].async('blob').then((b) => makeThumbnail(new Blob([b], { type: mimeFor(entries[0].name) }))),
    detectFromProportions(entries),
  ]);

  const baseTitle = cleanTitle(fileName);
  const title =
    info.series && info.number ? `${info.series} #${info.number}` : info.title || info.series || baseTitle;

  return {
    id: newId(),
    title,
    series: info.series,
    number: info.number,
    fileName,
    size,
    pageCount: entries.length,
    addedAt: Date.now(),
    lastReadAt: null,
    progress: 0,
    finished: false,
    bookmarked: false,
    readingMode: null,
    detectedMode: info.manga ? 'manga' : proportionMode,
    cover,
  };
}

export interface ImportResult {
  record: ComicRecord;
  file: Blob;
}

export interface ImportReport {
  imported: ImportResult[];
  skipped: string[];
}

/**
 * Turn user-selected files into library entries.
 * - Each .cbz/.zip becomes one comic.
 * - Loose images are grouped per folder into a single comic (repacked as a zip).
 */
export async function importFiles(
  files: File[],
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<ImportReport> {
  const archives = files.filter((f) => ARCHIVE_RE.test(f.name));
  const images = files.filter((f) => IMAGE_RE.test(f.name));
  const skipped = files.filter((f) => !ARCHIVE_RE.test(f.name) && !IMAGE_RE.test(f.name)).map((f) => f.name);

  const groups = new Map<string, File[]>();
  for (const img of images) {
    const rel = (img as File & { webkitRelativePath?: string }).webkitRelativePath || '';
    const folder = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : 'Imported Images';
    groups.set(folder, [...(groups.get(folder) ?? []), img]);
  }

  const total = archives.length + groups.size;
  let completed = 0;
  const imported: ImportResult[] = [];

  for (const file of archives) {
    onProgress?.(completed, total, file.name);
    try {
      const zip = await JSZip.loadAsync(file);
      const record = await buildRecord(zip, file.name, file.size);
      if (record) imported.push({ record, file });
      else skipped.push(file.name);
    } catch {
      skipped.push(file.name);
    }
    completed += 1;
  }

  for (const [folder, groupFiles] of groups) {
    const name = folder.split('/').pop() || folder;
    onProgress?.(completed, total, name);
    try {
      const zip = new JSZip();
      groupFiles
        .sort((a, b) => collator.compare(a.name, b.name))
        .forEach((f) => zip.file(f.name, f));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const record = await buildRecord(await JSZip.loadAsync(blob), `${name}.cbz`, blob.size);
      if (record) imported.push({ record, file: blob });
    } catch {
      skipped.push(name);
    }
    completed += 1;
  }

  onProgress?.(total, total, '');
  return { imported, skipped };
}

/**
 * An open book. Pages are decoded lazily and cached as object URLs,
 * so even 300-page webtoon chapters open instantly.
 */
export class BookSession {
  private urls = new Map<number, string>();
  private pending = new Map<number, Promise<string>>();
  private disposed = false;

  private constructor(private entries: JSZip.JSZipObject[]) {}

  static async open(file: Blob): Promise<BookSession> {
    const zip = await JSZip.loadAsync(file);
    return new BookSession(imageEntries(zip));
  }

  get length() {
    return this.entries.length;
  }

  cached(index: number): string | undefined {
    return this.urls.get(index);
  }

  page(index: number): Promise<string> {
    const hit = this.urls.get(index);
    if (hit) return Promise.resolve(hit);
    const inflight = this.pending.get(index);
    if (inflight) return inflight;

    const entry = this.entries[index];
    if (!entry) return Promise.reject(new Error(`Page ${index} out of range`));

    const job = entry.async('blob').then((raw) => {
      const url = URL.createObjectURL(new Blob([raw], { type: mimeFor(entry.name) }));
      if (this.disposed) {
        URL.revokeObjectURL(url);
        throw new Error('Session closed');
      }
      this.urls.set(index, url);
      this.pending.delete(index);
      return url;
    });
    this.pending.set(index, job);
    return job;
  }

  /** Warm pages around the reading position. */
  prefetch(center: number, radius = 3) {
    for (let i = Math.max(0, center - 1); i <= Math.min(this.length - 1, center + radius); i++) {
      void this.page(i).catch(() => undefined);
    }
  }

  dispose() {
    this.disposed = true;
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls.clear();
    this.pending.clear();
  }
}

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
};
