/**
 * Stock quotes via Yahoo Finance's public chart/search endpoints (no API key).
 * Extension pages bypass CORS thanks to host_permissions; the Vite dev server
 * cannot, so dev mode serves mock data (same approach as weather).
 */

export interface StockQuote {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  /** Intraday closes for the sparkline (nulls removed) */
  series: number[];
  marketState: "open" | "closed";
  updatedAt: number;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

const WATCHLIST_KEY = "dashboard-stocks-watchlist";
const CACHE_PREFIX = "dashboard-stocks-v1-";
const MOCK_KEY = "dashboard-stocks-mock";
export const STOCKS_REFRESH_MS = 60 * 1000;
const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "SPY"];
const MAX_SYMBOLS = 20;

export const STOCKS_WATCHLIST_EVENT = "stocks:watchlist-changed";

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9.\-^=]/g, "").slice(0, 15);
}

export function getWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((s): s is string => typeof s === "string")
          .map(normalizeSymbol)
          .filter(Boolean)
          .slice(0, MAX_SYMBOLS);
      }
    }
  } catch {}
  return [...DEFAULT_WATCHLIST];
}

export function saveWatchlist(symbols: string[]): void {
  const unique = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))).slice(0, MAX_SYMBOLS);
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(unique));
  } catch {}
  window.dispatchEvent(new CustomEvent(STOCKS_WATCHLIST_EVENT, { detail: unique }));
}

function shouldUseMock(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem(MOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i += 1) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createMockQuote(symbol: string): StockQuote {
  const seed = hashSymbol(symbol);
  let state = seed || 1;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const base = 20 + (seed % 480);
  const drift = (rand() - 0.5) * 0.05;
  const series: number[] = [];
  let value = base;
  for (let i = 0; i < 78; i += 1) {
    value *= 1 + drift / 78 + (rand() - 0.5) * 0.006;
    series.push(Math.round(value * 100) / 100);
  }
  const price = series[series.length - 1]!;
  const change = price - base;
  return {
    symbol,
    name: `${symbol} Inc.`,
    currency: "USD",
    price,
    previousClose: base,
    change,
    changePercent: (change / base) * 100,
    series,
    marketState: "closed",
    updatedAt: Date.now(),
  };
}

function readCache(symbol: string): StockQuote | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + symbol);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StockQuote;
    if (typeof parsed?.price !== "number" || !Array.isArray(parsed.series)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(quote: StockQuote): void {
  try {
    localStorage.setItem(CACHE_PREFIX + quote.symbol, JSON.stringify(quote));
  } catch {}
}

async function fetchQuote(symbol: string): Promise<StockQuote> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=false`
  );
  if (!res.ok) throw new Error(`Quote error ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(json?.chart?.error?.description || "Unknown symbol");
  }
  const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
  const series = closes.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const price = meta.regularMarketPrice as number;
  const previousClose =
    typeof meta.chartPreviousClose === "number"
      ? meta.chartPreviousClose
      : typeof meta.previousClose === "number"
        ? meta.previousClose
        : series[0] ?? price;
  const change = price - previousClose;
  const period = meta.currentTradingPeriod?.regular;
  const nowSec = Date.now() / 1000;
  const isOpen =
    typeof period?.start === "number" && typeof period?.end === "number" && nowSec >= period.start && nowSec <= period.end;
  return {
    symbol: String(meta.symbol ?? symbol).toUpperCase(),
    name: String(meta.shortName ?? meta.longName ?? symbol),
    currency: String(meta.currency ?? "USD"),
    price,
    previousClose,
    change,
    changePercent: previousClose ? (change / previousClose) * 100 : 0,
    series: series.length ? series : [previousClose, price],
    marketState: isOpen ? "open" : "closed",
    updatedAt: Date.now(),
  };
}

export interface QuoteResult {
  symbol: string;
  quote: StockQuote | null;
  error?: string;
}

/** Fetches every symbol in parallel; failures fall back to the last cached quote. */
export async function fetchQuotes(symbols: string[], forceRefresh = false): Promise<QuoteResult[]> {
  const useMock = shouldUseMock();
  return Promise.all(
    symbols.map(async (symbol): Promise<QuoteResult> => {
      if (useMock) return { symbol, quote: createMockQuote(symbol) };
      const cached = readCache(symbol);
      if (!forceRefresh && cached && Date.now() - cached.updatedAt < STOCKS_REFRESH_MS) {
        return { symbol, quote: cached };
      }
      try {
        const quote = await fetchQuote(symbol);
        writeCache(quote);
        return { symbol, quote };
      } catch (err) {
        return { symbol, quote: cached, error: err instanceof Error ? err.message : "Failed to load" };
      }
    })
  );
}

export function getCachedQuotes(symbols: string[]): QuoteResult[] {
  return symbols.map((symbol) => ({ symbol, quote: readCache(symbol) }));
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  if (shouldUseMock()) {
    const sym = normalizeSymbol(q);
    return sym ? [{ symbol: sym, name: `${sym} Inc.`, exchange: "MOCK", type: "EQUITY" }] : [];
  }
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=0&listsCount=0`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (Array.isArray(json?.quotes) ? json.quotes : [])
      .filter((r: any) => typeof r?.symbol === "string")
      .map((r: any) => ({
        symbol: String(r.symbol).toUpperCase(),
        name: String(r.shortname ?? r.longname ?? r.symbol),
        exchange: String(r.exchDisp ?? r.exchange ?? ""),
        type: String(r.typeDisp ?? r.quoteType ?? ""),
      }));
  } catch {
    return [];
  }
}

export function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 4 : 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

// ─── History (drill-down chart) ───────────────────────────────────────────────

export type HistoryRange = "1d" | "5d" | "1mo" | "6mo" | "ytd" | "1y" | "5y" | "max";

export const HISTORY_RANGES: Array<{ id: HistoryRange; label: string; interval: string; ttlMs: number }> = [
  { id: "1d", label: "1D", interval: "5m", ttlMs: 60 * 1000 },
  { id: "5d", label: "5D", interval: "15m", ttlMs: 5 * 60 * 1000 },
  { id: "1mo", label: "1M", interval: "60m", ttlMs: 15 * 60 * 1000 },
  { id: "6mo", label: "6M", interval: "1d", ttlMs: 60 * 60 * 1000 },
  { id: "ytd", label: "YTD", interval: "1d", ttlMs: 60 * 60 * 1000 },
  { id: "1y", label: "1Y", interval: "1d", ttlMs: 60 * 60 * 1000 },
  { id: "5y", label: "5Y", interval: "1wk", ttlMs: 6 * 60 * 60 * 1000 },
  { id: "max", label: "Max", interval: "1mo", ttlMs: 24 * 60 * 60 * 1000 },
];

export interface HistoryPoint {
  /** Unix ms */
  t: number;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}

export interface StockHistory {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  timeZone: string;
  range: HistoryRange;
  /** Close before the first point (for 1D: previous session close) */
  baseline: number;
  price: number;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
  points: HistoryPoint[];
  fetchedAt: number;
}

const historyCache = new Map<string, StockHistory>();

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function createMockHistory(symbol: string, range: HistoryRange): StockHistory {
  const quote = createMockQuote(symbol);
  const spec: Record<HistoryRange, { count: number; stepMs: number; vol: number }> = {
    "1d": { count: 78, stepMs: 5 * 60e3, vol: 0.002 },
    "5d": { count: 130, stepMs: 15 * 60e3, vol: 0.004 },
    "1mo": { count: 154, stepMs: 60 * 60e3, vol: 0.006 },
    "6mo": { count: 126, stepMs: 86400e3, vol: 0.015 },
    ytd: { count: 215, stepMs: 86400e3, vol: 0.015 },
    "1y": { count: 252, stepMs: 86400e3, vol: 0.015 },
    "5y": { count: 260, stepMs: 7 * 86400e3, vol: 0.03 },
    max: { count: 240, stepMs: 30 * 86400e3, vol: 0.06 },
  };
  const { count, stepMs, vol } = spec[range];
  let state = hashSymbol(symbol + range) || 1;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  // Walk backwards from the current price so the series ends at "now".
  const closes: number[] = [quote.price];
  for (let i = 1; i < count; i += 1) {
    const prev = closes[closes.length - 1]!;
    closes.push(Math.max(0.5, prev / (1 + (rand() - 0.48) * vol * 2)));
  }
  closes.reverse();
  const end = Date.now();
  const points = closes.map((close, i) => ({
    t: end - (count - 1 - i) * stepMs,
    close: Math.round(close * 100) / 100,
    open: null,
    high: null,
    low: null,
    volume: Math.round(1e6 + rand() * 9e6),
  }));
  const baseline = range === "1d" ? quote.previousClose : points[0]!.close / (1 + (rand() - 0.5) * vol);
  return {
    symbol,
    name: quote.name,
    exchange: "Mock",
    currency: quote.currency,
    timeZone: "America/New_York",
    range,
    baseline,
    price: quote.price,
    dayHigh: Math.max(...quote.series),
    dayLow: Math.min(...quote.series),
    fiftyTwoWeekHigh: quote.price * 1.25,
    fiftyTwoWeekLow: quote.price * 0.7,
    volume: 42_000_000,
    points,
    fetchedAt: Date.now(),
  };
}

export async function fetchHistory(symbol: string, range: HistoryRange): Promise<StockHistory> {
  const key = `${symbol}|${range}`;
  const spec = HISTORY_RANGES.find((r) => r.id === range) ?? HISTORY_RANGES[0]!;
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < spec.ttlMs) return cached;
  if (shouldUseMock()) {
    const mock = createMockHistory(symbol, range);
    historyCache.set(key, mock);
    return mock;
  }
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${spec.interval}&includePrePost=false`
  );
  if (!res.ok) throw new Error(`History error ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) throw new Error(json?.chart?.error?.description || "No data");
  const ts: unknown[] = Array.isArray(result.timestamp) ? result.timestamp : [];
  const q = result?.indicators?.quote?.[0] ?? {};
  const points: HistoryPoint[] = [];
  ts.forEach((t, i) => {
    const close = num(q.close?.[i]);
    if (typeof t !== "number" || close === null) return;
    points.push({ t: t * 1000, close, open: num(q.open?.[i]), high: num(q.high?.[i]), low: num(q.low?.[i]), volume: num(q.volume?.[i]) });
  });
  const price = num(meta.regularMarketPrice) ?? points[points.length - 1]?.close ?? 0;
  const history: StockHistory = {
    symbol: String(meta.symbol ?? symbol).toUpperCase(),
    name: String(meta.longName ?? meta.shortName ?? symbol),
    exchange: String(meta.fullExchangeName ?? meta.exchangeName ?? ""),
    currency: String(meta.currency ?? "USD"),
    timeZone: typeof meta.exchangeTimezoneName === "string" ? meta.exchangeTimezoneName : "UTC",
    range,
    baseline: num(meta.chartPreviousClose) ?? points[0]?.close ?? price,
    price,
    dayHigh: num(meta.regularMarketDayHigh),
    dayLow: num(meta.regularMarketDayLow),
    fiftyTwoWeekHigh: num(meta.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(meta.fiftyTwoWeekLow),
    volume: num(meta.regularMarketVolume),
    points,
    fetchedAt: Date.now(),
  };
  historyCache.set(key, history);
  return history;
}

export function formatCompact(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}
