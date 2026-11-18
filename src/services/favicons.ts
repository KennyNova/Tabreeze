const CACHE_KEY = "tabreeze-favicon-cache-v1";
/** Found icons are re-checked this often in case the site changes theirs. */
const REFRESH_FOUND_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_ICON_BYTES = 256 * 1024;

interface FaviconCacheEntry {
  /** Data URL of the resolved icon, or null when nothing was found yet. */
  src: string | null;
  checkedAt: number;
}

type FaviconCache = Record<string, FaviconCacheEntry>;

/**
 * - `found`: a real icon (data URL)
 * - `missing`: every source answered, none had a real icon
 * - `unavailable`: sources couldn't be fetched (offline, CORS in dev); caller should fall back to <img>
 */
export type FaviconResolution =
  | { status: "found"; src: string }
  | { status: "missing" }
  | { status: "unavailable" };

const inFlight = new Map<string, Promise<FaviconResolution>>();
const listeners = new Map<string, Set<(src: string | null) => void>>();

function isFetchableUrl(url: string): URL | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname ? u : null;
  } catch {
    return null;
  }
}

export function getFaviconCacheKey(url: string): string | null {
  return isFetchableUrl(url)?.host.toLowerCase() ?? null;
}

/** Third-party favicon services, in the order the <img> fallback should try them. */
export function getFaviconServiceUrls(url: string): string[] {
  const u = isFetchableUrl(url);
  if (!u) return [];
  const host = u.hostname;
  return [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
    `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=${encodeURIComponent(url)}&size=64`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
  ];
}

function readCache(): FaviconCache {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCacheEntry(key: string, entry: FaviconCacheEntry): void {
  const cache = readCache();
  cache[key] = entry;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded: drop the oldest half and try once more.
    const keys = Object.keys(cache).sort((a, b) => cache[a].checkedAt - cache[b].checkedAt);
    for (const k of keys.slice(0, Math.ceil(keys.length / 2))) {
      if (k !== key) delete cache[k];
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Give up; icons will just be re-resolved next time.
    }
  }
}

export function getCachedFavicon(url: string): FaviconCacheEntry | null {
  const key = getFaviconCacheKey(url);
  return key ? readCache()[key] ?? null : null;
}

/** Missing icons are retried on every load; found icons only once they're stale. */
export function shouldRefreshFavicon(entry: FaviconCacheEntry | null): boolean {
  if (!entry || !entry.src) return true;
  return Date.now() - entry.checkedAt > REFRESH_FOUND_MS;
}

export function subscribeFavicon(url: string, cb: (src: string | null) => void): () => void {
  const key = getFaviconCacheKey(url);
  if (!key) return () => {};
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) listeners.delete(key);
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-cache" });
  } finally {
    clearTimeout(timer);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches an icon URL and returns it as a data URL when it's a real icon.
 * Favicon services answer 404 (with a generic globe body) when they have nothing,
 * and sites often answer /favicon.ico with an HTML soft-404, so both are rejected.
 */
async function tryIcon(url: string): Promise<string | null> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (type && !type.startsWith("image/") && !type.includes("octet-stream")) return null;
  const blob = await res.blob();
  if (blob.size === 0 || blob.size > MAX_ICON_BYTES) return null;
  return blobToDataUrl(blob);
}

/** Icons the page itself declares via <link rel="icon">, largest first. */
async function getDeclaredIconUrls(pageUrl: string): Promise<string[]> {
  const res = await fetchWithTimeout(pageUrl);
  if (!res.ok) return [];
  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("html")) return [];
  const html = (await res.text()).slice(0, 200_000);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = res.url || pageUrl;
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>("link[rel][href]")).filter((link) =>
    /(^|\s)(icon|apple-touch-icon)(\s|$)/i.test(link.getAttribute("rel") || ""),
  );
  const sizeOf = (link: HTMLLinkElement) => {
    const sizes = link.getAttribute("sizes") || "";
    if (/any/i.test(sizes)) return 1024;
    return Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
  };
  return links
    .sort((a, b) => sizeOf(b) - sizeOf(a))
    .map((link) => {
      try {
        return new URL(link.getAttribute("href")!, base).href;
      } catch {
        return null;
      }
    })
    .filter((href): href is string => !!href);
}

async function resolveFavicon(url: string): Promise<FaviconResolution> {
  const u = isFetchableUrl(url);
  if (!u) return { status: "missing" };

  let anyAnswered = false;
  const attempt = async (iconUrl: string) => {
    try {
      const src = await tryIcon(iconUrl);
      anyAnswered = true;
      return src;
    } catch {
      return null;
    }
  };

  const [google, gstatic, ddg] = getFaviconServiceUrls(url);
  for (const candidate of [google, gstatic]) {
    const src = await attempt(candidate);
    if (src) return { status: "found", src };
  }

  try {
    const declared = await getDeclaredIconUrls(u.origin + "/");
    anyAnswered = true;
    for (const candidate of declared.slice(0, 4)) {
      const src = await attempt(candidate);
      if (src) return { status: "found", src };
    }
  } catch {
    // Page unreachable; keep trying the other sources.
  }

  for (const candidate of [`${u.origin}/favicon.ico`, ddg]) {
    const src = await attempt(candidate);
    if (src) return { status: "found", src };
  }

  return anyAnswered ? { status: "missing" } : { status: "unavailable" };
}

/**
 * Resolves (once per host at a time) and caches the favicon for a URL.
 * A previously found icon is kept if a refresh comes up empty, so a flaky
 * network or a temporarily broken site never downgrades a working icon.
 */
export function refreshFavicon(url: string): Promise<FaviconResolution> {
  const key = getFaviconCacheKey(url);
  if (!key) return Promise.resolve({ status: "missing" });
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = resolveFavicon(url)
    .then((result) => {
      const previous = readCache()[key];
      if (result.status === "found") {
        writeCacheEntry(key, { src: result.src, checkedAt: Date.now() });
        listeners.get(key)?.forEach((cb) => cb(result.src));
      } else if (result.status === "missing") {
        writeCacheEntry(key, { src: previous?.src ?? null, checkedAt: Date.now() });
      }
      return result;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}
