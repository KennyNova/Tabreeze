import {
  DEFAULT_GAP_PX,
  DEFAULT_ROW_HEIGHT,
  MAX_VIEWPORT_DIM,
  defaultTileLayout,
} from "./constants";
import { clamp, normalizeTileToGrid } from "./tileGeometry";
import type { BreakpointProfile, BreakpointRange, TileItem, WidgetConstraintsMap } from "./types";

function newId(): string {
  return `bp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Sort profiles by minWidth then minHeight for deterministic ordering */
export function sortProfiles(profiles: BreakpointProfile[]): BreakpointProfile[] {
  return [...profiles].sort((a, b) => {
    if (a.range.minWidth !== b.range.minWidth) return a.range.minWidth - b.range.minWidth;
    return a.range.minHeight - b.range.minHeight;
  });
}

/**
 * Contiguous repair: sort by minWidth, then ensure ranges tile perfectly
 * with no gaps and no overlaps. First profile always starts at 0,
 * last profile always extends to MAX_VIEWPORT_DIM.
 */
export function repairProfileRanges(profiles: BreakpointProfile[]): BreakpointProfile[] {
  if (profiles.length === 0) return [];
  const sorted = sortProfiles(profiles);
  const out: BreakpointProfile[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    let { minWidth, maxWidth, minHeight, maxHeight } = p.range;
    minHeight = clamp(minHeight, 0, MAX_VIEWPORT_DIM);
    maxHeight = clamp(maxHeight, minHeight, MAX_VIEWPORT_DIM);

    if (i === 0) {
      minWidth = 0;
    } else {
      minWidth = out[i - 1].range.maxWidth + 1;
    }

    maxWidth = clamp(maxWidth, minWidth, MAX_VIEWPORT_DIM);

    if (i === sorted.length - 1) {
      maxWidth = MAX_VIEWPORT_DIM;
    } else {
      maxWidth = clamp(maxWidth, minWidth, MAX_VIEWPORT_DIM);
    }

    if (minWidth > maxWidth) maxWidth = minWidth;

    out.push({
      ...p,
      range: { minWidth, maxWidth, minHeight, maxHeight },
    });
  }
  return out;
}

export function pointInRange(w: number, h: number, r: BreakpointRange): boolean {
  return w >= r.minWidth && w <= r.maxWidth && h >= r.minHeight && h <= r.maxHeight;
}

/** First matching profile in sort order; otherwise null */
export function findMatchingProfile(profiles: BreakpointProfile[], w: number, h: number): BreakpointProfile | null {
  const sorted = sortProfiles(profiles);
  for (const p of sorted) {
    if (pointInRange(w, h, p.range)) return p;
  }
  return null;
}

export function fallbackProfile(profiles: BreakpointProfile[]): BreakpointProfile | null {
  if (profiles.length === 0) return null;
  return sortProfiles(profiles)[0];
}

export function cloneLayout(layout: TileItem[]): TileItem[] {
  return layout.map((t) => ({ ...t }));
}

export function createDefaultProfilesFromLayout(
  layout: TileItem[],
  defs: WidgetConstraintsMap
): BreakpointProfile[] {
  const base = cloneLayout(layout);
  const mk = (
    label: string,
    range: BreakpointRange,
    cols: number,
    rowHeight = DEFAULT_ROW_HEIGHT
  ): BreakpointProfile => ({
    id: newId(),
    label,
    range,
    grid: { cols, rowHeight, gap: DEFAULT_GAP_PX },
    layout: sortTilesReadingOrder(
      base.map((t) => normalizeTileToGrid({ ...t }, cols)).map((t) => {
        const d = defs[t.type];
        return normalizeTileToGrid(
          {
            ...t,
            colSpan: clamp(t.colSpan, d.minColSpan, Math.min(d.maxColSpan, cols)),
          },
          cols
        );
      })
    ),
  });

  return repairProfileRanges([
    mk("Mobile", { minWidth: 0, maxWidth: 639, minHeight: 0, maxHeight: MAX_VIEWPORT_DIM }, 4),
    mk("Tablet", { minWidth: 640, maxWidth: 1023, minHeight: 0, maxHeight: MAX_VIEWPORT_DIM }, 8),
    mk("Desktop", { minWidth: 1024, maxWidth: MAX_VIEWPORT_DIM, minHeight: 0, maxHeight: MAX_VIEWPORT_DIM }, 12),
  ]);
}

function sortTilesReadingOrder(layout: TileItem[]): TileItem[] {
  return [...layout].sort((a, b) => {
    if (a.rowStart !== b.rowStart) return a.rowStart - b.rowStart;
    return a.colStart - b.colStart;
  });
}

/**
 * Creates a new breakpoint by splitting the last profile's range in half.
 * The ranges stay contiguous — repairProfileRanges ensures the full
 * 0–MAX_VIEWPORT_DIM spectrum is always covered.
 */
export function createNewBreakpointProfile(
  existing: BreakpointProfile[],
  cloneFrom: BreakpointProfile | null,
  defs: WidgetConstraintsMap
): BreakpointProfile {
  const sorted = sortProfiles(existing);
  let startW: number;
  let endW: number;

  if (sorted.length === 0) {
    startW = 0;
    endW = MAX_VIEWPORT_DIM;
  } else {
    const last = sorted[sorted.length - 1];
    const mid = Math.round((last.range.minWidth + last.range.maxWidth) / 2);
    startW = Math.max(mid + 1, last.range.minWidth + 50);
    endW = MAX_VIEWPORT_DIM;
  }

  const cols = cloneFrom?.grid.cols ?? 12;
  const layout = cloneFrom
    ? cloneLayout(cloneFrom.layout).map((t) => normalizeTileToGrid({ ...t }, cols))
    : defaultTileLayout.map((t) => normalizeTileToGrid({ ...t }, cols)).map((t) => {
        const d = defs[t.type];
        return normalizeTileToGrid(
          { ...t, colSpan: clamp(t.colSpan, d.minColSpan, Math.min(d.maxColSpan, cols)) },
          cols
        );
      });

  return {
    id: newId(),
    label: `Breakpoint ${existing.length + 1}`,
    range: {
      minWidth: startW,
      maxWidth: endW,
      minHeight: 0,
      maxHeight: MAX_VIEWPORT_DIM,
    },
    grid: {
      cols,
      rowHeight: cloneFrom?.grid.rowHeight ?? DEFAULT_ROW_HEIGHT,
      gap: cloneFrom?.grid.gap ?? DEFAULT_GAP_PX,
    },
    layout,
  };
}
