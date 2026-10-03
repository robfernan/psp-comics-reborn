import JSZip from 'jszip';

export interface ComicBook {
  id: string;
  title: string;
  coverUrl: string;
  totalPages: number;
  path: string;
}

const IMAGE_PATTERN = /\.(jpg|jpeg|png|webp)$/i;

const coverUrlCache = new Map<string, string>();
const coverExtractionCache = new Map<string, Promise<string>>();
const pageUrlCache = new Map<string, string[]>();
const pageExtractionCache = new Map<string, Promise<string[]>>();

const OFFLINE_PLACEHOLDER_COVER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#180404"/>
          <stop offset="45%" stop-color="#4a0d0d"/>
          <stop offset="100%" stop-color="#d94a17"/>
        </linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#g)"/>
      <circle cx="300" cy="320" r="150" fill="rgba(255,255,255,0.10)"/>
      <path d="M120 620C180 560 240 640 300 580C360 520 420 610 480 550" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="16" stroke-linecap="round"/>
      <path d="M90 690C160 630 230 730 300 670C370 610 440 700 510 640" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="12" stroke-linecap="round"/>
    </svg>
  `);

export function titleFromPath(path: string): string {
  const fileName = path.split('/').pop() ?? path;
  return fileName.replace(/\.cbz$/i, '').replace(/\.[^.]+$/i, '').replace(/\s+/g, ' ').trim();
}

export function createFallbackCover(title: string): string {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#2a0b0a" />
          <stop offset="55%" stop-color="#8d2a18" />
          <stop offset="100%" stop-color="#f06a23" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="28%" r="70%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.35)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect width="600" height="900" fill="url(#bg)" />
      <rect width="600" height="900" fill="url(#glow)" />
      <rect x="28" y="28" width="544" height="844" rx="24" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="3" />
      <text x="50%" y="50%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700" fill="#fff" letter-spacing="2">
        ${safeTitle}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function isCapacitorRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { Capacitor?: unknown }).Capacitor);
}

function isNativeDesktopRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const desktopWindow = window as Window & {
    __wails?: unknown;
    go?: unknown;
    nw?: unknown;
  };

  return Boolean(desktopWindow.__wails || desktopWindow.go || desktopWindow.nw);
}

async function bufferFromBase64(input: string): Promise<ArrayBuffer> {
  const binary = atob(input.replace(/^data:.*?;base64,/, ''));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function readNativeBytes(filePath: string): Promise<ArrayBuffer | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const anyWindow = window as Window & {
    Capacitor?: {
      Plugins?: {
        Filesystem?: {
          readFile?: (options: { path: string; directory?: string }) => Promise<{ data: string }>;
        };
      };
      Filesystem?: {
        readFile?: (options: { path: string; directory?: string }) => Promise<{ data: string }>;
      };
    };
    __wails?: {
      readFile?: (path: string) => Promise<string | ArrayBuffer | Uint8Array>;
      openFile?: (path: string) => Promise<string | ArrayBuffer | Uint8Array>;
    };
    go?: {
      app?: {
        ReadFile?: (path: string) => Promise<string | ArrayBuffer | Uint8Array>;
      };
    };
    nw?: {
      fs?: {
        readFile?: (path: string, cb: (error: Error | null, data?: Uint8Array) => void) => void;
      };
    };
  };

  try {
    const filesystem = anyWindow.Capacitor?.Plugins?.Filesystem ?? anyWindow.Capacitor?.Filesystem;

    if (filesystem?.readFile) {
      const result = await filesystem.readFile({ path: filePath });
      return bufferFromBase64(result.data);
    }

    const wailsBridge = anyWindow.__wails?.readFile ?? anyWindow.__wails?.openFile ?? anyWindow.go?.app?.ReadFile;
    if (wailsBridge) {
      const result = await wailsBridge(filePath);

      if (typeof result === 'string') {
        if (result.startsWith('data:')) {
          return bufferFromBase64(result);
        }

        return new TextEncoder().encode(result).buffer;
      }

      if (result instanceof ArrayBuffer) {
        return result;
      }

      if (result instanceof Uint8Array) {
        return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
      }
    }

    if (anyWindow.nw?.fs?.readFile) {
      return await new Promise<ArrayBuffer | null>((resolve) => {
        anyWindow.nw?.fs?.readFile?.(filePath, (error, data) => {
          if (error || !data) {
            resolve(null);
            return;
          }

          resolve(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        });
      });
    }
  } catch {
    return null;
  }

  return null;
}

async function resolveArchiveBuffer(filePath: string): Promise<ArrayBuffer | null> {
  let arrayBuffer: ArrayBuffer | null = null;
  const resolvedPath = filePath.startsWith('http://') || filePath.startsWith('https://')
    ? filePath
    : `/${filePath.replace(/^\/+/, '')}`;

  if (isCapacitorRuntime() || isNativeDesktopRuntime()) {
    arrayBuffer = await readNativeBytes(filePath);
  }

  if (!arrayBuffer) {
    try {
      const response = await fetch(encodeURI(resolvedPath));

      if (!response.ok) {
        return null;
      }

      arrayBuffer = await response.arrayBuffer();
    } catch {
      return null;
    }
  }

  return arrayBuffer;
}

function loadZipImages(zip: JSZip): JSZip.JSZipObject[] {
  return Object.values(zip.files)
    .filter((entry) => !entry.dir && IMAGE_PATTERN.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

export async function extractUniversalCbz(filePath: string, fallbackUrl: string): Promise<string> {
  const placeholder = fallbackUrl || OFFLINE_PLACEHOLDER_COVER;

  const cachedCover = coverUrlCache.get(filePath);
  if (cachedCover) {
    return cachedCover;
  }

  const pendingExtraction = coverExtractionCache.get(filePath);
  if (pendingExtraction) {
    return pendingExtraction;
  }

  const extraction = (async () => {
    try {
    const arrayBuffer = await resolveArchiveBuffer(filePath);

    if (!arrayBuffer) {
      return placeholder;
    }

    const zip = await JSZip.loadAsync(arrayBuffer);
    const imageEntries = loadZipImages(zip);
    const coverEntry = imageEntries[0];

    if (!coverEntry) {
      return placeholder;
    }

    const coverData = await coverEntry.async('arraybuffer');
    const blob = new Blob([coverData], { type: 'image/jpeg' });
    const objectUrl = URL.createObjectURL(blob);
    coverUrlCache.set(filePath, objectUrl);
    return objectUrl;
  } catch {
    return placeholder;
  } finally {
    coverExtractionCache.delete(filePath);
  }
  })();

  coverExtractionCache.set(filePath, extraction);
  return extraction;
}

export async function extractUniversalCbzPages(filePath: string): Promise<string[]> {
  const cachedPages = pageUrlCache.get(filePath);
  if (cachedPages) {
    return cachedPages;
  }

  const pendingExtraction = pageExtractionCache.get(filePath);
  if (pendingExtraction) {
    return pendingExtraction;
  }

  const extraction = (async () => {
    try {
      const arrayBuffer = await resolveArchiveBuffer(filePath);

      if (!arrayBuffer) {
        return [];
      }

      const zip = await JSZip.loadAsync(arrayBuffer);
      const imageEntries = loadZipImages(zip);
      const pageUrls: string[] = [];

      for (const entry of imageEntries) {
        const pageData = await entry.async('arraybuffer');
        const blob = new Blob([pageData], { type: 'image/jpeg' });
        pageUrls.push(URL.createObjectURL(blob));
      }

      pageUrlCache.set(filePath, pageUrls);
      return pageUrls;
    } catch {
      return [];
    } finally {
      pageExtractionCache.delete(filePath);
    }
  })();

  pageExtractionCache.set(filePath, extraction);
  return extraction;
}

export async function parseLocalCbz(fileBlob: Blob, fallbackTitle: string): Promise<ComicBook> {
  const zip = await JSZip.loadAsync(fileBlob);
  const imageEntries = loadZipImages(zip);

  const coverEntry = imageEntries[0];
  const coverBuffer = coverEntry ? await coverEntry.async('arraybuffer') : new ArrayBuffer(0);
  const coverBlob = new Blob([coverBuffer], { type: 'image/jpeg' });

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `comic-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: fallbackTitle,
    coverUrl: URL.createObjectURL(coverBlob),
    totalPages: imageEntries.length,
    path: fallbackTitle,
  };
}