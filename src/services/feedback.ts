import { loadOnboardingState } from "../settings/onboarding";
import { loadDashboardSettings } from "../settings/dashboardSettings";
import { loadTheme, loadThemeAutomationSettings } from "../settings/themeStore";

export type FeedbackReportType = "survey" | "bug_report";

export interface FeedbackReportInput {
  type: FeedbackReportType;
  message: string;
  rating?: number;
  includeDiagnostics?: boolean;
}

interface FeedbackPayload {
  reportType: FeedbackReportType;
  message: string;
  rating: number | null;
  submittedAt: string;
  extensionVersion: string | null;
  appUrl: string;
  userAgent: string;
  diagnostics: FeedbackDiagnostics | null;
}

interface FeedbackDiagnostics {
  themePreset: string;
  themeAutomationEnabled: boolean;
  wallpaperEnabled: boolean;
  onboardingCompleted: boolean;
  showCustomizeButton: boolean;
}

interface FeedbackResponse {
  ok: boolean;
  message?: string;
}

const DEFAULT_ENDPOINT = "https://navidmadani.com/api/tabreeze-feedback";

function getFeedbackEndpointUrl(): string {
  const envUrl = import.meta.env?.VITE_FEEDBACK_ENDPOINT_URL;
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim();
  }
  return DEFAULT_ENDPOINT;
}

function getExtensionVersion(): string | null {
  const envVersion = import.meta.env?.VITE_APP_VERSION;
  return typeof envVersion === "string" && envVersion.trim().length > 0 ? envVersion : null;
}

function buildDiagnostics(): FeedbackDiagnostics {
  const themeState = loadTheme();
  const themeAutomation = loadThemeAutomationSettings();
  const onboardingState = loadOnboardingState();
  const dashboardSettings = loadDashboardSettings();
  const wallpaper = localStorage.getItem("dashboard-wallpaper");
  return {
    themePreset: themeState.preset,
    themeAutomationEnabled: themeAutomation.enabled,
    wallpaperEnabled: typeof wallpaper === "string" && wallpaper.trim().length > 0,
    onboardingCompleted: onboardingState.completed,
    showCustomizeButton: dashboardSettings.showCustomizeButton,
  };
}

function buildPayload(input: FeedbackReportInput): FeedbackPayload {
  const message = input.message.trim();
  return {
    reportType: input.type,
    message,
    rating: typeof input.rating === "number" ? input.rating : null,
    submittedAt: new Date().toISOString(),
    extensionVersion: getExtensionVersion(),
    appUrl: window.location.href,
    userAgent: window.navigator.userAgent,
    diagnostics: input.includeDiagnostics ? buildDiagnostics() : null,
  };
}

export async function submitFeedbackReport(input: FeedbackReportInput): Promise<void> {
  const message = input.message.trim();
  if (!message) {
    throw new Error("Please share a little detail before sending.");
  }

  const endpoint = getFeedbackEndpointUrl();
  const payload = buildPayload(input);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Could not reach feedback server. Please try again shortly.");
  }

  let result: FeedbackResponse | null = null;
  try {
    result = (await response.json()) as FeedbackResponse;
  } catch {
    result = null;
  }

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message ?? "Feedback could not be sent. Please try again.");
  }
}
