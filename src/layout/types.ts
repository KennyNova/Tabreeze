/**
 * Dashboard layout v2 — dual mode: reactive (auto) or custom breakpoints (per-range presets).
 */

export type WidgetType =
  | "greeting"
  | "search"
  | "bookmarks"
  | "quotes"
  | "tasks"
  | "calendar"
  | "weather";

export type AiProvider = "chatgpt" | "claude";

export type LayoutMode = "reactive" | "customBreakpoints";
export type ReactivePreset = "balanced" | "focus" | "dense";
export type AnimationStyle = "none" | "subtle" | "smooth";

export interface TileSettings {
  searchProvider?: AiProvider;
}

export interface TileItem {
  id: string;
  type: WidgetType;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
  settings?: TileSettings;
}

/** Column / row track sizing for the dashboard grid */
export interface GridSpec {
  cols: number;
  rowHeight: number;
  gap: number;
}

/** Inclusive pixel range for matching (width × height viewport) */
export interface BreakpointRange {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

/** One saved preset: range + grid + tile layout in that grid’s column count */
export interface BreakpointProfile {
  id: string;
  label: string;
  range: BreakpointRange;
  grid: GridSpec;
  layout: TileItem[];
}

export interface ReactiveLayoutState {
  /** Canonical layout expressed in `baseGridCols` (default 12) */
  layout: TileItem[];
  preferredGridCols: number;
  baseGridCols: number;
  preset: ReactivePreset;
  animationStyle: AnimationStyle;
}

export interface CustomBreakpointState {
  profiles: BreakpointProfile[];
  /** Profile being edited in customize UI; live viewport match is computed separately */
  selectedProfileId: string | null;
}

export interface LayoutConfigV2 {
  version: 2;
  mode: LayoutMode;
  reactive: ReactiveLayoutState;
  custom: CustomBreakpointState;
}

export interface WidgetSpanConstraints {
  minColSpan: number;
  maxColSpan: number;
  minRowSpan: number;
  maxRowSpan: number;
  defaultColSpan: number;
  defaultRowSpan: number;
}

export type WidgetConstraintsMap = Record<WidgetType, WidgetSpanConstraints>;
