import { useMemo } from "react";
import {
  THEME_PRESETS,
  THEME_SETTINGS_PRESET_ORDER,
  THEME_TOKEN_LABELS,
  THEME_TOKEN_ORDER,
  normalizeHexColor,
  toSettingsPresetId,
  type ThemeSettingsSelectablePreset,
  type ThemeTokens,
} from "../settings/themeTokens";
import type { ThemeState } from "../settings/themeStore";

interface ThemeSwatchPanelProps {
  theme: ThemeState;
  onApplyPreset: (preset: ThemeSettingsSelectablePreset) => void;
  onTokenChange: (key: keyof ThemeTokens, value: string) => void;
  onToggleLock: (key: keyof ThemeTokens) => void;
  onRandomize: () => void;
}

function LockIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M5.5 8V6.75a4.5 4.5 0 119 0V8h.75A1.75 1.75 0 0117 9.75v6.5A1.75 1.75 0 0115.25 18h-10.5A1.75 1.75 0 013 16.25v-6.5A1.75 1.75 0 014.75 8h.75zm1.5 0h6V6.75a3 3 0 10-6 0V8z" />
      </svg>
    );
  }

  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M6.25 8V6.75a3.75 3.75 0 116.632 2.385.75.75 0 101.106 1.013A5.25 5.25 0 005.5 6.75V8h-.75A1.75 1.75 0 003 9.75v6.5A1.75 1.75 0 004.75 18h10.5A1.75 1.75 0 0017 16.25v-6.5A1.75 1.75 0 0015.25 8H6.25zm-1.75 1.5h10.5a.25.25 0 01.25.25v6.5a.25.25 0 01-.25.25H4.75a.25.25 0 01-.25-.25v-6.5a.25.25 0 01.25-.25z" />
    </svg>
  );
}

function swatchTextColor(hex: string): string {
  const cleaned = normalizeHexColor(hex).slice(1);
  const rgb = [0, 1, 2].map((idx) => Number.parseInt(cleaned.slice(idx * 2, idx * 2 + 2), 16) / 255);
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return luminance > 0.5 ? "#111111" : "#f8f8f8";
}

export default function ThemeSwatchPanel({
  theme,
  onApplyPreset,
  onTokenChange,
  onToggleLock,
  onRandomize,
}: ThemeSwatchPanelProps) {
  const showCustomPreset = theme.preset === "custom";
  const presetButtons = useMemo(() => {
    const base: Array<
      { id: ThemeSettingsSelectablePreset; label: string } | { id: "custom"; label: string }
    > = THEME_SETTINGS_PRESET_ORDER.map((id) => {
      const meta = THEME_PRESETS.find((p) => p.id === id)!;
      return { id, label: meta.label };
    });
    if (showCustomPreset) {
      base.push({ id: "custom", label: "Custom" });
    }
    return base;
  }, [showCustomPreset]);

  return (
    <section className="glass p-4 rounded-2xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold theme-text">Theme</h3>
        <button type="button" onClick={onRandomize} className="btn-primary text-xs inline-flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path d="M4.01 4.5a1 1 0 011.415 0l2.012 2.011a3.8 3.8 0 015.127 0L14.575 4.5A1 1 0 1116 5.915L14 7.915a3.8 3.8 0 010 4.17L16 14.085a1 1 0 11-1.415 1.415l-2.011-2.011a3.8 3.8 0 01-5.127 0L5.425 15.5A1 1 0 114.01 14.085L6.02 12.074a3.8 3.8 0 010-4.17L4.01 5.915a1 1 0 010-1.415zM10 8.2a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6z" />
          </svg>
          Randomize
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {presetButtons.map((preset) => {
          const active =
            preset.id === "custom"
              ? theme.preset === "custom"
              : toSettingsPresetId(theme.preset) === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (preset.id === "custom") return;
                onApplyPreset(preset.id);
              }}
              disabled={preset.id === "custom"}
              className="px-3 py-1.5 rounded-xl text-xs transition-all disabled:cursor-default"
              style={{
                background: active
                  ? "color-mix(in srgb, var(--theme-accent) 25%, transparent)"
                  : "color-mix(in srgb, var(--theme-surface-hover) 78%, transparent)",
                color: active ? "var(--theme-accent)" : "var(--theme-text-secondary)",
                border: active
                  ? "1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent)"
                  : "1px solid color-mix(in srgb, var(--theme-border) 65%, transparent)",
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
        {THEME_TOKEN_ORDER.map((key) => {
          const value = normalizeHexColor(theme.tokens[key]);
          const textColor = swatchTextColor(value);
          const locked = theme.locked[key];
          return (
            <div
              key={key}
              className="rounded-xl overflow-hidden border"
              style={{ borderColor: "color-mix(in srgb, var(--theme-border) 70%, transparent)" }}
            >
              <label
                className="group relative h-20 flex items-end p-2 cursor-pointer"
                style={{ background: value, color: textColor }}
                title={`Pick ${THEME_TOKEN_LABELS[key]}`}
              >
                <input
                  type="color"
                  value={value}
                  onChange={(event) => onTokenChange(key, event.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label={`Color for ${THEME_TOKEN_LABELS[key]}`}
                />
                <div className="text-[10px] leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
                  <div className="font-semibold">{THEME_TOKEN_LABELS[key]}</div>
                  <div className="font-mono uppercase">{value}</div>
                </div>
              </label>
              <button
                type="button"
                onClick={() => onToggleLock(key)}
                className="w-full h-8 flex items-center justify-center text-[10px] transition-colors"
                style={{
                  background: "color-mix(in srgb, var(--theme-surface) 88%, transparent)",
                  color: locked ? "var(--theme-accent)" : "var(--theme-text-secondary)",
                }}
                title={locked ? "Unlock color" : "Lock color"}
                aria-label={locked ? `Unlock ${THEME_TOKEN_LABELS[key]}` : `Lock ${THEME_TOKEN_LABELS[key]}`}
              >
                <span className="inline-flex items-center gap-1">
                  <LockIcon locked={locked} />
                  {locked ? "Locked" : "Unlocked"}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
