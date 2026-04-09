import { createDefaultLayoutConfigV2, defaultTileLayout, LEGACY_GRID_COLS_KEY, LEGACY_TILE_LAYOUT_KEY, LAYOUT_CONFIG_V2_KEY } from "./constants";
import { createDefaultProfilesFromLayout } from "./breakpoints";
import { clamp, normalizeLayout } from "./tileGeometry";
import type { LayoutConfigV2, WidgetConstraintsMap } from "./types";

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sanitizeReactivePreset(input: unknown): LayoutConfigV2["reactive"]["preset"] {
  return input === "focus" || input === "dense" || input === "balanced" ? input : "balanced";
}

function sanitizeAnimationStyle(input: unknown): LayoutConfigV2["reactive"]["animationStyle"] {
  return input === "none" || input === "subtle" || input === "smooth" ? input : "smooth";
}

function isLayoutConfigV2(x: unknown): x is LayoutConfigV2 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 2 || (o.mode !== "reactive" && o.mode !== "customBreakpoints")) return false;
  const reactive = o.reactive;
  const custom = o.custom;
  if (!reactive || typeof reactive !== "object") return false;
  if (!custom || typeof custom !== "object") return false;
  const cr = custom as Record<string, unknown>;
  if (!Array.isArray(cr.profiles)) return false;
  return true;
}

function stripProfilesForValidation(cfg: LayoutConfigV2): LayoutConfigV2 {
  return {
    ...cfg,
    custom: {
      ...cfg.custom,
      profiles: cfg.custom.profiles.map((p) => ({
        ...p,
        layout: p.layout,
      })),
    },
  };
}

export function loadLayoutConfig(defs: WidgetConstraintsMap): LayoutConfigV2 {
  const raw = localStorage.getItem(LAYOUT_CONFIG_V2_KEY);
  if (raw) {
    const parsed = safeParse(raw);
    if (isLayoutConfigV2(parsed)) {
      const cfg = stripProfilesForValidation(parsed);
      cfg.reactive.layout = normalizeLayout(cfg.reactive.layout, defs, defaultTileLayout);
      cfg.reactive.preferredGridCols = clamp(cfg.reactive.preferredGridCols ?? 12, 4, 12);
      cfg.reactive.baseGridCols = clamp(cfg.reactive.baseGridCols ?? 12, 4, 12);
      cfg.reactive.preset = sanitizeReactivePreset(cfg.reactive.preset);
      cfg.reactive.animationStyle = sanitizeAnimationStyle(cfg.reactive.animationStyle);
      cfg.custom.profiles = (cfg.custom.profiles ?? []).map((p) => ({
        ...p,
        grid: {
          cols: clamp(p.grid?.cols ?? 12, 2, 12),
          rowHeight: clamp(p.grid?.rowHeight ?? 110, 72, 200),
          gap: clamp(p.grid?.gap ?? 16, 8, 32),
        },
        layout: normalizeLayout(p.layout, defs, defaultTileLayout),
      }));
      if (cfg.custom.profiles.length === 0 && cfg.mode === "customBreakpoints") {
        cfg.custom.profiles = createDefaultProfilesFromLayout(cfg.reactive.layout, defs);
        cfg.custom.selectedProfileId = cfg.custom.profiles[0]?.id ?? null;
      }
      return cfg;
    }
  }

  return migrateFromV1(defs);
}

function migrateFromV1(defs: WidgetConstraintsMap): LayoutConfigV2 {
  const base = createDefaultLayoutConfigV2();
  try {
    const layoutRaw = localStorage.getItem(LEGACY_TILE_LAYOUT_KEY);
    if (layoutRaw) {
      base.reactive.layout = normalizeLayout(JSON.parse(layoutRaw), defs, defaultTileLayout);
    }
    const colsRaw = localStorage.getItem(LEGACY_GRID_COLS_KEY);
    const n = Number(colsRaw);
    if (Number.isFinite(n)) base.reactive.preferredGridCols = clamp(n, 4, 12);
  } catch {
    /* keep defaults */
  }
  base.custom.profiles = createDefaultProfilesFromLayout(base.reactive.layout, defs);
  base.custom.selectedProfileId = base.custom.profiles[0]?.id ?? null;
  return base;
}

export function saveLayoutConfig(config: LayoutConfigV2): void {
  localStorage.setItem(LAYOUT_CONFIG_V2_KEY, JSON.stringify(config));
}
