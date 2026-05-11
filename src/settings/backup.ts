export const SETTINGS_BACKUP_SCHEMA_VERSION = 1;

export interface SettingsBackupPayload {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string | null;
  storage: Record<string, string>;
}

const THEME_STORAGE_KEYS = ["dashboard-theme-v2", "dashboard-theme-automation-v1", "dashboard-theme"] as const;

/** Every persisted dashboard value in this extension uses keys starting with `dashboard-`. */
export const DASHBOARD_LOCALSTORAGE_PREFIX = "dashboard-" as const;

/**
 * Snapshot of all dashboard localStorage entries (layout v2 tile grid, reactive + breakpoint profiles,
 * side widget slots, bookmarks/tasks/widgets, theme, weather/news/calendar caches, homelab, etc.).
 */
export function collectDashboardLocalStorageSnapshot(): Record<string, string> {
  const storage: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(DASHBOARD_LOCALSTORAGE_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) {
      storage[key] = value;
    }
  }
  return storage;
}

function getAppVersion(): string | null {
  const envVersion = import.meta.env?.VITE_APP_VERSION;
  return typeof envVersion === "string" && envVersion.trim().length > 0 ? envVersion : null;
}

function getDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildSettingsBackupPayload(): SettingsBackupPayload {
  const storage = collectDashboardLocalStorageSnapshot();

  return {
    schemaVersion: SETTINGS_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: getAppVersion(),
    storage,
  };
}

export function downloadSettingsBackup(payload = buildSettingsBackupPayload()): string {
  const exportedAt = new Date(payload.exportedAt);
  const filename = `tabreeze-settings-${getDateStamp(exportedAt)}.json`;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return filename;
}

function isStringRecord(input: unknown): input is Record<string, string> {
  if (!input || typeof input !== "object") return false;
  return Object.values(input).every((value) => typeof value === "string");
}

function extractStorageMap(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object") return null;
  const payload = input as { storage?: unknown };
  if (isStringRecord(payload.storage)) {
    return payload.storage;
  }
  return isStringRecord(input) ? input : null;
}

export async function importThemeFromBackupFile(file: File): Promise<number> {
  const raw = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  const storageMap = extractStorageMap(parsed);
  if (!storageMap) {
    throw new Error("Invalid backup format.");
  }

  let applied = 0;
  for (const key of THEME_STORAGE_KEYS) {
    const value = storageMap[key];
    if (typeof value === "string") {
      localStorage.setItem(key, value);
      applied += 1;
    }
  }

  if (applied === 0) {
    throw new Error("No theme settings found in the selected file.");
  }

  return applied;
}
