import { MAX_COL_SPAN, MAX_ROW_SPAN } from "./constants";
import type { AiProvider, TileItem, WidgetConstraintsMap, WidgetType } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeSearchProvider(input: unknown): AiProvider | undefined {
  if (input === "chatgpt" || input === "claude") return input;
  return undefined;
}

export function tilesOverlap(a: TileItem, b: TileItem): boolean {
  const aRight = a.colStart + a.colSpan - 1;
  const aBottom = a.rowStart + a.rowSpan - 1;
  const bRight = b.colStart + b.colSpan - 1;
  const bBottom = b.rowStart + b.rowSpan - 1;
  return !(aRight < b.colStart || bRight < a.colStart || aBottom < b.rowStart || bBottom < a.rowStart);
}

export function normalizeTileToGrid(tile: TileItem, gridCols: number): TileItem {
  const maxStart = Math.max(1, gridCols - tile.colSpan + 1);
  return {
    ...tile,
    colSpan: clamp(tile.colSpan, 1, gridCols),
    rowSpan: clamp(tile.rowSpan, 1, MAX_ROW_SPAN),
    colStart: clamp(tile.colStart, 1, maxStart),
    rowStart: Math.max(1, tile.rowStart),
  };
}

export function findFirstAvailablePosition(
  candidate: TileItem,
  others: TileItem[],
  gridCols: number
): { colStart: number; rowStart: number } {
  const maxColStart = Math.max(1, gridCols - candidate.colSpan + 1);
  for (let row = 1; row <= 200; row++) {
    for (let col = 1; col <= maxColStart; col++) {
      const probe = { ...candidate, colStart: col, rowStart: row };
      if (!others.some((t) => tilesOverlap(probe, t))) {
        return { colStart: col, rowStart: row };
      }
    }
  }
  return { colStart: 1, rowStart: 1 };
}

export function resolveCollisions(layout: TileItem[], movedId: string, gridCols: number): TileItem[] {
  const result = layout.map((t) => normalizeTileToGrid(t, gridCols));
  const queue: string[] = [movedId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = result.find((t) => t.id === currentId);
    if (!current) continue;

    for (let i = 0; i < result.length; i++) {
      const tile = result[i];
      if (tile.id === current.id) continue;
      if (!tilesOverlap(current, tile)) continue;

      const others = result.filter((x) => x.id !== tile.id);
      const startRow = Math.max(current.rowStart + current.rowSpan, tile.rowStart + 1);
      const moved = { ...tile, rowStart: startRow };
      const nextPos = findFirstAvailablePosition(moved, others, gridCols);
      result[i] = { ...moved, ...nextPos };
      queue.push(tile.id);
    }
  }

  return result;
}

export function generateTileId(type: WidgetType): string {
  return `tile-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Normalize parsed JSON into tiles using widget span constraints */
export function normalizeLayout(input: unknown, defs: WidgetConstraintsMap, fallback: TileItem[]): TileItem[] {
  if (!Array.isArray(input)) return fallback.map((t) => ({ ...t }));
  const validTypes = new Set<WidgetType>(Object.keys(defs) as WidgetType[]);
  const normalized = input
    .filter((item): item is Partial<TileItem> => typeof item === "object" && item !== null)
    .map((item, idx) => {
      const type = validTypes.has(item.type as WidgetType) ? (item.type as WidgetType) : "bookmarks";
      const def = defs[type];
      const colSpan = clamp(
        typeof item.colSpan === "number" ? item.colSpan : def.defaultColSpan,
        def.minColSpan,
        def.maxColSpan
      );
      const rowSpan = clamp(
        typeof item.rowSpan === "number" ? item.rowSpan : def.defaultRowSpan,
        def.minRowSpan,
        def.maxRowSpan
      );
      return {
        id: typeof item.id === "string" && item.id ? item.id : generateTileId(type),
        type,
        colStart: typeof item.colStart === "number" ? item.colStart : 1 + (idx % 3) * 4,
        rowStart: typeof item.rowStart === "number" ? item.rowStart : 1 + Math.floor(idx / 3) * 2,
        colSpan,
        rowSpan,
        settings:
          type === "search"
            ? {
                searchProvider: sanitizeSearchProvider((item as { settings?: { searchProvider?: unknown } }).settings?.searchProvider) ?? "chatgpt",
              }
            : undefined,
      };
    });
  return normalized.length > 0 ? normalized : fallback.map((t) => ({ ...t }));
}

/** Convert layout coordinates from `fromCols` to `toCols` (proportional, integer-safe). */
export function remapLayoutToGridCols(layout: TileItem[], fromCols: number, toCols: number, defs: WidgetConstraintsMap): TileItem[] {
  if (fromCols === toCols || fromCols < 1 || toCols < 1) {
    return layout.map((t) => normalizeTileToGrid({ ...t }, toCols));
  }
  return layout.map((tile) => {
    const def = defs[tile.type];
    let colStart = Math.round(1 + ((tile.colStart - 1) * toCols) / fromCols);
    let colSpan = Math.max(1, Math.round((tile.colSpan * toCols) / fromCols));
    colSpan = clamp(colSpan, def.minColSpan, Math.min(def.maxColSpan, toCols));
    const maxStart = Math.max(1, toCols - colSpan + 1);
    colStart = clamp(colStart, 1, maxStart);
    return normalizeTileToGrid({ ...tile, colStart, colSpan }, toCols);
  });
}

/** Clamp tiles for on-screen display without mutating canonical state (reactive / wide canonical). */
export function layoutForDisplay(
  layout: TileItem[],
  activeGridCols: number,
  defs: WidgetConstraintsMap
): TileItem[] {
  return layout.map((tile) => {
    const def = defs[tile.type];
    const colSpan = clamp(tile.colSpan, def.minColSpan, Math.min(def.maxColSpan, activeGridCols));
    const maxColStart = Math.max(1, activeGridCols - colSpan + 1);
    return {
      ...tile,
      colSpan,
      rowSpan: clamp(tile.rowSpan, def.minRowSpan, def.maxRowSpan),
      colStart: clamp(tile.colStart, 1, maxColStart),
      rowStart: Math.max(1, tile.rowStart),
    };
  });
}
