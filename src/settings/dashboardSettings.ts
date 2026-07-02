export interface DashboardSettings {
  showCustomizeButton: boolean;
}

export type FeedbackSurveySnoozeOption = "two_hours" | "tomorrow" | "never";

export interface FeedbackSurveySettings {
  disabled: boolean;
  nextPromptAt: string | null;
}

export interface SideDrawerUiSettings {
  blurBackdrop: boolean;
}

export interface LayoutEditorState {
  isEditing: boolean;
}

export const DASHBOARD_SETTINGS_KEY = "dashboard-settings-v1";
export const SIDE_DRAWER_UI_SETTINGS_KEY = "dashboard-side-drawer-ui-settings-v1";
export const FEEDBACK_SURVEY_SETTINGS_KEY = "dashboard-feedback-survey-settings-v1";

export const DASHBOARD_SETTINGS_UPDATED_EVENT = "dashboard:settings-updated";
export const SIDE_DRAWER_UI_SETTINGS_UPDATED_EVENT = "dashboard:side-drawer-settings-updated";
export const FEEDBACK_SURVEY_SETTINGS_UPDATED_EVENT = "dashboard:feedback-survey-settings-updated";
export const DASHBOARD_ENTER_LAYOUT_EDITOR_EVENT = "dashboard:enter-layout-editor";
export const DASHBOARD_LAYOUT_EDITOR_STATE_UPDATED_EVENT = "dashboard:layout-editor-state-updated";

const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  showCustomizeButton: true,
};

const DEFAULT_SIDE_DRAWER_UI_SETTINGS: SideDrawerUiSettings = {
  blurBackdrop: true,
};

const DEFAULT_FEEDBACK_SURVEY_SETTINGS: FeedbackSurveySettings = {
  disabled: false,
  nextPromptAt: null,
};

export function loadDashboardSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(DASHBOARD_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_DASHBOARD_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<DashboardSettings>;
    return {
      showCustomizeButton:
        typeof parsed.showCustomizeButton === "boolean"
          ? parsed.showCustomizeButton
          : DEFAULT_DASHBOARD_SETTINGS.showCustomizeButton,
    };
  } catch {
    return { ...DEFAULT_DASHBOARD_SETTINGS };
  }
}

export function saveDashboardSettings(settings: DashboardSettings): void {
  localStorage.setItem(DASHBOARD_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(
    new CustomEvent<DashboardSettings>(DASHBOARD_SETTINGS_UPDATED_EVENT, {
      detail: settings,
    })
  );
}

export function loadSideDrawerUiSettings(): SideDrawerUiSettings {
  try {
    const raw = localStorage.getItem(SIDE_DRAWER_UI_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SIDE_DRAWER_UI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SideDrawerUiSettings>;
    return {
      blurBackdrop:
        typeof parsed.blurBackdrop === "boolean"
          ? parsed.blurBackdrop
          : DEFAULT_SIDE_DRAWER_UI_SETTINGS.blurBackdrop,
    };
  } catch {
    return { ...DEFAULT_SIDE_DRAWER_UI_SETTINGS };
  }
}

export function saveSideDrawerUiSettings(settings: SideDrawerUiSettings): void {
  localStorage.setItem(SIDE_DRAWER_UI_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(
    new CustomEvent<SideDrawerUiSettings>(SIDE_DRAWER_UI_SETTINGS_UPDATED_EVENT, {
      detail: settings,
    })
  );
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function loadFeedbackSurveySettings(): FeedbackSurveySettings {
  try {
    const raw = localStorage.getItem(FEEDBACK_SURVEY_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_FEEDBACK_SURVEY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<FeedbackSurveySettings>;
    const nextPromptAt =
      typeof parsed.nextPromptAt === "string" && parseDate(parsed.nextPromptAt) ? parsed.nextPromptAt : null;
    return {
      disabled: typeof parsed.disabled === "boolean" ? parsed.disabled : DEFAULT_FEEDBACK_SURVEY_SETTINGS.disabled,
      nextPromptAt,
    };
  } catch {
    return { ...DEFAULT_FEEDBACK_SURVEY_SETTINGS };
  }
}

export function saveFeedbackSurveySettings(settings: FeedbackSurveySettings): void {
  localStorage.setItem(FEEDBACK_SURVEY_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(
    new CustomEvent<FeedbackSurveySettings>(FEEDBACK_SURVEY_SETTINGS_UPDATED_EVENT, {
      detail: settings,
    })
  );
}

export function shouldShowFeedbackSurvey(settings: FeedbackSurveySettings, now = new Date()): boolean {
  if (settings.disabled) return false;
  const nextPromptDate = parseDate(settings.nextPromptAt);
  if (!nextPromptDate) return true;
  return nextPromptDate.getTime() <= now.getTime();
}

export function resolveFeedbackSurveySnoozeUntil(option: FeedbackSurveySnoozeOption, now = new Date()): string | null {
  if (option === "never") return null;
  if (option === "two_hours") {
    return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}
