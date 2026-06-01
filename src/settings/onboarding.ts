export type OnboardingPath = "preset" | "custom";
export type OnboardingStepId =
  | "welcome"
  | "path"
  | "widgetChoice"
  | "presetLayout"
  | "customLayout"
  | "theme"
  | "wallpaper"
  | "searchConfig"
  | "bookmarks"
  | "weather"
  | "calendar"
  | "contentMode"
  | "review";

export type OnboardingThemeChoice =
  | "light"
  | "dark"
  | "dev-matrix"
  | "coffee-espresso"
  | "random";

export type OnboardingLayoutDensity = "comfortable" | "balanced" | "dense";
export type OnboardingCalendarProvider = "google" | "outlook" | "other";
export type OnboardingContentMode = "quotes" | "news";
export type OnboardingQuoteSelectionMode = "theme" | "poet-collection";
export type OnboardingPresetProfileId =
  | "starter"
  | "quick-glance"
  | "daily-planner"
  | "weather-brief"
  | "bookmark-flow"
  | "deep-work"
  | "signal-hub"
  | "research-desk"
  | "ops-center"
  | "everything"
  | "spotlight-a"
  | "spotlight-b"
  | "spotlight-c";
export type OnboardingWidgetId =
  | "greeting"
  | "search"
  | "bookmarks"
  | "tasks"
  | "calendar"
  | "weather"
  | "quotes"
  | "homelab";

export interface OnboardingWeatherChoice {
  unit: "C" | "F";
  customLat?: number;
  customLon?: number;
  customCity?: string;
}

export interface OnboardingBookmarksChoice {
  includedFolderIds: string[];
  excludedBookmarkIds: string[];
}

export interface OnboardingAnswers {
  path: OnboardingPath | null;
  presetLayout: "balanced" | "focus" | "dense";
  presetProfileId: OnboardingPresetProfileId;
  customDensity: OnboardingLayoutDensity;
  themeChoice: OnboardingThemeChoice;
  selectedWidgets: OnboardingWidgetId[];
  searchBars: { sourceId: string }[];
  wallpaperUrl: string;
  bookmarks: OnboardingBookmarksChoice;
  weather: OnboardingWeatherChoice;
  calendarProvider: OnboardingCalendarProvider;
  calendarUrl: string;
  contentMode: OnboardingContentMode;
  quoteSelectionMode: OnboardingQuoteSelectionMode;
  quoteCategoryId: string;
  quotePoetCategoryIds: string[];
  newsSourceId: string;
  newsCustomRssUrl: string;
}

export interface OnboardingDraft {
  version: number;
  stepId: OnboardingStepId;
  answers: OnboardingAnswers;
  savedAt: number;
}

export interface OnboardingState {
  version: number;
  completed: boolean;
  dismissed: boolean;
  completedAt?: number;
}

export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STATE_KEY = "dashboard-onboarding-state-v1";
export const ONBOARDING_DRAFT_KEY = "dashboard-onboarding-draft-v1";
export const ONBOARDING_STATE_UPDATED_EVENT = "dashboard:onboarding-state-updated";

const DEFAULT_STATE: OnboardingState = {
  version: ONBOARDING_VERSION,
  completed: false,
  dismissed: false,
};

const DEFAULT_ANSWERS: OnboardingAnswers = {
  path: null,
  presetLayout: "balanced",
  presetProfileId: "starter",
  customDensity: "balanced",
  themeChoice: "light",
  selectedWidgets: ["greeting", "search", "bookmarks", "weather", "quotes", "tasks", "calendar"],
  searchBars: [{ sourceId: "chatgpt" }],
  wallpaperUrl: "",
  bookmarks: {
    includedFolderIds: [],
    excludedBookmarkIds: [],
  },
  weather: {
    unit: "C",
  },
  calendarProvider: "google",
  calendarUrl: "",
  contentMode: "quotes",
  quoteSelectionMode: "theme",
  quoteCategoryId: "inspirational",
  quotePoetCategoryIds: [],
  newsSourceId: "google-top",
  newsCustomRssUrl: "",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sanitizeAnswers(value: unknown): OnboardingAnswers {
  if (!isObject(value)) return { ...DEFAULT_ANSWERS };
  const selectedWidgets = Array.isArray(value.selectedWidgets)
    ? value.selectedWidgets.filter(
        (item): item is OnboardingWidgetId =>
          item === "greeting" ||
          item === "search" ||
          item === "bookmarks" ||
          item === "tasks" ||
          item === "calendar" ||
          item === "weather" ||
          item === "quotes" ||
          item === "homelab"
      )
    : [...DEFAULT_ANSWERS.selectedWidgets];
  const searchBars = Array.isArray(value.searchBars)
    ? value.searchBars
        .filter((item): item is Record<string, unknown> => isObject(item))
        .map((item) => ({
          sourceId: typeof item.sourceId === "string" && item.sourceId ? item.sourceId : "chatgpt",
        }))
        .slice(0, 3)
    : [...DEFAULT_ANSWERS.searchBars];
  const wallpaperUrl = typeof value.wallpaperUrl === "string" ? value.wallpaperUrl : "";
  const path = value.path === "preset" || value.path === "custom" ? value.path : null;
  const presetLayout =
    value.presetLayout === "focus" || value.presetLayout === "dense" ? value.presetLayout : "balanced";
  const presetProfileId =
    value.presetProfileId === "spotlight-a" ||
    value.presetProfileId === "spotlight-b" ||
    value.presetProfileId === "spotlight-c" ||
    value.presetProfileId === "quick-glance" ||
    value.presetProfileId === "daily-planner" ||
    value.presetProfileId === "weather-brief" ||
    value.presetProfileId === "bookmark-flow" ||
    value.presetProfileId === "deep-work" ||
    value.presetProfileId === "signal-hub" ||
    value.presetProfileId === "research-desk" ||
    value.presetProfileId === "ops-center" ||
    value.presetProfileId === "everything"
      ? value.presetProfileId
      : "starter";
  const customDensity =
    value.customDensity === "comfortable" || value.customDensity === "dense" ? value.customDensity : "balanced";
  const themeChoice =
    value.themeChoice === "dark" ||
    value.themeChoice === "dev-matrix" ||
    value.themeChoice === "coffee-espresso" ||
    value.themeChoice === "random"
      ? value.themeChoice
      : "light";
  const weatherRaw = isObject(value.weather) ? value.weather : {};
  const weather: OnboardingWeatherChoice = {
    unit: weatherRaw.unit === "F" ? "F" : "C",
    customLat: typeof weatherRaw.customLat === "number" ? weatherRaw.customLat : undefined,
    customLon: typeof weatherRaw.customLon === "number" ? weatherRaw.customLon : undefined,
    customCity: typeof weatherRaw.customCity === "string" ? weatherRaw.customCity : undefined,
  };
  const bookmarksRaw = isObject(value.bookmarks) ? value.bookmarks : {};
  const bookmarks: OnboardingBookmarksChoice = {
    includedFolderIds: Array.isArray(bookmarksRaw.includedFolderIds)
      ? bookmarksRaw.includedFolderIds.filter((item): item is string => typeof item === "string")
      : [],
    excludedBookmarkIds: Array.isArray(bookmarksRaw.excludedBookmarkIds)
      ? bookmarksRaw.excludedBookmarkIds.filter((item): item is string => typeof item === "string")
      : [],
  };
  const calendarProvider =
    value.calendarProvider === "outlook" || value.calendarProvider === "other" ? value.calendarProvider : "google";
  const calendarUrl = typeof value.calendarUrl === "string" ? value.calendarUrl : "";
  const contentMode = value.contentMode === "news" ? "news" : "quotes";
  const quoteSelectionMode = value.quoteSelectionMode === "poet-collection" ? "poet-collection" : "theme";
  const quoteCategoryId = typeof value.quoteCategoryId === "string" && value.quoteCategoryId ? value.quoteCategoryId : "inspirational";
  const quotePoetCategoryIds = Array.isArray(value.quotePoetCategoryIds)
    ? [...new Set(value.quotePoetCategoryIds.filter((item): item is string => typeof item === "string" && item.length > 0))]
    : [];
  const newsSourceId = typeof value.newsSourceId === "string" && value.newsSourceId ? value.newsSourceId : "google-top";
  const newsCustomRssUrl = typeof value.newsCustomRssUrl === "string" ? value.newsCustomRssUrl : "";
  return {
    path,
    presetLayout,
    presetProfileId,
    customDensity,
    themeChoice,
    selectedWidgets: selectedWidgets.length > 0 ? selectedWidgets : [...DEFAULT_ANSWERS.selectedWidgets],
    searchBars: searchBars.length > 0 ? searchBars : [{ sourceId: "chatgpt" }],
    wallpaperUrl,
    bookmarks,
    weather,
    calendarProvider,
    calendarUrl,
    contentMode,
    quoteSelectionMode,
    quoteCategoryId,
    quotePoetCategoryIds,
    newsSourceId,
    newsCustomRssUrl,
  };
}

function sanitizeState(value: unknown): OnboardingState {
  if (!isObject(value)) return { ...DEFAULT_STATE };
  const version = typeof value.version === "number" ? value.version : ONBOARDING_VERSION;
  const completed = value.completed === true;
  const dismissed = value.dismissed === true;
  const completedAt = typeof value.completedAt === "number" ? value.completedAt : undefined;
  return {
    version,
    completed,
    dismissed,
    ...(completedAt ? { completedAt } : {}),
  };
}

export function createDefaultOnboardingAnswers(): OnboardingAnswers {
  return {
    ...DEFAULT_ANSWERS,
    selectedWidgets: [...DEFAULT_ANSWERS.selectedWidgets],
    searchBars: DEFAULT_ANSWERS.searchBars.map((bar) => ({ ...bar })),
    wallpaperUrl: DEFAULT_ANSWERS.wallpaperUrl,
    bookmarks: { ...DEFAULT_ANSWERS.bookmarks },
    weather: { ...DEFAULT_ANSWERS.weather },
    quoteSelectionMode: DEFAULT_ANSWERS.quoteSelectionMode,
    quoteCategoryId: DEFAULT_ANSWERS.quoteCategoryId,
    quotePoetCategoryIds: [...DEFAULT_ANSWERS.quotePoetCategoryIds],
    newsSourceId: DEFAULT_ANSWERS.newsSourceId,
    newsCustomRssUrl: DEFAULT_ANSWERS.newsCustomRssUrl,
  };
}

export function loadOnboardingState(): OnboardingState {
  const parsed = parseJson(localStorage.getItem(ONBOARDING_STATE_KEY));
  const state = sanitizeState(parsed);
  if (state.version !== ONBOARDING_VERSION) {
    return {
      ...DEFAULT_STATE,
      completed: false,
      dismissed: false,
    };
  }
  return state;
}

export function saveOnboardingState(partial: Partial<OnboardingState>): OnboardingState {
  const current = loadOnboardingState();
  const next: OnboardingState = {
    ...current,
    ...partial,
    version: ONBOARDING_VERSION,
  };
  localStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent<OnboardingState>(ONBOARDING_STATE_UPDATED_EVENT, {
      detail: next,
    })
  );
  return next;
}

export function markOnboardingCompleted(): OnboardingState {
  clearOnboardingDraft();
  return saveOnboardingState({
    completed: true,
    dismissed: false,
    completedAt: Date.now(),
  });
}

export function loadOnboardingDraft(): OnboardingDraft | null {
  const parsed = parseJson(localStorage.getItem(ONBOARDING_DRAFT_KEY));
  if (!isObject(parsed)) return null;
  const version = typeof parsed.version === "number" ? parsed.version : ONBOARDING_VERSION;
  if (version !== ONBOARDING_VERSION) return null;
  const stepId = typeof parsed.stepId === "string" ? parsed.stepId : "welcome";
  const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now();
  return {
    version,
    stepId: stepId as OnboardingStepId,
    answers: sanitizeAnswers(parsed.answers),
    savedAt,
  };
}

export function saveOnboardingDraft(stepId: OnboardingStepId, answers: OnboardingAnswers): OnboardingDraft {
  const next: OnboardingDraft = {
    version: ONBOARDING_VERSION,
    stepId,
    answers: sanitizeAnswers(answers),
    savedAt: Date.now(),
  };
  localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(next));
  saveOnboardingState({
    completed: false,
  });
  return next;
}

export function clearOnboardingDraft(): void {
  localStorage.removeItem(ONBOARDING_DRAFT_KEY);
}

export function shouldAutoOpenOnboarding(): boolean {
  const state = loadOnboardingState();
  if (state.completed) return false;
  if (state.dismissed) return false;
  return true;
}

export function dismissOnboardingUntilResume(): OnboardingState {
  return saveOnboardingState({
    completed: false,
    dismissed: true,
  });
}

export function resumeOnboardingFromSettings(): OnboardingState {
  return saveOnboardingState({
    completed: false,
    dismissed: false,
  });
}

export function resetOnboardingProgress(): OnboardingState {
  clearOnboardingDraft();
  return saveOnboardingState({
    completed: false,
    dismissed: false,
    completedAt: undefined,
  });
}
