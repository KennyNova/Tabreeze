import { useState, useEffect } from "react";
import ThemeToggle from "./components/ThemeToggle";
import SettingsModal from "./components/SettingsModal";
import FeedbackSurveyPopup from "./components/FeedbackSurveyPopup";
import BugReportModal from "./components/BugReportModal";
import SideWidgetSlot from "./components/SideWidgetSlot";
import TileLayout from "./components/TileLayout";
import { LAYOUT_SIDE_SLOTS_UPDATED_EVENT } from "./layout/constants";
import { loadLayoutConfig, saveLayoutConfig } from "./layout/storage";
import type { SideWidgetSlots, WidgetType } from "./layout/types";
import { widgetConstraints } from "./components/widgetRegistry";
import {
  applyTheme,
  isDarkTheme,
  loadTheme,
  loadThemeAutomationSettings,
  randomizeTheme,
  resolveSunThemeTimes,
  saveTheme,
  saveThemeAutomationSettings,
  type ThemeAutomationSettings,
  type ThemeState,
} from "./settings/themeStore";
import {
  advanceThemeToggle,
  getPresetTokens,
  type ThemePresetId,
  type ThemeSettingsSelectablePreset,
  type ThemeTokens,
} from "./settings/themeTokens";
import {
  loadFeedbackSurveySettings,
  resolveFeedbackSurveySnoozeUntil,
  saveFeedbackSurveySettings,
  shouldShowFeedbackSurvey,
  type FeedbackSurveySettings,
  type FeedbackSurveySnoozeOption,
} from "./settings/dashboardSettings";
import OnboardingWizard from "./components/onboarding/OnboardingWizard";
import {
  loadOnboardingDraft,
  loadOnboardingState,
  ONBOARDING_STATE_UPDATED_EVENT,
  resetOnboardingProgress,
  resumeOnboardingFromSettings,
  shouldAutoOpenOnboarding,
} from "./settings/onboarding";
import { submitFeedbackReport } from "./services/feedback";

const VIDEO_WALLPAPER_EXTENSIONS = [".mp4", ".webm", ".ogg", ".ogv", ".mov", ".m4v"];

function isVideoWallpaper(url: string): boolean {
  const normalized = url.toLowerCase().split("#")[0].split("?")[0];
  return VIDEO_WALLPAPER_EXTENSIONS.some((ext) => normalized.endsWith(ext));
}

export default function App() {
  const [theme, setTheme] = useState<ThemeState>(() => loadTheme());
  const [themeAutomation, setThemeAutomation] = useState<ThemeAutomationSettings>(() => loadThemeAutomationSettings());
  const [wallpaper, setWallpaper] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sideSlots, setSideSlots] = useState<SideWidgetSlots>(() => loadLayoutConfig(widgetConstraints).sideSlots);
  const [wizardOpen, setWizardOpen] = useState<boolean>(() => shouldAutoOpenOnboarding());
  const [layoutRefreshKey, setLayoutRefreshKey] = useState(0);
  const [feedbackSurveySettings, setFeedbackSurveySettings] = useState<FeedbackSurveySettings>(() =>
    loadFeedbackSurveySettings()
  );
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyRefreshTick, setSurveyRefreshTick] = useState(0);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugReportSubmitting, setBugReportSubmitting] = useState(false);

  useEffect(() => {
    const savedWallpaper = localStorage.getItem("dashboard-wallpaper");
    if (savedWallpaper) setWallpaper(savedWallpaper);
  }, []);

  useEffect(() => {
    applyTheme(theme.tokens);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveThemeAutomationSettings(themeAutomation);
  }, [themeAutomation]);

  useEffect(() => {
    if (feedbackSurveySettings.disabled || !feedbackSurveySettings.nextPromptAt) return;
    const nextShowAt = new Date(feedbackSurveySettings.nextPromptAt).getTime();
    if (!Number.isFinite(nextShowAt)) return;
    const delay = nextShowAt - Date.now();
    if (delay <= 0) return;
    const timeoutId = window.setTimeout(() => {
      setSurveyRefreshTick((prev) => prev + 1);
    }, Math.min(delay, 2_147_483_647));
    return () => window.clearTimeout(timeoutId);
  }, [feedbackSurveySettings]);

  const applySettingsPreset = (preset: ThemeSettingsSelectablePreset) => {
    setTheme((prev) => ({
      ...prev,
      preset,
      tokens: getPresetTokens(preset),
    }));
  };

  const handleThemeTokenChange = (key: keyof ThemeTokens, value: string) => {
    setTheme((prev) => ({
      ...prev,
      preset: "custom",
      tokens: {
        ...prev.tokens,
        [key]: value,
      },
    }));
  };

  const handleThemeLockToggle = (key: keyof ThemeTokens) => {
    setTheme((prev) => ({
      ...prev,
      locked: {
        ...prev.locked,
        [key]: !prev.locked[key],
      },
    }));
  };

  const handleThemeChange = (nextTheme: ThemeState) => {
    setTheme(nextTheme);
  };

  const toggleLightDark = () => {
    if (theme.preset === "custom") return;
    const nextPreset = advanceThemeToggle(theme.preset);
    setTheme((prev) => ({
      ...prev,
      preset: nextPreset,
      tokens: getPresetTokens(nextPreset),
    }));
  };

  useEffect(() => {
    if (!themeAutomation.enabled) return;

    let disposed = false;
    let resolvedDayStart = themeAutomation.dayStart;
    let resolvedNightStart = themeAutomation.nightStart;
    let resolvedForDate = "";

    const toMinutes = (value: string): number => {
      const [hours, minutes] = value.split(":").map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
      return Math.max(0, Math.min(23, hours)) * 60 + Math.max(0, Math.min(59, minutes));
    };

    const applyIfNeeded = (dayStart: string, nightStart: string) => {
      if (theme.preset === "custom") return;
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const dayMinutes = toMinutes(dayStart);
      const nightMinutes = toMinutes(nightStart);
      const shouldBeDark = nowMinutes >= nightMinutes || nowMinutes < dayMinutes;
      const targetPreset: Exclude<ThemePresetId, "custom"> = shouldBeDark ? "dark" : "light";
      setTheme((prev) => {
        if (prev.preset === "custom" || prev.preset === targetPreset) return prev;
        return {
          ...prev,
          preset: targetPreset,
          tokens: getPresetTokens(targetPreset),
        };
      });
    };

    const evaluate = async () => {
      if (disposed) return;
      const today = new Date().toDateString();
      if (themeAutomation.mode === "sun" && today !== resolvedForDate) {
        const resolved = await resolveSunThemeTimes(themeAutomation.dayStart, themeAutomation.nightStart);
        if (disposed) return;
        resolvedDayStart = resolved.dayStart;
        resolvedNightStart = resolved.nightStart;
        resolvedForDate = today;
      }
      if (themeAutomation.mode === "time") {
        resolvedDayStart = themeAutomation.dayStart;
        resolvedNightStart = themeAutomation.nightStart;
      }
      applyIfNeeded(resolvedDayStart, resolvedNightStart);
    };

    void evaluate();
    const intervalId = window.setInterval(() => {
      void evaluate();
    }, 60 * 1000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [themeAutomation, theme.preset]);

  useEffect(() => {
    const onOnboardingStateChanged = () => {
      const state = loadOnboardingState();
      if (state.completed) {
        setWizardOpen(false);
      }
    };
    window.addEventListener(ONBOARDING_STATE_UPDATED_EVENT, onOnboardingStateChanged);
    return () => {
      window.removeEventListener(ONBOARDING_STATE_UPDATED_EVENT, onOnboardingStateChanged);
    };
  }, []);

  const hasWallpaper = !!wallpaper;
  const wallpaperIsVideo = hasWallpaper && isVideoWallpaper(wallpaper);
  const applyWallpaper = (url: string) => {
    setWallpaper(url);
    localStorage.setItem("dashboard-wallpaper", url);
  };
  const setSlotWidget = (side: keyof SideWidgetSlots, widget: WidgetType | null) => {
    setSideSlots((prev) => {
      const next: SideWidgetSlots = {
        ...prev,
        [side]: { widget },
      };
      const config = loadLayoutConfig(widgetConstraints);
      config.sideSlots = next;
      saveLayoutConfig(config);
      window.dispatchEvent(new CustomEvent<SideWidgetSlots>(LAYOUT_SIDE_SLOTS_UPDATED_EVENT, { detail: next }));
      return next;
    });
  };

  const refreshDashboardWidgets = () => {
    setLayoutRefreshKey((prev) => prev + 1);
  };

  const openWizardFromSettings = (restart = false) => {
    if (restart) {
      resetOnboardingProgress();
    } else {
      resumeOnboardingFromSettings();
    }
    setSettingsOpen(false);
    setWizardOpen(true);
  };

  const hasOnboardingDraft = Boolean(loadOnboardingDraft());
  const onboardingState = loadOnboardingState();
  const surveyOpen =
    shouldShowFeedbackSurvey(feedbackSurveySettings, new Date()) &&
    !settingsOpen &&
    !wizardOpen &&
    !bugReportOpen &&
    !surveySubmitting;

  const applySurveySettings = (next: FeedbackSurveySettings) => {
    setFeedbackSurveySettings(next);
    saveFeedbackSurveySettings(next);
  };

  const handleSurveySnooze = (option: FeedbackSurveySnoozeOption) => {
    if (option === "never") {
      applySurveySettings({ disabled: true, nextPromptAt: null });
      return;
    }
    applySurveySettings({
      disabled: false,
      nextPromptAt: resolveFeedbackSurveySnoozeUntil(option),
    });
  };

  const handleSurveySubmit = async (payload: { rating: number; message: string }) => {
    setSurveySubmitting(true);
    try {
      await submitFeedbackReport({
        type: "survey",
        message: payload.message,
        rating: payload.rating,
        includeDiagnostics: false,
      });
    } finally {
      setSurveySubmitting(false);
    }
  };

  const handleBugReportSubmit = async (payload: { message: string; includeDiagnostics: boolean }) => {
    setBugReportSubmitting(true);
    try {
      await submitFeedbackReport({
        type: "bug_report",
        message: payload.message,
        includeDiagnostics: payload.includeDiagnostics,
      });
    } finally {
      setBugReportSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative transition-colors duration-500">
      {/* Background layer */}
      {hasWallpaper ? (
        wallpaperIsVideo ? (
          <video
            className="fixed inset-0 z-0 w-full h-full object-cover"
            src={wallpaper}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <div
            className="fixed inset-0 z-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${wallpaper})` }}
          />
        )
      ) : (
        <div className="fixed inset-0 z-0 transition-colors duration-500" style={{ background: "var(--theme-bg)" }} />
      )}

      {/* Frosted overlay when wallpaper is set */}
      {hasWallpaper && (
        <div className="fixed inset-0 z-[1] backdrop-blur-sm bg-black/10 dark:bg-black/30" />
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top bar */}
        <div className="flex items-start justify-end mb-6 animate-in delay-1">
          <div className="flex items-center gap-2">
            <ThemeToggle
              isDark={isDarkTheme(theme.tokens)}
              onToggle={toggleLightDark}
              disabled={theme.preset === "custom"}
              disabledReason="Manual day/night is disabled while custom palette is active."
            />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="glass p-2.5 hover:scale-105 transition-all duration-200"
              title="Dashboard settings"
              aria-label="Dashboard settings"
            >
              <svg
                className="w-[18px] h-[18px] text-gray-500/50 dark:text-white/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.6}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tile-based customizable dashboard */}
        <div className="animate-in delay-2">
          <TileLayout key={layoutRefreshKey} />
        </div>
      </div>

      <SideWidgetSlot side="left" slot={sideSlots.left} onSelectWidget={(widget) => setSlotWidget("left", widget)} />
      <SideWidgetSlot side="right" slot={sideSlots.right} onSelectWidget={(widget) => setSlotWidget("right", widget)} />

      <SettingsModal
        open={settingsOpen}
        theme={theme}
        wallpaper={wallpaper}
        onClose={() => setSettingsOpen(false)}
        onApplyThemePreset={applySettingsPreset}
        onThemeTokenChange={handleThemeTokenChange}
        onThemeLockToggle={handleThemeLockToggle}
        onThemeChange={handleThemeChange}
        themeAutomation={themeAutomation}
        onThemeAutomationChange={setThemeAutomation}
        onWallpaperChange={applyWallpaper}
        hasOnboardingDraft={hasOnboardingDraft}
        onboardingCompleted={onboardingState.completed}
        onContinueSetupWizard={() => openWizardFromSettings(false)}
        onOpenSetupWizard={() => openWizardFromSettings(false)}
        onRestartSetupWizard={() => openWizardFromSettings(true)}
        onOpenBugReport={() => {
          setSettingsOpen(false);
          setBugReportOpen(true);
        }}
      />
      <FeedbackSurveyPopup
        open={surveyOpen}
        submitting={surveySubmitting}
        onSubmit={handleSurveySubmit}
        onSnooze={handleSurveySnooze}
      />
      <BugReportModal
        open={bugReportOpen}
        submitting={bugReportSubmitting}
        onClose={() => setBugReportOpen(false)}
        onSubmit={handleBugReportSubmit}
      />
      <OnboardingWizard
        open={wizardOpen}
        theme={theme}
        onClose={() => setWizardOpen(false)}
        onRefreshDashboard={refreshDashboardWidgets}
        onApplyThemePreset={applySettingsPreset}
        onThemeTokenChange={handleThemeTokenChange}
        onThemeLockToggle={handleThemeLockToggle}
        onThemeRandomize={() => setTheme((prev) => randomizeTheme(prev))}
        onWallpaperChange={applyWallpaper}
      />
    </div>
  );
}
