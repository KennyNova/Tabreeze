export type ThemePresetId =
  | "light"
  | "dark"
  | "dev"
  | "devDark"
  | "devNight"
  | "coffee"
  | "coffeeDark"
  | "coffeeNight"
  | "custom";

export interface ThemeTokens {
  bg: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  border: string;
  scrollbar: string;
}

export interface ThemePreset {
  id: Exclude<ThemePresetId, "custom">;
  label: string;
  vibe: string;
  tokens: ThemeTokens;
}

export const THEME_TOKEN_ORDER: Array<keyof ThemeTokens> = [
  "bg",
  "surface",
  "surfaceHover",
  "text",
  "textSecondary",
  "accent",
  "accentHover",
  "border",
  "scrollbar",
];

export const THEME_TOKEN_LABELS: Record<keyof ThemeTokens, string> = {
  bg: "Background",
  surface: "Surface",
  surfaceHover: "Surface Hover",
  text: "Text",
  textSecondary: "Text Secondary",
  accent: "Accent",
  accentHover: "Accent Hover",
  border: "Border",
  scrollbar: "Scrollbar",
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "light",
    label: "Light",
    vibe: "Clean daylight",
    tokens: {
      bg: "#f2f2f7",
      surface: "#ffffff",
      surfaceHover: "#f7f8fb",
      text: "#1c1c1e",
      textSecondary: "#66666b",
      accent: "#007aff",
      accentHover: "#006ce1",
      border: "#d9d9e1",
      scrollbar: "#b8b8c4",
    },
  },
  {
    id: "dark",
    label: "Dark",
    vibe: "Apple dark",
    tokens: {
      bg: "#1c1c1e",
      surface: "#2c2c2e",
      surfaceHover: "#3a3a3d",
      text: "#f5f5f7",
      textSecondary: "#b9b9bf",
      accent: "#0a84ff",
      accentHover: "#2994ff",
      border: "#3f3f45",
      scrollbar: "#5d5d66",
    },
  },
  {
    id: "dev",
    label: "Dev",
    vibe: "Matrix green",
    tokens: {
      bg: "#000000",
      surface: "#001100",
      surfaceHover: "#0a1a0a",
      text: "#00ff41",
      textSecondary: "#00cc33",
      accent: "#00ff41",
      accentHover: "#33ff66",
      border: "#0f4d20",
      scrollbar: "#1a8f38",
    },
  },
  {
    id: "devDark",
    label: "Dev · Dark",
    vibe: "Terminal charcoal",
    tokens: {
      bg: "#050807",
      surface: "#0c120e",
      surfaceHover: "#141c17",
      text: "#c8f7d4",
      textSecondary: "#6eb584",
      accent: "#3dff7a",
      accentHover: "#6eff9e",
      border: "#1f3d2a",
      scrollbar: "#2a5c3d",
    },
  },
  {
    id: "devNight",
    label: "Dev · Night",
    vibe: "Dim phosphor",
    tokens: {
      bg: "#020302",
      surface: "#070a08",
      surfaceHover: "#0d110f",
      text: "#5a9d6e",
      textSecondary: "#3d6b4c",
      accent: "#2d8f4a",
      accentHover: "#3faa5c",
      border: "#0f2418",
      scrollbar: "#1a3d28",
    },
  },
  {
    id: "coffee",
    label: "Coffee",
    vibe: "Warm espresso",
    tokens: {
      bg: "#1b1411",
      surface: "#2a1f1a",
      surfaceHover: "#372923",
      text: "#e8d5c4",
      textSecondary: "#bea58f",
      accent: "#c4956a",
      accentHover: "#d2a67f",
      border: "#4a372d",
      scrollbar: "#7d5b47",
    },
  },
  {
    id: "coffeeDark",
    label: "Coffee · Dark",
    vibe: "Chocolate roast",
    tokens: {
      bg: "#120d0a",
      surface: "#1c1612",
      surfaceHover: "#261e19",
      text: "#e5d4c2",
      textSecondary: "#a89078",
      accent: "#b8875c",
      accentHover: "#c9986e",
      border: "#3d2e25",
      scrollbar: "#6a4f3f",
    },
  },
  {
    id: "coffeeNight",
    label: "Coffee · Night",
    vibe: "After hours",
    tokens: {
      bg: "#0a0706",
      surface: "#110c0a",
      surfaceHover: "#181210",
      text: "#b8a090",
      textSecondary: "#7d6b5c",
      accent: "#8b6b4d",
      accentHover: "#9c7d5f",
      border: "#2a2019",
      scrollbar: "#4d3d32",
    },
  },
];

/** Presets shown in the theme picker — Dev/Coffee dark & night variants are header-toggle only. */
export type ThemeSettingsPresetId = "light" | "dark" | "dev" | "coffee" | "custom";

export type ThemeSettingsSelectablePreset = Exclude<ThemeSettingsPresetId, "custom">;

export const THEME_SETTINGS_PRESET_ORDER: ThemeSettingsSelectablePreset[] = [
  "light",
  "dark",
  "dev",
  "coffee",
];

const DEV_THEME_TOGGLE_CYCLE: readonly Exclude<ThemePresetId, "custom">[] = ["dev", "devDark", "devNight"];

const COFFEE_THEME_TOGGLE_CYCLE: readonly Exclude<ThemePresetId, "custom">[] = [
  "coffee",
  "coffeeDark",
  "coffeeNight",
];

export function toSettingsPresetId(preset: ThemePresetId): ThemeSettingsPresetId {
  if (preset === "custom") return "custom";
  if (preset === "dev" || preset === "devDark" || preset === "devNight") return "dev";
  if (preset === "coffee" || preset === "coffeeDark" || preset === "coffeeNight") return "coffee";
  return preset;
}

/** Cycles Dev/Coffee through base → dark → night; Light ↔ Dark swap. */
export function advanceThemeToggle(preset: Exclude<ThemePresetId, "custom">): Exclude<ThemePresetId, "custom"> {
  const devIdx = DEV_THEME_TOGGLE_CYCLE.indexOf(preset);
  if (devIdx >= 0) return DEV_THEME_TOGGLE_CYCLE[(devIdx + 1) % DEV_THEME_TOGGLE_CYCLE.length]!;
  const coffeeIdx = COFFEE_THEME_TOGGLE_CYCLE.indexOf(preset);
  if (coffeeIdx >= 0) return COFFEE_THEME_TOGGLE_CYCLE[(coffeeIdx + 1) % COFFEE_THEME_TOGGLE_CYCLE.length]!;
  if (preset === "light") return "dark";
  if (preset === "dark") return "light";
  return preset;
}

const PRESET_BY_ID = new Map<Exclude<ThemePresetId, "custom">, ThemePreset>(
  THEME_PRESETS.map((preset) => [preset.id, preset])
);

export function cloneThemeTokens(tokens: ThemeTokens): ThemeTokens {
  return { ...tokens };
}

export function getPresetTokens(presetId: Exclude<ThemePresetId, "custom">): ThemeTokens {
  const preset = PRESET_BY_ID.get(presetId);
  return cloneThemeTokens((preset ?? THEME_PRESETS[0]).tokens);
}

export function isThemePresetId(value: string): value is Exclude<ThemePresetId, "custom"> {
  return PRESET_BY_ID.has(value as Exclude<ThemePresetId, "custom">);
}

export function normalizeHexColor(value: string): string {
  const v = value.trim().toLowerCase();
  if (/^#[\da-f]{6}$/.test(v)) return v;
  if (/^#[\da-f]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return "#000000";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeHexColor(hex).slice(1);
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    if (max === rr) {
      h = ((gg - bb) / delta) % 6;
    } else if (max === gg) {
      h = (bb - rr) / delta + 2;
    } else {
      h = (rr - gg) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
    s = delta / (1 - Math.abs(2 * l - 1));
  }

  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let rr = 0;
  let gg = 0;
  let bb = 0;

  if (hh < 60) {
    rr = c;
    gg = x;
  } else if (hh < 120) {
    rr = x;
    gg = c;
  } else if (hh < 180) {
    gg = c;
    bb = x;
  } else if (hh < 240) {
    gg = x;
    bb = c;
  } else if (hh < 300) {
    rr = x;
    bb = c;
  } else {
    rr = c;
    bb = x;
  }

  return {
    r: (rr + m) * 255,
    g: (gg + m) * 255,
    b: (bb + m) * 255,
  };
}

function shiftColor(hex: string, deltaLightness: number, deltaSaturation = 0): string {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  const next = hslToRgb(hsl.h, hsl.s + deltaSaturation, hsl.l + deltaLightness);
  return rgbToHex(next.r, next.g, next.b);
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function hexFromHsl(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function randomPalette(): ThemeTokens {
  const darkMode = Math.random() > 0.5;
  const baseHue = randomInRange(0, 359);
  const accentHue = (baseHue + randomInRange(25, 180)) % 360;

  if (darkMode) {
    const bg = hexFromHsl(baseHue, randomInRange(20, 35), randomInRange(5, 12));
    const surface = hexFromHsl(baseHue, randomInRange(18, 35), randomInRange(12, 20));
    const text = hexFromHsl(baseHue, randomInRange(25, 55), randomInRange(86, 94));
    const accent = hexFromHsl(accentHue, randomInRange(72, 92), randomInRange(58, 68));
    return {
      bg,
      surface,
      surfaceHover: shiftColor(surface, 4),
      text,
      textSecondary: shiftColor(text, -24, -15),
      accent,
      accentHover: shiftColor(accent, 6),
      border: shiftColor(surface, 10, -8),
      scrollbar: shiftColor(surface, 18, -5),
    };
  }

  const bg = hexFromHsl(baseHue, randomInRange(18, 30), randomInRange(92, 98));
  const surface = hexFromHsl(baseHue, randomInRange(15, 25), randomInRange(98, 100));
  const text = hexFromHsl(baseHue, randomInRange(20, 35), randomInRange(10, 20));
  const accent = hexFromHsl(accentHue, randomInRange(72, 92), randomInRange(46, 56));
  return {
    bg,
    surface,
    surfaceHover: shiftColor(surface, -3),
    text,
    textSecondary: shiftColor(text, 24, -12),
    accent,
    accentHover: shiftColor(accent, -6),
    border: shiftColor(surface, -12, -8),
    scrollbar: shiftColor(surface, -24, -10),
  };
}

export function randomizeThemeTokens(
  current: ThemeTokens,
  locked: Record<keyof ThemeTokens, boolean>
): ThemeTokens {
  const randomized = randomPalette();
  const next: ThemeTokens = cloneThemeTokens(current);
  for (const key of THEME_TOKEN_ORDER) {
    if (!locked[key]) {
      next[key] = randomized[key];
    }
  }
  return next;
}

export function detectMatchingPreset(tokens: ThemeTokens): Exclude<ThemePresetId, "custom"> | "custom" {
  for (const preset of THEME_PRESETS) {
    const equal = THEME_TOKEN_ORDER.every((key) => normalizeHexColor(tokens[key]) === normalizeHexColor(preset.tokens[key]));
    if (equal) return preset.id;
  }
  return "custom";
}
