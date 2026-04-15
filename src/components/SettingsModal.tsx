import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DASHBOARD_ENTER_LAYOUT_EDITOR_EVENT,
  loadDashboardSettings,
  loadSideDrawerUiSettings,
  saveDashboardSettings,
  saveSideDrawerUiSettings,
  type DashboardSettings,
  type SideDrawerUiSettings,
} from "../settings/dashboardSettings";
import ThemeSwatchPanel from "./ThemeSwatchPanel";
import {
  randomizeTheme,
  type ThemeAutomationMode,
  type ThemeAutomationSettings,
  type ThemeState,
} from "../settings/themeStore";
import type { ThemeSettingsSelectablePreset, ThemeTokens } from "../settings/themeTokens";

interface SettingsModalProps {
  open: boolean;
  theme: ThemeState;
  wallpaper: string;
  onClose: () => void;
  onApplyThemePreset: (preset: ThemeSettingsSelectablePreset) => void;
  onThemeTokenChange: (key: keyof ThemeTokens, value: string) => void;
  onThemeLockToggle: (key: keyof ThemeTokens) => void;
  onThemeChange: (theme: ThemeState) => void;
  themeAutomation: ThemeAutomationSettings;
  onThemeAutomationChange: (settings: ThemeAutomationSettings) => void;
  onWallpaperChange: (url: string) => void;
}

const WALLPAPER_PRESETS = [
  { name: "None", url: "" },
  { name: "Mountains", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80" },
  { name: "Ocean", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80" },
  { name: "Forest", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80" },
  { name: "Night Sky", url: "https://images.unsplash.com/photo-1475274047050-1d0c55b7b10c?w=1920&q=80" },
  { name: "City", url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80" },
];

export default function SettingsModal({
  open,
  theme,
  wallpaper,
  onClose,
  onApplyThemePreset,
  onThemeTokenChange,
  onThemeLockToggle,
  onThemeChange,
  themeAutomation,
  onThemeAutomationChange,
  onWallpaperChange,
}: SettingsModalProps) {
  const [customUrl, setCustomUrl] = useState("");
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(() => loadDashboardSettings());
  const [sideDrawerSettings, setSideDrawerSettings] = useState<SideDrawerUiSettings>(() => loadSideDrawerUiSettings());

  useEffect(() => {
    if (!open) return;
    setDashboardSettings(loadDashboardSettings());
    setSideDrawerSettings(loadSideDrawerUiSettings());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-black/40 dark:bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-settings-title"
        className="relative z-10 w-full max-w-5xl my-4 sm:my-10 rounded-3xl border shadow-2xl backdrop-blur-xl max-h-[min(90vh,calc(100vh-2rem))] flex flex-col"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-border) 72%, transparent)",
          background: "color-mix(in srgb, var(--theme-bg) 95%, transparent)",
          color: "var(--theme-text)",
        }}
      >
        <div
          className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b shrink-0"
          style={{ borderColor: "color-mix(in srgb, var(--theme-border) 70%, transparent)" }}
        >
          <div>
            <h2 id="global-settings-title" className="text-base font-semibold theme-text">
              Dashboard settings
            </h2>
            <p className="text-xs mt-1 theme-text-secondary">
              Control appearance, layout access, and side drawer behavior.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{
              color: "var(--theme-text-secondary)",
              background: "color-mix(in srgb, var(--theme-surface-hover) 70%, transparent)",
            }}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 min-h-0">
          <ThemeSwatchPanel
            theme={theme}
            onApplyPreset={onApplyThemePreset}
            onTokenChange={onThemeTokenChange}
            onToggleLock={onThemeLockToggle}
            onRandomize={() => onThemeChange(randomizeTheme(theme))}
          />

          <section className="glass p-4 rounded-2xl">
            <h3 className="text-sm font-semibold theme-text mb-3">Appearance</h3>
            <div className="text-[11px] uppercase tracking-wide theme-text-secondary mb-2">
              Wallpaper presets
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
              {WALLPAPER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => onWallpaperChange(preset.url)}
                  className="rounded-xl overflow-hidden h-16 transition-all duration-200"
                  style={{
                    border:
                      wallpaper === preset.url
                        ? "2px solid color-mix(in srgb, var(--theme-accent) 60%, transparent)"
                        : "1px solid color-mix(in srgb, var(--theme-border) 70%, transparent)",
                    transform: wallpaper === preset.url ? "scale(1.04)" : "scale(1)",
                  }}
                >
                  {preset.url ? (
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: "color-mix(in srgb, var(--theme-surface-hover) 75%, transparent)" }}
                    >
                      <span className="text-[10px] theme-text-secondary">None</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(event) => setCustomUrl(event.target.value)}
                placeholder="Custom image/GIF/video URL..."
                className="input-field text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const next = customUrl.trim();
                  if (!next) return;
                  onWallpaperChange(next);
                  setCustomUrl("");
                }}
                className="btn-primary text-xs whitespace-nowrap"
              >
                Set
              </button>
            </div>

            <div
              className="mt-4 pt-4 border-t space-y-3"
              style={{ borderColor: "color-mix(in srgb, var(--theme-border) 70%, transparent)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs theme-text">Automatic day/night theme</div>
                  <div className="text-[11px] theme-text-secondary">
                    Switch between light and dark automatically.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onThemeAutomationChange({
                      ...themeAutomation,
                      enabled: !themeAutomation.enabled,
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs transition-colors ${
                    themeAutomation.enabled
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200"
                      : "theme-text-secondary"
                  }`}
                  style={
                    themeAutomation.enabled
                      ? undefined
                      : { background: "color-mix(in srgb, var(--theme-surface-hover) 72%, transparent)" }
                  }
                >
                  {themeAutomation.enabled ? "On" : "Off"}
                </button>
              </div>

              {themeAutomation.enabled ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {([
                      { id: "time", label: "Custom times" },
                      { id: "sun", label: "Sunrise / Sunset" },
                    ] as const).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          onThemeAutomationChange({
                            ...themeAutomation,
                            mode: option.id as ThemeAutomationMode,
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                          themeAutomation.mode === option.id
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-200"
                            : "theme-text-secondary"
                        }`}
                        style={
                          themeAutomation.mode === option.id
                            ? undefined
                            : { background: "color-mix(in srgb, var(--theme-surface-hover) 72%, transparent)" }
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {themeAutomation.mode === "sun" ? (
                    <div className="text-[11px] theme-text-secondary">
                      Uses your weather location (or browser location) to resolve sunrise/sunset each day.
                    </div>
                  ) : null}

                  {themeAutomation.mode === "time" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="text-[11px] theme-text-secondary">
                        Day starts at
                        <input
                          type="time"
                          value={themeAutomation.dayStart}
                          onChange={(event) =>
                            onThemeAutomationChange({
                              ...themeAutomation,
                              dayStart: event.target.value,
                            })
                          }
                          className="input-field text-xs mt-1"
                        />
                      </label>
                      <label className="text-[11px] theme-text-secondary">
                        Night starts at
                        <input
                          type="time"
                          value={themeAutomation.nightStart}
                          onChange={(event) =>
                            onThemeAutomationChange({
                              ...themeAutomation,
                              nightStart: event.target.value,
                            })
                          }
                          className="input-field text-xs mt-1"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="glass p-4 rounded-2xl">
            <h3 className="text-sm font-semibold theme-text mb-3">Layout</h3>

            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-xs theme-text">Show "Customize layout" button</div>
                <div className="text-[11px] theme-text-secondary">
                  Hide the button from the main dashboard if you prefer a cleaner view.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = {
                    ...dashboardSettings,
                    showCustomizeButton: !dashboardSettings.showCustomizeButton,
                  };
                  setDashboardSettings(next);
                  saveDashboardSettings(next);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs transition-colors ${
                  dashboardSettings.showCustomizeButton
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200"
                    : "theme-text-secondary"
                }`}
                style={
                  dashboardSettings.showCustomizeButton
                    ? undefined
                    : { background: "color-mix(in srgb, var(--theme-surface-hover) 72%, transparent)" }
                }
              >
                {dashboardSettings.showCustomizeButton ? "Shown" : "Hidden"}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs theme-text">Always-accessible layout editor</div>
                <div className="text-[11px] theme-text-secondary">
                  Open tile edit mode directly from here.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent(DASHBOARD_ENTER_LAYOUT_EDITOR_EVENT));
                  onClose();
                }}
                className="btn-primary text-xs"
              >
                Open layout editor
              </button>
            </div>
          </section>

          <section className="glass p-4 rounded-2xl">
            <h3 className="text-sm font-semibold theme-text mb-3">Side Drawers</h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const next = {
                    ...sideDrawerSettings,
                    blurBackdrop: !sideDrawerSettings.blurBackdrop,
                  };
                  setSideDrawerSettings(next);
                  saveSideDrawerUiSettings(next);
                }}
                className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl transition-colors"
                style={{
                  background: "color-mix(in srgb, var(--theme-surface-hover) 75%, transparent)",
                  color: "var(--theme-text)",
                }}
              >
                <span>Blur backdrop when drawer is open</span>
                <span>{sideDrawerSettings.blurBackdrop ? "On" : "Off"}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
