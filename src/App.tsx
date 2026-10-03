import { useEffect, useMemo, useRef, useState } from 'react';
import { ShaderBackground } from './components/ShaderBackground';
import { ComicBook, extractUniversalCbz, extractUniversalCbzPages, titleFromPath } from './lib/cbz';

type Scene = 'MAIN_MENU' | 'CAROUSEL' | 'READER';
type CollectionView = 'all' | 'unread' | 'bookmarked';
type ReaderFitMode = 'contain' | 'cover';

interface ReaderOptions {
  fitMode: ReaderFitMode;
  showPageCounter: boolean;
  readingDirection: 'ltr' | 'rtl';
}

const COMIC_PATHS = [
  "assets/1 Scott Pilgrim's Precious Little Life.cbz",
  'assets/Absolute Batman 020 (2026) (Digital) (Pyrate-DCP).cbz',
  'assets/Batman Beyond - Return of the Joker (2001 comic adaptation).cbz',
  'assets/Official U.S. PlayStation Magazine Issue 01 (October 1997).cbz',
];

const MENU_ITEMS = [
  { label: 'Browse Collection', counter: '04' },
  { label: 'Recently Added', counter: '04' },
  { label: 'Unread', counter: '00' },
  { label: 'Bookmarks', counter: '12' },
  { label: 'Options', counter: '99' },
];

const STORAGE_KEYS = {
  bookmarks: 'psp-digital-comics.bookmarks',
  read: 'psp-digital-comics.read',
  options: 'psp-digital-comics.options',
  bookmarkPositions: 'psp-digital-comics.bookmarkPositions',
};

const DEFAULT_READER_OPTIONS: ReaderOptions = {
  fitMode: 'contain',
  showPageCounter: true,
  readingDirection: 'ltr',
};

const thumbUrlForPath = (path: string): string => {
  const fileName = path.split('/').pop() ?? path;
  const slug = fileName
    .replace(/\.cbz$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `/thumbs/${slug}.jpg`;
};

const createInitialComics = (): ComicBook[] =>
  COMIC_PATHS.map((path, index) => {
    return {
      id: `seed-${index}-${path}`,
      title: titleFromPath(path),
      coverUrl: thumbUrlForPath(path),
      totalPages: 0,
      path,
    };
  });

function loadStringSet(storageKey: string): Set<string> {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return new Set<string>();
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.filter((entry) => typeof entry === 'string'));
  } catch {
    return new Set<string>();
  }
}

function loadReaderOptions(): ReaderOptions {
  if (typeof window === 'undefined') {
    return DEFAULT_READER_OPTIONS;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEYS.options);
    if (!rawValue) {
      return DEFAULT_READER_OPTIONS;
    }

    const parsed = JSON.parse(rawValue) as Partial<ReaderOptions>;

    return {
      fitMode: parsed.fitMode === 'cover' ? 'cover' : 'contain',
      showPageCounter: parsed.showPageCounter !== false,
      readingDirection: parsed.readingDirection === 'rtl' ? 'rtl' : 'ltr',
    };
  } catch {
    return DEFAULT_READER_OPTIONS;
  }
}

function loadBookmarkPositions(): Record<string, number> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.bookmarkPositions);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, number> = {};
      for (const k of Object.keys(parsed)) {
        const v = parsed[k];
        out[k] = typeof v === 'number' && Number.isFinite(v) ? v : Number(parsed[k]) || 0;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

export function App() {
  const [currentScene, setCurrentScene] = useState<Scene>('MAIN_MENU');
  const [collectionView, setCollectionView] = useState<CollectionView>('all');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [activeComicIndex, setActiveComicIndex] = useState(0);
  const [readerComicIndex, setReaderComicIndex] = useState(0);
  const [readerPageIndex, setReaderPageIndex] = useState(0);
  const [readerPages, setReaderPages] = useState<string[]>([]);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerZoom, setReaderZoom] = useState(1);
  const [readerPan, setReaderPan] = useState({ x: 0, y: 0 });
  const [readerViewportWidth, setReaderViewportWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  const [bookmarkedComicIds, setBookmarkedComicIds] = useState<Set<string>>(() => loadStringSet(STORAGE_KEYS.bookmarks));
  const [bookmarkedPositions, setBookmarkedPositions] = useState<Record<string, number>>(() => loadBookmarkPositions());
  const [readComicIds, setReadComicIds] = useState<Set<string>>(() => loadStringSet(STORAGE_KEYS.read));
  const [readerOptions, setReaderOptions] = useState<ReaderOptions>(() => loadReaderOptions());
  const [comicsList, setComicsList] = useState<ComicBook[]>(() => createInitialComics());
  const [menuOpen, setMenuOpen] = useState(true);
  const appRef = useRef<HTMLDivElement | null>(null);
  const [appScale, setAppScale] = useState(1);

  // removed tap-to-turn refs (explicit buttons now used)
  const readerDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const readerHeaderRef = useRef<HTMLElement | null>(null);
  const readerFooterRef = useRef<HTMLElement | null>(null);
  const readerStageRef = useRef<HTMLElement | null>(null);
  const [readerStageHeight, setReaderStageHeight] = useState<number | null>(null);

  const selectedComic = comicsList[activeComicIndex] ?? comicsList[0];
  const readerComic = comicsList[readerComicIndex] ?? comicsList[0];
  const currentReaderPage = readerPages[readerPageIndex] ?? readerPages[0] ?? '';
  const readerSpreadMode = readerViewportWidth >= 1024 && readerPages.length > 1;
  const readerSpreadStartIndex = readerSpreadMode ? readerPageIndex - (readerPageIndex % 2) : readerPageIndex;
  const readerVisiblePages = readerSpreadMode
    ? readerPages.slice(readerSpreadStartIndex, readerSpreadStartIndex + 2)
    : readerPages.slice(readerPageIndex, readerPageIndex + 1);

  const unreadCount = comicsList.filter((comic) => !readComicIds.has(comic.id)).length;
  const bookmarkedCount = bookmarkedComicIds.size;

  const visibleComicIndices = useMemo(() => {
    return comicsList
      .map((comic, index) => ({ comic, index }))
      .filter(({ comic }) => {
        if (collectionView === 'unread') {
          return !readComicIds.has(comic.id);
        }

        if (collectionView === 'bookmarked') {
          return bookmarkedComicIds.has(comic.id);
        }

        return true;
      })
      .map(({ index }) => index);
  }, [bookmarkedComicIds, collectionView, comicsList, readComicIds]);

  const activeCollectionComicIndex = visibleComicIndices[activeComicIndex] ?? visibleComicIndices[0] ?? 0;
  const activeCollectionComic = comicsList[activeCollectionComicIndex] ?? comicsList[0];
  const readerPageCounterLabel = readerSpreadMode
    ? `${readerSpreadStartIndex + 1}${readerVisiblePages[1] ? `-${readerSpreadStartIndex + 2}` : ''} / ${readerPages.length}`
    : readerPages.length
      ? `${readerPageIndex + 1} / ${readerPages.length}`
      : 'Loading pages...';
  const readerZoomPercent = Math.round(readerZoom * 100);

  const openCollectionView = (view: CollectionView) => {
    setCollectionView(view);
    setActiveComicIndex(0);
    setCurrentScene('CAROUSEL');
  };

  const toggleBookmarkByComicId = (comicId: string) => {
    // toggle bookmark but keep any saved page position so the reader can resume later
    setBookmarkedComicIds((current) => {
      const next = new Set(current);
      if (next.has(comicId)) {
        next.delete(comicId);
        // intentionally keep bookmarkedPositions[comicId] so resume is preserved
      } else {
        next.add(comicId);
        setBookmarkedPositions((p) => ({ ...p, [comicId]: p[comicId] ?? 0 }));
      }
      return next;
    });
  };

  // bookmark and save a specific page (used from reader)
  const toggleBookmarkWithPage = (comicId: string, pageIndex?: number) => {
    setBookmarkedComicIds((current) => {
      const next = new Set(current);
      if (next.has(comicId)) {
        next.delete(comicId);
        // keep position saved
      } else {
        next.add(comicId);
        setBookmarkedPositions((p) => ({ ...p, [comicId]: typeof pageIndex === 'number' ? pageIndex : p[comicId] ?? 0 }));
      }
      return next;
    });
  };

  const advanceReaderPage = (delta: number) => {
    setReaderPageIndex((current) => {
      const direction = readerOptions.readingDirection === 'rtl' ? -1 : 1;
      const step = readerSpreadMode ? 2 : 1;
      const nextIndex = current + delta * direction * step;

      return Math.max(0, Math.min(readerPages.length - 1, nextIndex));
    });
  };

  const resetReaderView = () => {
    setReaderZoom(1);
    setReaderPan({ x: 0, y: 0 });
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(Array.from(bookmarkedComicIds)));
  }, [bookmarkedComicIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.bookmarkPositions, JSON.stringify(bookmarkedPositions));
    } catch {
      // ignore
    }
  }, [bookmarkedPositions]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.read, JSON.stringify(Array.from(readComicIds)));
  }, [readComicIds]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.options, JSON.stringify(readerOptions));
  }, [readerOptions]);

  useEffect(() => {
    const warmCache = async () => {
      for (const path of COMIC_PATHS) {
        void extractUniversalCbz(`/${path}`, thumbUrlForPath(path));
      }
    };

    void warmCache();
  }, []);

  // Scale the whole app down to fit the viewport height if content overflows.
  useEffect(() => {
    const computeScale = () => {
      const el = appRef.current;
      if (!el) return setAppScale(1);

      // measure the content height
      const contentH = el.scrollHeight || el.offsetHeight || el.getBoundingClientRect().height;
      const vwH = window.innerHeight;
      const scale = contentH > vwH ? Math.max(0.6, Math.min(1, vwH / contentH)) : 1;
      setAppScale(Number(scale.toFixed(3)));
    };

    computeScale();
    window.addEventListener('resize', computeScale);
    window.addEventListener('orientationchange', computeScale);
    return () => {
      window.removeEventListener('resize', computeScale);
      window.removeEventListener('orientationchange', computeScale);
    };
  }, [currentScene, readerStageHeight]);

  // Compute available height for reader stage so images fit on small screens
  useEffect(() => {
    const compute = () => {
      const vh = window.innerHeight;
      const headerH = readerHeaderRef.current ? readerHeaderRef.current.getBoundingClientRect().height : 0;
      const footerH = readerFooterRef.current ? readerFooterRef.current.getBoundingClientRect().height : 0;
      const gap = 24; // padding + margins
      const available = Math.max(160, Math.floor(vh - headerH - footerH - gap));
      setReaderStageHeight(available);
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onResize = () => setReaderViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (currentScene !== 'READER') {
      return;
    }

    let cancelled = false;
    const comicPath = readerComic?.path;

    if (!comicPath) {
      setReaderPages([]);
      setReaderLoading(false);
      return;
    }

    const loadReaderPages = async () => {
      setReaderLoading(true);
      const pages = await extractUniversalCbzPages(`/${comicPath}`);

      if (cancelled) {
        return;
      }

      setReaderPages(pages);
      // If we have a saved bookmarked position for this comic, resume there.
      let startIndex = 0;
      if (readerComic?.id && typeof bookmarkedPositions[readerComic.id] === 'number') {
        startIndex = clamp(bookmarkedPositions[readerComic.id], 0, Math.max(0, pages.length - 1));
      }
      setReaderPageIndex(startIndex);
      setReaderLoading(false);
      resetReaderView();
      setReadComicIds((current) => {
        const next = new Set(current);
        if (readerComic?.id) {
          next.add(readerComic.id);
        }
        return next;
      });
      setComicsList((current) =>
        current.map((comic, index) =>
          index === readerComicIndex ? { ...comic, totalPages: pages.length } : comic,
        ),
      );
    };

    void loadReaderPages();

    return () => {
      cancelled = true;
    };
  }, [currentScene, readerComic?.path, bookmarkedPositions, readerComicIndex]);

  useEffect(() => {
    if (currentScene !== 'READER') {
      resetReaderView();
    }
  }, [currentScene]);

  // Ensure top of the app is visible when switching scenes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [currentScene]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (optionsOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOptionsOpen(false);
        }

        return;
      }

      if (currentScene === 'MAIN_MENU') {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedMenuIndex((current) => (current - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedMenuIndex((current) => (current + 1) % MENU_ITEMS.length);
        }

        if (event.key === 'Enter' && selectedMenuIndex === 0) {
          event.preventDefault();
          openCollectionView('all');
        }

        if (event.key === 'Enter' && selectedMenuIndex === 1) {
          event.preventDefault();
          openCollectionView('all');
        }

        if (event.key === 'Enter' && selectedMenuIndex === 2) {
          event.preventDefault();
          openCollectionView('unread');
        }

        if (event.key === 'Enter' && selectedMenuIndex === 3) {
          event.preventDefault();
          openCollectionView('bookmarked');
        }

        if (event.key === 'Enter' && selectedMenuIndex === 4) {
          event.preventDefault();
          setOptionsOpen(true);
        }
      }

      if (currentScene === 'CAROUSEL') {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setActiveComicIndex((current) => (current - 1 + visibleComicIndices.length) % visibleComicIndices.length);
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          setActiveComicIndex((current) => (current + 1) % visibleComicIndices.length);
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          setReaderComicIndex(activeCollectionComicIndex);
          setReaderPageIndex(0);
          setReaderPages([]);
          setCurrentScene('READER');
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setCurrentScene('MAIN_MENU');
          setCollectionView('all');
        }

        if (event.key === 'b' || event.key === 'B') {
          event.preventDefault();
          const comicId = activeCollectionComic?.id;
          if (comicId) {
            toggleBookmarkByComicId(comicId);
          }
        }
      }

      if (currentScene === 'READER') {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          advanceReaderPage(-1);
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          advanceReaderPage(1);
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setCurrentScene('CAROUSEL');
        }

        if (event.key === 'b' || event.key === 'B') {
          event.preventDefault();
          if (readerComic?.id) {
            toggleBookmarkByComicId(readerComic.id);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeCollectionComic?.id, activeCollectionComicIndex, advanceReaderPage, collectionView, currentScene, optionsOpen, readerPages.length, selectedMenuIndex, visibleComicIndices.length]);

  const totalComics = comicsList.length.toString().padStart(2, '0');
  const optionsCount = '03';

  const carouselCards = useMemo(() => {
    const sourceIndices = visibleComicIndices.length ? visibleComicIndices : comicsList.map((_, index) => index);

    return sourceIndices.map((comicIndex, index) => {
      const comic = comicsList[comicIndex];
      const distance = index - activeComicIndex;
      const absDistance = Math.abs(distance);
      const isActive = distance === 0;
      const isNeighbor = absDistance === 1;
      const hiddenOnMobile = absDistance > 1;

      const scale = isActive ? 1.1 : isNeighbor ? 0.9 : 0.75;
      const opacity = isActive ? 1 : isNeighbor ? 0.6 : 0.3;
      const blur = isNeighbor ? 'blur-[1px]' : absDistance > 1 ? 'blur-[2px]' : 'blur-0';
      const zIndex = isActive ? 30 : isNeighbor ? 20 : 10 - absDistance;

      return {
        comic,
        index,
        className: [
          'absolute left-1/2 top-1/2 w-[200px] sm:w-[240px] md:w-[280px] lg:w-[320px] transition-all duration-300 ease-in-out',
          blur,
          hiddenOnMobile ? 'hidden md:block' : '',
        ]
          .filter(Boolean)
          .join(' '),
        style: {
          transform: `translate(-50%, -50%) translateX(${distance * 13.5}rem) scale(${scale})`,
          opacity,
          zIndex,
        } as React.CSSProperties,
        isActive,
      };
    });
  }, [activeComicIndex, comicsList, visibleComicIndices]);

  return (
    <div className="relative min-h-screen w-full bg-transparent text-white">
      {/* Background layers: black base + animated ribbon shader */}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a] pointer-events-none" />
      <ShaderBackground />

      <div
        ref={(el) => { appRef.current = el; }}
        className="relative z-20 min-h-screen w-full flex flex-col bg-transparent pointer-events-auto overflow-hidden"
        style={{ transform: `scale(${appScale})`, transformOrigin: 'top center' }}
      >
        {currentScene === 'MAIN_MENU' ? (
          <main className="flex h-full w-full flex-col bg-transparent md:flex-row">
            <section
              className="flex w-full flex-1 flex-col justify-start border-b border-white/10 bg-transparent px-3 pt-8 md:border-b-0 md:border-r md:px-8 md:pt-24 min-h-0 overflow-hidden md:overflow-auto"
              style={{ maxHeight: 'calc(100vh - 80px)' }}
            >
              <div>
                <div className="inline-flex overflow-hidden rounded-md bg-transparent">
                  <div className="bg-white px-4 py-2 text-sm font-black tracking-[0.35em] text-black md:text-base">
                    DIGITAL
                  </div>
                  <div className="bg-[#d83a1b] px-4 py-2 text-sm font-black italic tracking-[0.35em] text-white md:text-base">
                    COMICS
                  </div>
                </div>

                <div className="mt-4 bg-transparent">
                  <div className="flex items-center justify-between md:hidden">
                    <div className="text-sm font-semibold tracking-wide">Menu</div>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-sm"
                      onClick={() => setMenuOpen((v) => !v)}
                    >
                      {menuOpen ? 'Close' : 'Open'}
                    </button>
                  </div>
                  <div className={['mt-3', menuOpen ? 'block' : 'hidden', 'space-y-3'].join(' ')}>
                  {MENU_ITEMS.map((item, index) => {
                    const isActive = index === selectedMenuIndex;
                    const counter =
                      index === 0 || index === 1
                        ? totalComics
                        : index === 2
                          ? unreadCount.toString().padStart(2, '0')
                          : index === 3
                            ? bookmarkedCount.toString().padStart(2, '0')
                            : optionsCount;

                    return (
                      <div
                        key={item.label}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedMenuIndex(index);
                          // mirror Enter key behavior
                          if (index === 0) openCollectionView('all');
                          else if (index === 1) openCollectionView('all');
                          else if (index === 2) openCollectionView('unread');
                          else if (index === 3) openCollectionView('bookmarked');
                          else if (index === 4) setOptionsOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).click();
                          }
                        }}
                        className={[
                          'flex items-center justify-between rounded-full border px-4 py-3 transition-all duration-200',
                          isActive
                            ? 'border-transparent bg-gradient-to-r from-red-600 to-amber-500 font-bold text-white shadow-[0_0_25px_rgba(220,38,38,0.5)]'
                            : 'border-white/25 bg-white/5 text-white/85',
                        ].join(' ')}
                      >
                        <span className="text-sm font-semibold tracking-wide md:text-base">{item.label}</span>
                        <span
                          className={[
                            'ml-4 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.25em]',
                            isActive
                              ? 'border-white/50 bg-white/15 text-white'
                              : 'border-white/30 bg-black/20 text-white/85',
                          ].join(' ')}
                        >
                          {counter}
                        </span>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            </section>

            <section className="flex w-full flex-1 items-start justify-center bg-transparent px-4 pt-8 md:px-10 md:pt-24">
              <div className="flex w-full max-w-sm flex-col items-center justify-start text-center">
                <div className="relative aspect-[2/3] w-[220px] overflow-hidden rounded-[22px] border border-white/15 bg-transparent p-0 shadow-[0_20px_60px_rgba(0,0,0,0.42)] md:w-[260px]">
                  {selectedComic?.coverUrl ? (
                    <img
                      src={selectedComic.coverUrl}
                      alt={selectedComic?.title ?? 'Selected comic cover'}
                      className="aspect-[2/3] w-full rounded-[18px] object-cover shadow-2xl border border-white/10"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] w-full items-center justify-center rounded-[18px] bg-gradient-to-b from-[#430807] via-[#250404] to-black">
                      <div className="h-14 w-14 animate-pulse rounded-full bg-[#f06a23]/20 shadow-[0_0_30px_rgba(230,92,0,0.55)]" />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="mt-6 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold tracking-[0.2em] text-[#f5e7d8] transition hover:bg-white/10"
                  onClick={() => {
                    setReaderComicIndex(activeComicIndex);
                    setReaderPageIndex(0);
                    setReaderPages([]);
                    setCurrentScene('READER');
                  }}
                >
                  (Triangle) Resume
                </button>
              </div>
            </section>
          </main>
        ) : null}

        {currentScene === 'CAROUSEL' ? (
          <main className="flex h-full w-full flex-col bg-transparent">
            <header className="border-b border-white/15 bg-transparent px-4 py-4 md:px-8">
              <div className="text-center text-sm font-semibold tracking-[0.35em] text-white/90 md:text-base">
                All Comics
              </div>
              <div className="mx-auto mt-3 h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </header>

            <section className="relative flex flex-1 items-start justify-center bg-transparent px-4 pt-6 md:px-8 md:pt-8">
              <div className="relative h-[34rem] w-full max-w-6xl -translate-y-8 overflow-visible md:h-[38rem] md:-translate-y-10">
                {carouselCards.map(({ comic, index, className, style, isActive }) => (
                  <article
                    key={comic.id}
                    className={[className, 'cursor-pointer'].join(' ')}
                    style={style}
                    aria-current={isActive}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const realIndex = comicsList.findIndex((c) => c.id === comic.id);
                      if (realIndex === -1) return;
                      setActiveComicIndex(index);
                      setReaderComicIndex(realIndex);
                      setReaderPages([]);
                      setCurrentScene('READER');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).click();
                      }
                    }}
                  >
                    <div
                      className={[
                        'relative aspect-[2/3] overflow-hidden rounded-[24px] border bg-transparent shadow-psp',
                        isActive
                          ? 'border-[#ff7a2b] ring-2 ring-[#ff5f1d]/70 ring-offset-2 ring-offset-black shadow-[0_0_40px_rgba(255,122,43,0.4)]'
                          : 'border-white/18',
                      ].join(' ')}
                    >
                      {!readComicIds.has(comic.id) ? (
                        <span className="absolute left-3 top-3 z-20 h-3 w-3 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.85)]" />
                      ) : null}

                      {bookmarkedComicIds.has(comic.id) ? (
                        <span className="absolute right-3 top-3 z-20 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(253,224,71,0.9)]" />
                      ) : null}

                      {comic.coverUrl ? (
                        <img
                          src={comic.coverUrl}
                          alt={comic.title}
                          className="aspect-[2/3] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[2/3] w-full items-center justify-center bg-gradient-to-b from-[#430807] via-[#250404] to-black">
                          <div className="h-14 w-14 animate-pulse rounded-full bg-[#f06a23]/20 shadow-[0_0_30px_rgba(230,92,0,0.55)]" />
                        </div>
                      )}

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/8" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                    </div>

                  </article>
                ))}
              </div>
            </section>

            <footer className="border-t border-white/10 bg-transparent px-4 py-5 text-center md:px-8">
              <div className="mx-auto max-w-4xl text-sm font-semibold tracking-[0.18em] text-white/90 md:text-base">
                {selectedComic?.title ?? 'No comic selected'}
              </div>
              <div className="mt-2 text-xs tracking-[0.3em] text-white/45">
                LEFT / RIGHT to browse, ESC to return
              </div>
            </footer>
          </main>
        ) : null}

        {currentScene === 'READER' ? (
          <main className="relative flex h-full w-full flex-col bg-transparent px-3 py-4 md:px-6 md:py-5">
            <header
              className="border-b border-white/10 bg-transparent px-2 pb-3 text-center md:px-6"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              ref={(el) => { readerHeaderRef.current = el; }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.45em] text-white/55 md:text-xs">Reader Mode</div>
                <button
                  type="button"
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold tracking-[0.25em] text-white/80 transition hover:bg-white/10"
                  onClick={() => readerComic?.id && toggleBookmarkWithPage(readerComic.id, readerPageIndex)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                >
                  {readerComic?.id && bookmarkedComicIds.has(readerComic.id) ? 'Bookmarked' : 'Bookmark'}
                </button>
              </div>
              <div className="mt-2 text-sm font-semibold tracking-[0.18em] text-white/90 md:text-base">
                {readerComic?.title ?? 'Untitled Comic'}
              </div>
              {readerOptions.showPageCounter ? (
                <div className="mt-2 text-[10px] tracking-[0.28em] text-white/40 md:text-xs">
                  {readerPageCounterLabel}
                </div>
              ) : null}
            </header>

            <section className="relative flex flex-1 items-center justify-center bg-transparent py-3 md:py-4">

              <div
                className="relative flex w-full max-w-[min(96vw,1200px)] items-center justify-center overflow-hidden rounded-[22px] border border-white/10 bg-black/25 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                ref={(el) => { readerStageRef.current = el; }}
                style={{ height: readerStageHeight ? `${readerStageHeight}px` : 'calc(100vh - 120px)' }}
                onWheel={(event) => {
                  event.preventDefault();

                  const zoomDelta = event.deltaY < 0 ? 0.12 : -0.12;
                  setReaderZoom((current) => {
                    const nextZoom = clamp(current + zoomDelta, 1, 3);
                    if (nextZoom === 1) {
                      setReaderPan({ x: 0, y: 0 });
                    }
                    return nextZoom;
                  });
                }}
                onDoubleClick={resetReaderView}
                onPointerDown={(event) => {
                  // Only start panning if we're zoomed; taps won't change pages.
                  if (readerZoom <= 1) {
                    return;
                  }

                  event.stopPropagation();
                  readerDragRef.current = {
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: readerPan.x,
                    originY: readerPan.y,
                  };
                  (event.currentTarget as Element).setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const drag = readerDragRef.current;

                  if (!drag) {
                    return;
                  }

                  event.stopPropagation();
                  setReaderPan({
                    x: drag.originX + (event.clientX - drag.startX),
                    y: drag.originY + (event.clientY - drag.startY),
                  });
                }}
                onPointerUp={(event) => {
                  if (readerDragRef.current) {
                    event.stopPropagation();
                    try { (event.currentTarget as Element).releasePointerCapture(event.pointerId); } catch {}
                  }

                  readerDragRef.current = null;
                }}
                onPointerCancel={() => {
                  readerDragRef.current = null;
                }}
              >
                {readerLoading ? (
                  <div className="flex h-full w-full items-center justify-center bg-transparent">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
                  </div>
                  ) : readerVisiblePages.length ? (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      transform: `translate3d(${readerPan.x}px, ${readerPan.y}px, 0) scale(${readerZoom})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <div className={readerSpreadMode ? 'grid h-full w-full grid-cols-2 gap-4' : 'flex h-full w-full items-center justify-center'}>
                      {readerVisiblePages.map((pageUrl, pageOffset) => {
                        const pageNumber = readerSpreadMode ? readerSpreadStartIndex + pageOffset + 1 : readerPageIndex + 1;

                        return (
                          <img
                            key={`${pageUrl}-${pageNumber}`}
                            src={pageUrl}
                            alt={`${readerComic?.title ?? 'Comic'} page ${pageNumber}`}
                            className="max-h-full max-w-full min-w-0 object-contain select-none"
                            draggable={false}
                            style={{ zIndex: 0 }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/60">
                    No pages available.
                  </div>
                )}

                <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.3em] text-white/70 md:text-[10px]">
                  {readerSpreadMode ? 'Spread' : 'Single'} {readerZoomPercent}%
                </div>
              </div>
            </section>

            <footer
              className="border-t border-white/10 bg-transparent px-3 pt-3 text-center md:px-6"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              ref={(el) => { readerFooterRef.current = el; }}
            >
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold tracking-[0.24em] text-white/80 transition hover:bg-white/10"
                  onClick={() => advanceReaderPage(-1)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold tracking-[0.24em] text-white/80 transition hover:bg-white/10"
                  onClick={() => {
                    setReaderZoom((current) => {
                      const nextZoom = clamp(current - 0.15, 1, 3);
                      if (nextZoom === 1) {
                        setReaderPan({ x: 0, y: 0 });
                      }
                      return nextZoom;
                    });
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                >
                  -
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold tracking-[0.24em] text-white/80 transition hover:bg-white/10"
                  onClick={resetReaderView}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                >
                  Reset Zoom
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold tracking-[0.24em] text-white/80 transition hover:bg-white/10"
                  onClick={() => {
                    setReaderZoom((current) => clamp(current + 0.15, 1, 3));
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                >
                  +
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold tracking-[0.24em] text-white/80 transition hover:bg-white/10"
                  onClick={() => advanceReaderPage(1)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                >
                  Next
                </button>
              </div>
              <div className="mt-3 text-[10px] tracking-[0.28em] text-white/45 md:text-xs">
                DRAG TO PAN WHEN ZOOMED, USE PREV/NEXT BUTTONS OR ARROW KEYS, ESC TO RETURN
              </div>
            </footer>
          </main>
        ) : null}

      {optionsOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[26px] border border-white/15 bg-black/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <div className="text-center text-[10px] font-bold uppercase tracking-[0.45em] text-white/55">Options</div>
            <div className="mt-6 space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                onClick={() => setReaderOptions((current) => ({ ...current, fitMode: current.fitMode === 'contain' ? 'cover' : 'contain' }))}
              >
                <span>Page Fit</span>
                <span className="text-white/65">{readerOptions.fitMode === 'contain' ? 'Contain' : 'Cover'}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                onClick={() => setReaderOptions((current) => ({ ...current, readingDirection: current.readingDirection === 'ltr' ? 'rtl' : 'ltr' }))}
              >
                <span>Reading Direction</span>
                <span className="text-white/65">{readerOptions.readingDirection === 'ltr' ? 'Left-to-right' : 'Right-to-left'}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                onClick={() => setReaderOptions((current) => ({ ...current, showPageCounter: !current.showPageCounter }))}
              >
                <span>Page Counter</span>
                <span className="text-white/65">{readerOptions.showPageCounter ? 'On' : 'Off'}</span>
              </button>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold tracking-[0.25em] text-white/80 transition hover:bg-white/10"
                onClick={() => setOptionsOpen(false)}
              >
                Close
              </button>
              <div className="text-[10px] tracking-[0.25em] text-white/40">ESC TO CLOSE</div>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

export default App;