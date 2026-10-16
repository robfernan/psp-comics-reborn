import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookSession,
  formatBytes,
  importFiles,
} from './lib/archive';
import {
  addComic,
  deleteComic,
  getAllComics,
  getComicFile,
  getStorageEstimate,
  putComic,
} from './lib/db';
import {
  playCancelChime,
  playConfirmChime,
  playCursorTick,
  playPageTurn,
} from './lib/audio';
import { Action, KEY_HINTS, useInput } from './lib/input';
import {
  ComicRecord,
  DEFAULT_SETTINGS,
  LibraryFilter,
  MODE_LABEL,
  ReadingMode,
  Settings,
  THEME_CONFIGS,
  ThemeColor,
  effectiveMode,
  getCurrentMonthTheme,
} from './lib/types';
import './psp-theme.css';

type Scene = 'MAIN_MENU' | 'CAROUSEL' | 'RECENT_LIST' | 'READER';

const MENU_ITEMS = [
  { id: 'all', label: 'Browse Collection' },
  { id: 'recent', label: 'Recently Added' },
  { id: 'unread', label: 'Unread' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'options', label: 'Options' },
] as const;

const BTN = {
  circle: '/psp-assets/textures/button_circle.png',
  cross: '/psp-assets/textures/button_cross.png',
  square: '/psp-assets/textures/button_square.png',
  triangle: '/psp-assets/textures/button_triangle.png',
  dpad: '/psp-assets/textures/button_dpad_u.png',
  l: '/psp-assets/textures/button_l.png',
  r: '/psp-assets/textures/button_r.png',
  start: '/psp-assets/textures/button_start.png',
  select: '/psp-assets/textures/button_select.png',
};

export function App() {
  const [comics, setComics] = useState<ComicRecord[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [scene, setScene] = useState<Scene>('MAIN_MENU');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [menuIdx, setMenuIdx] = useState(0);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [recentIdx, setRecentIdx] = useState(0);

  // Active comic being read
  const [readerComicId, setReaderComicId] = useState<string | null>(null);
  const [session, setSession] = useState<BookSession | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [pageUrls, setPageUrls] = useState<Record<number, string>>({});
  const [readerLoading, setReaderLoading] = useState(false);

  // Settings & Modals
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const s = localStorage.getItem('psp-comics.settings');
      return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null);

  // Import State
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // References for zooming/panning
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const webtoonRef = useRef<HTMLDivElement | null>(null);

  // Load library from IndexedDB on startup
  useEffect(() => {
    getAllComics()
      .then((records) => {
        setComics(records);
        setLoadingLibrary(false);
      })
      .catch((err) => {
        console.error('Failed to load library:', err);
        setLoadingLibrary(false);
      });
  }, []);

  // Sync settings
  useEffect(() => {
    try {
      localStorage.setItem('psp-comics.settings', JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Object URLs for cover thumbnails
  const coverUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of comics) {
      if (c.cover) {
        map[c.id] = URL.createObjectURL(c.cover);
      }
    }
    return map;
  }, [comics]);

  // Filtered comics list
  const filteredComics = useMemo(() => {
    let list = [...comics];
    if (filter === 'unread') {
      list = list.filter((c) => !c.finished && c.progress === 0);
    } else if (filter === 'reading') {
      list = list.filter((c) => c.progress > 0 && !c.finished);
    } else if (filter === 'bookmarked') {
      list = list.filter((c) => c.bookmarked);
    }
    return list;
  }, [comics, filter]);

  const activeComic = useMemo(() => {
    if (scene === 'RECENT_LIST') {
      return comics[recentIdx] ?? comics[0] ?? null;
    }
    return filteredComics[carouselIdx] ?? comics[0] ?? null;
  }, [comics, filteredComics, carouselIdx, recentIdx, scene]);

  const readerComic = useMemo(
    () => comics.find((c) => c.id === readerComicId) ?? null,
    [comics, readerComicId],
  );

  const activeMode: ReadingMode = readerComic ? effectiveMode(readerComic, settings) : 'paged';

  // Import handler
  const handleImportFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setImportProgress({ done: 0, total: fileArray.length, name: 'Starting import...' });

    try {
      const report = await importFiles(fileArray, (done, total, name) => {
        setImportProgress({ done, total, name });
      });

      if (report.imported.length > 0) {
        for (const item of report.imported) {
          await addComic(item.record, item.file);
        }
        const updated = await getAllComics();
        setComics(updated);
        setCarouselIdx(0);
        setRecentIdx(0);
      }
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setImportProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  // Open Reader
  const openReader = useCallback(
    async (comic: ComicRecord) => {
      playConfirmChime(settings.soundEnabled);
      setReaderComicId(comic.id);
      setPageIdx(comic.progress ?? 0);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setReaderLoading(true);
      setScene('READER');

      try {
        const fileBlob = await getComicFile(comic.id);
        if (!fileBlob) throw new Error('File not found in storage');

        const newSession = await BookSession.open(fileBlob);
        setSession((prev) => {
          prev?.dispose();
          return newSession;
        });

        // Prefetch initial pages
        newSession.prefetch(comic.progress ?? 0, 4);

        // Update lastReadAt
        const updated: ComicRecord = {
          ...comic,
          lastReadAt: Date.now(),
        };
        await putComic(updated);
        setComics((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } catch (err) {
        console.error('Failed to open comic archive:', err);
      } finally {
        setReaderLoading(false);
      }
    },
    [settings.soundEnabled],
  );

  // Bookmark toggle
  const toggleBookmark = useCallback(
    async (comic: ComicRecord) => {
      playConfirmChime(settings.soundEnabled);
      const updated = { ...comic, bookmarked: !comic.bookmarked };
      await putComic(updated);
      setComics((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    },
    [settings.soundEnabled],
  );

  // Delete comic
  const handleDeleteComic = useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to remove this comic from your library?')) return;
      playCancelChime(settings.soundEnabled);
      await deleteComic(id);
      setComics((prev) => prev.filter((c) => c.id !== id));
      setCarouselIdx(0);
      setRecentIdx(0);
    },
    [settings.soundEnabled],
  );

  // Page advancement
  const advancePage = useCallback(
    (delta: number) => {
      if (!session || !readerComic) return;
      const total = session.length;
      if (total <= 0) return;

      const step =
        activeMode === 'webtoon'
          ? 1
          : settings.spread && window.innerWidth >= 1024
            ? 2
            : 1;

      const direction = activeMode === 'manga' ? -1 : 1;
      const nextIdx = Math.max(0, Math.min(total - 1, pageIdx + delta * step * direction));

      if (nextIdx !== pageIdx) {
        playPageTurn(settings.soundEnabled);
        setPageIdx(nextIdx);
        session.prefetch(nextIdx, 3);
        const finished = nextIdx >= total - 1;
        const updated: ComicRecord = { ...readerComic, progress: nextIdx, finished };
        putComic(updated).catch(() => {});
        setComics((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    },
    [session, readerComic, activeMode, settings.spread, settings.soundEnabled, pageIdx],
  );

  // Load pages on demand for reader
  useEffect(() => {
    if (!session || scene !== 'READER') return;

    let cancelled = false;
    const loadRequiredPages = async () => {
      const needed =
        activeMode === 'webtoon'
          ? Array.from({ length: session.length }, (_, i) => i)
          : settings.spread && window.innerWidth >= 1024
            ? [pageIdx, pageIdx + 1].filter((p) => p < session.length)
            : [pageIdx];

      const loaded: Record<number, string> = {};
      for (const p of needed) {
        try {
          const url = await session.page(p);
          if (!cancelled) loaded[p] = url;
        } catch {}
      }

      if (!cancelled) {
        setPageUrls((prev) => ({ ...prev, ...loaded }));
      }
    };

    void loadRequiredPages();
    return () => {
      cancelled = true;
    };
  }, [session, pageIdx, scene, activeMode, settings.spread]);

  // Unified Input Handler (Keyboard + Controller)
  useInput(
    (action: Action) => {
      if (controlsOpen) {
        if (action === 'back' || action === 'confirm') {
          playCancelChime(settings.soundEnabled);
          setControlsOpen(false);
          return;
        }
        return;
      }

      if (optionsOpen) {
        if (action === 'back' || action === 'start') {
          playCancelChime(settings.soundEnabled);
          setOptionsOpen(false);
          return;
        }
        return;
      }

      switch (scene) {
        case 'MAIN_MENU':
          if (action === 'down') {
            playCursorTick(settings.soundEnabled);
            setMenuIdx((i) => (i + 1) % MENU_ITEMS.length);
          } else if (action === 'up') {
            playCursorTick(settings.soundEnabled);
            setMenuIdx((i) => (i - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
          } else if (action === 'confirm') {
            playConfirmChime(settings.soundEnabled);
            const item = MENU_ITEMS[menuIdx];
            if (item.id === 'options') {
              setOptionsOpen(true);
            } else if (item.id === 'recent') {
              setRecentIdx(0);
              setScene('RECENT_LIST');
            } else {
              setFilter(item.id as LibraryFilter);
              setCarouselIdx(0);
              setScene('CAROUSEL');
            }
          } else if (action === 'triangle') {
            if (activeComic) {
              playConfirmChime(settings.soundEnabled);
              openReader(activeComic);
            } else if (fileInputRef.current) {
              fileInputRef.current.click();
            }
          } else if (action === 'square') {
            playConfirmChime(settings.soundEnabled);
            setOptionsOpen(true);
          } else if (action === 'left') {
            playCursorTick(settings.soundEnabled);
            setCarouselIdx((i) => (i - 1 + filteredComics.length) % Math.max(1, filteredComics.length));
          } else if (action === 'right') {
            playCursorTick(settings.soundEnabled);
            setCarouselIdx((i) => (i + 1) % Math.max(1, filteredComics.length));
          }
          break;

        case 'CAROUSEL':
          if (action === 'left') {
            playCursorTick(settings.soundEnabled);
            setCarouselIdx((i) => Math.max(0, i - 1));
          } else if (action === 'right') {
            playCursorTick(settings.soundEnabled);
            setCarouselIdx((i) => Math.min(filteredComics.length - 1, i + 1));
          } else if (action === 'confirm') {
            const c = filteredComics[carouselIdx];
            if (c) {
              playConfirmChime(settings.soundEnabled);
              openReader(c);
            }
          } else if (action === 'triangle') {
            const c = filteredComics[carouselIdx];
            if (c) {
              playConfirmChime(settings.soundEnabled);
              toggleBookmark(c);
            }
          } else if (action === 'back' || action === 'start' || action === 'select') {
            playCancelChime(settings.soundEnabled);
            setScene('MAIN_MENU');
          }
          break;

        case 'RECENT_LIST':
          if (action === 'down') {
            playCursorTick(settings.soundEnabled);
            setRecentIdx((i) => Math.min(comics.length - 1, i + 1));
          } else if (action === 'up') {
            playCursorTick(settings.soundEnabled);
            setRecentIdx((i) => Math.max(0, i - 1));
          } else if (action === 'confirm' || action === 'triangle') {
            const c = comics[recentIdx];
            if (c) {
              playConfirmChime(settings.soundEnabled);
              openReader(c);
            }
          } else if (action === 'back' || action === 'start' || action === 'select') {
            playCancelChime(settings.soundEnabled);
            setScene('MAIN_MENU');
          }
          break;

        case 'READER':
          if (activeMode === 'webtoon') {
            if (action === 'down' || action === 'r') {
              playCursorTick(settings.soundEnabled);
              webtoonRef.current?.scrollBy({ top: 400, behavior: 'smooth' });
            } else if (action === 'up' || action === 'l') {
              playCursorTick(settings.soundEnabled);
              webtoonRef.current?.scrollBy({ top: -400, behavior: 'smooth' });
            } else if (action === 'confirm' || action === 'right') {
              advancePage(1);
            } else if (action === 'triangle' || action === 'left') {
              advancePage(-1);
            } else if (action === 'back' || action === 'start') {
              playCancelChime(settings.soundEnabled);
              closeReader();
            } else if (action === 'square') {
              if (readerComic) {
                playConfirmChime(settings.soundEnabled);
                toggleBookmark(readerComic);
              }
            }
          } else {
            if (action === 'confirm' || action === 'right' || action === 'r') {
              advancePage(1);
            } else if (action === 'triangle' || action === 'left' || action === 'l') {
              advancePage(-1);
            } else if (action === 'square') {
              if (readerComic) {
                playConfirmChime(settings.soundEnabled);
                toggleBookmark(readerComic);
              }
            } else if (action === 'back' || action === 'start') {
              playCancelChime(settings.soundEnabled);
              closeReader();
            }
          }
          break;
      }
    },
    true,
  );

  // Storage estimation when opening options
  useEffect(() => {
    if (optionsOpen) {
      getStorageEstimate().then(setStorageUsage);
    }
  }, [optionsOpen]);

  // Clean-up session when closing reader
  const closeReader = useCallback(() => {
    playCancelChime(settings.soundEnabled);
    session?.dispose();
    setSession(null);
    setScene(filter === 'all' ? 'CAROUSEL' : 'MAIN_MENU');
  }, [session, filter, settings.soundEnabled]);

  // 3D Carousel Cards Calculation
  const carouselCards = useMemo(() => {
    return filteredComics.map((comic, index) => {
      const distance = index - carouselIdx;
      const absDist = Math.abs(distance);
      const isActive = distance === 0;
      const isNeighbor = absDist === 1;
      const hiddenOnMobile = absDist > 1;

      const scale = isActive ? 1.08 : isNeighbor ? 0.88 : 0.72;
      const opacity = isActive ? 1 : isNeighbor ? 0.65 : 0.35;
      const zIndex = isActive ? 30 : 20 - absDist;

      return {
        comic,
        index,
        isActive,
        className: [
          'absolute left-1/2 top-1/2 w-[210px] sm:w-[250px] md:w-[290px] transition-all duration-300 ease-out',
          hiddenOnMobile ? 'hidden md:block' : '',
        ]
          .filter(Boolean)
          .join(' '),
        style: {
          transform: `translate(-50%, -50%) translateX(${distance * 14}rem) scale(${scale})`,
          opacity,
          zIndex,
        } as React.CSSProperties,
      };
    });
  }, [filteredComics, carouselIdx]);

  return (
    <div
      data-theme={settings.theme}
      className="relative min-h-screen w-full bg-[#020202] text-white overflow-hidden select-none font-sans"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) handleImportFiles(e.dataTransfer.files);
      }}
    >
      {/* ========================================================
          AUTHENTIC PSP WAVE RIBBON BACKGROUND (psp-theme.css)
          ======================================================== */}
      <div className="fixed inset-0 z-0 bg-[#020202] pointer-events-none" />
      <div className="psp-wave-ribbon" aria-hidden />
      <div className="psp-wave-ribbon psp-wave-ribbon-secondary" aria-hidden />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="psp-drag-overlay">
          <img src="/psp-assets/textures/logo224.png" alt="" className="psp-logo" />
          <p>Drop Comic Archives (.CBZ, .ZIP) or Image Folders Here</p>
        </div>
      )}

      {/* Busy Loading Overlay */}
      {(importProgress || readerLoading || loadingLibrary) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="psp-spinner">
            <img src="/psp-assets/textures/busy.png" alt="Loading" />
          </div>
          {importProgress && (
            <p className="mt-4 text-xs font-semibold tracking-widest text-white/80">
              Importing {importProgress.done} / {importProgress.total}: {importProgress.name}
            </p>
          )}
        </div>
      )}

      {/* Hidden File Input for Imports */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".cbz,.zip,image/*"
        multiple
        className="hidden"
        onChange={(e) => handleImportFiles(e.target.files)}
      />

      {/* ========================================================
          MAIN MENU SCREEN: AUTHENTIC HOMAGE
          ======================================================== */}
      {scene === 'MAIN_MENU' && (
        <main className="relative z-20 flex min-h-screen flex-col justify-between p-4 md:p-8">
          <div className="flex flex-1 flex-col md:flex-row items-center justify-center gap-8 md:gap-20 max-w-6xl mx-auto w-full">
            {/* Left: PSP Logo & Authentic 9-Slice Menu Rows */}
            <div className="flex flex-col items-center md:items-start w-full max-w-md">
              <img
                src="/psp-assets/textures/logo224.png"
                alt="PSP Digital Comics"
                className="psp-logo mb-6 md:mb-8"
              />

              <nav className="psp-menu-list" aria-label="PSP Main Menu">
                {MENU_ITEMS.map((item, index) => {
                  const isActive = index === menuIdx;
                  const counter =
                    item.id === 'all'
                      ? comics.length.toString().padStart(2, '0')
                      : item.id === 'recent'
                        ? comics.length.toString().padStart(2, '0')
                        : item.id === 'unread'
                          ? comics.filter((c) => !c.finished && c.progress === 0).length.toString().padStart(2, '0')
                          : item.id === 'bookmarks'
                            ? comics.filter((c) => c.bookmarked).length.toString().padStart(2, '0')
                            : '⚙';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`psp-menu-row${isActive ? ' active' : ''}`}
                      onMouseEnter={() => setMenuIdx(index)}
                      onClick={() => {
                        setMenuIdx(index);
                        if (item.id === 'options') setOptionsOpen(true);
                        else if (item.id === 'recent') {
                          setRecentIdx(0);
                          setScene('RECENT_LIST');
                        } else {
                          setFilter(item.id as LibraryFilter);
                          setCarouselIdx(0);
                          setScene('CAROUSEL');
                        }
                      }}
                    >
                      <span className="psp-menu-label">{item.label}</span>
                      <span className="psp-badge">{counter}</span>
                    </button>
                  );
                })}
              </nav>

              <button
                type="button"
                className="mt-6 text-xs text-white/70 hover:text-white underline cursor-pointer tracking-wider"
                onClick={() => fileInputRef.current?.click()}
              >
                + Import Comics (.CBZ, .ZIP or Image Folders)
              </button>
            </div>

            {/* Right: Active Comic Preview Card or Empty State */}
            <div className="flex flex-col items-center justify-center w-full max-w-xs md:max-w-sm">
              {comics.length === 0 ? (
                <div
                  className="psp-empty-card w-[220px] md:w-[260px] aspect-[2/3] cursor-pointer hover:border-white/40 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <img
                    src="/psp-assets/textures/cover_locked.png"
                    alt="No Comics"
                    className="w-20 h-20 opacity-50 mb-4"
                  />
                  <p className="text-sm font-semibold mb-1">Library Empty</p>
                  <p className="text-[11px] text-white/50 mb-4">No comics in memory</p>
                  <span className="psp-read-btn text-[10px] px-3 py-1.5">
                    Click or Drop to Add
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative aspect-[2/3] w-[210px] md:w-[250px] overflow-hidden rounded-[18px] border-2 border-white/20 bg-black/70 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
                    {activeComic && coverUrls[activeComic.id] ? (
                      <img
                        src={coverUrls[activeComic.id]}
                        alt={activeComic.title}
                        className="aspect-[2/3] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[2/3] w-full items-center justify-center bg-gradient-to-b from-[#2a0806] to-black">
                        <img
                          src="/psp-assets/textures/bkmk_noarchive.png"
                          alt=""
                          className="w-16 h-16 opacity-40"
                        />
                      </div>
                    )}

                    {activeComic?.bookmarked && (
                      <span className="absolute right-3 top-3 h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
                    )}

                    {activeComic && activeComic.progress === 0 && !activeComic.finished && (
                      <span className="absolute left-3 top-3 h-3 w-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)]" />
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 pt-6">
                      <p className="text-xs font-semibold text-white/95 truncate">
                        {activeComic?.title}
                      </p>
                      <p className="text-[10px] text-white/60 tracking-wider">
                        {activeComic?.pageCount ? `${activeComic.pageCount} pages` : 'CBZ Archive'}
                        {activeComic && activeComic.progress > 0
                          ? ` • Page ${activeComic.progress + 1}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {activeComic && (
                    <button
                      type="button"
                      className="psp-read-btn mt-5 px-6 py-2.5 text-xs font-bold uppercase tracking-widest"
                      onClick={() => openReader(activeComic)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <img src={BTN.triangle} alt="" className="w-3.5 h-3.5" />
                        {activeComic.progress > 0 ? 'Resume' : 'Read'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Button Hints Bar */}
          <footer className="psp-btn-hints">
            <span className="psp-btn-hint">
              <img src={BTN.circle} alt="" /> Select
            </span>
            <span className="psp-btn-hint">
              <img src={BTN.triangle} alt="" /> {comics.length > 0 ? 'Resume' : 'Import'}
            </span>
            <span className="psp-btn-hint">
              <img src={BTN.square} alt="" /> Options
            </span>
            <button
              type="button"
              className="psp-btn-hint text-white/50 hover:text-white cursor-pointer ml-auto"
              onClick={() => setControlsOpen(true)}
            >
              Controls Help
            </button>
          </footer>
        </main>
      )}

      {/* ========================================================
          CAROUSEL VIEW: AUTHENTIC 3D COVER FLOW
          ======================================================== */}
      {scene === 'CAROUSEL' && (
        <main className="relative z-20 flex min-h-screen flex-col justify-between">
          <div className="psp-screen-bar">
            <button type="button" onClick={() => setScene('MAIN_MENU')}>
              Home
            </button>
            <span>
              {filter === 'all'
                ? `All Comics (${filteredComics.length})`
                : filter === 'unread'
                  ? `Unread (${filteredComics.length})`
                  : `Bookmarks (${filteredComics.length})`}
            </span>
            <label>
              Import
              <input
                type="file"
                accept=".cbz,.zip,image/*"
                multiple
                onChange={(e) => handleImportFiles(e.target.files)}
              />
            </label>
          </div>

          <section className="relative flex flex-1 items-start justify-center px-4 pt-4 md:pt-10 overflow-visible">
            {filteredComics.length === 0 ? (
              <div
                className="psp-empty-card my-auto w-full max-w-md cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <img
                  src="/psp-assets/textures/cover_locked.png"
                  alt=""
                  className="w-16 h-16 opacity-40 mb-3"
                />
                <p className="text-sm font-semibold mb-1">No Comics in this View</p>
                <p className="text-xs text-white/60 mb-4">Click to import or switch views</p>
                <span className="psp-read-btn text-xs px-4 py-2">Import .CBZ</span>
              </div>
            ) : (
              <div className="relative h-[32rem] w-full max-w-6xl -translate-y-6 overflow-visible md:h-[36rem]">
                {carouselCards.map(({ comic, index, className, style, isActive }) => (
                  <article
                    key={comic.id}
                    className={[className, 'cursor-pointer'].join(' ')}
                    style={style}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isActive) openReader(comic);
                      else setCarouselIdx(index);
                    }}
                  >
                    <div
                      className={[
                        'relative aspect-[2/3] overflow-hidden rounded-[20px] border bg-black/70 shadow-2xl transition-all duration-300 psp-carousel-reflection',
                        isActive
                          ? 'border-[#ff5f1d] ring-2 ring-[#ff5f1d]/80 ring-offset-2 ring-offset-black shadow-[0_0_40px_rgba(255,100,30,0.6)]'
                          : 'border-white/20',
                      ].join(' ')}
                    >
                      {coverUrls[comic.id] ? (
                        <img
                          src={coverUrls[comic.id]}
                          alt={comic.title}
                          className="aspect-[2/3] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[2/3] w-full items-center justify-center bg-gradient-to-b from-[#2a0806] to-black">
                          <div className="h-10 w-10 animate-pulse rounded-full bg-[#f06a23]/30" />
                        </div>
                      )}

                      {comic.bookmarked && (
                        <span className="absolute right-3 top-3 z-20 h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
                      )}

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6">
                        <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-orange-400 mb-1">
                          {effectiveMode(comic, settings) === 'webtoon'
                            ? 'Manhwa'
                            : effectiveMode(comic, settings) === 'manga'
                              ? 'Manga'
                              : 'Comic'}
                        </span>
                        <p className="text-xs font-semibold text-white/95 truncate">
                          {comic.title}
                        </p>
                        <p className="text-[10px] text-white/60">
                          {comic.pageCount} pages • {formatBytes(comic.size)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer className="psp-btn-hints">
            <span className="psp-btn-hint">
              <img src={BTN.circle} alt="" /> Open
            </span>
            <span className="psp-btn-hint">
              <img src={BTN.triangle} alt="" /> Bookmark
            </span>
            <span className="psp-btn-hint">
              <img src={BTN.cross} alt="" /> Back
            </span>
            <span className="psp-btn-hint text-white/50">
              {activeComic?.title ?? 'No Comic Selected'}
            </span>
          </footer>
        </main>
      )}

      {/* ========================================================
          RECENT LIST VIEW (From DigitalComicsPSP)
          ======================================================== */}
      {scene === 'RECENT_LIST' && (
        <main className="relative z-20 flex min-h-screen flex-col justify-between">
          <div className="psp-screen-bar">
            <button type="button" onClick={() => setScene('MAIN_MENU')}>
              Home
            </button>
            <span>Recently Added ({comics.length})</span>
            <label>
              Import
              <input
                type="file"
                accept=".cbz,.zip,image/*"
                multiple
                onChange={(e) => handleImportFiles(e.target.files)}
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto px-4 max-w-4xl mx-auto w-full py-4">
            {comics.length === 0 ? (
              <div
                className="psp-empty-card my-12 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <p className="text-sm font-semibold mb-1">No Comics Added Yet</p>
                <p className="text-xs text-white/60 mb-4">Drop CBZ files or click to add</p>
                <span className="psp-read-btn text-xs px-4 py-2">Import</span>
              </div>
            ) : (
              <ul className="psp-recent-list">
                {comics.map((comic, i) => {
                  const isActive = i === recentIdx;
                  return (
                    <li
                      key={comic.id}
                      className={`psp-recent-row${isActive ? ' active' : ''}`}
                      onMouseEnter={() => setRecentIdx(i)}
                      onClick={() => openReader(comic)}
                    >
                      <span className="psp-recent-cover">
                        {coverUrls[comic.id] && <img src={coverUrls[comic.id]} alt="" />}
                      </span>
                      <span className="psp-recent-info">
                        <strong>{comic.title}</strong>
                        <small>
                          {comic.pageCount} pages • {MODE_LABEL[effectiveMode(comic, settings)]}
                          {comic.bookmarked ? ' • Bookmarked' : ''}
                        </small>
                      </span>
                      <button
                        type="button"
                        className="psp-read-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReader(comic);
                        }}
                      >
                        READ
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="psp-btn-hints">
            <span className="psp-btn-hint">
              <img src={BTN.circle} alt="" /> Read
            </span>
            <span className="psp-btn-hint">
              <img src={BTN.cross} alt="" /> Back to Menu
            </span>
          </footer>
        </main>
      )}

      {/* ========================================================
          EVOLVED READER: COMIC (LTR), MANGA (RTL), MANHWA (WEBTOON)
          ======================================================== */}
      {scene === 'READER' && readerComic && (
        <main className="relative z-20 flex min-h-screen flex-col justify-between">
          {/* Header Bar */}
          <header className="psp-screen-bar !m-2">
            <button type="button" onClick={closeReader}>
              Back
            </button>
            <span>{readerComic.title}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextMode: ReadingMode =
                    activeMode === 'paged'
                      ? 'manga'
                      : activeMode === 'manga'
                        ? 'webtoon'
                        : 'paged';
                  const updated: ComicRecord = { ...readerComic, readingMode: nextMode };
                  putComic(updated).catch(() => {});
                  setComics((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                }}
                title="Switch mode (Comic / Manga / Webtoon)"
              >
                {activeMode === 'webtoon'
                  ? 'Manhwa'
                  : activeMode === 'manga'
                    ? 'Manga'
                    : 'Comic'}
              </button>
              <button type="button" onClick={() => toggleBookmark(readerComic)}>
                {readerComic.bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
              </button>
            </div>
          </header>

          {/* Reader Canvas / Stage */}
          <section className="relative flex flex-1 items-center justify-center overflow-hidden">
            {activeMode === 'webtoon' ? (
              /* CONTINUOUS VERTICAL STRIP (Manhwa / Webtoon Mode) */
              <div
                ref={webtoonRef}
                className="psp-webtoon-container"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const progress = Math.min(
                    readerComic.pageCount - 1,
                    Math.floor((el.scrollTop / (el.scrollHeight - el.clientHeight || 1)) * readerComic.pageCount),
                  );
                  if (progress !== pageIdx) {
                    setPageIdx(progress);
                  }
                }}
              >
                {Array.from({ length: readerComic.pageCount }).map((_, idx) => (
                  <div key={idx} className="w-full max-w-[840px] flex justify-center bg-black/40">
                    {pageUrls[idx] ? (
                      <img
                        src={pageUrls[idx]}
                        alt={`Page ${idx + 1}`}
                        className="psp-webtoon-page"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-96 w-full flex items-center justify-center text-white/40 text-xs">
                        Loading page {idx + 1}...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* PAGED READER (Western Comic LTR or Manga RTL) */
              <div
                className="relative flex h-[calc(100vh-140px)] w-full max-w-[min(96vw,1280px)] items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-black/50 shadow-2xl"
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY < 0 ? 0.15 : -0.15;
                  setZoom((z) => Math.max(1, Math.min(3, z + delta)));
                }}
                onDoubleClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                onPointerDown={(e) => {
                  if (zoom <= 1) return;
                  dragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: pan.x,
                    origY: pan.y,
                  };
                  (e.currentTarget as Element).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const drag = dragRef.current;
                  if (!drag) return;
                  setPan({
                    x: drag.origX + (e.clientX - drag.startX),
                    y: drag.origY + (e.clientY - drag.startY),
                  });
                }}
                onPointerUp={(e) => {
                  if (dragRef.current) {
                    try {
                      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
                    } catch {}
                  }
                  dragRef.current = null;
                }}
              >
                <div
                  className="flex h-full w-full items-center justify-center transition-transform duration-75"
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  }}
                >
                  {settings.spread && window.innerWidth >= 1024 && pageIdx + 1 < readerComic.pageCount ? (
                    <div className="grid h-full w-full grid-cols-2 gap-2 p-2">
                      <div className="flex items-center justify-end">
                        {pageUrls[pageIdx] && (
                          <img
                            src={pageUrls[pageIdx]}
                            alt={`Page ${pageIdx + 1}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-start">
                        {pageUrls[pageIdx + 1] && (
                          <img
                            src={pageUrls[pageIdx + 1]}
                            alt={`Page ${pageIdx + 2}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2">
                      {pageUrls[pageIdx] ? (
                        <img
                          src={pageUrls[pageIdx]}
                          alt={`Page ${pageIdx + 1}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-white/50 text-xs">Loading page {pageIdx + 1}...</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Mode & Zoom indicator badge */}
                <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {activeMode === 'manga' ? 'Manga (RTL)' : 'Comic (LTR)'} • {Math.round(zoom * 100)}%
                </div>
              </div>
            )}
          </section>

          {/* Reader Footer Controls */}
          <footer className="psp-btn-hints">
            <button
              type="button"
              className="psp-screen-bar button text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              onClick={() => advancePage(-1)}
            >
              Prev
            </button>
            <span className="text-xs font-semibold text-white/80">
              {pageIdx + 1} / {readerComic.pageCount}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, readerComic.pageCount - 1)}
              value={pageIdx}
              onChange={(e) => {
                const next = Number(e.target.value);
                setPageIdx(next);
                session?.prefetch(next, 3);
              }}
              className="w-32 md:w-48 accent-[#ff4535]"
              aria-label="Page slider"
            />
            <button
              type="button"
              className="psp-screen-bar button text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              onClick={() => advancePage(1)}
            >
              Next
            </button>
            <span className="psp-btn-hint ml-4">
              <img src={BTN.cross} alt="" /> Exit
            </span>
          </footer>
        </main>
      )}

      {/* ========================================================
          SETTINGS / OPTIONS MODAL
          ======================================================== */}
      {optionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
          <div className="psp-modal-card w-full max-w-lg p-5 md:p-6 max-h-[90vh] flex flex-col">
            <div className="psp-screen-bar !m-0 !p-0 !h-10 border-b border-white/15 pb-2 shrink-0">
              <span>PSP Settings & Preferences</span>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* Theme Color Selection (PSP 12-Month Firmware + Specials) */}
              <div className="rounded-xl border border-white/15 bg-white/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white/90 text-sm">Theme Color (PSP Monthly Colors)</span>
                  <button
                    type="button"
                    className="text-[11px] px-2.5 py-1 rounded border border-white/20 bg-white/10 hover:bg-white/20 text-orange-300 font-mono"
                    onClick={() => {
                      const m = getCurrentMonthTheme();
                      setSettings((s) => ({ ...s, theme: m }));
                      playConfirmChime(settings.soundEnabled);
                    }}
                  >
                    Auto (This Month)
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1 rounded-lg bg-black/30 border border-white/10">
                  {THEME_CONFIGS.map((cfg) => {
                    const isSelected = settings.theme === cfg.id;
                    return (
                      <button
                        key={cfg.id}
                        type="button"
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-all text-[11px] ${
                          isSelected
                            ? 'bg-white/20 font-bold border border-white/40 shadow-sm'
                            : 'hover:bg-white/10 text-white/70'
                        }`}
                        onClick={() => {
                          setSettings((s) => ({ ...s, theme: cfg.id }));
                          playConfirmChime(settings.soundEnabled);
                        }}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: cfg.accent }}
                        />
                        <span className="truncate">{cfg.season ? `${cfg.season} • ` : ''}{cfg.label.split('•')[0]?.replace(/\(.*\)/, '') || cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sound Effects Toggle */}
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                onClick={() => {
                  const nextVal = !settings.soundEnabled;
                  setSettings((s) => ({ ...s, soundEnabled: nextVal }));
                  if (nextVal) playConfirmChime(true);
                  else playCancelChime(true);
                }}
              >
                <span>Sound Effects (PSP UI Audio)</span>
                <span className={`font-semibold ${settings.soundEnabled ? 'text-green-400' : 'text-white/40'}`}>
                  {settings.soundEnabled ? '● Enabled' : '○ Muted'}
                </span>
              </button>

              {/* Default Reading Mode */}
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                onClick={() => {
                  playConfirmChime(settings.soundEnabled);
                  setSettings((s) => ({
                    ...s,
                    defaultMode:
                      s.defaultMode === 'auto'
                        ? 'paged'
                        : s.defaultMode === 'paged'
                          ? 'manga'
                          : s.defaultMode === 'manga'
                            ? 'webtoon'
                            : 'auto',
                  }));
                }}
              >
                <span>Default Reading Mode</span>
                <span className="text-orange-400 font-semibold">
                  {settings.defaultMode === 'auto'
                    ? 'Auto-Detect'
                    : MODE_LABEL[settings.defaultMode]}
                </span>
              </button>

              {/* Two-page spread */}
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                onClick={() => {
                  playConfirmChime(settings.soundEnabled);
                  setSettings((s) => ({ ...s, spread: !s.spread }));
                }}
              >
                <span>2-Page Spread (Desktop)</span>
                <span className="text-white/70">{settings.spread ? 'Enabled' : 'Disabled'}</span>
              </button>

              {/* Fit Mode */}
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                onClick={() => {
                  playConfirmChime(settings.soundEnabled);
                  setSettings((s) => ({
                    ...s,
                    fit: s.fit === 'contain' ? 'width' : s.fit === 'width' ? 'height' : 'contain',
                  }));
                }}
              >
                <span>Display Fit</span>
                <span className="text-white/70 capitalize">{settings.fit}</span>
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                onClick={() => {
                  playConfirmChime(settings.soundEnabled);
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  } else {
                    document.exitFullscreen().catch(() => {});
                  }
                }}
              >
                <span>Toggle Fullscreen Display</span>
                <span className="text-white/70">F11</span>
              </button>

              {/* Storage Info */}
              <div className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/70">
                <span>Stored Library</span>
                <span>
                  {comics.length} comics •{' '}
                  {storageUsage ? formatBytes(storageUsage.usage) : 'Calculating...'}
                </span>
              </div>

              {/* Delete Active / Clear All */}
              {activeComic && (
                <button
                  type="button"
                  className="w-full text-left rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2.5 text-xs text-red-300 hover:bg-red-950/40"
                  onClick={() => {
                    handleDeleteComic(activeComic.id);
                    setOptionsOpen(false);
                  }}
                >
                  Delete Selected Comic ({activeComic.title})
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/10 shrink-0">
              <button
                type="button"
                className="psp-read-btn text-xs px-6 py-2"
                onClick={() => {
                  playCancelChime(settings.soundEnabled);
                  setOptionsOpen(false);
                }}
              >
                Done (ESC)
              </button>
              <button
                type="button"
                className="text-xs text-white/60 hover:text-white underline cursor-pointer"
                onClick={() => {
                  playConfirmChime(settings.soundEnabled);
                  setOptionsOpen(false);
                  setControlsOpen(true);
                }}
              >
                Controls Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CONTROLS GUIDE MODAL (PSP Template)
          ======================================================== */}
      {controlsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-md">
          <div className="psp-modal-card w-full max-w-lg p-6">
            <div className="psp-screen-bar !m-0 !p-0 !h-10 border-b border-white/15 pb-2">
              <span>Controller & Keyboard Guide</span>
            </div>

            <div className="my-4 flex justify-center">
              <img
                src="/psp-assets/textures/ctrls_template.png"
                alt="PSP Controls"
                className="max-h-36 object-contain"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
              {KEY_HINTS.map((h) => (
                <div key={h.action} className="flex justify-between border-b border-white/10 py-1">
                  <span className="font-semibold text-orange-300">{h.label}</span>
                  <span className="text-white/60">{h.keys}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="psp-read-btn text-xs px-5 py-2"
                onClick={() => {
                  playCancelChime(settings.soundEnabled);
                  setControlsOpen(false);
                }}
              >
                Close (ESC)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;