export interface DashboardSettings {
  showCustomizeButton: boolean;
}

export interface SideDrawerUiSettings {
  blurBackdrop: boolean;
}

export interface LayoutEditorState {
  isEditing: boolean;
}

export const DASHBOARD_SETTINGS_KEY = "dashboard-settings-v1";
export const SIDE_DRAWER_UI_SETTINGS_KEY = "dashboard-side-drawer-ui-settings-v1";

export const DASHBOARD_SETTINGS_UPDATED_EVENT = "dashboard:settings-updated";
export const SIDE_DRAWER_UI_SETTINGS_UPDATED_EVENT = "dashboard:side-drawer-settings-updated";
export const DASHBOARD_ENTER_LAYOUT_EDITOR_EVENT = "dashboard:enter-layout-editor";
export const DASHBOARD_LAYOUT_EDITOR_STATE_UPDATED_EVENT = "dashboard:layout-editor-state-updated";

const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  showCustomizeButton: true,
};

const DEFAULT_SIDE_DRAWER_UI_SETTINGS: SideDrawerUiSettings = {
  blurBackdrop: true,
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
