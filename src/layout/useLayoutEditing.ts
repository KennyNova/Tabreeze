import { useSyncExternalStore } from "react";
import { DASHBOARD_LAYOUT_EDITOR_STATE_UPDATED_EVENT, type LayoutEditorState } from "../settings/dashboardSettings";

/**
 * Tracks whether the dashboard is in "Customize layout" mode. The listener lives
 * at module scope so widgets mounted mid-edit still read the current state.
 */
let isEditing = false;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener(DASHBOARD_LAYOUT_EDITOR_STATE_UPDATED_EVENT, (event) => {
    const next = Boolean((event as CustomEvent<LayoutEditorState>).detail?.isEditing);
    if (next === isEditing) return;
    isEditing = next;
    listeners.forEach((fn) => fn());
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useLayoutEditing(): boolean {
  return useSyncExternalStore(subscribe, () => isEditing);
}
