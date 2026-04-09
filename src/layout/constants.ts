import type { LayoutConfigV2, TileItem } from "./types";

export const LAYOUT_CONFIG_V2_KEY = "dashboard-layout-config-v2";

/** Legacy v1 keys — migrated once into v2 */
export const LEGACY_TILE_LAYOUT_KEY = "dashboard-tile-layout-v1";
export const LEGACY_GRID_COLS_KEY = "dashboard-grid-columns-v1";

export const MAX_COL_SPAN = 12;
export const MAX_ROW_SPAN = 5;
export const DEFAULT_BASE_GRID_COLS = 12;
export const DEFAULT_GRID_COLS_PREFERENCE = 12;
export const GRID_COLUMN_OPTIONS = [4, 6, 8, 10, 12] as const;

export const DEFAULT_ROW_HEIGHT = 110;
export const DEFAULT_GAP_PX = 16;

export const MAX_VIEWPORT_DIM = 16000;

export const defaultTileLayout: TileItem[] = [
  { id: "tile-greeting-1", type: "greeting", colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 2 },
  { id: "tile-search-1", type: "search", colStart: 1, rowStart: 3, colSpan: 12, rowSpan: 1, settings: { searchProvider: "chatgpt" } },
  { id: "tile-bookmarks-1", type: "bookmarks", colStart: 1, rowStart: 4, colSpan: 12, rowSpan: 2 },
  { id: "tile-weather-1", type: "weather", colStart: 1, rowStart: 6, colSpan: 4, rowSpan: 1 },
  { id: "tile-quotes-1", type: "quotes", colStart: 5, rowStart: 6, colSpan: 8, rowSpan: 2 },
  { id: "tile-tasks-1", type: "tasks", colStart: 1, rowStart: 8, colSpan: 6, rowSpan: 3 },
  { id: "tile-calendar-1", type: "calendar", colStart: 7, rowStart: 8, colSpan: 6, rowSpan: 3 },
];

export function createDefaultLayoutConfigV2(): LayoutConfigV2 {
  return {
    version: 2,
    mode: "reactive",
    reactive: {
      layout: defaultTileLayout.map((t) => ({ ...t })),
      preferredGridCols: DEFAULT_GRID_COLS_PREFERENCE,
      baseGridCols: DEFAULT_BASE_GRID_COLS,
      preset: "balanced",
      animationStyle: "smooth",
    },
    custom: {
      profiles: [],
      selectedProfileId: null,
    },
  };
}
