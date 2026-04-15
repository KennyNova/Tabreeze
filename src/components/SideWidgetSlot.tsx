import { useEffect, useRef, useState } from "react";
import SideWidgetPanelContent from "./SideWidgetPanelContent";
import { renderWidgetIcon, selectableWidgetTypes, widgetDefinitions } from "./widgetRegistry";
import type { SideWidgetSlot as SideWidgetSlotConfig, WidgetType } from "../layout/types";
import {
  DASHBOARD_LAYOUT_EDITOR_STATE_UPDATED_EVENT,
  loadSideDrawerUiSettings,
  SIDE_DRAWER_UI_SETTINGS_UPDATED_EVENT,
  type LayoutEditorState,
  type SideDrawerUiSettings,
} from "../settings/dashboardSettings";

interface SideWidgetSlotProps {
  side: "left" | "right";
  slot: SideWidgetSlotConfig;
  onSelectWidget: (widget: WidgetType | null) => void;
}

export default function SideWidgetSlot({ side, slot, onSelectWidget }: SideWidgetSlotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [isLayoutEditorActive, setIsLayoutEditorActive] = useState(false);
  const [uiSettings, setUiSettings] = useState<SideDrawerUiSettings>(() => loadSideDrawerUiSettings());
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedWidget = slot.widget;
  const isRight = side === "right";
  const label = selectedWidget ? widgetDefinitions[selectedWidget].label : "Pick widget";

  useEffect(() => {
    if (!showPicker && !isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (showPicker && !menuRef.current?.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showPicker) {
          setShowPicker(false);
          return;
        }
        setIsOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showPicker, isOpen]);

  useEffect(() => {
    const onSideDrawerSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<SideDrawerUiSettings>;
      if (!customEvent.detail) return;
      setUiSettings(customEvent.detail);
    };
    window.addEventListener(
      SIDE_DRAWER_UI_SETTINGS_UPDATED_EVENT,
      onSideDrawerSettingsUpdated as EventListener
    );
    return () =>
      window.removeEventListener(
        SIDE_DRAWER_UI_SETTINGS_UPDATED_EVENT,
        onSideDrawerSettingsUpdated as EventListener
      );
  }, []);

  useEffect(() => {
    const onLayoutEditorStateUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<LayoutEditorState>;
      setIsLayoutEditorActive(Boolean(customEvent.detail?.isEditing));
    };
    window.addEventListener(
      DASHBOARD_LAYOUT_EDITOR_STATE_UPDATED_EVENT,
      onLayoutEditorStateUpdated as EventListener
    );
    return () =>
      window.removeEventListener(
        DASHBOARD_LAYOUT_EDITOR_STATE_UPDATED_EVENT,
        onLayoutEditorStateUpdated as EventListener
      );
  }, []);

  useEffect(() => {
    if (!isLayoutEditorActive) {
      setShowPicker(false);
    }
  }, [isLayoutEditorActive]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            return;
          }
          if (isLayoutEditorActive) {
            setShowPicker((prev) => !prev);
          }
        }}
        className={`fixed top-1/2 -translate-y-1/2 z-40 transition-all duration-300 ${
          isRight ? "right-0" : "left-0"
        } opacity-100`}
        aria-label={`Open ${side} side slot`}
      >
        <div
          className={`glass flex items-center gap-2 py-2.5 text-xs text-gray-600 dark:text-white/70 ${
            isRight ? "pl-3 pr-2 rounded-l-xl rounded-r-none" : "pr-3 pl-2 rounded-r-xl rounded-l-none"
          }`}
        >
          {selectedWidget ? renderWidgetIcon(selectedWidget) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
            </svg>
          )}
          <span className="max-w-[110px] truncate">{label}</span>
        </div>
      </button>

      {isOpen && (
        <button
          type="button"
          className={`fixed inset-0 z-40 bg-black/10 dark:bg-black/30 ${uiSettings.blurBackdrop ? "backdrop-blur-[2px]" : ""}`}
          onClick={() => {
            setIsOpen(false);
            setShowPicker(false);
          }}
          aria-label="Close side drawer backdrop"
        />
      )}

      <aside
        className={`fixed top-0 z-50 h-full w-[380px] max-w-[92vw] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isRight ? "right-0 border-l" : "left-0 border-r"
        } border-white/20 dark:border-white/[0.08] ${
          isOpen ? "translate-x-0" : isRight ? "translate-x-full" : "-translate-x-full"
        }`}
      >
        <div className="h-full min-h-0 flex flex-col bg-white/72 dark:bg-[#1c1c1e]/92 backdrop-blur-2xl">
          {isLayoutEditorActive && (
            <div className="shrink-0 p-3 pb-0">
              <div className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500/80 dark:text-white/45">Widget</div>
                  <div className="text-[12px] text-gray-700 dark:text-white/80 truncate">{label}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPicker((prev) => !prev)}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium border border-black/10 dark:border-white/[0.16] bg-black/[0.04] dark:bg-white/[0.08] text-gray-700 dark:text-white/80 hover:bg-black/[0.08] dark:hover:bg-white/[0.14] transition-colors"
                >
                  {showPicker ? "Hide list" : "Change"}
                </button>
              </div>
            </div>
          )}

          {showPicker && (
            <div
              ref={menuRef}
              className={`rounded-xl border border-black/10 dark:border-white/[0.14] bg-white/85 dark:bg-[#1c1c1e]/90 backdrop-blur-md max-h-64 overflow-y-auto m-3`}
            >
              <button
                type="button"
                onClick={() => {
                  onSelectWidget(null);
                  setShowPicker(false);
                }}
                className={`w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 transition-colors ${
                  selectedWidget === null
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-200"
                    : "text-gray-700 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                }`}
              >
                <span className="shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </span>
                <span>None</span>
              </button>
              {selectableWidgetTypes.map((type) => {
                const selected = type === selectedWidget;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      onSelectWidget(type);
                      setShowPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 transition-colors ${
                      selected
                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-200"
                        : "text-gray-700 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                    }`}
                  >
                    <span className="shrink-0 text-current">{renderWidgetIcon(type)}</span>
                    <span>{widgetDefinitions[type].label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className={`flex-1 min-h-0 overflow-y-auto p-3`}>
            {selectedWidget ? (
              <SideWidgetPanelContent widget={selectedWidget} side={side} />
            ) : (
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="w-full h-full min-h-0 rounded-2xl border-2 border-dashed border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] text-gray-500/80 dark:text-white/45 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors flex flex-col items-center justify-center gap-2"
              >
                <span className="w-10 h-10 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] inline-flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                  </svg>
                </span>
                <span className="text-xs">Pick a widget</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
