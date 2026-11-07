import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  HISTORY_RANGES,
  fetchHistory,
  formatCompact,
  formatPrice,
  type HistoryRange,
  type StockHistory,
} from "../services/stocks";

const RANGE_KEY = "dashboard-stocks-detail-range";
const UP_COLOR = "#10b981";
const DOWN_COLOR = "#f43f5e";
const CHART_HEIGHT = 260;
const PAD = { top: 12, right: 56, bottom: 26, left: 4 };

const INTRADAY: HistoryRange[] = ["1d", "5d", "1mo"];

function loadRange(): HistoryRange {
  try {
    const raw = localStorage.getItem(RANGE_KEY);
    if (raw && HISTORY_RANGES.some((r) => r.id === raw)) return raw as HistoryRange;
  } catch {}
  return "1d";
}

function formatPointTime(t: number, range: HistoryRange, timeZone: string): string {
  const opts: Intl.DateTimeFormatOptions =
    range === "1d"
      ? { hour: "numeric", minute: "2-digit" }
      : INTRADAY.includes(range)
        ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
        : range === "max" || range === "5y"
          ? { month: "short", year: "numeric" }
          : { month: "short", day: "numeric", year: "numeric" };
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone }).format(t);
  } catch {
    return new Date(t).toLocaleString();
  }
}

function formatAxisTime(t: number, range: HistoryRange, timeZone: string): string {
  const opts: Intl.DateTimeFormatOptions =
    range === "1d"
      ? { hour: "numeric", minute: "2-digit" }
      : range === "5d" || range === "1mo"
        ? { month: "short", day: "numeric" }
        : range === "max" || range === "5y"
          ? { year: "numeric" }
          : { month: "short", year: "2-digit" };
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone }).format(t);
  } catch {
    return "";
  }
}

function signed(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

function ChangeText({ from, to, currency, className = "" }: { from: number; to: number; currency: string; className?: string }) {
  const diff = to - from;
  const pct = from ? (diff / from) * 100 : 0;
  const up = diff >= 0;
  return (
    <span className={`tabular-nums font-medium ${className}`} style={{ color: up ? UP_COLOR : DOWN_COLOR }}>
      {up ? "▲" : "▼"} {signed(diff)} ({signed(pct)}%)
      <span className="sr-only"> {currency}</span>
    </span>
  );
}

interface ChartProps {
  history: StockHistory;
  hoverIndex: number | null;
  selection: [number, number] | null;
  onHover: (index: number | null) => void;
  onSelect: (sel: [number, number] | null) => void;
}

function HistoryChart({ history, hoverIndex, selection, onHover, onSelect }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const dragStart = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points, baseline, range, timeZone } = history;
  const innerW = width - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const showBaseline = range === "1d";

  const geo = useMemo(() => {
    const closes = points.map((p) => p.close);
    let min = Math.min(...closes, ...(showBaseline ? [baseline] : []));
    let max = Math.max(...closes, ...(showBaseline ? [baseline] : []));
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const padY = (max - min) * 0.08;
    min -= padY;
    max += padY;
    const n = points.length;
    const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH;
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join(" ");
    const area = n ? `${line} L${x(n - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z` : "";
    const yTicks = [0, 0.5, 1].map((f) => min + padY + (max - min - 2 * padY) * f);
    const xTickCount = Math.max(2, Math.min(5, Math.floor(innerW / 120)));
    const xTicks = n > 1 ? Array.from({ length: xTickCount }, (_, k) => Math.round((k / (xTickCount - 1)) * (n - 1))) : [];
    return { x, y, line, area, yTicks, xTicks };
  }, [points, baseline, showBaseline, innerW, innerH]);

  if (points.length === 0) {
    return <div className="h-[260px] flex items-center justify-center text-sm opacity-50">No data for this range</div>;
  }

  const startClose = baseline;
  const endClose = points[points.length - 1]!.close;
  const color = endClose >= startClose ? UP_COLOR : DOWN_COLOR;

  const indexFromEvent = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const f = (px - PAD.left) / innerW;
    return Math.max(0, Math.min(points.length - 1, Math.round(f * (points.length - 1))));
  };

  const sel = selection ? ([Math.min(...selection), Math.max(...selection)] as [number, number]) : null;
  const selColor = sel && points[sel[1]]!.close >= points[sel[0]]!.close ? UP_COLOR : DOWN_COLOR;
  const hp = hoverIndex !== null ? points[hoverIndex] : null;
  const gradId = `stock-grad-${history.symbol.replace(/[^A-Za-z0-9]/g, "")}`;

  return (
    <div ref={wrapRef} className="w-full select-none">
      <svg
        width={width}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        className="block touch-none cursor-crosshair"
        onPointerMove={(e) => {
          const i = indexFromEvent(e);
          onHover(i);
          if (dragStart.current !== null && i !== dragStart.current) onSelect([dragStart.current, i]);
        }}
        onPointerLeave={() => {
          if (dragStart.current === null) onHover(null);
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragStart.current = indexFromEvent(e);
          onSelect(null);
        }}
        onPointerUp={() => {
          dragStart.current = null;
        }}
        onDoubleClick={() => onSelect(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {geo.yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={geo.y(v)} y2={geo.y(v)} stroke="currentColor" strokeOpacity={0.07} />
            {!(showBaseline && Math.abs(geo.y(v) - geo.y(baseline)) < 14) && (
              <text x={PAD.left + innerW + 8} y={geo.y(v) + 3.5} fontSize={10.5} fill="currentColor" fillOpacity={0.45} className="tabular-nums">
                {v.toFixed(v >= 1000 ? 0 : 2)}
              </text>
            )}
          </g>
        ))}
        {geo.xTicks.map((i, k) => (
          <text
            key={`${i}-${k}`}
            x={geo.x(i)}
            y={CHART_HEIGHT - 8}
            fontSize={10.5}
            fill="currentColor"
            fillOpacity={0.45}
            textAnchor={k === 0 ? "start" : k === geo.xTicks.length - 1 ? "end" : "middle"}
          >
            {formatAxisTime(points[i]!.t, range, timeZone)}
          </text>
        ))}

        {showBaseline && (
          <g>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={geo.y(baseline)} y2={geo.y(baseline)} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 4" />
            <text x={PAD.left + innerW + 8} y={geo.y(baseline) + 3.5} fontSize={9.5} fill="currentColor" fillOpacity={0.55}>
              {baseline.toFixed(baseline >= 1000 ? 0 : 2)}
            </text>
            <text x={PAD.left + 4} y={geo.y(baseline) - 4} fontSize={9.5} fill="currentColor" fillOpacity={0.5}>
              Prev close
            </text>
          </g>
        )}

        {sel && (
          <rect
            x={geo.x(sel[0])}
            y={PAD.top}
            width={Math.max(1, geo.x(sel[1]) - geo.x(sel[0]))}
            height={innerH}
            fill={selColor}
            fillOpacity={0.1}
          />
        )}

        <path d={geo.area} fill={`url(#${gradId})`} />
        <path d={geo.line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

        {sel &&
          sel.map((i) => (
            <g key={`sel-${i}`}>
              <line x1={geo.x(i)} x2={geo.x(i)} y1={PAD.top} y2={PAD.top + innerH} stroke={selColor} strokeOpacity={0.6} />
              <circle cx={geo.x(i)} cy={geo.y(points[i]!.close)} r={3.5} fill={selColor} />
            </g>
          ))}

        {hp && hoverIndex !== null && !sel && (
          <g pointerEvents="none">
            <line x1={geo.x(hoverIndex)} x2={geo.x(hoverIndex)} y1={PAD.top} y2={PAD.top + innerH} stroke="currentColor" strokeOpacity={0.3} />
            <circle cx={geo.x(hoverIndex)} cy={geo.y(hp.close)} r={4.5} fill={color} stroke="var(--theme-bg, #fff)" strokeWidth={2} />
          </g>
        )}
      </svg>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b" style={{ borderColor: "color-mix(in srgb, var(--theme-border) 45%, transparent)" }}>
      <span className="text-[12px] opacity-55">{label}</span>
      <span className="text-[12.5px] tabular-nums font-medium">{value}</span>
    </div>
  );
}

export default function StockDetailModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [range, setRange] = useState<HistoryRange>(loadRange);
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selection, setSelection] = useState<[number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHoverIndex(null);
    setSelection(null);
    fetchHistory(symbol, range)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    try {
      localStorage.setItem(RANGE_KEY, range);
    } catch {}
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selection) setSelection(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, selection]);

  const points = history?.points ?? [];
  const stats = useMemo(() => {
    if (!points.length) return null;
    const closes = points.map((p) => p.close);
    const highs = points.map((p) => p.high ?? p.close);
    const lows = points.map((p) => p.low ?? p.close);
    const vols = points.map((p) => p.volume ?? 0);
    return {
      rangeHigh: Math.max(...highs),
      rangeLow: Math.min(...lows),
      open: points[0]!.open ?? closes[0]!,
      totalVolume: vols.reduce((a, b) => a + b, 0),
    };
  }, [points]);

  const rangeLabel = HISTORY_RANGES.find((r) => r.id === range)?.label ?? range;
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const sel = selection ? ([Math.min(...selection), Math.max(...selection)] as [number, number]) : null;
  const lastClose = points[points.length - 1]?.close ?? history?.price ?? 0;

  // Header reflects selection > hover > latest
  let headlinePrice = history?.price ?? 0;
  let changeFrom = history?.baseline ?? 0;
  let changeTo = range === "1d" ? history?.price ?? 0 : lastClose;
  let caption = range === "1d" ? "Today" : `Past ${rangeLabel}`;
  if (history && sel) {
    const a = points[sel[0]]!;
    const b = points[sel[1]]!;
    headlinePrice = b.close;
    changeFrom = a.close;
    changeTo = b.close;
    caption = `${formatPointTime(a.t, range, history.timeZone)} → ${formatPointTime(b.t, range, history.timeZone)}`;
  } else if (history && hovered) {
    headlinePrice = hovered.close;
    changeTo = hovered.close;
    caption = `${formatPointTime(hovered.t, range, history.timeZone)} · vs ${range === "1d" ? "prev close" : `start of ${rangeLabel}`}`;
  }

  return createPortal(
    <div className="fixed inset-0 z-[185] flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
      <button type="button" aria-label="Close stock details" className="absolute inset-0 bg-black/45 dark:bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${symbol} details`}
        className="relative z-10 w-full max-w-3xl my-6 rounded-3xl border shadow-2xl backdrop-blur-xl p-5 sm:p-6"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-border) 72%, transparent)",
          background: "color-mix(in srgb, var(--theme-bg) 95%, transparent)",
          color: "var(--theme-text)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-semibold">{symbol}</h2>
              {history?.exchange && <span className="text-[11px] opacity-45">{history.exchange}</span>}
            </div>
            <div className="text-[13px] opacity-60 truncate">{history?.name ?? " "}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-3 min-h-[56px]">
          {history && (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-semibold tabular-nums">{formatPrice(headlinePrice, history.currency)}</span>
                <ChangeText from={changeFrom} to={changeTo} currency={history.currency} className="text-[14px]" />
              </div>
              <div className="text-[12px] opacity-50 mt-0.5">
                {caption}
                {hovered && !sel && hovered.volume ? ` · Vol ${formatCompact(hovered.volume)}` : ""}
              </div>
            </>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex rounded-xl p-0.5 bg-black/[0.04] dark:bg-white/[0.06]" role="tablist" aria-label="Chart range">
            {HISTORY_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={range === r.id}
                onClick={() => setRange(r.id)}
                className={`px-2.5 py-1 text-[12px] rounded-[10px] font-medium transition-all ${
                  range === r.id ? "bg-white dark:bg-white/[0.14] shadow-sm" : "opacity-55 hover:opacity-90"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] opacity-40">{sel ? "Esc or double-click to clear" : "Drag on the chart to compare two points"}</span>
        </div>

        <div className="mt-3 relative">
          {error && !history ? (
            <div className="h-[260px] flex items-center justify-center text-sm opacity-60">{error}</div>
          ) : history ? (
            <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
              <HistoryChart history={history} hoverIndex={hoverIndex} selection={selection} onHover={setHoverIndex} onSelect={setSelection} />
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-sm opacity-50">Loading…</div>
          )}
        </div>

        {history && stats && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-x-6">
            {range === "1d" ? (
              <Stat label="Prev close" value={formatPrice(history.baseline, history.currency)} />
            ) : (
              <Stat label={`${rangeLabel} volume`} value={formatCompact(stats.totalVolume || null)} />
            )}
            <Stat label={range === "1d" ? "Open" : `${rangeLabel} start`} value={formatPrice(stats.open, history.currency)} />
            <Stat label="Volume" value={formatCompact(history.volume)} />
            <Stat label="Day high" value={history.dayHigh !== null ? formatPrice(history.dayHigh, history.currency) : "—"} />
            <Stat label={`${rangeLabel} high`} value={formatPrice(stats.rangeHigh, history.currency)} />
            <Stat label="52-wk high" value={history.fiftyTwoWeekHigh !== null ? formatPrice(history.fiftyTwoWeekHigh, history.currency) : "—"} />
            <Stat label="Day low" value={history.dayLow !== null ? formatPrice(history.dayLow, history.currency) : "—"} />
            <Stat label={`${rangeLabel} low`} value={formatPrice(stats.rangeLow, history.currency)} />
            <Stat label="52-wk low" value={history.fiftyTwoWeekLow !== null ? formatPrice(history.fiftyTwoWeekLow, history.currency) : "—"} />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
