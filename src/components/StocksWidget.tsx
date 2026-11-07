import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  STOCKS_REFRESH_MS,
  STOCKS_WATCHLIST_EVENT,
  fetchQuotes,
  formatPrice,
  getCachedQuotes,
  getWatchlist,
  normalizeSymbol,
  saveWatchlist,
  searchSymbols,
  type QuoteResult,
  type SymbolSearchResult,
} from "../services/stocks";
import { useLayoutEditing } from "../layout/useLayoutEditing";
import StockDetailModal from "./StockDetailModal";

interface StocksWidgetProps {
  colSpan?: number;
  rowSpan?: number;
  /** Narrow layout used by the side panel */
  compactList?: boolean;
}

const UP = "text-emerald-600 dark:text-emerald-400";
const DOWN = "text-rose-600 dark:text-rose-400";

function Sparkline({ series, previousClose, up }: { series: number[]; previousClose: number; up: boolean }) {
  const width = 72;
  const height = 24;
  const path = useMemo(() => {
    if (series.length < 2) return "";
    const min = Math.min(...series, previousClose);
    const max = Math.max(...series, previousClose);
    const span = max - min || 1;
    return series
      .map((v, i) => {
        const x = (i / (series.length - 1)) * width;
        const y = height - 2 - ((v - min) / span) * (height - 4);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [series, previousClose]);
  const baselineY = useMemo(() => {
    const min = Math.min(...series, previousClose);
    const max = Math.max(...series, previousClose);
    const span = max - min || 1;
    return height - 2 - ((previousClose - min) / span) * (height - 4);
  }, [series, previousClose]);
  if (!path) return <div style={{ width, height }} />;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`flex-shrink-0 ${up ? UP : DOWN}`} aria-hidden>
      <line x1={0} x2={width} y1={baselineY} y2={baselineY} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2 3" strokeWidth={1} />
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ChangePill({ percent }: { percent: number }) {
  const up = percent >= 0;
  return (
    <span
      className={`text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded-md ${up ? UP : DOWN}`}
      style={{ background: up ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)" }}
    >
      {up ? "+" : ""}
      {percent.toFixed(2)}%
    </span>
  );
}

function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>(getWatchlist);
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail;
      setSymbols(Array.isArray(detail) ? detail : getWatchlist());
    };
    window.addEventListener(STOCKS_WATCHLIST_EVENT, onChange);
    return () => window.removeEventListener(STOCKS_WATCHLIST_EVENT, onChange);
  }, []);
  const update = useCallback((next: string[]) => {
    setSymbols(next);
    saveWatchlist(next);
  }, []);
  return [symbols, update] as const;
}

function useQuotes(symbols: string[]) {
  const [results, setResults] = useState<QuoteResult[]>(() => getCachedQuotes(symbols));
  const [loading, setLoading] = useState(false);
  const symbolsKey = symbols.join(",");

  const load = useCallback(
    async (force = false) => {
      if (symbols.length === 0) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        setResults(await fetchQuotes(symbols, force));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbolsKey]
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, STOCKS_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { results, loading, refresh: () => load(true) };
}

function AddSymbolForm({ existing, onAdd, onClose }: { existing: string[]; onAdd: (symbol: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SymbolSearchResult[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const found = await searchSymbols(q);
      if (!cancelled) {
        setMatches(found.filter((m) => !existing.includes(m.symbol)));
        setActive(0);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, existing]);

  const submit = (symbol?: string) => {
    const chosen = normalizeSymbol(symbol ?? matches[active]?.symbol ?? query);
    if (!chosen) return;
    onAdd(chosen);
    setQuery("");
    setMatches([]);
  };

  return (
    <div className="relative mb-3">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(0, matches.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          }
        }}
        placeholder="Search ticker or company…"
        className="input-field text-sm"
      />
      {matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 glass rounded-xl p-1 max-h-56 overflow-y-auto">
          {matches.map((m, i) => (
            <button
              key={m.symbol}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(m.symbol)}
              onMouseEnter={() => setActive(i)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                i === active ? "bg-black/[0.05] dark:bg-white/[0.08]" : ""
              }`}
            >
              <span className="text-[13px] font-semibold text-gray-700/90 dark:text-white/80 w-16 flex-shrink-0 truncate">{m.symbol}</span>
              <span className="text-[12px] text-gray-500/80 dark:text-white/45 flex-1 truncate">{m.name}</span>
              <span className="text-[10px] text-gray-400/70 dark:text-white/25 flex-shrink-0">{m.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StocksWidget({ colSpan = 4, rowSpan = 3, compactList = false }: StocksWidgetProps) {
  const [symbols, setSymbols] = useWatchlist();
  const { results, loading, refresh } = useQuotes(symbols);
  const editing = useLayoutEditing();
  const [adding, setAdding] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setAdding(false);
  }, [editing]);

  const detailModal = detailSymbol ? <StockDetailModal symbol={detailSymbol} onClose={() => setDetailSymbol(null)} /> : null;

  const showSparkline = !compactList && colSpan >= 4;
  const showName = !compactList && colSpan >= 5;
  const tickerMode = !compactList && rowSpan <= 1;

  const addSymbol = (symbol: string) => {
    if (!symbols.includes(symbol)) setSymbols([...symbols, symbol]);
    setAdding(false);
  };
  const removeSymbol = (symbol: string) => setSymbols(symbols.filter((s) => s !== symbol));
  const moveSymbol = (from: number, to: number) => {
    if (from === to) return;
    const next = [...symbols];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setSymbols(next);
  };

  const lastUpdated = results.reduce((acc, r) => Math.max(acc, r.quote?.updatedAt ?? 0), 0);
  const anyOpen = results.some((r) => r.quote?.marketState === "open");

  if (tickerMode) {
    return (
      <div className="widget-card !py-0 h-full flex items-center gap-4 overflow-x-auto">
        {detailModal}
        {results.length === 0 && <span className="text-sm text-gray-400/60 dark:text-white/25">Add symbols in a taller tile</span>}
        {results.map(({ symbol, quote }) => (
          <div
            key={symbol}
            role={editing ? undefined : "button"}
            tabIndex={editing ? undefined : 0}
            onClick={editing ? undefined : () => setDetailSymbol(symbol)}
            onKeyDown={editing ? undefined : (e) => e.key === "Enter" && setDetailSymbol(symbol)}
            className={`flex items-baseline gap-1.5 flex-shrink-0 rounded-lg px-1.5 py-1 -mx-1.5 ${editing ? "" : "cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"}`}
          >
            <span className="text-[13px] font-semibold text-gray-700/90 dark:text-white/75">{symbol}</span>
            {quote ? (
              <>
                <span className="text-[13px] tabular-nums text-gray-600/80 dark:text-white/55">{formatPrice(quote.price, quote.currency)}</span>
                <ChangePill percent={quote.changePercent} />
              </>
            ) : (
              <span className="text-[12px] text-gray-400/60 dark:text-white/25">—</span>
            )}
            {editing && (
              <button
                type="button"
                onClick={() => removeSymbol(symbol)}
                aria-label={`Remove ${symbol}`}
                className="self-center p-0.5 rounded text-gray-400/60 hover:text-red-400/80"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="widget-card flex flex-col">
      {detailModal}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <svg className="w-[18px] h-[18px] text-gray-500/60 dark:text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 17l6-6 4 4 8-8M15 7h6v6" />
          </svg>
          <h2 className="font-medium text-[15px] text-gray-700/80 dark:text-white/60">Stocks</h2>
          {results.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400/70 dark:text-white/25">
              <span className={`w-1.5 h-1.5 rounded-full ${anyOpen ? "bg-emerald-500" : "bg-gray-400/60"}`} />
              {anyOpen ? "Market open" : "Closed"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void refresh()}
            title={lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Refresh"}
            aria-label="Refresh quotes"
            className="p-1.5 rounded-lg text-gray-400/70 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.6m14.8 2A8 8 0 004.6 9M4.6 9H9m11 11v-5h-.6m0 0a8 8 0 01-14.8-2m14.8 2H15" />
            </svg>
          </button>
          {editing && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            aria-label={adding ? "Cancel adding symbol" : "Add symbol"}
            title={adding ? "Cancel" : "Add symbol"}
            className="p-1.5 rounded-lg text-gray-400/70 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${adding ? "rotate-45" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
            </svg>
          </button>
          )}
        </div>
      </div>

      {editing && adding && <AddSymbolForm existing={symbols} onAdd={addSymbol} onClose={() => setAdding(false)} />}

      <div className="flex-1 min-h-0 flex flex-col gap-0.5 overflow-y-auto pr-1">
        {symbols.length === 0 && (
          <div className="text-center text-gray-400/40 dark:text-white/15 text-sm py-6 font-light">
            {editing ? "No symbols yet. Click + to add one." : "No symbols yet. Customize the layout to add some."}
          </div>
        )}
        {results.map(({ symbol, quote, error }, index) => {
          const up = (quote?.change ?? 0) >= 0;
          return (
            <div
              key={symbol}
              draggable={editing}
              onDragStart={editing ? () => setDragIndex(index) : undefined}
              onDragOver={editing ? (e) => e.preventDefault() : undefined}
              onDrop={
                editing
                  ? () => {
                      if (dragIndex !== null) moveSymbol(dragIndex, index);
                      setDragIndex(null);
                    }
                  : undefined
              }
              onDragEnd={editing ? () => setDragIndex(null) : undefined}
              role={editing ? undefined : "button"}
              tabIndex={editing ? undefined : 0}
              aria-label={editing ? undefined : `Open ${symbol} details`}
              onClick={editing ? undefined : () => setDetailSymbol(symbol)}
              onKeyDown={editing ? undefined : (e) => e.key === "Enter" && setDetailSymbol(symbol)}
              className={`group flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all duration-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] ${
                editing ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
              } ${dragIndex === index ? "opacity-40" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-gray-700/90 dark:text-white/75">{symbol}</span>
                  {error && (
                    <span title={quote ? `Showing cached quote: ${error}` : error} className="text-[10px] text-amber-500/80">
                      {quote ? "stale" : "error"}
                    </span>
                  )}
                </div>
                {showName && quote && (
                  <div className="text-[11px] text-gray-400/80 dark:text-white/30 truncate">{quote.name}</div>
                )}
              </div>

              {showSparkline && quote && <Sparkline series={quote.series} previousClose={quote.previousClose} up={up} />}

              <div className="flex flex-col items-end flex-shrink-0">
                {quote ? (
                  <>
                    <span className="text-[13px] tabular-nums text-gray-700/85 dark:text-white/70">{formatPrice(quote.price, quote.currency)}</span>
                    <ChangePill percent={quote.changePercent} />
                  </>
                ) : (
                  <span className="text-[12px] text-gray-400/60 dark:text-white/25">{loading ? "…" : "—"}</span>
                )}
              </div>

              {editing && (
                <button
                  type="button"
                  onClick={() => removeSymbol(symbol)}
                  aria-label={`Remove ${symbol}`}
                  className="p-1 -mr-1 rounded-lg text-gray-400/60 hover:text-red-400/80 transition-all duration-200 flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
