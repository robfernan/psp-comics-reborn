export type ReadingMode = 'paged' | 'manga' | 'webtoon';
export type FitMode = 'contain' | 'width' | 'height';

/** Library metadata for one comic. The archive itself lives in a separate IndexedDB store. */
export interface ComicRecord {
  id: string;
  title: string;
  series?: string;
  number?: string;
  fileName: string;
  size: number;
  pageCount: number;
  addedAt: number;
  lastReadAt: number | null;
  /** Zero-based index of the last page viewed. */
  progress: number;
  finished: boolean;
  bookmarked: boolean;
  /** User override; null means "use detectedMode". */
  readingMode: ReadingMode | null;
  /** Guessed at import time from ComicInfo.xml / page proportions. */
  detectedMode: ReadingMode;
  /** Small pre-rendered cover thumbnail. */
  cover: Blob | null;
}

export interface Settings {
  defaultMode: ReadingMode | 'auto';
  fit: FitMode;
  spread: boolean;
  showPageNumber: boolean;
  showHints: boolean;
  libraryView: 'shelf' | 'grid';
  sort: 'added' | 'read' | 'title';
}

export const DEFAULT_SETTINGS: Settings = {
  defaultMode: 'auto',
  fit: 'contain',
  spread: true,
  showPageNumber: true,
  showHints: true,
  libraryView: 'shelf',
  sort: 'added',
};

export type LibraryFilter = 'all' | 'reading' | 'unread' | 'bookmarked';

export const effectiveMode = (comic: ComicRecord, settings: Settings): ReadingMode =>
  comic.readingMode ?? (settings.defaultMode === 'auto' ? comic.detectedMode : settings.defaultMode);

export const MODE_LABEL: Record<ReadingMode, string> = {
  paged: 'Comic (Left → Right)',
  manga: 'Manga (Right → Left)',
  webtoon: 'Manhwa / Webtoon (Vertical)',
};
