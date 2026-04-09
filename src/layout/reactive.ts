import { DEFAULT_GAP_PX, DEFAULT_ROW_HEIGHT } from "./constants";
import type { AnimationStyle, GridSpec, ReactivePreset } from "./types";

export interface ReactivePresetDefinition {
  id: ReactivePreset;
  label: string;
  description: string;
  recommendedMaxCols: number;
}

export const REACTIVE_PRESETS: ReactivePresetDefinition[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Default balance of readability and density.",
    recommendedMaxCols: 12,
  },
  {
    id: "focus",
    label: "Focus",
    description: "Larger cards with fewer columns.",
    recommendedMaxCols: 10,
  },
  {
    id: "dense",
    label: "Dense",
    description: "More information on screen.",
    recommendedMaxCols: 12,
  },
];

export const ANIMATION_STYLES: { id: AnimationStyle; label: string; description: string }[] = [
  { id: "none", label: "None", description: "Instant layout updates." },
  { id: "subtle", label: "Subtle", description: "Quick and lightweight movement." },
  { id: "smooth", label: "Smooth", description: "More fluid transitions." },
];

/**
 * Reactive viewport bands: column cap + optional row height tweak by width/height.
 * Keeps layout stable: only caps columns; row height lightly scales on short windows.
 */
export function deriveReactiveGrid(
  viewportWidth: number,
  viewportHeight: number,
  preset: ReactivePreset = "balanced"
): GridSpec {
  let cols = 12;
  let rowHeight = DEFAULT_ROW_HEIGHT;
  let gap = DEFAULT_GAP_PX;

  if (preset === "focus") {
    if (viewportWidth < 720) cols = 2;
    else if (viewportWidth < 1180) cols = 5;
    else cols = 10;
    rowHeight = 122;
    gap = 18;
  } else if (preset === "dense") {
    if (viewportWidth < 560) cols = 2;
    else if (viewportWidth < 920) cols = 6;
    else cols = 12;
    rowHeight = 98;
    gap = 12;
  } else {
    if (viewportWidth < 640) cols = 2;
    else if (viewportWidth < 1024) cols = 6;
    else cols = 12;
    rowHeight = DEFAULT_ROW_HEIGHT;
    gap = DEFAULT_GAP_PX;
  }

  if (viewportHeight > 0 && viewportHeight < 520) rowHeight -= 12;
  if (viewportHeight > 0 && viewportHeight < 400) rowHeight -= 8;

  return { cols, rowHeight: Math.max(78, rowHeight), gap };
}

/** Effective columns for reactive mode: min(user preference, viewport-derived cap). */
export function effectiveReactiveCols(
  preferredGridCols: number,
  viewportWidth: number,
  viewportHeight: number,
  preset: ReactivePreset = "balanced"
): number {
  const cap = deriveReactiveGrid(viewportWidth, viewportHeight, preset).cols;
  return Math.min(clampPref(preferredGridCols), cap);
}

function clampPref(n: number): number {
  if (!Number.isFinite(n)) return 12;
  return Math.min(12, Math.max(4, Math.round(n)));
}
