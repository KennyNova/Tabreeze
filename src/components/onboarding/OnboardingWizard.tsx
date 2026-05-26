import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { widgetConstraints } from "../widgetRegistry";
import ThemeSwatchPanel from "../ThemeSwatchPanel";
import SearchSourceLogo from "../../search/SearchSourceLogo";
import { loadLayoutConfig, saveLayoutConfig } from "../../layout/storage";
import { REACTIVE_PRESETS } from "../../layout/reactive";
import { defaultTileLayout } from "../../layout/constants";
import type { ReactivePreset, TileItem } from "../../layout/types";
import { getStoredIcalUrl, storeIcalUrl } from "../../services/googleCalendar";
import { getWeatherSettings, saveWeatherSettings, searchCity, type GeocodingResult } from "../../services/weather";
import { loadQuotesDefaultMode, saveQuotesDefaultMode } from "../../settings/quotesMode";
import { getAvailableSearchSources, loadCustomSearchSources } from "../../search/sources";
import { NEWS_CUSTOM_RSS_KEY, NEWS_CUSTOM_SOURCE_ID, NEWS_SOURCE_KEY, NEWS_SOURCES } from "../../services/news";
import { quoteCategories } from "../../data/quotes";
import {
  buildFolderTree,
  loadBookmarkSyncScope,
  pruneOrphanExclusions,
  saveBookmarkSyncScope,
  type BookmarkTreeFolderNode,
} from "../../settings/bookmarksSync";
import {
  createDefaultOnboardingAnswers,
  dismissOnboardingUntilResume,
  loadOnboardingDraft,
  markOnboardingCompleted,
  saveOnboardingDraft,
  type OnboardingAnswers,
  type OnboardingContentMode,
  type OnboardingPresetProfileId,
  type OnboardingStepId,
  type OnboardingWidgetId,
} from "../../settings/onboarding";
import type { ThemeState } from "../../settings/themeStore";
import type { ThemeSettingsSelectablePreset, ThemeTokens } from "../../settings/themeTokens";
import OnboardingGlobe from "./OnboardingGlobe";
import OnboardingWizardChrome from "./OnboardingWizardChrome";
import OnboardingWizardProgressBar from "./OnboardingWizardProgressBar";

interface OnboardingWizardProps {
  open: boolean;
  theme: ThemeState;
  onClose: () => void;
  onRefreshDashboard: () => void;
  onApplyThemePreset: (preset: ThemeSettingsSelectablePreset) => void;
  onThemeTokenChange: (key: keyof ThemeTokens, value: string) => void;
  onThemeLockToggle: (key: keyof ThemeTokens) => void;
  onThemeRandomize: () => void;
  onWallpaperChange: (url: string) => void;
}

const STEP_TITLES: Record<OnboardingStepId, string> = {
  welcome: "Welcome",
  path: "Choose setup path",
  widgetChoice: "Choose your widgets",
  presetLayout: "Pick a preset layout",
  customLayout: "Customize your layout style",
  theme: "Pick your starting theme",
  wallpaper: "Choose a background image",
  searchConfig: "Configure search bars",
  bookmarks: "Choose bookmarks to sync",
  weather: "Set weather location",
  calendar: "Connect your calendar",
  contentMode: "Quotes or news",
  review: "Review and finish",
};

const WIZARD_WALLPAPER_PRESETS = [
  { name: "None", url: "" },
  { name: "Mountains", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80" },
  { name: "Ocean", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80" },
  { name: "Forest", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80" },
  { name: "Night Sky", url: "https://images.unsplash.com/photo-1475274047050-1d0c55b7b10c?w=1920&q=80" },
  { name: "City", url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80" },
];

function QuoteCategoryIcon({ categoryId }: { categoryId: string }) {
  const palette = ["#6d8bff", "#8f6dff", "#36b6a2", "#d68b2d", "#d25f8b", "#5f8ad2"];
  const sum = categoryId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = palette[sum % palette.length];
  const shape = sum % 4;
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill={color} fillOpacity="0.18" />
      {shape === 0 ? <path d="M7 16h10l-5-8z" fill={color} /> : null}
      {shape === 1 ? <circle cx="12" cy="12" r="5" fill={color} /> : null}
      {shape === 2 ? <rect x="7" y="7" width="10" height="10" rx="2.5" fill={color} /> : null}
      {shape === 3 ? <path d="M12 6l2 4 4 .6-3 3 .8 4.4-3.8-2.2L8.2 18l.8-4.4-3-3 4-.6z" fill={color} /> : null}
    </svg>
  );
}

function getStepRail(answers: OnboardingAnswers): OnboardingStepId[] {
  const hasWidget = (widget: OnboardingWidgetId) => answers.selectedWidgets.includes(widget);
  const shouldSkipPresetLayout = answers.path === "preset" && answers.selectedWidgets.length <= 2;
  const steps: OnboardingStepId[] = ["welcome", "widgetChoice", "path"];
  if (answers.path === "custom") steps.push("customLayout");
  else if (!shouldSkipPresetLayout) steps.push("presetLayout");
  steps.push("theme", "wallpaper");
  if (hasWidget("search")) steps.push("searchConfig");
  if (hasWidget("bookmarks")) steps.push("bookmarks");
  if (hasWidget("weather")) steps.push("weather");
  if (hasWidget("calendar")) steps.push("calendar");
  if (hasWidget("quotes")) steps.push("contentMode");
  steps.push(
    "review",
  );
  return steps;
}

function densityToPreset(density: OnboardingAnswers["customDensity"]): { preset: "balanced" | "focus" | "dense"; cols: number } {
  if (density === "comfortable") return { preset: "focus", cols: 10 };
  if (density === "dense") return { preset: "dense", cols: 12 };
  return { preset: "balanced", cols: 12 };
}

function liftLayoutToTop(layout: TileItem[]): TileItem[] {
  if (layout.length === 0) return layout;
  const minRowStart = layout.reduce((acc, tile) => Math.min(acc, tile.rowStart), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(minRowStart) || minRowStart <= 1) return layout.map((tile) => ({ ...tile }));
  const delta = minRowStart - 1;
  return layout.map((tile) => ({ ...tile, rowStart: Math.max(1, tile.rowStart - delta) }));
}

function withSingleWidgetFallback(tile: TileItem): TileItem {
  const constraints = widgetConstraints[tile.type];
  const expandedColSpan =
    tile.type === "weather"
      ? 12
      : Math.max(constraints.minColSpan, Math.min(12, Math.max(constraints.defaultColSpan, 8)));
  const expandedRowSpan =
    tile.type === "weather"
      ? Math.max(constraints.minRowSpan, Math.min(constraints.maxRowSpan, Math.max(tile.rowSpan, 2)))
      : Math.max(constraints.minRowSpan, Math.min(constraints.maxRowSpan, Math.max(tile.rowSpan, constraints.defaultRowSpan)));

  return {
    ...tile,
    colStart: 1,
    rowStart: 1,
    colSpan: expandedColSpan,
    rowSpan: expandedRowSpan,
  };
}

function withAdaptiveSpan(tile: TileItem, widgetCount: number): TileItem {
  if (widgetCount <= 1) return withSingleWidgetFallback(tile);
  const constraints = widgetConstraints[tile.type];
  const minSpanByCount = widgetCount === 2 ? 6 : widgetCount === 3 ? 4 : constraints.minColSpan;
  const colSpan = Math.max(
    constraints.minColSpan,
    Math.min(12, Math.min(constraints.maxColSpan, Math.max(tile.colSpan, minSpanByCount)))
  );
  const rowSpan =
    tile.type === "weather" && widgetCount <= 2
      ? Math.max(constraints.minRowSpan, Math.min(constraints.maxRowSpan, Math.max(tile.rowSpan, 2)))
      : Math.max(constraints.minRowSpan, Math.min(constraints.maxRowSpan, tile.rowSpan));
  return { ...tile, colSpan, rowSpan };
}

function compactPackTiles(layout: TileItem[]): TileItem[] {
  if (layout.length <= 1) return layout.map((tile) => ({ ...tile }));
  const placed: TileItem[] = [];
  for (const tile of layout) {
    const maxColStart = Math.max(1, 12 - tile.colSpan + 1);
    let assigned: TileItem | null = null;
    for (let row = 1; row <= 200 && !assigned; row += 1) {
      for (let col = 1; col <= maxColStart; col += 1) {
        const candidate: TileItem = { ...tile, colStart: col, rowStart: row };
        const overlap = placed.some((other) => {
          const candidateRight = candidate.colStart + candidate.colSpan - 1;
          const candidateBottom = candidate.rowStart + candidate.rowSpan - 1;
          const otherRight = other.colStart + other.colSpan - 1;
          const otherBottom = other.rowStart + other.rowSpan - 1;
          return !(
            candidateRight < other.colStart ||
            otherRight < candidate.colStart ||
            candidateBottom < other.rowStart ||
            otherBottom < candidate.rowStart
          );
        });
        if (!overlap) {
          assigned = candidate;
          break;
        }
      }
    }
    placed.push(assigned ?? { ...tile, colStart: 1, rowStart: Math.max(1, tile.rowStart) });
  }
  return placed;
}

function inferThemeChoiceFromTheme(theme: ThemeState): OnboardingAnswers["themeChoice"] {
  if (theme.preset === "dark") return "dark";
  if (theme.preset === "dev" || theme.preset === "devDark" || theme.preset === "devNight") return "dev-matrix";
  if (theme.preset === "coffee" || theme.preset === "coffeeDark" || theme.preset === "coffeeNight") {
    return "coffee-espresso";
  }
  return "light";
}

const PRESET_PREVIEW_CONFIG = { cols: 12, rowHeight: 11, gap: 3 };
const ALL_WIDGETS: OnboardingWidgetId[] = [
  "greeting",
  "search",
  "bookmarks",
  "tasks",
  "calendar",
  "weather",
  "quotes",
  "homelab",
];

type PresetPreviewStrategy =
  | "starter"
  | "deep-work"
  | "signal-hub"
  | "research-desk"
  | "ops-center"
  | "everything"
  | "spotlight";

interface PresetProfileDefinition {
  id: OnboardingPresetProfileId;
  title: string;
  subtitle: string;
  description: string;
  requiredWidgets: OnboardingWidgetId[];
  reactivePreset: ReactivePreset;
  previewStrategy: PresetPreviewStrategy;
  focusWidget?: OnboardingWidgetId;
  compactSearch?: boolean;
}

const PRESET_PROFILES: PresetProfileDefinition[] = [
  {
    id: "starter",
    title: "Starter Command Bar",
    subtitle: "Fast everyday launcher",
    description: "Clean top search with core cards underneath for a quick, low-friction start.",
    requiredWidgets: ["search"],
    reactivePreset: "balanced",
    previewStrategy: "starter",
  },
  {
    id: "quick-glance",
    title: "Quick Glance",
    subtitle: "Simple at-a-glance start",
    description: "A lightweight dashboard that keeps search and your core cards easy to scan.",
    requiredWidgets: ["search"],
    reactivePreset: "balanced",
    previewStrategy: "starter",
  },
  {
    id: "daily-planner",
    title: "Daily Planner",
    subtitle: "Calendar-led cadence",
    description: "Ideal when your day is schedule-driven and you want tasks close to your timeline.",
    requiredWidgets: ["search", "calendar"],
    reactivePreset: "focus",
    previewStrategy: "deep-work",
  },
  {
    id: "weather-brief",
    title: "Weather Brief",
    subtitle: "Conditions-first dashboard",
    description: "Puts weather forward for quick decisions; homelab can join if enabled.",
    requiredWidgets: ["search", "weather"],
    reactivePreset: "dense",
    previewStrategy: "signal-hub",
  },
  {
    id: "bookmark-flow",
    title: "Bookmark Flow",
    subtitle: "Link-heavy workflow",
    description: "Optimized for users who rely on bookmarks and frequent lookup.",
    requiredWidgets: ["search", "bookmarks"],
    reactivePreset: "balanced",
    previewStrategy: "research-desk",
  },
  {
    id: "deep-work",
    title: "Deep Work Flow",
    subtitle: "Task-first dashboard",
    description: "Prioritizes tasks and calendar in the primary area with search always leading.",
    requiredWidgets: ["search", "tasks", "calendar"],
    reactivePreset: "focus",
    previewStrategy: "deep-work",
  },
  {
    id: "signal-hub",
    title: "Signal Hub",
    subtitle: "Quick info board",
    description: "Brings weather forward for instant checks; homelab appears when enabled.",
    requiredWidgets: ["search", "weather"],
    reactivePreset: "dense",
    previewStrategy: "signal-hub",
  },
  {
    id: "research-desk",
    title: "Research Desk",
    subtitle: "Reading and retrieval",
    description: "Centers search and bookmarks, with context cards arranged for information gathering.",
    requiredWidgets: ["search", "bookmarks", "quotes"],
    reactivePreset: "balanced",
    previewStrategy: "research-desk",
  },
  {
    id: "ops-center",
    title: "Ops Center",
    subtitle: "Work + infrastructure",
    description: "Blends tasks with live conditions; homelab automatically joins if enabled.",
    requiredWidgets: ["search", "tasks", "weather"],
    reactivePreset: "dense",
    previewStrategy: "ops-center",
  },
  {
    id: "everything",
    title: "Everything Board",
    subtitle: "Full control surface",
    description: "Balanced whole-stack board that gives all enabled widgets intentional space.",
    requiredWidgets: [...ALL_WIDGETS],
    reactivePreset: "dense",
    previewStrategy: "everything",
  },
];

const PREVIEW_TILE_LABELS: Record<TileItem["type"], string> = {
  greeting: "Greeting",
  search: "Search",
  bookmarks: "Bookmarks",
  quotes: "Quotes/News",
  tasks: "Tasks",
  calendar: "Calendar",
  weather: "Weather",
  homelab: "Homelab",
};

const PREVIEW_TILE_COLORS: Record<TileItem["type"], { bg: string; border: string; text: string }> = {
  greeting: {
    bg: "color-mix(in srgb, #8b5cf6 24%, transparent)",
    border: "color-mix(in srgb, #8b5cf6 52%, transparent)",
    text: "color-mix(in srgb, #e9d5ff 92%, var(--theme-text) 8%)",
  },
  search: {
    bg: "color-mix(in srgb, #3b82f6 24%, transparent)",
    border: "color-mix(in srgb, #3b82f6 52%, transparent)",
    text: "color-mix(in srgb, #dbeafe 92%, var(--theme-text) 8%)",
  },
  bookmarks: {
    bg: "color-mix(in srgb, #f59e0b 22%, transparent)",
    border: "color-mix(in srgb, #f59e0b 52%, transparent)",
    text: "color-mix(in srgb, #fef3c7 94%, var(--theme-text) 6%)",
  },
  quotes: {
    bg: "color-mix(in srgb, #ec4899 20%, transparent)",
    border: "color-mix(in srgb, #ec4899 50%, transparent)",
    text: "color-mix(in srgb, #fce7f3 92%, var(--theme-text) 8%)",
  },
  tasks: {
    bg: "color-mix(in srgb, #22c55e 22%, transparent)",
    border: "color-mix(in srgb, #22c55e 52%, transparent)",
    text: "color-mix(in srgb, #dcfce7 92%, var(--theme-text) 8%)",
  },
  calendar: {
    bg: "color-mix(in srgb, #06b6d4 20%, transparent)",
    border: "color-mix(in srgb, #06b6d4 50%, transparent)",
    text: "color-mix(in srgb, #cffafe 92%, var(--theme-text) 8%)",
  },
  weather: {
    bg: "color-mix(in srgb, #f97316 20%, transparent)",
    border: "color-mix(in srgb, #f97316 50%, transparent)",
    text: "color-mix(in srgb, #ffedd5 94%, var(--theme-text) 6%)",
  },
  homelab: {
    bg: "color-mix(in srgb, #14b8a6 22%, transparent)",
    border: "color-mix(in srgb, #14b8a6 52%, transparent)",
    text: "color-mix(in srgb, #ccfbf1 92%, var(--theme-text) 8%)",
  },
};

function resolveAvailablePresetProfiles(selectedWidgets: OnboardingWidgetId[]): PresetProfileDefinition[] {
  const selected = new Set(selectedWidgets);
  const available = PRESET_PROFILES.filter((profile) =>
    profile.requiredWidgets.every((widget) => selected.has(widget))
  );
  if (selectedWidgets.length >= 3 && selectedWidgets.length <= 4) {
    const spotlightProfiles = buildSpotlightPresetProfiles(selectedWidgets);
    const merged: PresetProfileDefinition[] = [];
    for (const spotlight of spotlightProfiles) {
      merged.push(spotlight);
    }
    for (const profile of available) {
      if (merged.some((item) => item.id === profile.id)) continue;
      merged.push(profile);
    }
    return dedupePresetProfiles(merged);
  }
  return dedupePresetProfiles(available);
}

function normalizePresetSelection(answers: OnboardingAnswers): OnboardingAnswers {
  const available = resolveAvailablePresetProfiles(answers.selectedWidgets);
  const current = available.find((profile) => profile.id === answers.presetProfileId) ?? available[0];
  if (!current) return answers;
  if (answers.presetProfileId === current.id && answers.presetLayout === current.reactivePreset) return answers;
  return {
    ...answers,
    presetProfileId: current.id,
    presetLayout: current.reactivePreset,
  };
}

function getPresetProfileLabel(profileId: OnboardingPresetProfileId): string {
  return (
    PRESET_PROFILES.find((profile) => profile.id === profileId)?.title ??
    SPOTLIGHT_ID_TO_TITLE[profileId] ??
    "Preset layout"
  );
}

const SPOTLIGHT_PRESET_IDS: Array<OnboardingPresetProfileId> = ["spotlight-a", "spotlight-b", "spotlight-c"];
const SPOTLIGHT_ID_TO_TITLE: Partial<Record<OnboardingPresetProfileId, string>> = {
  "spotlight-a": "Widget Spotlight A",
  "spotlight-b": "Widget Spotlight B",
  "spotlight-c": "Widget Spotlight C",
};

function widgetPriority(widget: OnboardingWidgetId): number {
  const ranking: Record<OnboardingWidgetId, number> = {
    tasks: 100,
    weather: 96,
    calendar: 92,
    bookmarks: 88,
    quotes: 84,
    homelab: 82,
    greeting: 72,
    search: 64,
  };
  return ranking[widget];
}

function buildSpotlightPresetProfiles(selectedWidgets: OnboardingWidgetId[]): PresetProfileDefinition[] {
  const focusCandidates: OnboardingWidgetId[] = [...selectedWidgets]
    .filter((widget) => widget !== "search")
    .sort((a, b) => widgetPriority(b) - widgetPriority(a)) as OnboardingWidgetId[];
  if (focusCandidates.length === 0 && selectedWidgets.includes("search")) focusCandidates.push("search");
  while (focusCandidates.length < 3) {
    focusCandidates.push(focusCandidates[focusCandidates.length - 1] ?? "search");
  }
  const topFocuses = focusCandidates.slice(0, 3);
  return topFocuses.map((focusWidget, index) => {
    const spotlightId = SPOTLIGHT_PRESET_IDS[index]!;
    return {
      id: spotlightId,
      title: `${PREVIEW_TILE_LABELS[focusWidget]} Spotlight`,
      subtitle: "Feature-first layout",
      description: `Highlights ${PREVIEW_TILE_LABELS[focusWidget]} as the main top widget with compact support cards.`,
      requiredWidgets: [focusWidget],
      reactivePreset: index === 0 ? "focus" : index === 1 ? "dense" : "balanced",
      previewStrategy: "spotlight",
      focusWidget,
      compactSearch: index !== 0,
    };
  });
}

function previewWeightForPreset(
  strategy: PresetPreviewStrategy,
  type: TileItem["type"],
  focusWidget?: OnboardingWidgetId
): number {
  if (strategy === "spotlight") {
    if (focusWidget && type === focusWidget) return 130;
    if (type === "search") return 95;
    return 70 - widgetPriority(type as OnboardingWidgetId) * 0.05;
  }
  const byStrategy: Record<PresetPreviewStrategy, Record<TileItem["type"], number>> = {
    starter: {
      search: 100,
      greeting: 90,
      tasks: 80,
      calendar: 75,
      bookmarks: 70,
      weather: 65,
      quotes: 60,
      homelab: 55,
    },
    "deep-work": {
      search: 110,
      tasks: 100,
      calendar: 95,
      bookmarks: 85,
      greeting: 70,
      quotes: 60,
      weather: 50,
      homelab: 40,
    },
    "signal-hub": {
      search: 110,
      weather: 100,
      homelab: 96,
      calendar: 86,
      bookmarks: 82,
      quotes: 78,
      tasks: 75,
      greeting: 62,
    },
    "research-desk": {
      search: 110,
      bookmarks: 102,
      quotes: 92,
      calendar: 78,
      tasks: 72,
      greeting: 68,
      weather: 58,
      homelab: 52,
    },
    "ops-center": {
      search: 110,
      tasks: 100,
      weather: 96,
      homelab: 92,
      calendar: 84,
      bookmarks: 78,
      quotes: 64,
      greeting: 58,
    },
    everything: {
      search: 110,
      tasks: 98,
      calendar: 94,
      weather: 90,
      homelab: 88,
      bookmarks: 84,
      quotes: 80,
      greeting: 76,
    },
    spotlight: {
      search: 95,
      tasks: 90,
      calendar: 88,
      weather: 86,
      bookmarks: 84,
      quotes: 82,
      homelab: 80,
      greeting: 78,
    },
  };
  return byStrategy[strategy][type];
}

function previewSpanForPreset(
  strategy: PresetPreviewStrategy,
  type: TileItem["type"],
  indexWithinType: number,
  focusWidget?: OnboardingWidgetId,
  compactSearch?: boolean
): { colSpan: number; rowSpan: number } {
  const firstSearch = indexWithinType === 0;
  if (strategy === "spotlight") {
    if (focusWidget && type === focusWidget) return { colSpan: 8, rowSpan: 3 };
    if (type === "search") {
      if (!firstSearch) return { colSpan: compactSearch ? 3 : 4, rowSpan: 1 };
      return { colSpan: compactSearch ? 4 : 6, rowSpan: 1 };
    }
    if (type === "greeting") return { colSpan: 4, rowSpan: 1 };
    if (type === "homelab") return { colSpan: 6, rowSpan: 2 };
    return { colSpan: 4, rowSpan: 2 };
  }
  const byStrategy: Record<PresetPreviewStrategy, Record<TileItem["type"], { colSpan: number; rowSpan: number }>> = {
    starter: {
      greeting: { colSpan: 6, rowSpan: 1 },
      search: { colSpan: firstSearch ? 12 : 4, rowSpan: 1 },
      bookmarks: { colSpan: 6, rowSpan: 2 },
      quotes: { colSpan: 6, rowSpan: 2 },
      tasks: { colSpan: 6, rowSpan: 2 },
      calendar: { colSpan: 6, rowSpan: 2 },
      weather: { colSpan: 6, rowSpan: 2 },
      homelab: { colSpan: 12, rowSpan: 2 },
    },
    "deep-work": {
      greeting: { colSpan: 4, rowSpan: 1 },
      search: { colSpan: firstSearch ? 12 : 6, rowSpan: 1 },
      bookmarks: { colSpan: 8, rowSpan: 2 },
      quotes: { colSpan: 4, rowSpan: 2 },
      tasks: { colSpan: 8, rowSpan: 3 },
      calendar: { colSpan: 4, rowSpan: 3 },
      weather: { colSpan: 4, rowSpan: 2 },
      homelab: { colSpan: 12, rowSpan: 1 },
    },
    "signal-hub": {
      greeting: { colSpan: 4, rowSpan: 1 },
      search: { colSpan: firstSearch ? 12 : 4, rowSpan: 1 },
      bookmarks: { colSpan: 4, rowSpan: 2 },
      quotes: { colSpan: 4, rowSpan: 2 },
      tasks: { colSpan: 4, rowSpan: 2 },
      calendar: { colSpan: 4, rowSpan: 2 },
      weather: { colSpan: 4, rowSpan: 2 },
      homelab: { colSpan: 8, rowSpan: 2 },
    },
    "research-desk": {
      greeting: { colSpan: 4, rowSpan: 1 },
      search: { colSpan: firstSearch ? 12 : 4, rowSpan: 1 },
      bookmarks: { colSpan: 8, rowSpan: 3 },
      quotes: { colSpan: 4, rowSpan: 3 },
      tasks: { colSpan: 4, rowSpan: 2 },
      calendar: { colSpan: 4, rowSpan: 2 },
      weather: { colSpan: 4, rowSpan: 2 },
      homelab: { colSpan: 8, rowSpan: 2 },
    },
    "ops-center": {
      greeting: { colSpan: 4, rowSpan: 1 },
      search: { colSpan: firstSearch ? 12 : 4, rowSpan: 1 },
      bookmarks: { colSpan: 4, rowSpan: 2 },
      quotes: { colSpan: 4, rowSpan: 2 },
      tasks: { colSpan: 6, rowSpan: 3 },
      calendar: { colSpan: 6, rowSpan: 2 },
      weather: { colSpan: 4, rowSpan: 2 },
      homelab: { colSpan: 8, rowSpan: 2 },
    },
    everything: {
      greeting: { colSpan: 4, rowSpan: 1 },
      search: { colSpan: firstSearch ? 12 : 4, rowSpan: 1 },
      bookmarks: { colSpan: 4, rowSpan: 2 },
      quotes: { colSpan: 4, rowSpan: 2 },
      tasks: { colSpan: 4, rowSpan: 2 },
      calendar: { colSpan: 4, rowSpan: 2 },
      weather: { colSpan: 4, rowSpan: 2 },
      homelab: { colSpan: 8, rowSpan: 2 },
    },
    spotlight: {
      greeting: { colSpan: 4, rowSpan: 1 },
      search: { colSpan: firstSearch ? 6 : 4, rowSpan: 1 },
      bookmarks: { colSpan: 4, rowSpan: 2 },
      quotes: { colSpan: 4, rowSpan: 2 },
      tasks: { colSpan: 4, rowSpan: 2 },
      calendar: { colSpan: 4, rowSpan: 2 },
      weather: { colSpan: 4, rowSpan: 2 },
      homelab: { colSpan: 6, rowSpan: 2 },
    },
  };
  return byStrategy[strategy][type];
}

function buildPreviewLayout(baseLayout: TileItem[], profile: PresetProfileDefinition): TileItem[] {
  const strategy = profile.previewStrategy;
  const cols = PRESET_PREVIEW_CONFIG.cols;
  const occupancy = new Set<string>();
  const typeCounts = new Map<TileItem["type"], number>();
  const tiles = baseLayout
    .map((tile) => ({ ...tile }))
    .sort((a, b) => {
      const weightDiff =
        previewWeightForPreset(strategy, b.type, profile.focusWidget) -
        previewWeightForPreset(strategy, a.type, profile.focusWidget);
      if (weightDiff !== 0) return weightDiff;
      return a.id.localeCompare(b.id);
    });

  const canPlace = (colStart: number, rowStart: number, colSpan: number, rowSpan: number): boolean => {
    for (let row = rowStart; row < rowStart + rowSpan; row += 1) {
      for (let col = colStart; col < colStart + colSpan; col += 1) {
        if (occupancy.has(`${row}:${col}`)) return false;
      }
    }
    return true;
  };

  const markPlaced = (colStart: number, rowStart: number, colSpan: number, rowSpan: number) => {
    for (let row = rowStart; row < rowStart + rowSpan; row += 1) {
      for (let col = colStart; col < colStart + colSpan; col += 1) {
        occupancy.add(`${row}:${col}`);
      }
    }
  };

  return tiles.map((tile) => {
    const indexWithinType = typeCounts.get(tile.type) ?? 0;
    typeCounts.set(tile.type, indexWithinType + 1);
    const span = previewSpanForPreset(
      strategy,
      tile.type,
      indexWithinType,
      profile.focusWidget,
      profile.compactSearch
    );
    const colSpan = Math.max(1, Math.min(cols, span.colSpan));
    const rowSpan = Math.max(1, span.rowSpan);
    const maxColStart = cols - colSpan + 1;
    let placedCol = 1;
    let placedRow = 1;
    let assigned = false;
    for (let row = 1; row <= 60 && !assigned; row += 1) {
      for (let col = 1; col <= maxColStart; col += 1) {
        if (!canPlace(col, row, colSpan, rowSpan)) continue;
        placedCol = col;
        placedRow = row;
        assigned = true;
        markPlaced(col, row, colSpan, rowSpan);
        break;
      }
    }
    return {
      ...tile,
      colStart: placedCol,
      rowStart: placedRow,
      colSpan,
      rowSpan,
    };
  });
}

function presetRedundancyKey(profile: PresetProfileDefinition): string {
  return `${profile.previewStrategy}|${profile.focusWidget ?? "none"}|${profile.compactSearch ? "compact" : "regular"}`;
}

function dedupePresetProfiles(profiles: PresetProfileDefinition[]): PresetProfileDefinition[] {
  const seen = new Set<string>();
  const deduped: PresetProfileDefinition[] = [];
  for (const profile of profiles) {
    const key = presetRedundancyKey(profile);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(profile);
  }
  return deduped;
}

function sortTileItems(layout: TileItem[]): TileItem[] {
  return [...layout].sort((a, b) => a.id.localeCompare(b.id));
}

function areTileLayoutsEqual(a: TileItem[], b: TileItem[]): boolean {
  if (a.length !== b.length) return false;
  const left = sortTileItems(a);
  const right = sortTileItems(b);
  return left.every((tile, idx) => {
    const other = right[idx]!;
    return (
      tile.id === other.id &&
      tile.type === other.type &&
      tile.colStart === other.colStart &&
      tile.rowStart === other.rowStart &&
      tile.colSpan === other.colSpan &&
      tile.rowSpan === other.rowSpan
    );
  });
}

function reconcilePresetLayout(base: TileItem[], override: TileItem[] | undefined): TileItem[] {
  if (!override || override.length === 0) return base;
  const map = new Map(override.map((tile) => [tile.id, tile]));
  return base.map((tile) => {
    const patched = map.get(tile.id);
    if (!patched) return tile;
    return {
      ...tile,
      colStart: patched.colStart,
      rowStart: patched.rowStart,
      colSpan: patched.colSpan,
      rowSpan: patched.rowSpan,
    };
  });
}

function hasTileOverlap(layout: TileItem[]): boolean {
  for (let i = 0; i < layout.length; i += 1) {
    const left = layout[i]!;
    const leftRight = left.colStart + left.colSpan - 1;
    const leftBottom = left.rowStart + left.rowSpan - 1;
    for (let j = i + 1; j < layout.length; j += 1) {
      const right = layout[j]!;
      const rightRight = right.colStart + right.colSpan - 1;
      const rightBottom = right.rowStart + right.rowSpan - 1;
      const overlaps = !(
        leftRight < right.colStart ||
        rightRight < left.colStart ||
        leftBottom < right.rowStart ||
        rightBottom < left.rowStart
      );
      if (overlaps) return true;
    }
  }
  return false;
}

export default function OnboardingWizard({
  open,
  theme,
  onClose,
  onRefreshDashboard,
  onApplyThemePreset,
  onThemeTokenChange,
  onThemeLockToggle,
  onThemeRandomize,
  onWallpaperChange,
}: OnboardingWizardProps) {
  type PreviewInteractionMode = "move" | "resize";
  interface PreviewInteractionState {
    profileId: string;
    tileId: string;
    mode: PreviewInteractionMode;
    startX: number;
    startY: number;
    startTile: TileItem;
    startLayout: TileItem[];
    colStep: number;
    rowStep: number;
  }
  const [stepId, setStepId] = useState<OnboardingStepId>("welcome");
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => createDefaultOnboardingAnswers());
  const [bookmarkTree, setBookmarkTree] = useState<BookmarkTreeFolderNode[]>([]);
  const [bookmarkTreeRaw, setBookmarkTreeRaw] = useState<chrome.bookmarks.BookmarkTreeNode[] | null>(null);
  const [bookmarkError, setBookmarkError] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<GeocodingResult[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [weatherStatus, setWeatherStatus] = useState("");
  const [calendarTestStatus, setCalendarTestStatus] = useState<string>("");
  const [calendarTestBusy, setCalendarTestBusy] = useState(false);
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState("");
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [hasVisitedReview, setHasVisitedReview] = useState(false);
  const [wizardError, setWizardError] = useState("");
  const [presetPreviewOverrides, setPresetPreviewOverrides] = useState<Record<string, TileItem[]>>({});
  const previewInteractionRef = useRef<PreviewInteractionState | null>(null);
  const presetDefaultLayoutsRef = useRef<Record<string, TileItem[]>>({});
  const globePhiRef = useRef(0);
  const globeThetaRef = useRef(0);
  const globeScaleRef = useRef(1.08);
  const globeAnimationFrameRef = useRef<number | null>(null);
  const longitudeToPhi = (lon: number): number => -((lon + 90) * Math.PI) / 180;
  const latitudeToTheta = (lat: number): number => (lat * Math.PI) / 180;

  const searchSources = useMemo(
    () => getAvailableSearchSources(loadCustomSearchSources()),
    []
  );
  const availablePresetProfiles = useMemo(
    () => resolveAvailablePresetProfiles(answers.selectedWidgets),
    [answers.selectedWidgets]
  );
  const activePresetProfile = useMemo(
    () =>
      availablePresetProfiles.find((profile) => profile.id === answers.presetProfileId) ??
      availablePresetProfiles[0] ??
      null,
    [availablePresetProfiles, answers.presetProfileId]
  );
  const stepRail = useMemo(() => getStepRail(answers), [answers]);
  const stepIndex = Math.max(0, stepRail.indexOf(stepId));
  const progressFraction = (stepIndex + 1) / stepRail.length;
  const isLastStep = stepRail[stepRail.length - 1] === stepId;
  const isFiniteNumber = (value: number | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value);
  const formatCoordinate = (value: unknown): string =>
    typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "—";

  const applyPresetOverride = (profileId: string, layout: TileItem[]) => {
    const defaultLayout = presetDefaultLayoutsRef.current[profileId];
    if (defaultLayout && areTileLayoutsEqual(layout, defaultLayout)) {
      setPresetPreviewOverrides((prev) => {
        if (!prev[profileId]) return prev;
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      return;
    }
    setPresetPreviewOverrides((prev) => ({ ...prev, [profileId]: layout }));
  };

  const startPresetInteraction = (
    event: ReactMouseEvent,
    profileId: string,
    tile: TileItem,
    layout: TileItem[],
    mode: PreviewInteractionMode
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    const grid = target.parentElement;
    const config = PRESET_PREVIEW_CONFIG;
    const usableWidth = Math.max(120, (grid?.clientWidth ?? 220) - (config.cols - 1) * config.gap);
    const colWidth = usableWidth / config.cols;
    previewInteractionRef.current = {
      profileId,
      tileId: tile.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startTile: { ...tile },
      startLayout: layout.map((item) => ({ ...item })),
      colStep: colWidth + config.gap,
      rowStep: config.rowHeight + config.gap,
    };
    if (typeof document !== "undefined") {
      document.body.style.cursor = mode === "resize" ? "nwse-resize" : "grabbing";
    }
  };

  useEffect(() => {
    const onPointerMove = (event: MouseEvent) => {
      const interaction = previewInteractionRef.current;
      if (!interaction) return;
      const deltaX = event.clientX - interaction.startX;
      const deltaY = event.clientY - interaction.startY;
      const config = PRESET_PREVIEW_CONFIG;
      const deltaCols = Math.round(deltaX / Math.max(1, interaction.colStep));
      const deltaRows = Math.round(deltaY / Math.max(1, interaction.rowStep));
      const nextLayout = interaction.startLayout.map((tile) => {
        if (tile.id !== interaction.tileId) return tile;
        if (interaction.mode === "move") {
          const nextColStart = Math.max(1, Math.min(config.cols, interaction.startTile.colStart + deltaCols));
          const nextRowStart = Math.max(1, interaction.startTile.rowStart + deltaRows);
          return { ...tile, colStart: nextColStart, rowStart: nextRowStart };
        }
        const nextColSpan = Math.max(1, Math.min(config.cols, interaction.startTile.colSpan + deltaCols));
        const nextRowSpan = Math.max(1, interaction.startTile.rowSpan + deltaRows);
        const clampedColSpan = Math.min(nextColSpan, config.cols - tile.colStart + 1);
        return { ...tile, colSpan: clampedColSpan, rowSpan: nextRowSpan };
      });
      applyPresetOverride(interaction.profileId, nextLayout);
      if (typeof document !== "undefined") {
        document.body.style.cursor = interaction.mode === "resize" ? "nwse-resize" : "grabbing";
      }
    };

    const onPointerUp = () => {
      previewInteractionRef.current = null;
      if (typeof document !== "undefined") {
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      if (typeof document !== "undefined") {
        document.body.style.cursor = "";
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (globeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(globeAnimationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const draft = loadOnboardingDraft();
    const weather = getWeatherSettings();
    const bookmarks = loadBookmarkSyncScope();
    const wallpaper = localStorage.getItem("dashboard-wallpaper") ?? "";
    const quoteCategory = localStorage.getItem("dashboard-quote-category") ?? "inspirational";
    const newsSource = localStorage.getItem(NEWS_SOURCE_KEY) ?? NEWS_SOURCES[0]?.id ?? "google-top";
    const newsCustomRssUrl = localStorage.getItem(NEWS_CUSTOM_RSS_KEY) ?? "";
    const baseAnswers = {
      ...createDefaultOnboardingAnswers(),
      themeChoice: inferThemeChoiceFromTheme(theme),
      wallpaperUrl: wallpaper,
      weather: {
        unit: weather.unit,
        customLat: weather.customLat,
        customLon: weather.customLon,
        customCity: weather.customCity,
      },
      calendarUrl: getStoredIcalUrl(),
      contentMode: loadQuotesDefaultMode(),
      quoteCategoryId: quoteCategory,
      newsSourceId: newsSource,
      newsCustomRssUrl,
      bookmarks: bookmarks ?? createDefaultOnboardingAnswers().bookmarks,
    } satisfies OnboardingAnswers;
    const seededAnswers = draft ? { ...baseAnswers, ...draft.answers } : baseAnswers;
    setAnswers(normalizePresetSelection(seededAnswers));
    setStepId(draft?.stepId ?? "welcome");
    setCityQuery("");
    setCityResults([]);
    setWeatherStatus("");
    setCalendarTestStatus("");
    setCustomWallpaperUrl("");
    setExpandedFolderIds(["1"]);
    setHasVisitedReview(false);
    setPresetPreviewOverrides({});
    const draftAnswers = draft?.answers;
    const initialLatCandidate = draftAnswers?.weather.customLat ?? weather.customLat;
    const initialLonCandidate = draftAnswers?.weather.customLon ?? weather.customLon;
    const initLat = isFiniteNumber(initialLatCandidate) ? initialLatCandidate : 0;
    const initLon = isFiniteNumber(initialLonCandidate) ? initialLonCandidate : 0;
    globePhiRef.current = longitudeToPhi(initLon);
    globeThetaRef.current = latitudeToTheta(initLat);
    globeScaleRef.current = 1.08;
  }, [open]);

  useEffect(() => {
    if (stepId === "review") setHasVisitedReview(true);
  }, [stepId]);

  useEffect(() => {
    const normalized = normalizePresetSelection(answers);
    if (
      normalized.presetProfileId === answers.presetProfileId &&
      normalized.presetLayout === answers.presetLayout
    ) {
      return;
    }
    setAnswers(normalized);
  }, [answers]);

  useEffect(() => {
    if (!open || stepId !== "bookmarks") return;
    if (typeof chrome === "undefined" || !chrome.bookmarks) {
      setBookmarkError("Bookmarks API unavailable in this environment.");
      setBookmarkTree([]);
      setBookmarkTreeRaw(null);
      return;
    }
    chrome.bookmarks.getTree((tree) => {
      setBookmarkTree(buildFolderTree(tree));
      setBookmarkTreeRaw(tree);
      setBookmarkError("");
      setAnswers((prev) => {
        const pruned = pruneOrphanExclusions(tree, prev.bookmarks);
        return {
          ...prev,
          bookmarks: pruned,
        };
      });
    });
  }, [open, stepId]);

  const buildLayoutFromAnswers = (): TileItem[] => {
    const selected = new Set(answers.selectedWidgets);
    const base = defaultTileLayout.filter((tile) => selected.has(tile.type as OnboardingWidgetId) && tile.type !== "search");
    const searchTiles: TileItem[] = [];
    if (selected.has("search")) {
      const bars = answers.searchBars.length > 0 ? answers.searchBars : [{ sourceId: "chatgpt" }];
      for (let i = 0; i < bars.length; i += 1) {
        searchTiles.push({
          id: `tile-search-${i + 1}`,
          type: "search",
          colStart: 1,
          rowStart: 3 + i,
          colSpan: 12,
          rowSpan: 1,
          settings: { searchSourceId: bars[i]!.sourceId },
        });
      }
    }

    const hasSearch = searchTiles.length > 0;
    const extraSearchRows = hasSearch ? Math.max(0, searchTiles.length - 1) : 0;
    const compactedBase = base.map((tile) => {
      if (!hasSearch && tile.rowStart >= 4) {
        return { ...tile, rowStart: tile.rowStart - 1 };
      }
      if (extraSearchRows > 0 && tile.rowStart >= 4) {
        return { ...tile, rowStart: tile.rowStart + extraSearchRows };
      }
      return { ...tile };
    });
    let layout = [...compactedBase, ...searchTiles].sort((a, b) => a.rowStart - b.rowStart);

    if (selected.has("homelab")) {
      const maxEnd = layout.reduce((acc, tile) => Math.max(acc, tile.rowStart + tile.rowSpan), 1);
      layout.push({
        id: "tile-homelab-1",
        type: "homelab",
        colStart: 1,
        rowStart: maxEnd,
        colSpan: 12,
        rowSpan: 3,
      });
    }

    if (!selected.has("greeting")) {
      layout = layout.filter((tile) => tile.type !== "greeting");
    }

    let normalizedLayout = liftLayoutToTop(layout);
    if (normalizedLayout.length <= 3) {
      const adaptive = normalizedLayout.map((tile) => withAdaptiveSpan(tile, normalizedLayout.length));
      normalizedLayout = compactPackTiles(adaptive);
      normalizedLayout = liftLayoutToTop(normalizedLayout);
    }

    return normalizedLayout;
  };

  const activePresetHasOverlap = useMemo(() => {
    if (!activePresetProfile) return false;
    const baseLayout = buildLayoutFromAnswers();
    const defaultPreview = buildPreviewLayout(baseLayout, activePresetProfile);
    const effectivePreview = reconcilePresetLayout(defaultPreview, presetPreviewOverrides[activePresetProfile.id]);
    return hasTileOverlap(effectivePreview);
  }, [activePresetProfile, answers, presetPreviewOverrides]);

  const persistSelections = (nextStep: OnboardingStepId): boolean => {
    try {
      const answersForPersist = normalizePresetSelection(answers);
      if (
        answersForPersist.presetProfileId !== answers.presetProfileId ||
        answersForPersist.presetLayout !== answers.presetLayout
      ) {
        setAnswers(answersForPersist);
      }
      const baseLayout = buildLayoutFromAnswers();
      const layoutConfig = loadLayoutConfig(widgetConstraints);
      layoutConfig.reactive.layout = baseLayout;
      if (answersForPersist.path === "preset") {
        layoutConfig.mode = "reactive";
        const selectedProfile = resolveAvailablePresetProfiles(answersForPersist.selectedWidgets).find(
          (profile) => profile.id === answersForPersist.presetProfileId
        );
        if (selectedProfile) {
          const defaultPresetLayout = buildPreviewLayout(baseLayout, selectedProfile);
          const appliedPresetLayout = reconcilePresetLayout(
            defaultPresetLayout,
            presetPreviewOverrides[selectedProfile.id]
          );
          layoutConfig.reactive.layout = appliedPresetLayout;
        }
        const presetToUse = selectedProfile?.reactivePreset ?? answersForPersist.presetLayout;
        layoutConfig.reactive.preset = presetToUse;
        const preset = REACTIVE_PRESETS.find((item) => item.id === presetToUse);
        layoutConfig.reactive.preferredGridCols = preset?.recommendedMaxCols ?? 12;
      } else if (answersForPersist.path === "custom") {
        layoutConfig.mode = "reactive";
        const mapped = densityToPreset(answersForPersist.customDensity);
        layoutConfig.reactive.preset = mapped.preset;
        layoutConfig.reactive.preferredGridCols = mapped.cols;
      }
      saveLayoutConfig(layoutConfig);

      saveWeatherSettings({
        unit: answersForPersist.weather.unit,
        customLat: isFiniteNumber(answersForPersist.weather.customLat) ? answersForPersist.weather.customLat : undefined,
        customLon: isFiniteNumber(answersForPersist.weather.customLon) ? answersForPersist.weather.customLon : undefined,
        customCity: answersForPersist.weather.customCity,
      });

      if (answersForPersist.calendarUrl.trim()) {
        storeIcalUrl(answersForPersist.calendarUrl.trim());
      }

      localStorage.setItem("dashboard-quote-category", answersForPersist.quoteCategoryId);
      localStorage.setItem(NEWS_SOURCE_KEY, answersForPersist.newsSourceId);
      localStorage.setItem(NEWS_CUSTOM_RSS_KEY, answersForPersist.newsCustomRssUrl.trim());
      onWallpaperChange(answersForPersist.wallpaperUrl);
      saveQuotesDefaultMode(answersForPersist.contentMode);
      saveBookmarkSyncScope(answersForPersist.bookmarks);
      saveOnboardingDraft(nextStep, answersForPersist);
      setWizardError("");
      return true;
    } catch (error) {
      console.error("Failed to persist onboarding selections", error);
      setWizardError("Could not save setup progress. Please retry, then refresh if this keeps happening.");
      return false;
    }
  };

  const handleSaveAndExit = () => {
    if (!persistSelections(stepId)) return;
    dismissOnboardingUntilResume();
    onRefreshDashboard();
    onClose();
  };

  const handleFinalize = () => {
    if (!persistSelections("review")) return;
    markOnboardingCompleted();
    onRefreshDashboard();
    onClose();
  };

  const handleBack = () => {
    const idx = stepRail.indexOf(stepId);
    if (idx <= 0) return;
    const previousStep = stepRail[idx - 1]!;
    try {
      setStepId(previousStep);
      saveOnboardingDraft(previousStep, answers);
      setWizardError("");
    } catch (error) {
      console.error("Failed to go back in onboarding wizard", error);
      setWizardError("Could not save setup progress while going back. Please retry.");
    }
  };

  const canContinue = (() => {
    if (stepId === "path") return answers.path !== null;
    if (stepId === "presetLayout") return availablePresetProfiles.length > 0 && !activePresetHasOverlap;
    if (stepId === "contentMode" && answers.contentMode === "news" && answers.newsSourceId === NEWS_CUSTOM_SOURCE_ID) {
      return Boolean(answers.newsCustomRssUrl.trim());
    }
    return true;
  })();

  const skipWidgetStep = (widget: OnboardingWidgetId) => {
    const nextAnswers = normalizePresetSelection({
      ...answers,
      selectedWidgets: answers.selectedWidgets.filter((item) => item !== widget),
      ...(widget === "search" ? { searchBars: [] } : {}),
      ...(widget === "quotes" ? { contentMode: "quotes" as OnboardingContentMode } : {}),
    });
    const oldRail = stepRail;
    const currentIdx = oldRail.indexOf(stepId);
    const newRail = getStepRail(nextAnswers);
    const candidateSteps = oldRail.slice(currentIdx + 1);
    const fallbackStep = newRail[newRail.length - 1] ?? "review";
    const nextStep = candidateSteps.find((candidate) => newRail.includes(candidate)) ?? fallbackStep;
    setAnswers(nextAnswers);
    if (!persistSelections(nextStep)) return;
    setStepId(nextStep);
  };

  const applyThemeChoiceLive = (choice: OnboardingAnswers["themeChoice"]) => {
    setAnswers((prev) => ({ ...prev, themeChoice: choice }));
    if (choice === "random") {
      onThemeRandomize();
      return;
    }
    const preset: ThemeSettingsSelectablePreset =
      choice === "dark" ? "dark" : choice === "dev-matrix" ? "dev" : choice === "coffee-espresso" ? "coffee" : "light";
    onApplyThemePreset(preset);
  };

  const handleNext = () => {
    if (!canContinue) return;
    if (isLastStep) {
      handleFinalize();
      return;
    }
    const idx = stepRail.indexOf(stepId);
    const nextStep = stepRail[Math.min(stepRail.length - 1, idx + 1)]!;
    if (!persistSelections(nextStep)) return;
    setStepId(nextStep);
  };

  const jumpToStep = (targetStep: OnboardingStepId) => {
    if (!stepRail.includes(targetStep)) return;
    if (!persistSelections(targetStep)) return;
    setStepId(targetStep);
  };

  const handleJumpToReview = () => {
    if (!canContinue || stepId === "review") return;
    jumpToStep("review");
  };

  const runCitySearch = async () => {
    const query = cityQuery.trim();
    if (!query) return;
    setCityLoading(true);
    const results = await searchCity(query);
    setCityResults(results);
    setCityLoading(false);
  };

  const stopGlobeAnimation = () => {
    if (globeAnimationFrameRef.current === null) return;
    window.cancelAnimationFrame(globeAnimationFrameRef.current);
    globeAnimationFrameRef.current = null;
  };

  const animateGlobeTo = (
    lat: number,
    lon: number,
    options?: {
      durationMs?: number;
      spinTurns?: number;
      spinRevolutions?: number;
      targetScale?: number;
    }
  ) => {
    stopGlobeAnimation();
    const durationMs = options?.durationMs ?? 1700;
    const requestedRevolutions = options?.spinRevolutions ?? options?.spinTurns ?? 1;
    const spinRevolutions = Math.max(0, Math.round(requestedRevolutions));
    const targetScale = options?.targetScale ?? globeScaleRef.current;
    const twoPi = Math.PI * 2;
    const wrapToPi = (angle: number) => ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;

    const startPhi = globePhiRef.current;
    const startTheta = globeThetaRef.current;
    const startScale = globeScaleRef.current;
    const targetTheta = latitudeToTheta(lat);
    const baseTargetPhi = longitudeToPhi(lon);
    const shortestPhiDelta = wrapToPi(baseTargetPhi - startPhi);
    const spinDirection = shortestPhiDelta >= 0 ? 1 : -1;
    const targetPhi = startPhi + shortestPhiDelta + spinDirection * twoPi * spinRevolutions;

    let startTime = 0;
    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const tick = (timestamp: number) => {
      if (startTime === 0) startTime = timestamp;
      const progress = Math.min(1, (timestamp - startTime) / durationMs);
      const eased = easeInOutCubic(progress);
      globePhiRef.current = startPhi + (targetPhi - startPhi) * eased;
      globeThetaRef.current = startTheta + (targetTheta - startTheta) * eased;
      globeScaleRef.current = startScale + (targetScale - startScale) * eased;

      if (progress < 1) {
        globeAnimationFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        globePhiRef.current = targetPhi;
        globeThetaRef.current = targetTheta;
        globeScaleRef.current = targetScale;
        globeAnimationFrameRef.current = null;
      }
    };

    globeAnimationFrameRef.current = window.requestAnimationFrame(tick);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        animateGlobeTo(position.coords.latitude, position.coords.longitude, {
          targetScale: 2.7,
          spinRevolutions: 2,
          durationMs: 1850,
        });
        setAnswers((prev) => ({
          ...prev,
          weather: {
            ...prev.weather,
            customLat: position.coords.latitude,
            customLon: position.coords.longitude,
            customCity: "My location",
          },
        }));
      },
      () => {
        setWeatherStatus("Location permission denied. Drag the pin or search for your city.");
      },
      { timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  };

  const testCalendarUrl = async () => {
    const url = answers.calendarUrl.trim();
    if (!url) return;
    setCalendarTestBusy(true);
    setCalendarTestStatus("");
    try {
      const response = await fetch(url);
      const text = await response.text();
      if (!response.ok) {
        setCalendarTestStatus(`URL responded with ${response.status}`);
      } else if (!text.includes("BEGIN:VCALENDAR")) {
        setCalendarTestStatus("URL loaded, but it does not look like an iCal feed.");
      } else {
        setCalendarTestStatus("Looks good — iCal feed reachable.");
      }
    } catch {
      setCalendarTestStatus("Could not reach this URL. Check sharing/privacy settings.");
    } finally {
      setCalendarTestBusy(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  const renderStep = () => {
    if (stepId === "welcome") {
      return (
        <div className="onboarding-welcome-stage">
          <div className="onboarding-welcome-title-wrap">
            <h2 className="onboarding-welcome-title-text">Tabreeze</h2>
          </div>

          <div className="onboarding-welcome-content">
            <p className="onboarding-welcome-kicker">
              Your new tab, reimagined
            </p>
            <p className="onboarding-welcome-subtitle theme-text">
              Build a command center that feels intentional from the first second. Start with a polished baseline, then personalize it to match exactly how you think and work.
            </p>
            <div className="onboarding-welcome-tour-grid">
              {[
                { title: "Smart Search", note: "Search Google, ChatGPT, Claude, Perplexity and more from one keyboard-first bar." },
                { title: "Adaptive Layout", note: "Drag, resize, and shape your dashboard so every widget sits where your brain expects it." },
                { title: "Live Context", note: "Weather, tasks, bookmarks, calendar, and headlines stay visible the moment a tab opens." },
                { title: "Visual Identity", note: "Curated themes, random palettes, and wallpaper control make the page unmistakably yours." },
              ].map((item, idx) => (
                <div
                  key={item.title}
                  className="onboarding-welcome-tour-card"
                  style={{ animationDelay: `${1.55 + idx * 0.1}s` }}
                >
                  <div className="text-[11px] uppercase tracking-[0.14em] theme-text-secondary">Feature</div>
                  <div className="text-[14px] font-semibold theme-text mt-1">{item.title}</div>
                  <div className="text-[12px] theme-text-secondary mt-1.5">{item.note}</div>
                </div>
              ))}
            </div>
            <div
              className="onboarding-welcome-next"
              style={{
                background: "color-mix(in srgb, var(--theme-surface) 55%, transparent)",
              }}
            >
              <div className="text-[11px] uppercase tracking-[0.14em] theme-text-secondary">What happens next</div>
              <p className="text-sm theme-text mt-1">
                Next, pick your widgets. Right after that, choose <span className="font-semibold">Preset</span> for a ready-made layout or <span className="font-semibold">Customize</span> for full control.
              </p>
            </div>
          </div>
          <p className="onboarding-welcome-footer text-xs theme-text-secondary">
            No account. No tracking. Just a better place to land every time you hit Ctrl+T.
          </p>
        </div>
      );
    }

    if (stepId === "path") {
      const pathVizMap = {
        widgets: (
          <div className="onboarding-path-viz-widgets" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`onboarding-path-viz-tile${i === 2 ? " onboarding-path-viz-tile--accent" : ""}`}
              />
            ))}
          </div>
        ),
        blueprint: (
          <div className="onboarding-path-viz-blueprint" aria-hidden>
            <div className="onboarding-path-viz-blueprint-bar onboarding-path-viz-blueprint-bar--hero" />
            <div className="onboarding-path-viz-blueprint-bar" />
            <div className="onboarding-path-viz-blueprint-bar" />
          </div>
        ),
        theme: <div className="onboarding-path-viz-theme" aria-hidden />,
        branch: (
          <div className="onboarding-path-viz-branch" aria-hidden>
            <span className="onboarding-path-viz-dot" />
            <span className="onboarding-path-viz-branch-line" />
            <span className="onboarding-path-viz-dot" />
            <span className="onboarding-path-viz-branch-line" />
            <span className="onboarding-path-viz-dot" />
            <span className="onboarding-path-viz-branch-line" />
            <span className="onboarding-path-viz-dot" />
          </div>
        ),
        review: (
          <div className="onboarding-path-viz-depth" aria-hidden>
            <div className="onboarding-path-viz-depth-row onboarding-path-viz-depth-row--accent" />
            <div className="onboarding-path-viz-depth-row" />
            <div className="onboarding-path-viz-depth-row onboarding-path-viz-depth-row--accent" />
            <div className="onboarding-path-viz-depth-row" />
          </div>
        ),
        density: (
          <div className="onboarding-path-viz-density" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="onboarding-path-viz-density-col" />
            ))}
          </div>
        ),
      } satisfies Record<"widgets" | "blueprint" | "theme" | "branch" | "review" | "density", JSX.Element>;

      const presetTimeline: Array<{ title: string; detail: string; viz: JSX.Element | null }> = [
        {
          title: "Pick your widgets",
          detail:
            "Toggle what belongs on every new tab. Preset keeps the wizard short—we only drill into widgets you turned on.",
          viz: pathVizMap.widgets,
        },
        {
          title: "Apply a finished layout pack",
          detail:
            "Choose a blueprint and we drop cards into place with spacing and columns already tuned—no fiddling required.",
          viz: pathVizMap.blueprint,
        },
        {
          title: "Set the look and finish",
          detail:
            "Pick theme + wallpaper, run any optional widget screens that matter, then review and save in one pass.",
          viz: pathVizMap.review,
        },
      ];

      const customTimeline: Array<{ title: string; detail: string; viz: JSX.Element | null }> = [
        {
          title: "Pick your widgets deliberately",
          detail:
            "Every module you toggle unlocks finer steps later—you control breadth before we touch density or integrations.",
          viz: pathVizMap.widgets,
        },
        {
          title: "Choose your layout density",
          detail:
            "Select Comfortable, Balanced, or Dense to control spacing and information pressure before deeper setup.",
          viz: pathVizMap.density,
        },
        {
          title: "Theme and wallpaper artistry",
          detail:
            "Same surfaces as preset, but the intent is personal curation—you can revisit tokens or swap wallpaper until it clicks.",
          viz: pathVizMap.theme,
        },
        {
          title: "Per-widget mastery",
          detail:
            "Folders, ICS links, locales, RSS, homelab pings—everything gets explicit rows so power users never fight defaults.",
          viz: pathVizMap.review,
        },
        {
          title: "Review and finalize",
          detail:
            "The final review shows your full stack so you can jump back, adjust, and then lock it in.",
          viz: pathVizMap.blueprint,
        },
      ];
      const selectedWidgetCount = answers.selectedWidgets.length;
      const customEstimateMin = Math.max(7, 5 + selectedWidgetCount);
      const customEstimateMax = Math.max(customEstimateMin + 6, 10 + selectedWidgetCount * 3);
      const customEstimateLabel = `~${customEstimateMin}–${customEstimateMax} min`;

      return (
        <div className="space-y-5">
          <p className="text-sm theme-text-secondary leading-relaxed">
            <span className="font-semibold theme-text">Preset</span> is the fast lane: curated layouts snap in so you ship a polished new tab fast.{" "}
            <span className="font-semibold theme-text">Custom</span> swaps the blueprint step for density control plus deeper drawers on every gadget you enabled.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              {
                id: "preset",
                title: "Use a preset",
                estimate: "~3–10 min",
                blurb: "Lets Tabreeze tune grid math for you.",
              },
              {
                id: "custom",
                title: "Customize with wizard",
                estimate: customEstimateLabel,
                blurb: "You steer density and every powered widget.",
              },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, path: option.id }))}
                className="text-left rounded-2xl border p-4 transition-colors"
                style={{
                  borderColor:
                    answers.path === option.id
                      ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                      : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                  background:
                    answers.path === option.id
                      ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                      : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
                }}
              >
                <div className="font-semibold text-sm theme-text">{option.title}</div>
                <div className="mt-1">
                  <span className="onboarding-path-time-pill">{option.estimate}</span>
                </div>
                <div className="text-xs theme-text-secondary mt-1">{option.blurb}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              className={`onboarding-path-journey${answers.path === "preset" ? " onboarding-path-journey--active" : ""}`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.12em] theme-text-secondary">Preset timeline</div>
              <p className="text-xs theme-text-secondary mt-3 leading-snug">
                Fastest onboarding: blueprint applies immediately after widgets, integrations only surface when relevant, finishing is mostly confirmation.
              </p>
              <div className="mt-2">
                {presetTimeline.map((row, idx) => (
                  <div key={row.title} className="onboarding-path-step">
                    <div className="onboarding-path-step-index">{idx + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold theme-text">{row.title}</div>
                      <p className="text-xs theme-text-secondary mt-2 leading-snug">{row.detail}</p>
                      {row.viz ? (
                        <div className="onboarding-path-viz">{row.viz}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`onboarding-path-journey${answers.path === "custom" ? " onboarding-path-journey--active" : ""}`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.12em] theme-text-secondary">Custom timeline</div>
              <p className="text-xs theme-text-secondary mt-3 leading-snug">
                Every stage adds control: spacing choices up front and deep configuration afterward, capped by review so nothing stays hidden behind defaults.
              </p>
              <div className="mt-2">
                {customTimeline.map((row, idx) => (
                  <div key={row.title} className="onboarding-path-step">
                    <div className="onboarding-path-step-index">{idx + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold theme-text">{row.title}</div>
                      <p className="text-xs theme-text-secondary mt-2 leading-snug">{row.detail}</p>
                      {row.viz ? (
                        <div className="onboarding-path-viz">{row.viz}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (stepId === "widgetChoice") {
      const widgetMeta: Array<{ id: OnboardingWidgetId; title: string; desc: string }> = [
        { id: "greeting", title: "Greeting + Clock", desc: "Ground your day the second a tab opens." },
        { id: "search", title: "Smart Search", desc: "Launch queries to engines and AIs instantly." },
        { id: "bookmarks", title: "Bookmarks Grid", desc: "Turn buried links into one-glance access." },
        { id: "tasks", title: "Tasks", desc: "Capture and complete work without leaving the tab." },
        { id: "calendar", title: "Calendar", desc: "See what is next without opening another app." },
        { id: "weather", title: "Weather", desc: "Know conditions and forecast before stepping out." },
        { id: "quotes", title: "Quotes / News", desc: "Choose inspiration or headlines as your pulse." },
        { id: "homelab", title: "Homelab", desc: "Monitor your self-hosted services at a glance." },
      ];
      const selected = new Set(answers.selectedWidgets);
      return (
        <div className="space-y-3">
          <div className="text-xs theme-text-secondary">Pick what should appear on your dashboard.</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {widgetMeta.map((widget) => (
              <button
                key={widget.id}
                type="button"
                onClick={() =>
                  setAnswers((prev) => {
                    const has = prev.selectedWidgets.includes(widget.id);
                    const nextAnswers: OnboardingAnswers = {
                      ...prev,
                      selectedWidgets: has
                        ? prev.selectedWidgets.filter((id) => id !== widget.id)
                        : [...prev.selectedWidgets, widget.id],
                      ...(widget.id === "search" && has ? { searchBars: [] } : {}),
                    };
                    return normalizePresetSelection(nextAnswers);
                  })
                }
                className="rounded-2xl border p-4 text-left transition-colors"
                style={{
                  borderColor: selected.has(widget.id)
                    ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                    : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                  background: selected.has(widget.id)
                    ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                    : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
                }}
              >
                <div className="font-medium text-sm theme-text">{widget.title}</div>
                <div className="text-xs theme-text-secondary mt-1">{widget.desc}</div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (stepId === "presetLayout") {
      const previewBaseLayout = buildLayoutFromAnswers();
      const missingWidgetSet = new Set<OnboardingWidgetId>();
      for (const profile of PRESET_PROFILES) {
        if (availablePresetProfiles.some((available) => available.id === profile.id)) continue;
        for (const widget of profile.requiredWidgets) {
          if (!answers.selectedWidgets.includes(widget)) missingWidgetSet.add(widget);
        }
      }
      const missingWidgetList = [...missingWidgetSet];
      return (
        <div className="space-y-3">
          {availablePresetProfiles.length === 0 ? (
            <div className="rounded-2xl border p-4 text-xs theme-text-secondary">
              Add widgets first, then presets will appear here.
            </div>
          ) : null}
          {availablePresetProfiles.length > 0 ? (
            <div className="text-[11px] theme-text-secondary">
              Drag cards to move, use the corner handle to resize, and stack tiles freely while previewing.
            </div>
          ) : null}
          <div
            className="rounded-xl border px-3 py-2 text-[11px] min-h-[34px] flex items-center"
            style={{
              borderColor: activePresetHasOverlap ? "color-mix(in srgb, #ef4444 45%, transparent)" : "transparent",
              opacity: activePresetHasOverlap ? 1 : 0,
            }}
            aria-live="polite"
          >
            Selected preset has overlapping widgets. Fix overlaps before continuing.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availablePresetProfiles.map((profile) => {
              const config = PRESET_PREVIEW_CONFIG;
              const defaultPreviewTiles = buildPreviewLayout(previewBaseLayout, profile);
              const previewTiles = reconcilePresetLayout(defaultPreviewTiles, presetPreviewOverrides[profile.id]);
              const edited = !areTileLayoutsEqual(defaultPreviewTiles, previewTiles);
              const hasOverlap = hasTileOverlap(previewTiles);
              presetDefaultLayoutsRef.current[profile.id] = defaultPreviewTiles;
              const maxRow = previewTiles.reduce((acc, tile) => Math.max(acc, tile.rowStart + tile.rowSpan - 1), 1);
              return (
                <div
                  key={profile.id}
                  className="rounded-2xl border p-4 text-left transition-colors"
                  style={{
                    borderColor:
                      hasOverlap
                        ? "color-mix(in srgb, #ef4444 55%, transparent)"
                        : activePresetProfile?.id === profile.id
                        ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                        : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                    background:
                      activePresetProfile?.id === profile.id
                        ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                        : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
                  }}
                  onClick={() => {
                    if (hasOverlap) return;
                    setAnswers((prev) => ({
                      ...prev,
                      presetProfileId: profile.id,
                      presetLayout: profile.reactivePreset,
                    }));
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm theme-text">{profile.title}</div>
                    <button
                      type="button"
                      className="btn-ghost text-[11px] px-2 py-1 min-w-[46px]"
                      style={{ visibility: edited ? "visible" : "hidden" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setPresetPreviewOverrides((prev) => {
                          if (!prev[profile.id]) return prev;
                          const next = { ...prev };
                          delete next[profile.id];
                          return next;
                        });
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="text-xs theme-text-secondary mt-1">{profile.subtitle}</div>
                  <div
                    className="mt-3 rounded-xl border p-2"
                    style={{
                      borderColor: "color-mix(in srgb, var(--theme-border) 55%, transparent)",
                      background: "color-mix(in srgb, var(--theme-bg) 42%, transparent)",
                    }}
                  >
                    {previewBaseLayout.length === 0 ? (
                      <div className="text-[11px] theme-text-secondary py-5 text-center">
                        Select at least one widget to preview this layout.
                      </div>
                    ) : (
                      <div
                        className="grid w-full select-none"
                        style={{
                          gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${Math.max(2, maxRow)}, ${config.rowHeight}px)`,
                          gap: `${config.gap}px`,
                        }}
                      >
                        {previewTiles.map((tile, tileIndex) => (
                          <div
                            key={`${profile.id}-${tile.id}`}
                            className="rounded-md border px-1.5 py-1 text-[10px] leading-none truncate relative cursor-grab"
                            style={{
                              gridColumn: `${tile.colStart} / span ${tile.colSpan}`,
                              gridRow: `${tile.rowStart} / span ${Math.max(1, tile.rowSpan)}`,
                              borderColor: PREVIEW_TILE_COLORS[tile.type].border,
                              background: PREVIEW_TILE_COLORS[tile.type].bg,
                              color: PREVIEW_TILE_COLORS[tile.type].text,
                              zIndex: tileIndex + 1,
                            }}
                            title={PREVIEW_TILE_LABELS[tile.type]}
                            onMouseDown={(event) => startPresetInteraction(event, profile.id, tile, previewTiles, "move")}
                          >
                            {PREVIEW_TILE_LABELS[tile.type]}
                            <span
                              className="absolute right-0.5 bottom-0.5 w-2.5 h-2.5 rounded-sm cursor-nwse-resize"
                              style={{
                                background: "color-mix(in srgb, var(--theme-surface) 72%, transparent)",
                                border: "1px solid color-mix(in srgb, var(--theme-border) 65%, transparent)",
                              }}
                              onMouseDown={(event) => startPresetInteraction(event, profile.id, tile, previewTiles, "resize")}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div
                    className="text-[11px] mt-2 min-h-[16px]"
                    style={{ color: hasOverlap ? "#ef4444" : "transparent" }}
                  >
                    Overlap detected. Rearrange or resize tiles before selecting.
                  </div>
                  <div className="text-[11px] theme-text-secondary mt-2">{profile.description}</div>
                </div>
              );
            })}
          </div>
          {missingWidgetList.length > 0 ? (
            <div className="rounded-xl border px-3 py-2 text-[11px] theme-text-secondary">
              More presets unlock when you enable more widgets: {missingWidgetList.join(", ")}
            </div>
          ) : null}
        </div>
      );
    }

    if (stepId === "customLayout") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { id: "comfortable", title: "Comfortable", desc: "Larger cards and fewer columns." },
            { id: "balanced", title: "Balanced", desc: "Default spacing for mixed workflows." },
            { id: "dense", title: "Dense", desc: "Fits more content on screen." },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setAnswers((prev) => ({ ...prev, customDensity: option.id }))}
              className="rounded-2xl border p-4 text-left"
              style={{
                borderColor:
                  answers.customDensity === option.id
                    ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                    : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                background:
                  answers.customDensity === option.id
                    ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                    : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
              }}
            >
              <div className="font-medium text-sm theme-text">{option.title}</div>
              <div className="text-xs theme-text-secondary mt-1">{option.desc}</div>
            </button>
          ))}
        </div>
      );
    }

    if (stepId === "theme") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {([
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
              { id: "dev-matrix", label: "Dev" },
              { id: "coffee-espresso", label: "Coffee" },
              { id: "random", label: "Randomize" },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyThemeChoiceLive(item.id)}
                className="rounded-xl border p-2.5 text-left text-xs"
                style={{
                  borderColor:
                    answers.themeChoice === item.id
                      ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                      : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                  background:
                    answers.themeChoice === item.id
                      ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                      : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <ThemeSwatchPanel
            theme={theme}
            onApplyPreset={(preset) =>
              applyThemeChoiceLive(
                preset === "dark" ? "dark" : preset === "dev" ? "dev-matrix" : preset === "coffee" ? "coffee-espresso" : "light"
              )
            }
            onTokenChange={onThemeTokenChange}
            onToggleLock={onThemeLockToggle}
            onRandomize={() => applyThemeChoiceLive("random")}
          />
        </div>
      );
    }

    if (stepId === "wallpaper") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {WIZARD_WALLPAPER_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setAnswers((prev) => ({ ...prev, wallpaperUrl: preset.url }));
                  onWallpaperChange(preset.url);
                }}
                className="rounded-xl border p-1.5 text-left overflow-hidden"
                style={{
                  borderColor:
                    answers.wallpaperUrl === preset.url
                      ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                      : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                }}
              >
                <div className="h-20 rounded-lg overflow-hidden">
                  {preset.url ? (
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs theme-text-secondary bg-black/[0.04] dark:bg-white/[0.06]">
                      None
                    </div>
                  )}
                </div>
                <div className="text-xs theme-text-secondary mt-1 px-0.5">{preset.name}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customWallpaperUrl}
              onChange={(event) => setCustomWallpaperUrl(event.target.value)}
              className="input-field text-xs"
              placeholder="Custom wallpaper URL..."
            />
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                const next = customWallpaperUrl.trim();
                if (!next) return;
                setAnswers((prev) => ({ ...prev, wallpaperUrl: next }));
                onWallpaperChange(next);
              }}
            >
              Set
            </button>
          </div>
        </div>
      );
    }

    if (stepId === "searchConfig") {
      const bars = answers.searchBars.length > 0 ? answers.searchBars : [{ sourceId: "chatgpt" }];
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs theme-text-secondary">How many search bars?</span>
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() =>
                  setAnswers((prev) => {
                    const nextBars = Array.from({ length: count }, (_, idx) => ({
                      sourceId: prev.searchBars[idx]?.sourceId ?? "chatgpt",
                    }));
                    return {
                      ...prev,
                      searchBars: nextBars,
                    };
                  })
                }
                className="px-2.5 py-1 rounded-lg text-xs"
                style={{
                  background:
                    bars.length === count
                      ? "color-mix(in srgb, var(--theme-accent) 20%, transparent)"
                      : "color-mix(in srgb, var(--theme-surface-hover) 75%, transparent)",
                }}
              >
                {count}
              </button>
            ))}
          </div>
          <div className="grid gap-3">
            {bars.map((bar, idx) => (
              <div key={`search-bar-${idx}`} className="rounded-xl border p-3">
                <div className="text-xs theme-text-secondary mb-2">Search bar {idx + 1}</div>
                <div className="flex items-stretch gap-2 flex-nowrap overflow-x-auto pb-1">
                  {searchSources.map((source) => {
                    const active = source.id === bar.sourceId;
                    return (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            searchBars: prev.searchBars.map((entry, entryIdx) =>
                              entryIdx === idx ? { sourceId: source.id } : entry
                            ),
                          }))
                        }
                        className="rounded-xl border p-0 text-left overflow-hidden shrink-0"
                        style={{
                          width: "58px",
                          borderColor: active
                            ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                            : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                          background: active
                            ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                            : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
                        }}
                      >
                        <div
                          className="relative w-full"
                          style={{ aspectRatio: "5 / 8" }}
                        >
                          <div className="absolute inset-0 flex flex-col">
                            <div className="flex-1 flex items-center justify-center pt-[14%]">
                              <div
                                style={{
                                  color: active ? "var(--theme-accent)" : "var(--theme-text-secondary)",
                                  filter: active ? "none" : "grayscale(1)",
                                  opacity: active ? 1 : 0.72,
                                }}
                              >
                                <SearchSourceLogo
                                  sourceId={source.id}
                                  className="w-8 h-8 object-contain transition-all duration-200"
                                />
                              </div>
                            </div>
                            <div className="pb-2 text-center">
                              <span className="text-[11px] font-medium theme-text">{source.label}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {answers.path === "custom" ? (
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => skipWidgetStep("search")}
            >
              I don't want this widget
            </button>
          ) : null}
        </div>
      );
    }

    if (stepId === "bookmarks") {
      const selectedFolderIds = new Set(answers.bookmarks.includedFolderIds);
      const excludedIds = new Set(answers.bookmarks.excludedBookmarkIds);

      const findFolderNodeById = (
        nodes: chrome.bookmarks.BookmarkTreeNode[],
        folderId: string
      ): chrome.bookmarks.BookmarkTreeNode | null => {
        for (const node of nodes) {
          if (node.id === folderId && Array.isArray(node.children)) return node;
          if (!node.children?.length) continue;
          const hit = findFolderNodeById(node.children, folderId);
          if (hit) return hit;
        }
        return null;
      };

      const collectFolderIdsRecursive = (folder: chrome.bookmarks.BookmarkTreeNode): string[] => {
        const ids = [folder.id];
        for (const child of folder.children ?? []) {
          if (!Array.isArray(child.children)) continue;
          ids.push(...collectFolderIdsRecursive(child));
        }
        return ids;
      };

      const toggleFolderSelection = (folderId: string, forceSelect?: boolean) => {
        setAnswers((prev) => {
          const rootNodes = bookmarkTreeRaw?.[0]?.children ?? [];
          const folderNode = findFolderNodeById(rootNodes, folderId);
          const folderIds = folderNode ? collectFolderIdsRecursive(folderNode) : [folderId];
          const setNow = new Set(prev.bookmarks.includedFolderIds);
          const allSelected = folderIds.every((id) => setNow.has(id));
          const shouldSelect = forceSelect ?? !allSelected;
          const nextSet = new Set(prev.bookmarks.includedFolderIds);
          if (!shouldSelect) {
            folderIds.forEach((id) => nextSet.delete(id));
          } else {
            folderIds.forEach((id) => nextSet.add(id));
          }
          return {
            ...prev,
            bookmarks: {
              ...prev.bookmarks,
              includedFolderIds: [...nextSet],
            },
          };
        });
      };

      const toggleExpanded = (folderId: string) => {
        setExpandedFolderIds((prev) => (prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]));
      };

      const toggleBookmarkIncluded = (bookmarkId: string) => {
        setAnswers((prev) => {
          const nextExcluded = new Set(prev.bookmarks.excludedBookmarkIds);
          if (nextExcluded.has(bookmarkId)) nextExcluded.delete(bookmarkId);
          else nextExcluded.add(bookmarkId);
          return {
            ...prev,
            bookmarks: {
              ...prev.bookmarks,
              excludedBookmarkIds: [...nextExcluded],
            },
          };
        });
      };

      const renderExplorerNodes = (
        nodes: chrome.bookmarks.BookmarkTreeNode[],
        depth: number,
        parentSelected: boolean
      ): JSX.Element[] => {
        const countFolderLeafSelection = (
          folderNode: chrome.bookmarks.BookmarkTreeNode,
          branchSelected: boolean
        ): { total: number; active: number } => {
          const folderExplicit = selectedFolderIds.has(folderNode.id);
          const currentSelected = branchSelected || folderExplicit;
          let total = 0;
          let active = 0;
          for (const child of folderNode.children ?? []) {
            if (Array.isArray(child.children)) {
              const nested = countFolderLeafSelection(child, currentSelected);
              total += nested.total;
              active += nested.active;
              continue;
            }
            if (!child.url?.trim()) continue;
            total += 1;
            if (currentSelected && !excludedIds.has(child.id)) active += 1;
          }
          return { total, active };
        };

        const rows: JSX.Element[] = [];
        for (const node of nodes) {
          const isFolder = Array.isArray(node.children);
          const title = node.title?.trim() || (isFolder ? "Folder" : node.url || "Bookmark");
          const rowPadding = 10 + depth * 16;

          if (isFolder) {
            const expanded = expandedFolderIds.includes(node.id);
            const folderSelected = selectedFolderIds.has(node.id);
            const anySelected = parentSelected || folderSelected;
            const folderSelection = countFolderLeafSelection(node, parentSelected);
            const folderChecked =
              folderSelection.total > 0
                ? folderSelection.active > 0 && folderSelection.active === folderSelection.total
                : folderSelected;
            const folderIndeterminate =
              folderSelection.total > 0 &&
              folderSelection.active > 0 &&
              folderSelection.active < folderSelection.total;
            rows.push(
              <div key={node.id}>
                <div
                  className="relative flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  style={{ paddingLeft: `${rowPadding}px` }}
                >
                  {depth > 0 ? (
                    <span
                      className="absolute h-px"
                      style={{
                        left: `${rowPadding - 12}px`,
                        width: "10px",
                        background: "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                      }}
                    />
                  ) : null}
                  <input
                    type="checkbox"
                    checked={folderChecked}
                    ref={(element) => {
                      if (!element) return;
                      element.indeterminate = folderIndeterminate;
                    }}
                    onChange={() => toggleFolderSelection(node.id, folderIndeterminate || !folderChecked)}
                  />
                  <button
                    type="button"
                              className="text-xs theme-text inline-flex items-center gap-1.5"
                    onClick={() => toggleExpanded(node.id)}
                  >
                    <span>📁</span>
                    <span>{title}</span>
                  </button>
                </div>
                {expanded && node.children?.length
                  ? (
                    <div
                      className="ml-2 border-l"
                      style={{ borderColor: "color-mix(in srgb, var(--theme-border) 60%, transparent)" }}
                    >
                      {renderExplorerNodes(node.children, depth + 1, anySelected)}
                    </div>
                  )
                  : null}
              </div>
            );
            continue;
          }

          const enabled = parentSelected;
          const included = !excludedIds.has(node.id);
          rows.push(
            <label
              key={node.id}
              className="relative flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              style={{ paddingLeft: `${rowPadding + 18}px`, opacity: enabled ? 1 : 0.45 }}
            >
              {depth > 0 ? (
                <span
                  className="absolute h-px"
                  style={{
                    left: `${rowPadding + 2}px`,
                    width: "10px",
                    background: "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                  }}
                />
              ) : null}
              <input
                type="checkbox"
                checked={included}
                disabled={!enabled}
                onChange={() => toggleBookmarkIncluded(node.id)}
              />
              <span className="text-xs theme-text truncate">🔗 {title}</span>
            </label>
          );
        }
        return rows;
      };

      return (
        <div className="space-y-4">
          {bookmarkError ? <p className="text-xs text-red-500">{bookmarkError}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() =>
                setAnswers((prev) => ({
                  ...prev,
                  bookmarks: { ...prev.bookmarks, includedFolderIds: [], excludedBookmarkIds: [] },
                }))
              }
            >
              Clear selection
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() =>
                setAnswers((prev) => ({
                  ...prev,
                  bookmarks: { ...prev.bookmarks, includedFolderIds: ["1"], excludedBookmarkIds: [] },
                }))
              }
            >
              Use bookmarks bar
            </button>
          </div>

          <div className="rounded-xl border p-3 max-h-72 overflow-auto">
            <div className="text-xs font-medium mb-2 theme-text">Bookmarks Explorer</div>
            <div className="text-[11px] theme-text-secondary mb-2">
              VSCode-style tree: check folders to sync, then uncheck specific links you do not want.
            </div>
            {bookmarkTreeRaw?.[0]?.children?.length
              ? renderExplorerNodes(bookmarkTreeRaw[0].children, 0, false)
              : bookmarkTree.length
                ? bookmarkTree.map((node) => (
                    <div key={node.id} className="text-xs theme-text">
                      📁 {node.title}
                    </div>
                  ))
                : <p className="text-xs theme-text-secondary">No folders found.</p>}
          </div>
          <p className="text-xs theme-text-secondary">Excluding bookmarks only affects Tabreeze. Nothing is deleted from Chrome.</p>
          {answers.path === "custom" ? (
            <button type="button" className="btn-ghost text-xs" onClick={() => skipWidgetStep("bookmarks")}>
              I don't want this widget
            </button>
          ) : null}
        </div>
      );
    }

    if (stepId === "weather") {
      return (
        <div className="space-y-4">
          <div className="relative h-60 rounded-2xl overflow-hidden border flex items-center justify-center">
            <OnboardingGlobe
              initialPhi={globePhiRef.current}
              initialTheta={globeThetaRef.current}
              initialScale={globeScaleRef.current}
              phiRef={globePhiRef}
              thetaRef={globeThetaRef}
              scaleRef={globeScaleRef}
              onCoordinatesChange={(lat, lon) => {
                setAnswers((prev) => ({
                  ...prev,
                  weather: {
                    ...prev.weather,
                    customLat: lat,
                    customLon: lon,
                    customCity: prev.weather.customCity || "Pinned location",
                  },
                }));
              }}
            />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm bg-red-500/90" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary text-xs" onClick={useMyLocation}>
              Use my location
            </button>
            <span className="text-xs theme-text-secondary">
              Lat {formatCoordinate(answers.weather.customLat)} / Lon {formatCoordinate(answers.weather.customLon)}
            </span>
          </div>
          {weatherStatus ? <p className="text-xs theme-text-secondary">{weatherStatus}</p> : null}

          <div className="flex gap-2">
            <input
              value={cityQuery}
              onChange={(event) => setCityQuery(event.target.value)}
              className="input-field text-xs"
              placeholder="Search city..."
            />
            <button type="button" className="btn-ghost text-xs" onClick={runCitySearch} disabled={cityLoading}>
              {cityLoading ? "Searching..." : "Search"}
            </button>
          </div>
          {cityResults.length > 0 ? (
            <div className="grid gap-1">
              {cityResults.map((result) => (
                <button
                  key={`${result.latitude}-${result.longitude}-${result.name}`}
                  type="button"
                  className="text-left rounded-lg px-2 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  onClick={() =>
                    {
                      globePhiRef.current = longitudeToPhi(result.longitude);
                      globeThetaRef.current = latitudeToTheta(result.latitude);
                      setAnswers((prev) => ({
                        ...prev,
                        weather: {
                          ...prev.weather,
                          customLat: result.latitude,
                          customLon: result.longitude,
                          customCity: `${result.name}${result.admin1 ? `, ${result.admin1}` : ""}, ${result.country}`,
                        },
                      }));
                    }
                  }
                >
                  <span className="text-xs theme-text">
                    {result.name}
                    {result.admin1 ? `, ${result.admin1}` : ""}, {result.country}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {answers.path === "custom" ? (
            <button type="button" className="btn-ghost text-xs" onClick={() => skipWidgetStep("weather")}>
              I don't want this widget
            </button>
          ) : null}
        </div>
      );
    }

    if (stepId === "calendar") {
      const provider = answers.calendarProvider;
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              { id: "google", label: "Google" },
              { id: "outlook", label: "Outlook" },
              { id: "other", label: "Other iCal" },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, calendarProvider: option.id }))}
                className="px-3 py-1.5 rounded-xl text-xs"
                style={{
                  background:
                    provider === option.id
                      ? "color-mix(in srgb, var(--theme-accent) 20%, transparent)"
                      : "color-mix(in srgb, var(--theme-surface-hover) 75%, transparent)",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <ol className="list-decimal list-inside text-xs theme-text-secondary space-y-1">
            {provider === "google" ? (
              <>
                <li>Open Google Calendar settings for your calendar.</li>
                <li>Find Integrate calendar → Secret address in iCal format.</li>
                <li>Copy the URL and paste it below.</li>
              </>
            ) : provider === "outlook" ? (
              <>
                <li>In Outlook on the web, open calendar settings.</li>
                <li>Choose Shared calendars and publish your calendar.</li>
                <li>Copy the ICS link and paste it below.</li>
              </>
            ) : (
              <>
                <li>Locate your calendar’s ICS / iCal subscription URL.</li>
                <li>Make sure it is accessible from this browser.</li>
                <li>Paste it below and test the feed.</li>
              </>
            )}
          </ol>
          <div className="flex gap-2">
            <input
              value={answers.calendarUrl}
              onChange={(event) => setAnswers((prev) => ({ ...prev, calendarUrl: event.target.value }))}
              className="input-field text-xs"
              placeholder="https://.../calendar.ics"
            />
            <button type="button" className="btn-ghost text-xs" onClick={testCalendarUrl} disabled={calendarTestBusy}>
              {calendarTestBusy ? "Testing..." : "Test URL"}
            </button>
          </div>
          {calendarTestStatus ? <p className="text-xs theme-text-secondary">{calendarTestStatus}</p> : null}
          {answers.path === "custom" ? (
            <button type="button" className="btn-ghost text-xs" onClick={() => skipWidgetStep("calendar")}>
              I don't want this widget
            </button>
          ) : null}
        </div>
      );
    }

    if (stepId === "contentMode") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { id: "quotes", title: "Inspirational quotes", desc: "Start with a daily quote." },
              { id: "news", title: "News headlines", desc: "Start with latest headlines." },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, contentMode: option.id as OnboardingContentMode }))}
                className="rounded-2xl border p-4 text-left"
                style={{
                  borderColor:
                    answers.contentMode === option.id
                      ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                      : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                  background:
                    answers.contentMode === option.id
                      ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                      : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
                }}
              >
                <div className="font-medium text-sm theme-text">{option.title}</div>
                <div className="text-xs theme-text-secondary mt-1">{option.desc}</div>
              </button>
            ))}
          </div>
          {answers.contentMode === "news" ? (
            <div className="space-y-2">
              <div className="text-xs theme-text-secondary">News source</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {NEWS_SOURCES.map((source) => {
                  const active = answers.newsSourceId === source.id;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, newsSourceId: source.id }))}
                      className="rounded-xl border p-2 text-left"
                      style={{
                        borderColor: active
                          ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                          : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                        background: active
                          ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                          : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
                      }}
                    >
                      <div className="text-xs font-medium theme-text">{source.label}</div>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1">
                <input
                  value={answers.newsCustomRssUrl}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, newsCustomRssUrl: event.target.value }))}
                  onFocus={() => setAnswers((prev) => ({ ...prev, newsSourceId: NEWS_CUSTOM_SOURCE_ID }))}
                  className="input-field text-xs"
                  placeholder="https://example.com/feed.xml (custom RSS)"
                />
                <p className="text-[11px] theme-text-secondary">
                  Enter a custom RSS URL and it will be used when "Custom RSS Feed" is selected.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs theme-text-secondary">Quote theme / person</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quoteCategories.map((category) => {
                  const active = answers.quoteCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, quoteCategoryId: category.id }))}
                      className="rounded-xl border p-2.5 text-left flex items-center gap-2.5"
                      style={{
                        borderColor: active
                          ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                          : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                        background: active
                          ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                          : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
                      }}
                    >
                      <QuoteCategoryIcon categoryId={category.id} />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium theme-text truncate">{category.name}</span>
                        <span className="block text-[11px] theme-text-secondary truncate">{category.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {answers.path === "custom" ? (
            <button type="button" className="btn-ghost text-xs" onClick={() => skipWidgetStep("quotes")}>
              I don't want this widget
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-3 text-sm">
        <div className="rounded-xl border p-3">
          <div className="font-medium theme-text mb-1">Layout</div>
          <div className="text-xs theme-text-secondary">
            {answers.path === "preset"
              ? `Preset: ${getPresetProfileLabel(answers.presetProfileId)}`
              : `Custom density: ${answers.customDensity}`}
          </div>
          {stepRail.includes(answers.path === "preset" ? "presetLayout" : "customLayout") ? (
            <button
              type="button"
              className="btn-ghost text-[11px] mt-2"
              onClick={() => jumpToStep(answers.path === "preset" ? "presetLayout" : "customLayout")}
            >
              Edit step
            </button>
          ) : null}
        </div>
        <div className="rounded-xl border p-3">
          <div className="font-medium theme-text mb-1">Widgets</div>
          <div className="text-xs theme-text-secondary">{answers.selectedWidgets.join(", ") || "None selected"}</div>
          {stepRail.includes("widgetChoice") ? (
            <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("widgetChoice")}>
              Edit step
            </button>
          ) : null}
        </div>
        <div className="rounded-xl border p-3">
          <div className="font-medium theme-text mb-1">Theme</div>
          <div className="text-xs theme-text-secondary">{answers.themeChoice}</div>
          {stepRail.includes("theme") ? (
            <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("theme")}>
              Edit step
            </button>
          ) : null}
        </div>
        <div className="rounded-xl border p-3">
          <div className="font-medium theme-text mb-1">Background</div>
          <div className="text-xs theme-text-secondary">{answers.wallpaperUrl ? "Custom/preset image selected" : "None"}</div>
          {stepRail.includes("wallpaper") ? (
            <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("wallpaper")}>
              Edit step
            </button>
          ) : null}
        </div>
        {answers.selectedWidgets.includes("search") ? (
          <div className="rounded-xl border p-3">
            <div className="font-medium theme-text mb-1">Search Bars</div>
            <div className="text-xs theme-text-secondary">
              {answers.searchBars.length} bar(s): {answers.searchBars.map((item) => item.sourceId).join(", ")}
            </div>
            {stepRail.includes("searchConfig") ? (
              <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("searchConfig")}>
                Edit step
              </button>
            ) : null}
          </div>
        ) : null}
        {answers.selectedWidgets.includes("bookmarks") ? (
          <div className="rounded-xl border p-3">
            <div className="font-medium theme-text mb-1">Bookmarks</div>
            <div className="text-xs theme-text-secondary">
              {answers.bookmarks.includedFolderIds.length} folders, {answers.bookmarks.excludedBookmarkIds.length} exclusions
            </div>
            {stepRail.includes("bookmarks") ? (
              <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("bookmarks")}>
                Edit step
              </button>
            ) : null}
          </div>
        ) : null}
        {answers.selectedWidgets.includes("weather") ? (
          <div className="rounded-xl border p-3">
            <div className="font-medium theme-text mb-1">Weather</div>
            <div className="text-xs theme-text-secondary">
              {answers.weather.customCity || "Pinned location"} ({formatCoordinate(answers.weather.customLat)},{" "}
              {formatCoordinate(answers.weather.customLon)})
            </div>
            {stepRail.includes("weather") ? (
              <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("weather")}>
                Edit step
              </button>
            ) : null}
          </div>
        ) : null}
        {answers.selectedWidgets.includes("calendar") ? (
          <div className="rounded-xl border p-3">
            <div className="font-medium theme-text mb-1">Calendar</div>
            <div className="text-xs theme-text-secondary">{answers.calendarUrl ? "Connected URL ready" : "Skipped for now"}</div>
            {stepRail.includes("calendar") ? (
              <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("calendar")}>
                Edit step
              </button>
            ) : null}
          </div>
        ) : null}
        {answers.selectedWidgets.includes("quotes") ? (
          <div className="rounded-xl border p-3">
            <div className="font-medium theme-text mb-1">Quotes / News</div>
            <div className="text-xs theme-text-secondary">
              {answers.contentMode === "news"
                ? `${answers.contentMode} (${
                    answers.newsSourceId === NEWS_CUSTOM_SOURCE_ID
                      ? answers.newsCustomRssUrl.trim() || "Custom RSS (not set)"
                      : NEWS_SOURCES.find((source) => source.id === answers.newsSourceId)?.label ?? answers.newsSourceId
                  })`
                : `${answers.contentMode} (${answers.quoteCategoryId})`}
            </div>
            {stepRail.includes("contentMode") ? (
              <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("contentMode")}>
                Edit step
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const nextLabel = isLastStep ? "Apply and open dashboard" : "Continue";
  const isWelcomeStep = stepId === "welcome";

  return createPortal(
    <div className="fixed inset-0 z-[250] p-2 sm:p-3 md:p-4 pt-9 pb-24 flex items-center justify-center">
      <div
        className="absolute inset-0 onboarding-ambient-backdrop"
        aria-hidden="true"
        style={{
          ["--onboarding-orb-1" as string]: theme.tokens.accent,
          ["--onboarding-orb-2" as string]: theme.tokens.accentHover,
          ["--onboarding-orb-3" as string]: theme.tokens.border,
          ["--onboarding-orb-4" as string]: theme.tokens.textSecondary,
          ["--onboarding-orb-5" as string]: theme.tokens.surfaceHover,
          ["--onboarding-orb-6" as string]: theme.tokens.surface,
        }}
      >
        <div className="onboarding-orb onboarding-orb--1" />
        <div className="onboarding-orb onboarding-orb--2" />
        <div className="onboarding-orb onboarding-orb--3" />
        <div className="onboarding-orb onboarding-orb--4" />
        <div className="onboarding-orb onboarding-orb--5" />
        <div className="onboarding-orb onboarding-orb--6" />
      </div>
      <div className="absolute inset-0 onboarding-glass-pane-fullscreen pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0" aria-hidden="true" />
      <div className="absolute top-0 inset-x-0 z-20">
        <OnboardingWizardProgressBar fraction={progressFraction} />
      </div>
      <div className="relative z-10 w-full max-w-[1200px]">
        <div
          role="dialog"
          aria-modal="true"
          className="relative"
          style={{
            color: "var(--theme-text)",
          }}
        >
          {!isWelcomeStep ? (
            <div className="px-7 sm:px-9 pt-6 pb-2">
              <div className="text-[11px] uppercase tracking-wide theme-text-secondary mb-1">Setup wizard</div>
              <h2 className="text-lg font-semibold theme-text">{STEP_TITLES[stepId]}</h2>
              {wizardError ? <p className="mt-2 text-xs text-red-500">{wizardError}</p> : null}
            </div>
          ) : null}
          <div
            className={
              isWelcomeStep
                ? "px-7 sm:px-10 pb-12 pt-3 min-h-[72vh]"
                : "px-7 sm:px-9 pb-8 max-h-[calc(100vh-196px)] overflow-y-auto"
            }
          >
            {renderStep()}
          </div>
          <OnboardingWizardChrome
            canGoBack={stepIndex > 0}
            canGoNext={canContinue}
            nextLabel={nextLabel}
            showJumpToFinish={hasVisitedReview && stepId !== "review"}
            onBack={handleBack}
            onNext={handleNext}
            onJumpToFinish={handleJumpToReview}
            onSaveLater={handleSaveAndExit}
            onExit={handleSaveAndExit}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
