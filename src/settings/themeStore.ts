import {
  THEME_TOKEN_ORDER,
  detectMatchingPreset,
  getPresetTokens,
  isThemePresetId,
  normalizeHexColor,
  randomizeThemeTokens,
  type ThemePresetId,
  type ThemeTokens,
} from "./themeTokens";
import { getWeatherSettings } from "../services/weather";

export interface ThemeState {
  preset: ThemePresetId;
  tokens: ThemeTokens;
  locked: Record<keyof ThemeTokens, boolean>;
}

export type ThemeAutomationMode = "time" | "sun";

export interface ThemeAutomationSettings {
  enabled: boolean;
  mode: ThemeAutomationMode;
  dayStart: string;
  nightStart: string;
}

export const THEME_STORAGE_KEY = "dashboard-theme-v2";
export const THEME_UPDATED_EVENT = "dashboard:theme-updated";
export const THEME_AUTOMATION_STORAGE_KEY = "dashboard-theme-automation-v1";

export const DEFAULT_THEME_LOCKS: Record<keyof ThemeTokens, boolean> = {
  bg: false,
  surface: false,
  surfaceHover: false,
  text: false,
  textSecondary: false,
  accent: false,
  accentHover: false,
  border: false,
  scrollbar: false,
};

const DEFAULT_THEME_STATE: ThemeState = {
  preset: "light",
  tokens: getPresetTokens("light"),
  locked: { ...DEFAULT_THEME_LOCKS },
};

interface PersistedThemeState {
  preset?: string;
  tokens?: Partial<Record<keyof ThemeTokens, string>>;
  locked?: Partial<Record<keyof ThemeTokens, boolean>>;
}

interface PersistedThemeAutomationSettings {
  enabled?: boolean;
  mode?: string;
  dayStart?: string;
  nightStart?: string;
}

const DEFAULT_THEME_AUTOMATION_SETTINGS: ThemeAutomationSettings = {
  enabled: false,
  mode: "time",
  dayStart: "07:00",
  nightStart: "19:00",
};

function parseLegacyPreset(): "light" | "dark" {
  const stored = localStorage.getItem("dashboard-theme");
  if (stored === "dark") return "dark";
  if (stored === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function normalizeTokens(raw: Partial<Record<keyof ThemeTokens, string>> | undefined): ThemeTokens {
  const base = { ...DEFAULT_THEME_STATE.tokens };
  if (!raw) return base;
  for (const key of THEME_TOKEN_ORDER) {
    const value = raw[key];
    if (typeof value === "string") {
      base[key] = normalizeHexColor(value);
    }
  }
  return base;
}

function normalizeLocks(raw: Partial<Record<keyof ThemeTokens, boolean>> | undefined): Record<keyof ThemeTokens, boolean> {
  const next = { ...DEFAULT_THEME_LOCKS };
  if (!raw) return next;
  for (const key of THEME_TOKEN_ORDER) {
    next[key] = raw[key] === true;
  }
  return next;
}

function sanitizeTimeValue(input: unknown, fallback: string): string {
  if (typeof input !== "string") return fallback;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(input) ? input : fallback;
}

function sanitizeAutomationMode(input: unknown): ThemeAutomationMode {
  return input === "sun" ? "sun" : "time";
}

export function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      const legacyPreset = parseLegacyPreset();
      return {
        preset: legacyPreset,
        tokens: getPresetTokens(legacyPreset),
        locked: { ...DEFAULT_THEME_LOCKS },
      };
    }

    const parsed = JSON.parse(raw) as PersistedThemeState;
    const tokens = normalizeTokens(parsed.tokens);
    const preset: ThemePresetId = isThemePresetId(parsed.preset ?? "")
      ? (parsed.preset as Exclude<ThemePresetId, "custom">)
      : detectMatchingPreset(tokens);
    return {
      preset,
      tokens,
      locked: normalizeLocks(parsed.locked),
    };
  } catch {
    return {
      ...DEFAULT_THEME_STATE,
      tokens: { ...DEFAULT_THEME_STATE.tokens },
      locked: { ...DEFAULT_THEME_LOCKS },
    };
  }
}

export function saveTheme(theme: ThemeState): void {
  const payload: ThemeState = {
    preset: theme.preset,
    tokens: normalizeTokens(theme.tokens),
    locked: normalizeLocks(theme.locked),
  };
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(
    new CustomEvent<ThemeState>(THEME_UPDATED_EVENT, {
      detail: payload,
    })
  );
}

export function loadThemeAutomationSettings(): ThemeAutomationSettings {
  try {
    const raw = localStorage.getItem(THEME_AUTOMATION_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME_AUTOMATION_SETTINGS };
    const parsed = JSON.parse(raw) as PersistedThemeAutomationSettings;
    return {
      enabled: parsed.enabled === true,
      mode: sanitizeAutomationMode(parsed.mode),
      dayStart: sanitizeTimeValue(parsed.dayStart, DEFAULT_THEME_AUTOMATION_SETTINGS.dayStart),
      nightStart: sanitizeTimeValue(parsed.nightStart, DEFAULT_THEME_AUTOMATION_SETTINGS.nightStart),
    };
  } catch {
    return { ...DEFAULT_THEME_AUTOMATION_SETTINGS };
  }
}

export function saveThemeAutomationSettings(settings: ThemeAutomationSettings): void {
  const payload: ThemeAutomationSettings = {
    enabled: settings.enabled === true,
    mode: sanitizeAutomationMode(settings.mode),
    dayStart: sanitizeTimeValue(settings.dayStart, DEFAULT_THEME_AUTOMATION_SETTINGS.dayStart),
    nightStart: sanitizeTimeValue(settings.nightStart, DEFAULT_THEME_AUTOMATION_SETTINGS.nightStart),
  };
  localStorage.setItem(THEME_AUTOMATION_STORAGE_KEY, JSON.stringify(payload));
}

function extractHHMM(input: string, fallback: string): string {
  const match = input.match(/(\d{2}):(\d{2})/);
  if (!match) return fallback;
  const hhmm = `${match[1]}:${match[2]}`;
  return sanitizeTimeValue(hhmm, fallback);
}

export async function resolveSunThemeTimes(
  fallbackDayStart: string,
  fallbackNightStart: string
): Promise<{ dayStart: string; nightStart: string }> {
  try {
    const settings = getWeatherSettings();
    let lat = settings.customLat;
    let lon = settings.customLon;

    if (typeof lat !== "number" || typeof lon !== "number") {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 30 * 60 * 1000,
        });
      });
      lat = position.coords.latitude;
      lon = position.coords.longitude;
    }

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto&forecast_days=1`
    );
    if (!response.ok) return { dayStart: fallbackDayStart, nightStart: fallbackNightStart };
    const data = await response.json();
    const sunrise = data?.daily?.sunrise?.[0];
    const sunset = data?.daily?.sunset?.[0];
    return {
      dayStart: extractHHMM(String(sunrise ?? ""), fallbackDayStart),
      nightStart: extractHHMM(String(sunset ?? ""), fallbackNightStart),
    };
  } catch {
    return { dayStart: fallbackDayStart, nightStart: fallbackNightStart };
  }
}

function relativeLuminance(hex: string): number {
  const value = normalizeHexColor(hex).slice(1);
  const rgb = [0, 1, 2].map((idx) => Number.parseInt(value.slice(idx * 2, idx * 2 + 2), 16) / 255);
  const linear = rgb.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function isDarkTheme(tokens: ThemeTokens): boolean {
  return relativeLuminance(tokens.bg) < 0.28;
}

export function applyTheme(tokens: ThemeTokens): void {
  const root = document.documentElement;
  root.style.setProperty("--theme-bg", tokens.bg);
  root.style.setProperty("--theme-surface", tokens.surface);
  root.style.setProperty("--theme-surface-hover", tokens.surfaceHover);
  root.style.setProperty("--theme-text", tokens.text);
  root.style.setProperty("--theme-text-secondary", tokens.textSecondary);
  root.style.setProperty("--theme-accent", tokens.accent);
  root.style.setProperty("--theme-accent-hover", tokens.accentHover);
  root.style.setProperty("--theme-border", tokens.border);
  root.style.setProperty("--theme-scrollbar", tokens.scrollbar);
  root.classList.toggle("dark", isDarkTheme(tokens));
}

export function randomizeTheme(theme: ThemeState): ThemeState {
  const tokens = randomizeThemeTokens(theme.tokens, theme.locked);
  return {
    ...theme,
    preset: detectMatchingPreset(tokens),
    tokens,
  };
}
