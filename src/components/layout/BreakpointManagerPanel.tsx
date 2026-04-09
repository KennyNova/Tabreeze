import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_VIEWPORT_DIM } from "../../layout/constants";
import { clamp } from "../../layout/tileGeometry";
import type { BreakpointProfile, LayoutMode } from "../../layout/types";

interface BreakpointManagerPanelProps {
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
  profiles: BreakpointProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (id: string) => void;
  onAddProfile: () => void;
  onRemoveProfile: (id: string) => void;
  onUpdateProfileRange: (id: string, range: BreakpointProfile["range"]) => void;
  onUpdateProfileLabel: (id: string, label: string) => void;
  /** Move a boundary between two adjacent profiles */
  onMoveBoundary?: (leftId: string, rightId: string, newBoundary: number) => void;
  viewportWidth: number;
  viewportHeight: number;
  disabled?: boolean;
}

export default function BreakpointManagerPanel({
  mode,
  onModeChange,
  profiles,
  selectedProfileId,
  onSelectProfile,
  onAddProfile,
  onRemoveProfile,
  onUpdateProfileRange,
  onUpdateProfileLabel,
  onMoveBoundary,
  viewportWidth,
  viewportHeight,
  disabled,
}: BreakpointManagerPanelProps) {
  const selected = profiles.find((p) => p.id === selectedProfileId);
  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => a.range.minWidth - b.range.minWidth || a.range.minHeight - b.range.minHeight),
    [profiles]
  );

  const rightmostBoundary = useMemo(() => {
    if (sortedProfiles.length <= 1) return 0;
    return sortedProfiles.slice(0, -1).reduce((max, p) => Math.max(max, p.range.maxWidth), 0);
  }, [sortedProfiles]);

  const monitorWidth = useMemo(() => {
    if (typeof window === "undefined") return Math.max(1200, Math.round(viewportWidth));
    const fromScreen = window.screen?.availWidth ?? window.screen?.width ?? viewportWidth;
    return Math.max(1200, Math.round(fromScreen));
  }, [viewportWidth]);

  const baseSliderMax = useMemo(() => {
    const desired = Math.max(monitorWidth, Math.round(viewportWidth * 1.1), rightmostBoundary + 200);
    return clamp(Math.ceil(desired / 100) * 100, 1000, MAX_VIEWPORT_DIM);
  }, [monitorWidth, viewportWidth, rightmostBoundary]);

  const [sliderMax, setSliderMax] = useState(baseSliderMax);

  // Keep timeline sensible for typical monitor size instead of jumping to MAX_VIEWPORT_DIM.
  useEffect(() => {
    setSliderMax((prev) => (prev < baseSliderMax ? baseSliderMax : prev));
  }, [baseSliderMax]);

  // If a boundary approaches the end of the timeline, extend the max for continued editing.
  useEffect(() => {
    if (rightmostBoundary < sliderMax * 0.9 || sliderMax >= MAX_VIEWPORT_DIM) return;
    const growBy = Math.max(400, Math.round(monitorWidth * 0.35));
    const next = clamp(Math.ceil(Math.max(sliderMax + growBy, sliderMax * 1.25) / 100) * 100, 1000, MAX_VIEWPORT_DIM);
    if (next > sliderMax) setSliderMax(next);
  }, [rightmostBoundary, sliderMax, monitorWidth]);

  const trackRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<{
    leftId: string;
    rightId: string;
    pointerId: number;
    startX: number;
    startBoundary: number;
    minBound: number;
    maxBound: number;
  } | null>(null);

  useEffect(() => {
    if (!dragState || disabled) return;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const deltaPx = event.clientX - dragState.startX;
      const deltaValue = Math.round((deltaPx / rect.width) * sliderMax / 10) * 10;
      const newBoundary = clamp(dragState.startBoundary + deltaValue, dragState.minBound, dragState.maxBound);
      onMoveBoundary?.(dragState.leftId, dragState.rightId, newBoundary);
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return;
      setDragState(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [dragState, disabled, onMoveBoundary, sliderMax]);

  const startBoundaryDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    leftProfile: BreakpointProfile,
    rightProfile: BreakpointProfile
  ) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const boundary = leftProfile.range.maxWidth;
    const minBound = leftProfile.range.minWidth + 50;
    const maxBound = rightProfile.range.maxWidth - 50;
    setDragState({
      leftId: leftProfile.id,
      rightId: rightProfile.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startBoundary: boundary,
      minBound: Math.max(10, minBound),
      maxBound: Math.min(MAX_VIEWPORT_DIM - 10, maxBound),
    });
  };

  const getColor = (index: number): string => BREAKPOINT_COLORS[index % BREAKPOINT_COLORS.length];
  const selectedColor =
    mode === "customBreakpoints"
      ? getColor(Math.max(0, sortedProfiles.findIndex((p) => p.id === selectedProfileId)))
      : "#10b981";

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl overflow-hidden border transition-colors duration-300"
        style={{ borderColor: `${selectedColor}44` }}
      >
        <div className="flex">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange("reactive")}
            className={`flex-1 py-3.5 text-center text-sm font-semibold transition-all relative ${
              mode === "reactive"
                ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                : "bg-white/40 dark:bg-white/[0.06] text-gray-500/80 dark:text-white/45 hover:bg-white/60 dark:hover:bg-white/10"
            }`}
          >
            Reactive
            {mode === "reactive" && (
              <div className="absolute bottom-0 inset-x-0 h-[3px] bg-emerald-500 rounded-t" />
            )}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange("customBreakpoints")}
            className={`flex-1 py-3.5 text-center text-sm font-semibold transition-all relative ${
              mode === "customBreakpoints"
                ? "text-gray-900 dark:text-white/90"
                : "bg-white/40 dark:bg-white/[0.06] text-gray-500/80 dark:text-white/45 hover:bg-white/60 dark:hover:bg-white/10"
            }`}
            style={mode === "customBreakpoints" ? { backgroundColor: `${selectedColor}25` } : undefined}
          >
            Custom Breakpoints
            {mode === "customBreakpoints" && (
              <div className="absolute bottom-0 inset-x-0 h-[3px] rounded-t" style={{ backgroundColor: selectedColor }} />
            )}
          </button>
        </div>
      </div>

      {mode === "customBreakpoints" && (
        <div
          className="rounded-2xl p-4 border space-y-4 transition-colors duration-300"
          style={{
            borderColor: `${selectedColor}55`,
            background: `linear-gradient(135deg, ${selectedColor}18, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.04))`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs rounded-lg px-3 py-1.5 bg-black/[0.04] dark:bg-white/[0.06] text-gray-600 dark:text-white/50 tabular-nums space-y-0.5">
              <div>
                Viewport: <span className="font-semibold text-amber-700/90 dark:text-amber-200/90">{Math.round(viewportWidth)}×{Math.round(viewportHeight)}</span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-white/40">
                Timeline max: <span className="font-semibold">{sliderMax}px</span>
              </div>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={onAddProfile}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-800 dark:text-rose-200 hover:bg-rose-500/30 transition-colors"
            >
              + Add breakpoint
            </button>
          </div>

          <div
            ref={trackRef}
            className="relative h-14 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.05] overflow-visible"
          >
            {sortedProfiles.map((p, index) => {
              const color = getColor(index);
              const leftPct = (p.range.minWidth / sliderMax) * 100;
              const rightPct = (Math.min(p.range.maxWidth, sliderMax) / sliderMax) * 100;
              const widthPct = Math.max(rightPct - leftPct, 1);
              const isSelected = p.id === selectedProfileId;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectProfile(p.id)}
                  className={`absolute top-0 bottom-0 flex items-center justify-center text-[10px] font-semibold text-white/95 transition-all ${
                    index === 0 ? "rounded-l-xl" : ""
                  } ${index === sortedProfiles.length - 1 ? "rounded-r-xl" : ""} ${
                    isSelected ? "z-20 ring-2 ring-white/90 dark:ring-white/70" : "z-10 hover:brightness-110"
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: isSelected ? color : `${color}aa`,
                  }}
                  title={`${p.label}: ${p.range.minWidth}–${p.range.maxWidth}px`}
                >
                  <span className="truncate px-1.5">{p.label}</span>
                </button>
              );
            })}

            {sortedProfiles.map((p, index) => {
              if (index >= sortedProfiles.length - 1) return null;
              const rightProfile = sortedProfiles[index + 1];
              const boundaryPx = p.range.maxWidth;
              const leftPct = (boundaryPx / sliderMax) * 100;
              return (
                <button
                  key={`boundary-${p.id}`}
                  type="button"
                  disabled={disabled}
                  onPointerDown={(e) => startBoundaryDrag(e, p, rightProfile)}
                  className="absolute top-[-4px] bottom-[-4px] w-4 -translate-x-1/2 z-40 cursor-ew-resize flex items-center justify-center group"
                  style={{ left: `${leftPct}%` }}
                  title={`Drag to move boundary (${boundaryPx}px)`}
                >
                  <div className="w-1 h-8 rounded-full bg-white/90 dark:bg-white/80 shadow-md group-hover:bg-white group-hover:h-10 transition-all border border-black/20 dark:border-white/30" />
                </button>
              );
            })}

            <div
              className="absolute top-0 bottom-0 w-[2px] bg-emerald-500 z-50 pointer-events-none"
              style={{ left: `${clamp((viewportWidth / sliderMax) * 100, 0, 100)}%` }}
              title={`Viewport ${Math.round(viewportWidth)}px`}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {Math.round(viewportWidth)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {sortedProfiles.map((p, index) => {
              const active = p.id === selectedProfileId;
              const color = getColor(index);
              return (
                <div key={p.id} className="flex items-center gap-0.5">
                  <div
                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all inline-flex items-center gap-1 ${
                      active ? "ring-2 shadow-sm" : "opacity-85"
                    }`}
                    style={{
                      backgroundColor: active ? `${color}30` : "rgba(255,255,255,0.35)",
                      color: active ? color : "inherit",
                      ...(active ? { boxShadow: `0 0 0 2px ${color}88` } : {}),
                    }}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onSelectProfile(p.id)}
                      className="inline-flex items-center gap-1 focus:outline-none"
                      title="Select breakpoint"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    </button>
                    <input
                      type="text"
                      disabled={disabled}
                      value={p.label}
                      onFocus={() => onSelectProfile(p.id)}
                      onChange={(e) => onUpdateProfileLabel(p.id, e.target.value)}
                      className="bg-transparent border-none outline-none text-[10px] font-medium min-w-[66px] max-w-[120px]"
                      aria-label={`Rename ${p.label}`}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={disabled || profiles.length <= 1}
                    title="Remove"
                    onClick={() => onRemoveProfile(p.id)}
                    className="w-5 h-5 rounded text-[10px] text-rose-600/70 dark:text-rose-300/70 hover:bg-rose-500/20 disabled:opacity-25 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {selected && (
            <div className="rounded-xl p-3 bg-white/35 dark:bg-white/[0.07] border border-white/40 dark:border-white/10 space-y-3">
              <label className="block text-xs">
                <span className="text-gray-600 dark:text-white/50">Breakpoint name</span>
                <input
                  type="text"
                  disabled={disabled}
                  value={selected.label}
                  onChange={(e) => onUpdateProfileLabel(selected.id, e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl text-sm bg-white/70 dark:bg-white/10 border border-black/10 dark:border-white/10"
                />
              </label>

              <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-white/50">
                <span>
                  Width: <span className="tabular-nums font-semibold">{selected.range.minWidth}–{selected.range.maxWidth}px</span>
                </span>
                <span className="text-gray-400 dark:text-white/25">|</span>
                <span>
                  Cols: <span className="font-semibold">{selected.grid.cols}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RangeSliders
                  label="Height (px)"
                  minKey="minHeight"
                  maxKey="maxHeight"
                  profile={selected}
                  disabled={disabled}
                  onUpdate={onUpdateProfileRange}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BREAKPOINT_COLORS = [
  "#ec4899",
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
];

function RangeSliders({
  label,
  minKey,
  maxKey,
  profile,
  disabled,
  onUpdate,
}: {
  label: string;
  minKey: "minWidth" | "minHeight";
  maxKey: "maxWidth" | "maxHeight";
  profile: BreakpointProfile;
  disabled?: boolean;
  onUpdate: (id: string, range: BreakpointProfile["range"]) => void;
}) {
  const r = profile.range;
  const minVal = r[minKey];
  const maxVal = r[maxKey];

  const setMin = (v: number) => {
    const nextMin = clamp(v, 0, MAX_VIEWPORT_DIM);
    let nextMax = maxVal;
    if (nextMax < nextMin) nextMax = nextMin;
    onUpdate(profile.id, { ...r, [minKey]: nextMin, [maxKey]: nextMax });
  };

  const setMax = (v: number) => {
    let nextMax = clamp(v, 0, MAX_VIEWPORT_DIM);
    let nextMin = minVal;
    if (nextMax < nextMin) nextMin = nextMax;
    onUpdate(profile.id, { ...r, [minKey]: nextMin, [maxKey]: nextMax });
  };

  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-600 dark:text-white/45 mb-2">{label}</div>
      <label className="block text-[10px] text-gray-500 dark:text-white/40 mb-1">
        Min: <span className="tabular-nums text-fuchsia-700 dark:text-fuchsia-300">{minVal}</span>
      </label>
      <input
        type="range"
        min={0}
        max={MAX_VIEWPORT_DIM}
        step={10}
        disabled={disabled}
        value={minVal}
        onChange={(e) => setMin(Number(e.target.value))}
        className="w-full accent-fuchsia-600"
      />
      <label className="block text-[10px] text-gray-500 dark:text-white/40 mt-2 mb-1">
        Max: <span className="tabular-nums text-amber-700 dark:text-amber-300">{maxVal}</span>
      </label>
      <input
        type="range"
        min={0}
        max={MAX_VIEWPORT_DIM}
        step={10}
        disabled={disabled}
        value={maxVal}
        onChange={(e) => setMax(Number(e.target.value))}
        className="w-full accent-amber-600"
      />
    </div>
  );
}
