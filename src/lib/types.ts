export type ReadingMode = 'paged' | 'manga' | 'webtoon';
export type FitMode = 'contain' | 'width' | 'height';
export type ThemeColor =
  | 'classic-red'
  | 'jan-silver'
  | 'feb-butter'
  | 'mar-spring'
  | 'apr-sakura'
  | 'may-emerald'
  | 'jun-sky'
  | 'jul-cyan'
  | 'aug-midnight'
  | 'sep-amethyst'
  | 'oct-gold'
  | 'nov-amber'
  | 'dec-ruby'
  | 'monolith-black'
  | 'cyberpunk-neon'
  | 'midnight-blue'
  | 'royal-purple'
  | 'emerald-green'
  | 'cyber-gold'
  | 'rose-pink';

export interface ThemeConfig {
  id: ThemeColor;
  label: string;
  season?: string;
  accent: string;
  previewBg: string;
}

export const THEME_CONFIGS: ThemeConfig[] = [
  { id: 'classic-red', label: 'Classic Crimson (Original Digital Comics)', accent: '#ff4535', previewBg: '#ff4535' },
  { id: 'jan-silver', label: 'January • Platinum Frost', season: 'Jan', accent: '#94a3b8', previewBg: '#64748b' },
  { id: 'feb-butter', label: 'February • Canary Yellow', season: 'Feb', accent: '#eab308', previewBg: '#ca8a04' },
  { id: 'mar-spring', label: 'March • Spring Sprout', season: 'Mar', accent: '#84cc16', previewBg: '#65a30d' },
  { id: 'apr-sakura', label: 'April • Sakura Blossom', season: 'Apr', accent: '#f472b6', previewBg: '#db2777' },
  { id: 'may-emerald', label: 'May • Emerald Forest', season: 'May', accent: '#22c55e', previewBg: '#16a34a' },
  { id: 'jun-sky', label: 'June • Summer Sky', season: 'Jun', accent: '#38bdf8', previewBg: '#0284c7' },
  { id: 'jul-cyan', label: 'July • Ocean Cyan', season: 'Jul', accent: '#06b6d4', previewBg: '#0891b2' },
  { id: 'aug-midnight', label: 'August • Midnight Cobalt', season: 'Aug', accent: '#3b82f6', previewBg: '#2563eb' },
  { id: 'sep-amethyst', label: 'September • Royal Amethyst', season: 'Sep', accent: '#a855f7', previewBg: '#9333ea' },
  { id: 'oct-gold', label: 'October • Autumn Gold', season: 'Oct', accent: '#f59e0b', previewBg: '#d97706' },
  { id: 'nov-amber', label: 'November • Warm Amber', season: 'Nov', accent: '#ea580c', previewBg: '#c2410c' },
  { id: 'dec-ruby', label: 'December • Deep Crimson Ruby', season: 'Dec', accent: '#e11d48', previewBg: '#be123c' },
  { id: 'monolith-black', label: 'Monolith Noir (OLED Minimal)', accent: '#f8fafc', previewBg: '#334155' },
  { id: 'cyberpunk-neon', label: 'Cyberpunk Neon (Teal & Violet)', accent: '#00f0ff', previewBg: '#06b6d4' },
];

export function getCurrentMonthTheme(): ThemeColor {
  const month = new Date().getMonth();
  const calendarMonths: ThemeColor[] = [
    'jan-silver',
    'feb-butter',
    'mar-spring',
    'apr-sakura',
    'may-emerald',
    'jun-sky',
    'jul-cyan',
    'aug-midnight',
    'sep-amethyst',
    'oct-gold',
    'nov-amber',
    'dec-ruby',
  ];
  return calendarMonths[month] ?? 'classic-red';
}

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
  theme: ThemeColor;
  soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultMode: 'auto',
  fit: 'contain',
  spread: true,
  showPageNumber: true,
  showHints: true,
  libraryView: 'shelf',
  sort: 'added',
  theme: 'classic-red',
  soundEnabled: true,
};

export type LibraryFilter = 'all' | 'reading' | 'unread' | 'bookmarked';

export const effectiveMode = (comic: ComicRecord, settings: Settings): ReadingMode =>
  comic.readingMode ?? (settings.defaultMode === 'auto' ? comic.detectedMode : settings.defaultMode);

export const MODE_LABEL: Record<ReadingMode, string> = {
  paged: 'Comic (Left → Right)',
  manga: 'Manga (Right → Left)',
  webtoon: 'Manhwa / Webtoon (Vertical)',
};
