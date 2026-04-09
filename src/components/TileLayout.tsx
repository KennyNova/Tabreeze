import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import Greeting from "./Greeting";
import SearchBar from "./SearchBar";
import BookmarksGrid from "./BookmarksGrid";
import QuotesWidget from "./QuotesWidget";
import TasksWidget from "./TasksWidget";
import CalendarWidget from "./CalendarWidget";
import WeatherWidget from "./WeatherWidget";
import BreakpointManagerPanel from "./layout/BreakpointManagerPanel";
import GridConfigPanel from "./layout/GridConfigPanel";
import { createDefaultLayoutConfigV2, defaultTileLayout } from "../layout/constants";
import {
  createDefaultProfilesFromLayout,
  createNewBreakpointProfile,
  fallbackProfile,
  findMatchingProfile,
  repairProfileRanges,
} from "../layout/breakpoints";
import { ANIMATION_STYLES, deriveReactiveGrid, effectiveReactiveCols, REACTIVE_PRESETS } from "../layout/reactive";
import { loadLayoutConfig, saveLayoutConfig } from "../layout/storage";
import {
  clamp,
  generateTileId,
  layoutForDisplay,
  normalizeLayout,
  remapLayoutToGridCols,
  resolveCollisions,
} from "../layout/tileGeometry";
import type { AiProvider, AnimationStyle, GridSpec, LayoutConfigV2, ReactivePreset, TileItem, WidgetConstraintsMap, WidgetType } from "../layout/types";

interface WidgetDefinition {
  label: string;
  defaultColSpan: number;
  defaultRowSpan: number;
  minColSpan: number;
  maxColSpan: number;
  minRowSpan: number;
  maxRowSpan: number;
  render: (tile: Pick<TileItem, "type" | "colSpan" | "rowSpan" | "settings">) => ReactNode;
}

interface ResizeState {
  id: string;
  startX: number;
  startY: number;
  startColSpan: number;
  startRowSpan: number;
  stepX: number;
  stepY: number;
  minColSpan: number;
  maxColSpan: number;
  minRowSpan: number;
  maxRowSpan: number;
}

interface DragState {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tilt: number;
  width: number;
  height: number;
  type: WidgetType;
  colSpan: number;
  rowSpan: number;
  previewColStart: number;
  previewRowStart: number;
}

const widgetDefinitions: Record<WidgetType, WidgetDefinition> = {
  greeting: {
    label: "Greeting + Clock",
    defaultColSpan: 12,
    defaultRowSpan: 2,
    minColSpan: 6,
    maxColSpan: 12,
    minRowSpan: 2,
    maxRowSpan: 4,
    render: () => (
      <div className="h-full flex items-center justify-center px-2">
        <Greeting />
      </div>
    ),
  },
  search: {
    label: "Search Bar",
    defaultColSpan: 12,
    defaultRowSpan: 1,
    minColSpan: 4,
    maxColSpan: 12,
    minRowSpan: 1,
    maxRowSpan: 2,
    render: (tile) => (
      <div className="h-full flex items-center justify-center px-2">
        <SearchBar provider={tile.settings?.searchProvider ?? "chatgpt"} />
      </div>
    ),
  },
  bookmarks: {
    label: "Bookmarks",
    defaultColSpan: 12,
    defaultRowSpan: 2,
    minColSpan: 4,
    maxColSpan: 12,
    minRowSpan: 1,
    maxRowSpan: 5,
    render: () => <BookmarksGrid />,
  },
  quotes: {
    label: "Quotes / News",
    defaultColSpan: 12,
    defaultRowSpan: 2,
    minColSpan: 3,
    maxColSpan: 12,
    minRowSpan: 2,
    maxRowSpan: 5,
    render: () => <QuotesWidget />,
  },
  tasks: {
    label: "Tasks",
    defaultColSpan: 6,
    defaultRowSpan: 3,
    minColSpan: 3,
    maxColSpan: 12,
    minRowSpan: 2,
    maxRowSpan: 5,
    render: () => <TasksWidget />,
  },
  calendar: {
    label: "Calendar",
    defaultColSpan: 6,
    defaultRowSpan: 3,
    minColSpan: 3,
    maxColSpan: 12,
    minRowSpan: 2,
    maxRowSpan: 5,
    render: () => <CalendarWidget />,
  },
  weather: {
    label: "Weather",
    defaultColSpan: 4,
    defaultRowSpan: 1,
    minColSpan: 2,
    maxColSpan: 6,
    minRowSpan: 1,
    maxRowSpan: 4,
    render: (tile) => (
      <div className="h-full w-full flex items-stretch">
        <WeatherWidget rowSpan={tile.rowSpan} colSpan={tile.colSpan} />
      </div>
    ),
  },
};

function buildWidgetConstraints(): WidgetConstraintsMap {
  const m = {} as WidgetConstraintsMap;
  (Object.keys(widgetDefinitions) as WidgetType[]).forEach((k) => {
    const d = widgetDefinitions[k];
    m[k] = {
      minColSpan: d.minColSpan,
      maxColSpan: d.maxColSpan,
      minRowSpan: d.minRowSpan,
      maxRowSpan: d.maxRowSpan,
      defaultColSpan: d.defaultColSpan,
      defaultRowSpan: d.defaultRowSpan,
    };
  });
  return m;
}

const widgetConstraints = buildWidgetConstraints();
const BREAKPOINT_ACCENTS = ["#ec4899", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
const SEARCH_PROVIDERS: AiProvider[] = ["chatgpt", "claude"];
const SEARCH_PROVIDER_LABELS: Record<AiProvider, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
};

function cloneConfig(c: LayoutConfigV2): LayoutConfigV2 {
  return JSON.parse(JSON.stringify(c)) as LayoutConfigV2;
}

function renderWidgetIcon(type: WidgetType): ReactNode {
  if (type === "greeting") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>;
  if (type === "search") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 21l-4.3-4.3m1.3-4.7a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>;
  if (type === "bookmarks") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" /></svg>;
  if (type === "quotes") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 8h6M7 12h10M7 16h5M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>;
  if (type === "tasks") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01" /></svg>;
  if (type === "calendar") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 3v3m8-3v3M4 9h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 15a4 4 0 014-4 5 5 0 019.6-1.5A3.5 3.5 0 0117.5 17H6a3 3 0 01-3-2z" /></svg>;
}

function TileContent({ tile }: { tile: Pick<TileItem, "type" | "colSpan" | "rowSpan" | "settings"> }) {
  const rendered = useMemo(
    () => widgetDefinitions[tile.type].render({ type: tile.type, colSpan: tile.colSpan, rowSpan: tile.rowSpan, settings: tile.settings }),
    [tile.colSpan, tile.rowSpan, tile.settings, tile.type]
  );
  return <div className="h-full min-h-0 [&>.widget-card]:h-full [&>.widget-card]:min-h-0">{rendered}</div>;
}

function EditButton({ icon, title, onClick, disabled }: { icon: ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 bg-black/[0.04] dark:bg-white/[0.08] text-gray-600/80 dark:text-white/70 disabled:opacity-35 disabled:cursor-not-allowed">
      {icon}
    </button>
  );
}

function MiniLayoutPreview({
  title,
  tiles,
  cols,
  constraints,
  editable,
  onMoveTile,
  onResizeTile,
}: {
  title: string;
  tiles: TileItem[];
  cols: number;
  constraints: WidgetConstraintsMap;
  editable?: boolean;
  onMoveTile?: (id: string, colStart: number, rowStart: number) => void;
  onResizeTile?: (id: string, colSpan: number, rowSpan: number) => void;
}) {
  const maxRow = tiles.reduce((acc, tile) => Math.max(acc, tile.rowStart + tile.rowSpan - 1), 1);
  const rows = Math.max(6, Math.min(12, maxRow));
  const [previewTiles, setPreviewTiles] = useState<TileItem[]>(tiles);
  const [interaction, setInteraction] = useState<{
    kind: "move" | "resize";
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    startColStart: number;
    startRowStart: number;
    startColSpan: number;
    startRowSpan: number;
    nextColStart: number;
    nextRowStart: number;
    nextColSpan: number;
    nextRowSpan: number;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!interaction) setPreviewTiles(tiles);
  }, [tiles, interaction]);

  const visibleTiles = previewTiles.filter((tile) => tile.rowStart <= rows);
  const hueByType: Record<WidgetType, string> = {
    greeting: "from-indigo-500/70 to-blue-500/70",
    search: "from-cyan-500/70 to-sky-500/70",
    bookmarks: "from-violet-500/70 to-fuchsia-500/70",
    quotes: "from-amber-500/70 to-orange-500/70",
    tasks: "from-emerald-500/70 to-teal-500/70",
    calendar: "from-pink-500/70 to-rose-500/70",
    weather: "from-blue-500/70 to-indigo-500/70",
  };

  const updateInteractiveTile = (
    id: string,
    updater: (tile: TileItem) => TileItem
  ) => {
    setPreviewTiles((prev) => prev.map((tile) => (tile.id === id ? updater(tile) : tile)));
  };

  const startInteraction = (
    event: ReactPointerEvent<HTMLDivElement>,
    kind: "move" | "resize",
    tile: TileItem
  ) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const next = {
      kind,
      id: tile.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startColStart: tile.colStart,
      startRowStart: tile.rowStart,
      startColSpan: tile.colSpan,
      startRowSpan: tile.rowSpan,
      nextColStart: tile.colStart,
      nextRowStart: tile.rowStart,
      nextColSpan: tile.colSpan,
      nextRowSpan: tile.rowSpan,
    };
    setInteraction(next);
    setDraggingId(tile.id);
  };

  useEffect(() => {
    if (!interaction || !editable) return;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) return;
      const rect = previewFrameRef.current?.getBoundingClientRect();
      if (!rect) return;
      const stepX = rect.width / cols;
      const stepY = rect.height / rows;
      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      const colDelta = Math.round(dx / Math.max(stepX, 1));
      const rowDelta = Math.round(dy / Math.max(stepY, 1));

      if (interaction.kind === "move") {
        const maxColStart = Math.max(1, cols - interaction.startColSpan + 1);
        const maxRowStart = Math.max(1, rows - interaction.startRowSpan + 1);
        const nextColStart = clamp(interaction.startColStart + colDelta, 1, maxColStart);
        const nextRowStart = clamp(interaction.startRowStart + rowDelta, 1, maxRowStart);
        setInteraction((prev) => (prev ? { ...prev, nextColStart, nextRowStart } : prev));
        updateInteractiveTile(interaction.id, (tile) => ({
          ...tile,
          colStart: nextColStart,
          rowStart: nextRowStart,
        }));
        return;
      }

      const tile = previewTiles.find((t) => t.id === interaction.id);
      if (!tile) return;
      const def = constraints[tile.type];
      const maxColSpan = Math.min(def.maxColSpan, cols - interaction.startColStart + 1);
      const maxRowSpan = Math.min(def.maxRowSpan, rows - interaction.startRowStart + 1);
      const minColSpan = Math.min(def.minColSpan, maxColSpan);
      const minRowSpan = Math.min(def.minRowSpan, maxRowSpan);
      const nextColSpan = clamp(interaction.startColSpan + colDelta, minColSpan, maxColSpan);
      const nextRowSpan = clamp(interaction.startRowSpan + rowDelta, minRowSpan, maxRowSpan);
      setInteraction((prev) => (prev ? { ...prev, nextColSpan, nextRowSpan } : prev));
      updateInteractiveTile(interaction.id, (t) => ({
        ...t,
        colSpan: nextColSpan,
        rowSpan: nextRowSpan,
      }));
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) return;
      if (interaction.kind === "move") {
        onMoveTile?.(interaction.id, interaction.nextColStart, interaction.nextRowStart);
      } else {
        onResizeTile?.(interaction.id, interaction.nextColSpan, interaction.nextRowSpan);
      }
      setInteraction(null);
      setDraggingId(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [interaction, editable, cols, rows, previewTiles, constraints, onMoveTile, onResizeTile]);

  return (
    <div className="rounded-2xl p-3 border border-black/10 dark:border-white/10 bg-white/55 dark:bg-white/[0.06]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-600/90 dark:text-white/55">
          {title}
        </div>
        <div className="text-[10px] tabular-nums text-gray-500/80 dark:text-white/45">
          {cols} cols
        </div>
      </div>
      <div ref={previewFrameRef} className="relative aspect-[16/10] rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] bg-gradient-to-br from-white/70 to-white/40 dark:from-white/[0.07] dark:to-white/[0.03]">
        <div
          className="absolute inset-0 grid p-2 gap-1 touch-none"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols * rows }).map((_, idx) => (
            <div key={idx} className="rounded-[4px] border border-black/[0.04] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]" />
          ))}
        </div>

        <div className="absolute inset-0 p-2">
          {visibleTiles.map((tile) => {
            const colStart = clamp(tile.colStart, 1, cols);
            const colEnd = clamp(tile.colStart + tile.colSpan - 1, colStart, cols);
            const rowStart = clamp(tile.rowStart, 1, rows);
            const rowEnd = clamp(tile.rowStart + tile.rowSpan - 1, rowStart, rows);
            const left = ((colStart - 1) / cols) * 100;
            const top = ((rowStart - 1) / rows) * 100;
            const width = ((colEnd - colStart + 1) / cols) * 100;
            const height = ((rowEnd - rowStart + 1) / rows) * 100;
            return (
              <div
                key={tile.id}
                className={`absolute rounded-md bg-gradient-to-br ${hueByType[tile.type]} border border-white/40 dark:border-white/25 shadow-sm ${editable ? "cursor-move" : ""} ${draggingId === tile.id ? "ring-2 ring-white/70 dark:ring-white/60 z-10" : ""}`}
                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                title={widgetDefinitions[tile.type].label}
                onPointerDown={(event) => startInteraction(event, "move", tile)}
              >
                <div className="absolute inset-0 flex items-center justify-center text-white/95 [&>svg]:w-3 [&>svg]:h-3">
                  {renderWidgetIcon(tile.type)}
                </div>
                {editable && (
                  <div
                    className="absolute right-0.5 bottom-0.5 w-2.5 h-2.5 rounded-[3px] bg-white/85 dark:bg-white/75 border border-black/15 cursor-nwse-resize"
                    onPointerDown={(event) => startInteraction(event, "resize", tile)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 text-[10px] text-gray-500/75 dark:text-white/40">
        {editable ? "Drag cards to move. Use corner handle to resize." : `Top ${rows} rows shown`}
      </div>
    </div>
  );
}

export default function TileLayout() {
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfigV2>(() => loadLayoutConfig(widgetConstraints));
  const [savedConfig, setSavedConfig] = useState<LayoutConfigV2>(() => cloneConfig(loadLayoutConfig(widgetConstraints)));
  const [editMode, setEditMode] = useState(false);
  const [showLayoutSettingsModal, setShowLayoutSettingsModal] = useState(false);
  const [layoutSettingsSnapshot, setLayoutSettingsSnapshot] = useState<LayoutConfigV2 | null>(null);
  const [viewport, setViewport] = useState({ w: typeof window !== "undefined" ? window.innerWidth : 1200, h: typeof window !== "undefined" ? window.innerHeight : 800 });
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);

  const editModeRef = useRef(editMode);
  const viewportRef = useRef(viewport);
  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!editMode) setShowLayoutSettingsModal(false);
  }, [editMode]);

  useEffect(() => {
    if (!showLayoutSettingsModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLayoutSettingsDiscard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showLayoutSettingsModal]);

  const openLayoutSettingsModal = () => {
    setLayoutSettingsSnapshot(cloneConfig(layoutConfig));
    setShowLayoutSettingsModal(true);
  };

  const closeLayoutSettingsDiscard = () => {
    if (layoutSettingsSnapshot) {
      setLayoutConfig(layoutSettingsSnapshot);
    }
    setLayoutSettingsSnapshot(null);
    setShowLayoutSettingsModal(false);
  };

  const applyLayoutSettingsChanges = () => {
    setLayoutSettingsSnapshot(null);
    setShowLayoutSettingsModal(false);
  };

  const liveMatchedProfile = useMemo(
    () =>
      findMatchingProfile(layoutConfig.custom.profiles, viewport.w, viewport.h) ??
      fallbackProfile(layoutConfig.custom.profiles),
    [layoutConfig.custom.profiles, viewport.w, viewport.h]
  );

  const selectedProfile = useMemo(
    () => layoutConfig.custom.profiles.find((p) => p.id === layoutConfig.custom.selectedProfileId) ?? null,
    [layoutConfig.custom.profiles, layoutConfig.custom.selectedProfileId]
  );

  const activeDataProfile = useMemo(() => {
    if (layoutConfig.mode !== "customBreakpoints") return null;
    if (editMode && selectedProfile) return selectedProfile;
    return liveMatchedProfile;
  }, [layoutConfig.mode, editMode, selectedProfile, liveMatchedProfile]);

  const gridSpec = useMemo(() => {
    if (layoutConfig.mode === "reactive") {
      const spec = deriveReactiveGrid(viewport.w, viewport.h, layoutConfig.reactive.preset);
      const cols = effectiveReactiveCols(
        layoutConfig.reactive.preferredGridCols,
        viewport.w,
        viewport.h,
        layoutConfig.reactive.preset
      );
      return { cols, rowHeight: spec.rowHeight, gap: spec.gap };
    }
    if (activeDataProfile) return activeDataProfile.grid;
    return { cols: 12, rowHeight: 110, gap: 16 };
  }, [layoutConfig.mode, layoutConfig.reactive.preferredGridCols, layoutConfig.reactive.preset, viewport.w, viewport.h, activeDataProfile]);

  const activeGridCols = gridSpec.cols;
  const gridRowPx = gridSpec.rowHeight;
  const gridGapPx = gridSpec.gap;

  /** Canonical tile list for current mode / active profile */
  const layoutSlice = useMemo(() => {
    if (layoutConfig.mode === "reactive") return layoutConfig.reactive.layout;
    return activeDataProfile?.layout ?? defaultTileLayout;
  }, [layoutConfig.mode, layoutConfig.reactive.layout, activeDataProfile?.layout]);

  /** Display-only clamp so narrow viewports do not permanently shrink saved spans */
  const layoutForView = useMemo(
    () => layoutForDisplay(layoutSlice, activeGridCols, widgetConstraints),
    [layoutSlice, activeGridCols]
  );

  const gridRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const draggingRef = useRef<DragState | null>(null);
  const dragAnimationRef = useRef<number | null>(null);
  const layoutRef = useRef<TileItem[]>(layoutForView);

  useEffect(() => {
    layoutRef.current = layoutForView;
  }, [layoutForView]);

  const setTiles = useCallback((updater: (prev: TileItem[]) => TileItem[]) => {
    setLayoutConfig((c) => {
      if (c.mode === "reactive") {
        return { ...c, reactive: { ...c.reactive, layout: updater(c.reactive.layout) } };
      }
      const vp = viewportRef.current;
      const matched =
        findMatchingProfile(c.custom.profiles, vp.w, vp.h) ?? fallbackProfile(c.custom.profiles);
      const sel = c.custom.selectedProfileId
        ? c.custom.profiles.find((p) => p.id === c.custom.selectedProfileId)
        : null;
      const prof = editModeRef.current && sel ? sel : matched;
      if (!prof) return c;
      const idx = c.custom.profiles.findIndex((p) => p.id === prof.id);
      if (idx < 0) return c;
      const nextProfiles = [...c.custom.profiles];
      nextProfiles[idx] = { ...nextProfiles[idx], layout: updater(nextProfiles[idx].layout) };
      return { ...c, custom: { ...c.custom, profiles: repairProfileRanges(nextProfiles) } };
    });
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onPointerMove = (event: PointerEvent) => {
      const dx = event.clientX - resizing.startX;
      const dy = event.clientY - resizing.startY;
      const colDelta = Math.round(dx / resizing.stepX);
      const rowDelta = Math.round(dy / resizing.stepY);
      setTiles((prev) =>
        prev.map((tile) => {
          if (tile.id !== resizing.id) return tile;
          const colSpan = clamp(resizing.startColSpan + colDelta, resizing.minColSpan, resizing.maxColSpan);
          const rowSpan = clamp(resizing.startRowSpan + rowDelta, resizing.minRowSpan, resizing.maxRowSpan);
          const maxColStart = Math.max(1, activeGridCols - colSpan + 1);
          return { ...tile, colSpan, rowSpan, colStart: clamp(tile.colStart, 1, maxColStart) };
        })
      );
    };
    const onPointerUp = () => setResizing(null);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [resizing, activeGridCols, setTiles]);

  useEffect(() => {
    if (!dragging) return;
    const tick = () => {
      const current = draggingRef.current;
      if (!current) return;
      current.vx = current.targetX - current.x;
      current.vy = current.targetY - current.y;
      current.x += current.vx * 0.55;
      current.y += current.vy * 0.55;
      current.tilt = clamp(current.vx * 0.04, -4, 4);
      setDragging({ ...current });
      dragAnimationRef.current = window.requestAnimationFrame(tick);
    };
    dragAnimationRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (dragAnimationRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationRef.current);
        dragAnimationRef.current = null;
      }
    };
  }, [dragging?.id]);

  useEffect(() => {
    if (!dragging?.id) return;
    const onPointerMove = (event: PointerEvent) => {
      const current = draggingRef.current;
      if (!current || event.pointerId !== current.pointerId || !gridRef.current) return;
      event.preventDefault();

      const gridRect = gridRef.current.getBoundingClientRect();
      const styles = window.getComputedStyle(gridRef.current);
      const colGap = parseFloat(styles.columnGap || "0") || gridGapPx;
      const rowGap = parseFloat(styles.rowGap || "0") || gridGapPx;
      const cellWidth =
        activeGridCols > 0 ? (gridRect.width - colGap * (activeGridCols - 1)) / activeGridCols : gridRect.width;
      const stepX = Math.max(cellWidth + colGap, 1);
      const stepY = Math.max(gridRowPx + rowGap, 1);

      const tile = layoutRef.current.find((t) => t.id === current.id);
      if (!tile) return;
      const maxColStart = Math.max(1, activeGridCols - tile.colSpan + 1);
      const rawCol = Math.floor((event.clientX - gridRect.left) / stepX) + 1;
      const rawRow = Math.floor((event.clientY - gridRect.top) / stepY) + 1;

      const next = {
        ...current,
        targetX: event.clientX - current.offsetX,
        targetY: event.clientY - current.offsetY,
        previewColStart: clamp(rawCol, 1, maxColStart),
        previewRowStart: Math.max(1, rawRow),
      };
      draggingRef.current = next;
      setDragging(next);
    };

    const finishDrag = () => {
      const current = draggingRef.current;
      if (!current) return;
      setTiles((prev) => {
        const next = prev.map((tile) =>
          tile.id === current.id
            ? { ...tile, colStart: current.previewColStart, rowStart: current.previewRowStart }
            : tile
        );
        return resolveCollisions(next, current.id, activeGridCols);
      });
      draggingRef.current = null;
      setDragging(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [dragging?.id, activeGridCols, gridRowPx, gridGapPx, setTiles]);

  const hasUnsavedChanges = JSON.stringify(layoutConfig) !== JSON.stringify(savedConfig);

  const animationTuning = useMemo(
    () =>
      ({
        none: { tileMs: 0, easing: "linear", dragMs: 0 },
        subtle: { tileMs: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", dragMs: 45 },
        smooth: { tileMs: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)", dragMs: 60 },
      } satisfies Record<AnimationStyle, { tileMs: number; easing: string; dragMs: number }>)[
        layoutConfig.reactive.animationStyle
      ],
    [layoutConfig.reactive.animationStyle]
  );

  const displayedLayout = useMemo(() => {
    if (!dragging) return layoutForView;
    const moved = layoutForView.map((tile) =>
      tile.id === dragging.id
        ? { ...tile, colStart: dragging.previewColStart, rowStart: dragging.previewRowStart }
        : tile
    );
    return resolveCollisions(moved, dragging.id, activeGridCols);
  }, [dragging, layoutForView, activeGridCols]);

  const gridGuideRows = useMemo(() => {
    const maxEnd = displayedLayout.reduce((acc, tile) => Math.max(acc, tile.rowStart + tile.rowSpan - 1), 1);
    return maxEnd + 4;
  }, [displayedLayout]);

  const moveTile = (id: string, rowDelta: number) => {
    setTiles((prev) => {
      const next = prev.map((tile) =>
        tile.id === id ? { ...tile, rowStart: Math.max(1, tile.rowStart + rowDelta) } : tile
      );
      return resolveCollisions(next, id, activeGridCols);
    });
  };

  const moveTileAbsolute = (id: string, colStart: number, rowStart: number) => {
    setTiles((prev) => {
      const next = prev.map((tile) =>
        tile.id === id ? { ...tile, colStart, rowStart: Math.max(1, rowStart) } : tile
      );
      return resolveCollisions(next, id, activeGridCols);
    });
  };

  const resizeTileAbsolute = (id: string, colSpan: number, rowSpan: number) => {
    setTiles((prev) => {
      const target = prev.find((tile) => tile.id === id);
      if (!target) return prev;
      const def = widgetDefinitions[target.type];
      const nextColSpan = clamp(
        colSpan,
        Math.min(def.minColSpan, activeGridCols),
        Math.min(def.maxColSpan, activeGridCols)
      );
      const nextRowSpan = clamp(rowSpan, def.minRowSpan, def.maxRowSpan);
      const maxColStart = Math.max(1, activeGridCols - nextColSpan + 1);
      const next = prev.map((tile) =>
        tile.id === id
          ? {
              ...tile,
              colSpan: nextColSpan,
              rowSpan: nextRowSpan,
              colStart: clamp(tile.colStart, 1, maxColStart),
            }
          : tile
      );
      return resolveCollisions(next, id, activeGridCols);
    });
  };

  const getSearchProvider = (tile: TileItem): AiProvider => {
    if (tile.type !== "search") return "chatgpt";
    return tile.settings?.searchProvider ?? "chatgpt";
  };

  const cycleSearchProvider = (id: string) => {
    setTiles((prev) =>
      prev.map((tile) => {
        if (tile.id !== id || tile.type !== "search") return tile;
        const currentProvider = getSearchProvider(tile);
        const currentIndex = SEARCH_PROVIDERS.indexOf(currentProvider);
        const nextProvider = SEARCH_PROVIDERS[(currentIndex + 1) % SEARCH_PROVIDERS.length];
        return {
          ...tile,
          settings: {
            ...(tile.settings ?? {}),
            searchProvider: nextProvider,
          },
        };
      })
    );
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, tile: TileItem) => {
    if (!editMode || resizing) return;
    const tileElement = tileRefs.current.get(tile.id);
    if (!tileElement) return;
    const rect = tileElement.getBoundingClientRect();
    event.preventDefault();
    event.stopPropagation();
    const next: DragState = {
      id: tile.id,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      targetX: rect.left,
      targetY: rect.top,
      x: rect.left,
      y: rect.top,
      vx: 0,
      vy: 0,
      tilt: 0,
      width: rect.width,
      height: rect.height,
      type: tile.type,
      colSpan: tile.colSpan,
      rowSpan: tile.rowSpan,
      previewColStart: tile.colStart,
      previewRowStart: tile.rowStart,
    };
    draggingRef.current = next;
    setDragging(next);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, tile: TileItem) => {
    if (!gridRef.current) return;
    const styles = window.getComputedStyle(gridRef.current);
    const colGap = parseFloat(styles.columnGap || "0") || gridGapPx;
    const rowGap = parseFloat(styles.rowGap || "0") || gridGapPx;
    const gridRect = gridRef.current.getBoundingClientRect();
    const cellWidth =
      activeGridCols > 0 ? (gridRect.width - colGap * (activeGridCols - 1)) / activeGridCols : gridRect.width;
    const def = widgetDefinitions[tile.type];
    event.preventDefault();
    event.stopPropagation();
    setResizing({
      id: tile.id,
      startX: event.clientX,
      startY: event.clientY,
      startColSpan: tile.colSpan,
      startRowSpan: tile.rowSpan,
      stepX: Math.max(cellWidth + colGap, 1),
      stepY: Math.max(gridRowPx + rowGap, 1),
      minColSpan: Math.min(def.minColSpan, activeGridCols),
      maxColSpan: Math.min(def.maxColSpan, activeGridCols),
      minRowSpan: def.minRowSpan,
      maxRowSpan: def.maxRowSpan,
    });
  };

  const removeTile = (id: string) => {
    setTiles((prev) => (prev.length <= 1 ? prev : prev.filter((tile) => tile.id !== id)));
  };

  const duplicateTile = (tile: TileItem) => {
    setTiles((prev) => {
      const copy: TileItem = { ...tile, id: generateTileId(tile.type), rowStart: tile.rowStart + 1 };
      return resolveCollisions([...prev, copy], copy.id, activeGridCols);
    });
  };

  const saveAndExitEditor = () => {
    saveLayoutConfig(layoutConfig);
    setSavedConfig(cloneConfig(layoutConfig));
    setLayoutSettingsSnapshot(null);
    setShowLayoutSettingsModal(false);
    setEditMode(false);
  };

  const resetLayout = () => {
    const fresh = createDefaultLayoutConfigV2();
    fresh.reactive.layout = normalizeLayout(null, widgetConstraints, defaultTileLayout);
    fresh.custom.profiles = createDefaultProfilesFromLayout(fresh.reactive.layout, widgetConstraints);
    fresh.custom.selectedProfileId = fresh.custom.profiles[0]?.id ?? null;
    setLayoutConfig(fresh);
  };

  const revertToSaved = () => {
    setLayoutConfig(cloneConfig(savedConfig));
  };

  const cancelAndExitEditor = () => {
    setLayoutConfig(cloneConfig(savedConfig));
    setLayoutSettingsSnapshot(null);
    setShowLayoutSettingsModal(false);
    setEditMode(false);
  };

  const handleModeChange = (mode: LayoutConfigV2["mode"]) => {
    setLayoutConfig((c) => {
      let next: LayoutConfigV2 = { ...c, mode };
      if (mode === "customBreakpoints" && next.custom.profiles.length === 0) {
        next = {
          ...next,
          custom: {
            ...next.custom,
            profiles: createDefaultProfilesFromLayout(next.reactive.layout, widgetConstraints),
            selectedProfileId: null,
          },
        };
      }
      if (mode === "customBreakpoints") {
        const repaired = repairProfileRanges(next.custom.profiles);
        const sel =
          next.custom.selectedProfileId && repaired.some((p) => p.id === next.custom.selectedProfileId)
            ? next.custom.selectedProfileId
            : repaired[0]?.id ?? null;
        next = { ...next, custom: { ...next.custom, profiles: repaired, selectedProfileId: sel } };
      }
      return next;
    });
  };

  const handleSelectProfile = (id: string) => {
    setLayoutConfig((c) => ({ ...c, custom: { ...c.custom, selectedProfileId: id } }));
  };

  const handleAddProfile = () => {
    setLayoutConfig((c) => {
      if (c.mode !== "customBreakpoints") return c;
      const cloneSrc =
        c.custom.profiles.find((p) => p.id === c.custom.selectedProfileId) ?? c.custom.profiles[0] ?? null;
      const created = createNewBreakpointProfile(c.custom.profiles, cloneSrc, widgetConstraints);
      const nextProfiles = repairProfileRanges([...c.custom.profiles, created]);
      return {
        ...c,
        custom: { ...c.custom, profiles: nextProfiles, selectedProfileId: created.id },
      };
    });
  };

  const handleRemoveProfile = (id: string) => {
    setLayoutConfig((c) => {
      if (c.mode !== "customBreakpoints" || c.custom.profiles.length <= 1) return c;
      const filtered = c.custom.profiles.filter((p) => p.id !== id);
      const repaired = repairProfileRanges(filtered);
      const sel =
        c.custom.selectedProfileId === id
          ? repaired[0]?.id ?? null
          : repaired.some((p) => p.id === c.custom.selectedProfileId)
            ? c.custom.selectedProfileId
            : repaired[0]?.id ?? null;
      return { ...c, custom: { ...c.custom, profiles: repaired, selectedProfileId: sel } };
    });
  };

  const handleUpdateProfileRange = (id: string, range: (typeof layoutConfig.custom.profiles)[0]["range"]) => {
    setLayoutConfig((c) => {
      const idx = c.custom.profiles.findIndex((p) => p.id === id);
      if (idx < 0) return c;
      const nextProfiles = [...c.custom.profiles];
      nextProfiles[idx] = { ...nextProfiles[idx], range };
      return { ...c, custom: { ...c.custom, profiles: repairProfileRanges(nextProfiles) } };
    });
  };

  const handleUpdateProfileLabel = (id: string, label: string) => {
    setLayoutConfig((c) => {
      const idx = c.custom.profiles.findIndex((p) => p.id === id);
      if (idx < 0) return c;
      const nextProfiles = [...c.custom.profiles];
      nextProfiles[idx] = { ...nextProfiles[idx], label };
      return { ...c, custom: { ...c.custom, profiles: nextProfiles } };
    });
  };

  const handleMoveBoundary = (leftId: string, rightId: string, newBoundary: number) => {
    setLayoutConfig((c) => {
      const nextProfiles = c.custom.profiles.map((p) => {
        if (p.id === leftId) return { ...p, range: { ...p.range, maxWidth: newBoundary } };
        if (p.id === rightId) return { ...p, range: { ...p.range, minWidth: newBoundary + 1 } };
        return p;
      });
      return { ...c, custom: { ...c.custom, profiles: nextProfiles } };
    });
  };

  const handleProfileGridChange = (nextGrid: GridSpec) => {
    setLayoutConfig((c) => {
      if (c.mode !== "customBreakpoints") return c;
      const id = c.custom.selectedProfileId;
      if (!id) return c;
      const idx = c.custom.profiles.findIndex((p) => p.id === id);
      if (idx < 0) return c;
      const old = c.custom.profiles[idx];
      const oldCols = old.grid.cols;
      let newLayout = old.layout;
      if (nextGrid.cols !== oldCols) {
        newLayout = remapLayoutToGridCols(old.layout, oldCols, nextGrid.cols, widgetConstraints);
      }
      const nextProfiles = [...c.custom.profiles];
      nextProfiles[idx] = {
        ...old,
        grid: { cols: nextGrid.cols, rowHeight: nextGrid.rowHeight, gap: nextGrid.gap },
        layout: newLayout,
      };
      return { ...c, custom: { ...c.custom, profiles: repairProfileRanges(nextProfiles) } };
    });
  };

  const applyReactivePreset = (preset: ReactivePreset) => {
    const presetInfo = REACTIVE_PRESETS.find((p) => p.id === preset);
    setLayoutConfig((c) => ({
      ...c,
      reactive: {
        ...c.reactive,
        preset,
        preferredGridCols: presetInfo?.recommendedMaxCols ?? c.reactive.preferredGridCols,
      },
    }));
  };

  const setReactiveAnimationStyle = (animationStyle: AnimationStyle) => {
    setLayoutConfig((c) => ({
      ...c,
      reactive: { ...c.reactive, animationStyle },
    }));
  };

  const modalPreview = useMemo(() => {
    if (layoutConfig.mode === "customBreakpoints" && selectedProfile) {
      return {
        title: `${selectedProfile.label} preview`,
        cols: selectedProfile.grid.cols,
        tiles: layoutForDisplay(selectedProfile.layout, selectedProfile.grid.cols, widgetConstraints),
      };
    }
    return {
      title: "Reactive preview",
      cols: activeGridCols,
      tiles: layoutForDisplay(layoutConfig.reactive.layout, activeGridCols, widgetConstraints),
    };
  }, [layoutConfig.mode, selectedProfile, activeGridCols, layoutConfig.reactive.layout]);

  const selectedBreakpointAccent = useMemo(() => {
    if (layoutConfig.mode !== "customBreakpoints" || !selectedProfile) return "#8b5cf6";
    const sorted = [...layoutConfig.custom.profiles].sort(
      (a, b) => a.range.minWidth - b.range.minWidth || a.range.minHeight - b.range.minHeight
    );
    const index = Math.max(0, sorted.findIndex((p) => p.id === selectedProfile.id));
    return BREAKPOINT_ACCENTS[index % BREAKPOINT_ACCENTS.length];
  }, [layoutConfig.mode, layoutConfig.custom.profiles, selectedProfile]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-gray-500/70 dark:text-white/35">
          {editMode
            ? "Edit mode: drag and resize tiles on the page. Open Layout settings for breakpoints, grid, and widgets."
            : "Your tab layout is fully customizable."}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {editMode && (
            <>
              <button
                type="button"
                className="text-xs inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 border border-violet-400/45 bg-violet-500/15 text-violet-700 dark:text-violet-200 hover:bg-violet-500/25 transition-colors"
                onClick={openLayoutSettingsModal}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.983 5.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm0 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM18.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-13 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.483-1.5h.034m-.034 7h.034" />
                </svg>
                Layout settings
              </button>
              <button type="button" className="text-xs rounded-xl px-3 py-1.5 border border-black/15 dark:border-white/20 bg-white/65 dark:bg-white/[0.05] text-gray-700 dark:text-white/80 hover:bg-white/90 dark:hover:bg-white/[0.1] transition-colors" onClick={resetLayout}>Reset layout</button>
              <button type="button" className="text-xs rounded-xl px-3 py-1.5 border border-black/15 dark:border-white/20 bg-white/65 dark:bg-white/[0.05] text-gray-700 dark:text-white/80 hover:bg-white/90 dark:hover:bg-white/[0.1] transition-colors disabled:opacity-45 disabled:cursor-not-allowed" onClick={revertToSaved} disabled={!hasUnsavedChanges}>Revert</button>
              <span className="h-5 w-px bg-black/10 dark:bg-white/15" aria-hidden />
              <button type="button" className="text-xs rounded-xl px-3 py-1.5 border border-black/15 dark:border-white/20 bg-white/65 dark:bg-white/[0.05] text-gray-700 dark:text-white/80 hover:bg-white/90 dark:hover:bg-white/[0.1] transition-colors" onClick={cancelAndExitEditor}>Cancel</button>
              <button type="button" className="btn-primary text-xs" onClick={saveAndExitEditor}>Save & exit</button>
            </>
          )}
          {!editMode && <button type="button" onClick={() => setEditMode(true)} className="btn-ghost text-xs">Customize layout</button>}
        </div>
      </div>

      {showLayoutSettingsModal && editMode && (
        <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
          <button
            type="button"
            aria-label="Close layout settings"
            className="absolute inset-0 bg-black/40 dark:bg-black/55 backdrop-blur-[2px]"
            onClick={closeLayoutSettingsDiscard}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="layout-settings-title"
            className="relative z-10 w-full max-w-5xl my-4 sm:my-10 rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl bg-[#f2f2f7]/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl max-h-[min(90vh,calc(100vh-2rem))] flex flex-col"
            style={{
              borderColor: `${selectedBreakpointAccent}55`,
              boxShadow: `0 24px 56px ${selectedBreakpointAccent}22`,
              transition: "border-color 250ms ease, box-shadow 250ms ease",
            }}
          >
            <div className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <div>
                <h2 id="layout-settings-title" className="text-base font-semibold text-gray-800 dark:text-white/90">
                  Layout settings
                </h2>
                <p className="text-xs text-gray-500 dark:text-white/45 mt-1">
                  Edit ranges, grid, and widgets, then apply to return to the editor.
                </p>
                {layoutConfig.mode === "customBreakpoints" && selectedProfile && (
                  <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold" style={{ color: selectedBreakpointAccent }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedBreakpointAccent }} />
                    Editing: {selectedProfile.label}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={closeLayoutSettingsDiscard}
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 dark:text-white/70 bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/12 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 min-h-0">
              <BreakpointManagerPanel
                mode={layoutConfig.mode}
                onModeChange={handleModeChange}
                profiles={layoutConfig.custom.profiles}
                selectedProfileId={layoutConfig.custom.selectedProfileId}
                onSelectProfile={handleSelectProfile}
                onAddProfile={handleAddProfile}
                onRemoveProfile={handleRemoveProfile}
                onUpdateProfileRange={handleUpdateProfileRange}
                onUpdateProfileLabel={handleUpdateProfileLabel}
                onMoveBoundary={handleMoveBoundary}
                viewportWidth={viewport.w}
                viewportHeight={viewport.h}
              />

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                {layoutConfig.mode === "reactive" && (
                  <div className="rounded-2xl p-4 border border-indigo-500/25 bg-gradient-to-br from-indigo-500/12 via-blue-500/8 to-cyan-500/10 space-y-4 xl:col-span-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide font-semibold text-indigo-700/90 dark:text-indigo-200/90 mb-2">
                        Reactive preset
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {REACTIVE_PRESETS.map((preset) => {
                          const active = layoutConfig.reactive.preset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => applyReactivePreset(preset.id)}
                              className={`px-3 py-2 rounded-xl text-xs transition-all text-left ${
                                active
                                  ? "bg-indigo-500/25 text-indigo-800 dark:text-indigo-100 ring-2 ring-indigo-400/50"
                                  : "bg-white/55 dark:bg-white/10 text-gray-700 dark:text-white/75 hover:bg-white/75 dark:hover:bg-white/15"
                              }`}
                              title={preset.description}
                            >
                              <div className="font-semibold">{preset.label}</div>
                              <div className="text-[10px] opacity-75">Max cols {preset.recommendedMaxCols}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-wide font-semibold text-indigo-700/90 dark:text-indigo-200/90 mb-2">
                        Animation style
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ANIMATION_STYLES.map((style) => {
                          const active = layoutConfig.reactive.animationStyle === style.id;
                          return (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() => setReactiveAnimationStyle(style.id)}
                              className={`px-3 py-2 rounded-xl text-xs transition-all text-left ${
                                active
                                  ? "bg-cyan-500/25 text-cyan-900 dark:text-cyan-100 ring-2 ring-cyan-400/50"
                                  : "bg-white/55 dark:bg-white/10 text-gray-700 dark:text-white/75 hover:bg-white/75 dark:hover:bg-white/15"
                              }`}
                              title={style.description}
                            >
                              <div className="font-semibold">{style.label}</div>
                              <div className="text-[10px] opacity-75">{style.description}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {layoutConfig.mode === "customBreakpoints" && selectedProfile && (
                  <GridConfigPanel
                    title="Grid (selected breakpoint)"
                    grid={selectedProfile.grid}
                    onGridChange={handleProfileGridChange}
                    showColumnPicker
                  />
                )}

                {layoutConfig.mode === "customBreakpoints" && (
                  <MiniLayoutPreview
                    title={modalPreview.title}
                    cols={modalPreview.cols}
                    tiles={modalPreview.tiles}
                    constraints={widgetConstraints}
                    editable={editMode}
                    onMoveTile={moveTileAbsolute}
                    onResizeTile={resizeTileAbsolute}
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-ghost text-xs" onClick={closeLayoutSettingsDiscard}>
                  Cancel
                </button>
                <button type="button" className="btn-primary text-xs" onClick={applyLayoutSettingsChanges}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {layoutConfig.mode === "customBreakpoints" && activeDataProfile && !editMode && (
        <div className="text-[11px] text-amber-700/85 dark:text-amber-300/85 glass rounded-xl px-3 py-2">
          Custom layout: <span className="font-semibold">{activeDataProfile.label}</span> (matched viewport)
        </div>
      )}

      <div className="relative">
        {(editMode || dragging) && (
          <div className="pointer-events-none absolute inset-0 z-0 grid"
            style={{ gridTemplateColumns: `repeat(${activeGridCols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${gridGuideRows}, ${gridRowPx}px)`, columnGap: `${gridGapPx}px`, rowGap: `${gridGapPx}px` }}>
            {Array.from({ length: activeGridCols * gridGuideRows }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-black/[0.05] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]" />
            ))}
          </div>
        )}

        <div ref={gridRef} className="relative z-10 grid"
          style={{ gridTemplateColumns: `repeat(${activeGridCols}, minmax(0, 1fr))`, gridAutoRows: `${gridRowPx}px`, gap: `${gridGapPx}px` }}>
          {displayedLayout.map((tile) => {
            const def = widgetDefinitions[tile.type];
            const minColSpan = Math.min(def.minColSpan, activeGridCols);
            const maxColSpan = Math.min(def.maxColSpan, activeGridCols);
            const colSpan = clamp(tile.colSpan, minColSpan, maxColSpan);
            const rowSpan = clamp(tile.rowSpan, def.minRowSpan, def.maxRowSpan);
            const maxColStart = Math.max(1, activeGridCols - colSpan + 1);
            const colStart = clamp(tile.colStart, 1, maxColStart);
            const compactEditControls = rowSpan === 1;

            return (
              <div key={tile.id}
                ref={(node) => { if (node) tileRefs.current.set(tile.id, node); else tileRefs.current.delete(tile.id); }}
                className={`relative min-h-0 ${editMode ? "rounded-2xl border border-dashed border-black/10 dark:border-white/15 p-2" : ""} transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`}
                style={{
                  gridColumn: `${colStart} / span ${colSpan}`,
                  gridRow: `${tile.rowStart} / span ${rowSpan}`,
                  transitionDuration: `${animationTuning.tileMs}ms`,
                  transitionTimingFunction: animationTuning.easing,
                }}>
                {editMode && !compactEditControls && <div className="absolute top-2 left-2 z-20 text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-600/80 dark:text-white/70">{def.label}</div>}

                <div className={`h-full min-h-0 overflow-hidden ${editMode && compactEditControls ? "pt-11" : ""}`}>
                  {dragging?.id === tile.id ? (
                    <div className="h-full rounded-2xl border-2 border-dashed border-blue-500/45 dark:border-blue-400/55 bg-blue-500/10 dark:bg-blue-400/15 relative animate-pulse">
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-blue-600/75 dark:text-blue-300/75">Drop target</div>
                    </div>
                  ) : (
                    <TileContent tile={tile} />
                  )}
                </div>

                {editMode && (
                  <div className={`absolute inset-x-2 z-20 ${compactEditControls ? "top-2" : "bottom-2"}`}>
                    <div className="glass rounded-xl p-2 flex flex-wrap items-center gap-1.5">
                      <button type="button" title="Drag tile" aria-label="Drag tile" onPointerDown={(event) => startDrag(event, tile)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/15 text-blue-600 dark:text-blue-300 transition-all duration-150 hover:-translate-y-[1px] cursor-grab active:cursor-grabbing">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <circle cx="7" cy="5" r="1.2" /><circle cx="13" cy="5" r="1.2" /><circle cx="7" cy="10" r="1.2" /><circle cx="13" cy="10" r="1.2" /><circle cx="7" cy="15" r="1.2" /><circle cx="13" cy="15" r="1.2" />
                        </svg>
                      </button>
                      <EditButton title="Move up" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>} onClick={() => moveTile(tile.id, -1)} />
                      <EditButton title="Move down" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>} onClick={() => moveTile(tile.id, 1)} />
                      <EditButton title="Duplicate tile" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h9a2 2 0 012 2v9m-3 3H7a2 2 0 01-2-2V10a2 2 0 012-2z" /></svg>} onClick={() => duplicateTile(tile)} />
                      {tile.type === "search" && (
                        <button
                          type="button"
                          onClick={() => cycleSearchProvider(tile.id)}
                          className="h-7 rounded-lg px-2.5 text-[10px] font-semibold tracking-wide uppercase
                                     bg-cyan-500/12 text-cyan-700 dark:text-cyan-200
                                     border border-cyan-500/25 hover:bg-cyan-500/20 transition-colors"
                          title="Switch AI source for this search widget"
                        >
                          Source: {SEARCH_PROVIDER_LABELS[getSearchProvider(tile)]}
                        </button>
                      )}
                      <EditButton title="Remove tile" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>} onClick={() => removeTile(tile.id)} disabled={layoutSlice.length <= 1} />
                      <div className="ml-auto text-[10px] text-gray-500/70 dark:text-white/45">{colSpan}x{rowSpan}</div>
                    </div>
                  </div>
                )}

                {editMode && (
                  <button type="button" aria-label={`Resize ${def.label}`} onPointerDown={(event) => startResize(event, tile)}
                    className="absolute right-2 bottom-2 z-30 w-5 h-5 rounded-md bg-black/10 hover:bg-black/15 dark:bg-white/15 dark:hover:bg-white/20 transition-colors cursor-nwse-resize">
                    <svg className="w-3.5 h-3.5 mx-auto text-gray-700/70 dark:text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l8-8M10 20h10V10" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {dragging && (
        <div className="fixed z-[120] pointer-events-none"
          style={{
            left: dragging.x,
            top: dragging.y,
            width: dragging.width,
            height: dragging.height,
            transformOrigin: "top left",
            transform: `translate3d(0,0,0) rotate(${dragging.tilt}deg)`,
            transition: animationTuning.dragMs > 0 ? `transform ${animationTuning.dragMs}ms linear` : "none",
          }}>
          <div className="rounded-2xl shadow-2xl ring-2 ring-blue-500/35 dark:ring-blue-400/35">
            <div className="h-full min-h-0 overflow-hidden">
              <TileContent
                tile={{
                  type: dragging.type,
                  colSpan: dragging.colSpan,
                  rowSpan: dragging.rowSpan,
                }}
              />
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
