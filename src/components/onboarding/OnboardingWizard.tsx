import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import createGlobe from "cobe";
import { widgetConstraints } from "../widgetRegistry";
import ThemeSwatchPanel from "../ThemeSwatchPanel";
import SearchSourceLogo from "../../search/SearchSourceLogo";
import { loadLayoutConfig, saveLayoutConfig } from "../../layout/storage";
import { REACTIVE_PRESETS } from "../../layout/reactive";
import { defaultTileLayout } from "../../layout/constants";
import type { TileItem } from "../../layout/types";
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
  type OnboardingStepId,
  type OnboardingWidgetId,
} from "../../settings/onboarding";
import type { ThemeState } from "../../settings/themeStore";
import type { ThemeSettingsSelectablePreset, ThemeTokens } from "../../settings/themeTokens";
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
  const steps: OnboardingStepId[] = [
    "welcome",
    "path",
    "widgetChoice",
    answers.path === "custom" ? "customLayout" : "presetLayout",
    "theme",
    "wallpaper",
  ];
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

function inferThemeChoiceFromTheme(theme: ThemeState): OnboardingAnswers["themeChoice"] {
  if (theme.preset === "dark") return "dark";
  if (theme.preset === "dev" || theme.preset === "devDark" || theme.preset === "devNight") return "dev-matrix";
  if (theme.preset === "coffee" || theme.preset === "coffeeDark" || theme.preset === "coffeeNight") {
    return "coffee-espresso";
  }
  return "light";
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
  const globeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const globePointerIdRef = useRef<number | null>(null);
  const globeLastPointerRef = useRef({ x: 0, y: 0 });
  const globePhiRef = useRef(0);
  const globeThetaRef = useRef(0);
  const globeScaleRef = useRef(1.08);

  const searchSources = useMemo(
    () => getAvailableSearchSources(loadCustomSearchSources()),
    []
  );
  const stepRail = useMemo(() => getStepRail(answers), [answers]);
  const stepIndex = Math.max(0, stepRail.indexOf(stepId));
  const progressFraction = (stepIndex + 1) / stepRail.length;
  const isLastStep = stepRail[stepRail.length - 1] === stepId;
  const isFiniteNumber = (value: number | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value);

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
    setAnswers(draft ? { ...baseAnswers, ...draft.answers } : baseAnswers);
    setStepId(draft?.stepId ?? "welcome");
    setCityQuery("");
    setCityResults([]);
    setWeatherStatus("");
    setCalendarTestStatus("");
    setCustomWallpaperUrl("");
    setExpandedFolderIds(["1"]);
    setHasVisitedReview(false);
    const draftAnswers = draft?.answers;
    const initialLatCandidate = draftAnswers?.weather.customLat ?? weather.customLat;
    const initialLonCandidate = draftAnswers?.weather.customLon ?? weather.customLon;
    const initLat = isFiniteNumber(initialLatCandidate) ? initialLatCandidate : 0;
    const initLon = isFiniteNumber(initialLonCandidate) ? initialLonCandidate : 0;
    globePhiRef.current = -(initLon * Math.PI) / 180;
    globeThetaRef.current = -(initLat * Math.PI) / 180;
    globeScaleRef.current = 1.08;
  }, [open]);

  useEffect(() => {
    if (stepId === "review") setHasVisitedReview(true);
  }, [stepId]);

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

  useEffect(() => {
    if (!open || stepId !== "weather") return;
    const canvas = globeCanvasRef.current;
    if (!canvas) return;
    let disposed = false;

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: canvas.offsetWidth * 2,
      height: canvas.offsetHeight * 2,
      phi: globePhiRef.current,
      theta: globeThetaRef.current,
      dark: 1,
      diffuse: 1.15,
      mapSamples: 14000,
      mapBrightness: 7,
      baseColor: [0.12, 0.18, 0.2],
      markerColor: [0.93, 0.46, 0.3],
      glowColor: [0.74, 0.95, 1.0],
      scale: globeScaleRef.current,
    });

    let frameId = 0;
    const renderFrame = () => {
      if (disposed) return;
      try {
        const width = Math.max(1, canvas.offsetWidth * 2);
        const height = Math.max(1, canvas.offsetHeight * 2);
        globe.update({
          phi: globePhiRef.current,
          theta: globeThetaRef.current,
          scale: globeScaleRef.current,
          width,
          height,
        });
        frameId = window.requestAnimationFrame(renderFrame);
      } catch {
        disposed = true;
      }
    };
    frameId = window.requestAnimationFrame(renderFrame);

    const updateCenterCoordinates = () => {
      const lon = Number((((-globePhiRef.current * 180) / Math.PI + 540) % 360 - 180).toFixed(4));
      const lat = Number(Math.max(-85, Math.min(85, (-globeThetaRef.current * 180) / Math.PI)).toFixed(4));
      setAnswers((prev) => ({
        ...prev,
        weather: {
          ...prev.weather,
          customLat: lat,
          customLon: lon,
          customCity: prev.weather.customCity || "Pinned location",
        },
      }));
    };

    const onPointerDown = (event: PointerEvent) => {
      globePointerIdRef.current = event.pointerId;
      globeLastPointerRef.current = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (globePointerIdRef.current !== event.pointerId) return;
      const dx = event.clientX - globeLastPointerRef.current.x;
      const dy = event.clientY - globeLastPointerRef.current.y;
      globeLastPointerRef.current = { x: event.clientX, y: event.clientY };
      globePhiRef.current += dx * 0.0075;
      globeThetaRef.current = Math.max(-1.25, Math.min(1.25, globeThetaRef.current + dy * 0.0065));
      updateCenterCoordinates();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (globePointerIdRef.current !== event.pointerId) return;
      globePointerIdRef.current = null;
      updateCenterCoordinates();
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // noop
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.05 : 0.05;
      globeScaleRef.current = Math.max(0.82, Math.min(2.7, globeScaleRef.current + delta));
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    updateCenterCoordinates();

    return () => {
      disposed = true;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      window.cancelAnimationFrame(frameId);
      try {
        globe.destroy();
      } catch {
        // noop
      }
    };
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

    return layout;
  };

  const persistSelections = (nextStep: OnboardingStepId) => {
    const layoutConfig = loadLayoutConfig(widgetConstraints);
    layoutConfig.reactive.layout = buildLayoutFromAnswers();
    if (answers.path === "preset") {
      layoutConfig.mode = "reactive";
      layoutConfig.reactive.preset = answers.presetLayout;
      const preset = REACTIVE_PRESETS.find((item) => item.id === answers.presetLayout);
      layoutConfig.reactive.preferredGridCols = preset?.recommendedMaxCols ?? 12;
    } else if (answers.path === "custom") {
      layoutConfig.mode = "reactive";
      const mapped = densityToPreset(answers.customDensity);
      layoutConfig.reactive.preset = mapped.preset;
      layoutConfig.reactive.preferredGridCols = mapped.cols;
    }
    saveLayoutConfig(layoutConfig);

    saveWeatherSettings({
      unit: answers.weather.unit,
      customLat: isFiniteNumber(answers.weather.customLat) ? answers.weather.customLat : undefined,
      customLon: isFiniteNumber(answers.weather.customLon) ? answers.weather.customLon : undefined,
      customCity: answers.weather.customCity,
    });

    if (answers.calendarUrl.trim()) {
      storeIcalUrl(answers.calendarUrl.trim());
    }

    localStorage.setItem("dashboard-quote-category", answers.quoteCategoryId);
    localStorage.setItem(NEWS_SOURCE_KEY, answers.newsSourceId);
    localStorage.setItem(NEWS_CUSTOM_RSS_KEY, answers.newsCustomRssUrl.trim());
    onWallpaperChange(answers.wallpaperUrl);
    saveQuotesDefaultMode(answers.contentMode);
    saveBookmarkSyncScope(answers.bookmarks);
    saveOnboardingDraft(nextStep, answers);
  };

  const handleSaveAndExit = () => {
    persistSelections(stepId);
    dismissOnboardingUntilResume();
    onRefreshDashboard();
    onClose();
  };

  const handleFinalize = () => {
    persistSelections("review");
    markOnboardingCompleted();
    onRefreshDashboard();
    onClose();
  };

  const handleBack = () => {
    const idx = stepRail.indexOf(stepId);
    if (idx <= 0) return;
    const previousStep = stepRail[idx - 1]!;
    setStepId(previousStep);
    saveOnboardingDraft(previousStep, answers);
  };

  const canContinue = (() => {
    if (stepId === "path") return answers.path !== null;
    if (stepId === "widgetChoice") return answers.selectedWidgets.length > 0;
    if (stepId === "contentMode" && answers.contentMode === "news" && answers.newsSourceId === NEWS_CUSTOM_SOURCE_ID) {
      return Boolean(answers.newsCustomRssUrl.trim());
    }
    return true;
  })();

  const skipWidgetStep = (widget: OnboardingWidgetId) => {
    const nextAnswers: OnboardingAnswers = {
      ...answers,
      selectedWidgets: answers.selectedWidgets.filter((item) => item !== widget),
      ...(widget === "search" ? { searchBars: [] } : {}),
      ...(widget === "quotes" ? { contentMode: "quotes" as OnboardingContentMode } : {}),
    };
    const oldRail = stepRail;
    const currentIdx = oldRail.indexOf(stepId);
    const newRail = getStepRail(nextAnswers);
    const candidateSteps = oldRail.slice(currentIdx + 1);
    const fallbackStep = newRail[newRail.length - 1] ?? "review";
    const nextStep = candidateSteps.find((candidate) => newRail.includes(candidate)) ?? fallbackStep;
    setAnswers(nextAnswers);
    persistSelections(nextStep);
    setStepId(nextStep);
    onRefreshDashboard();
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
    persistSelections(nextStep);
    setStepId(nextStep);
    onRefreshDashboard();
  };

  const jumpToStep = (targetStep: OnboardingStepId) => {
    if (!stepRail.includes(targetStep)) return;
    persistSelections(targetStep);
    setStepId(targetStep);
  };

  const handleJumpToReview = () => {
    if (!canContinue || stepId === "review") return;
    jumpToStep("review");
    onRefreshDashboard();
  };

  const runCitySearch = async () => {
    const query = cityQuery.trim();
    if (!query) return;
    setCityLoading(true);
    const results = await searchCity(query);
    setCityResults(results);
    setCityLoading(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
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
            <p className="text-[13px] uppercase tracking-[0.18em] theme-text-secondary mb-3">
              Your new tab, reimagined
            </p>
            <p className="text-base sm:text-lg max-w-3xl theme-text">
              Build a calm command center in minutes. Choose a polished preset or shape every widget, color, and feed around your flow.
            </p>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { title: "Smart Search", note: "One bar, many engines + AI" },
                { title: "Drag & Resize", note: "Layout that adapts to you" },
                { title: "Live Widgets", note: "Weather, tasks, calendar, news" },
                { title: "Themes + Wallpaper", note: "Instant style, zero friction" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl px-3 py-2.5"
                  style={{
                    background: "color-mix(in srgb, var(--theme-surface) 58%, transparent)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div className="text-[12px] font-semibold theme-text">{item.title}</div>
                  <div className="text-[11px] theme-text-secondary mt-1">{item.note}</div>
                </div>
              ))}
            </div>
            <p className="text-xs theme-text-secondary mt-5">
              No account. No clutter. Just a better place to land every time you hit Ctrl+T.
            </p>
          </div>
        </div>
      );
    }

    if (stepId === "path") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { id: "preset", title: "Use a preset", blurb: "Start with a polished layout immediately." },
            { id: "custom", title: "Customize with wizard", blurb: "Walk through each setup decision." },
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
              <div className="font-medium text-sm theme-text">{option.title}</div>
              <div className="text-xs theme-text-secondary mt-1">{option.blurb}</div>
            </button>
          ))}
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
                    return {
                      ...prev,
                      selectedWidgets: has
                        ? prev.selectedWidgets.filter((id) => id !== widget.id)
                        : [...prev.selectedWidgets, widget.id],
                      ...(widget.id === "search" && has ? { searchBars: [] } : {}),
                    };
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
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {REACTIVE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setAnswers((prev) => ({ ...prev, presetLayout: preset.id }))}
              className="rounded-2xl border p-4 text-left"
              style={{
                borderColor:
                  answers.presetLayout === preset.id
                    ? "color-mix(in srgb, var(--theme-accent) 55%, transparent)"
                    : "color-mix(in srgb, var(--theme-border) 72%, transparent)",
                background:
                  answers.presetLayout === preset.id
                    ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)"
                    : "color-mix(in srgb, var(--theme-surface) 70%, transparent)",
              }}
            >
              <div className="font-medium text-sm theme-text">{preset.label}</div>
              <div className="text-xs theme-text-secondary mt-1">
                Widget layout preset: {preset.description}
              </div>
            </button>
          ))}
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
            <canvas
              ref={globeCanvasRef}
              className="w-full h-full touch-none cursor-grab active:cursor-grabbing bg-transparent"
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
              Lat {answers.weather.customLat?.toFixed(3) ?? "—"} / Lon {answers.weather.customLon?.toFixed(3) ?? "—"}
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
                    setAnswers((prev) => ({
                      ...prev,
                      weather: {
                        ...prev.weather,
                        customLat: result.latitude,
                        customLon: result.longitude,
                        customCity: `${result.name}${result.admin1 ? `, ${result.admin1}` : ""}, ${result.country}`,
                      },
                    }))
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
              ? `Preset: ${answers.presetLayout}`
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
        <div className="rounded-xl border p-3">
          <div className="font-medium theme-text mb-1">Weather</div>
          <div className="text-xs theme-text-secondary">
            {answers.weather.customCity || "Pinned location"} ({answers.weather.customLat?.toFixed(3) ?? "—"},{" "}
            {answers.weather.customLon?.toFixed(3) ?? "—"})
          </div>
          {stepRail.includes("weather") ? (
            <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("weather")}>
              Edit step
            </button>
          ) : null}
        </div>
        <div className="rounded-xl border p-3">
          <div className="font-medium theme-text mb-1">Calendar</div>
          <div className="text-xs theme-text-secondary">{answers.calendarUrl ? "Connected URL ready" : "Skipped for now"}</div>
          {stepRail.includes("calendar") ? (
            <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("calendar")}>
              Edit step
            </button>
          ) : null}
        </div>
        <div className="rounded-xl border p-3">
          <div className="font-medium theme-text mb-1">Quotes / News</div>
          <div className="text-xs theme-text-secondary">
            {answers.selectedWidgets.includes("quotes")
              ? answers.contentMode === "news"
                ? `${answers.contentMode} (${
                    answers.newsSourceId === NEWS_CUSTOM_SOURCE_ID
                      ? answers.newsCustomRssUrl.trim() || "Custom RSS (not set)"
                      : NEWS_SOURCES.find((source) => source.id === answers.newsSourceId)?.label ?? answers.newsSourceId
                  })`
                : `${answers.contentMode} (${answers.quoteCategoryId})`
              : "Widget removed"}
          </div>
          {stepRail.includes("contentMode") ? (
            <button type="button" className="btn-ghost text-[11px] mt-2" onClick={() => jumpToStep("contentMode")}>
              Edit step
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const nextLabel = isLastStep ? "Apply and open dashboard" : "Continue";
  const isWelcomeStep = stepId === "welcome";

  return createPortal(
    <div className="fixed inset-0 z-[250] p-2 sm:p-3 md:p-4 flex items-center justify-center">
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
      <div className="relative z-10 w-full max-w-[1200px]">
        <div
          role="dialog"
          aria-modal="true"
          className="relative rounded-[32px] overflow-hidden shadow-2xl"
          style={{
            background: "color-mix(in srgb, var(--theme-bg) 90%, transparent)",
            backdropFilter: "blur(24px)",
            color: "var(--theme-text)",
          }}
        >
          <OnboardingWizardProgressBar fraction={progressFraction} />
          {!isWelcomeStep ? (
            <div className="px-7 sm:px-9 pt-6 pb-2">
              <div className="text-[11px] uppercase tracking-wide theme-text-secondary mb-1">Setup wizard</div>
              <h2 className="text-lg font-semibold theme-text">{STEP_TITLES[stepId]}</h2>
            </div>
          ) : null}
          <div
            className={isWelcomeStep ? "px-7 sm:px-10 pb-8 pt-3 min-h-[70vh]" : "px-7 sm:px-9 pb-6 max-h-[70vh] overflow-y-auto"}
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
