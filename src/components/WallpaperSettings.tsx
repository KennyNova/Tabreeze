import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";

interface WallpaperSettingsProps {
  wallpaper: string;
  onWallpaperChange: (url: string) => void;
}

const PRESETS = [
  { name: "None", url: "" },
  { name: "Mountains", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80" },
  { name: "Ocean", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80" },
  { name: "Forest", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80" },
  { name: "Night Sky", url: "https://images.unsplash.com/photo-1475274047050-1d0c55b7b10c?w=1920&q=80" },
  { name: "City", url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80" },
];

const PANEL_W = 288;

export default function WallpaperSettings({ wallpaper, onWallpaperChange }: WallpaperSettingsProps) {
  const [open, setOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const updatePanelPos = () => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPanelPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPos();
    window.addEventListener("resize", updatePanelPos);
    return () => window.removeEventListener("resize", updatePanelPos);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const panel =
    open &&
    panelPos &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[100] bg-black/0"
          onClick={() => setOpen(false)}
          aria-hidden
        />
        <div
          className="fixed z-[101] w-72 glass p-4 rounded-2xl shadow-xl"
          style={{
            top: panelPos.top,
            right: panelPos.right,
            maxWidth: `min(${PANEL_W}px, calc(100vw - 16px))`,
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(40px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-medium text-[13px] text-gray-700/70 dark:text-white/50 mb-3">
            Wallpaper
          </h3>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  onWallpaperChange(preset.url);
                  setOpen(false);
                }}
                className="rounded-xl overflow-hidden h-16 transition-all duration-200"
                style={{
                  border: wallpaper === preset.url
                    ? "2px solid rgba(0,122,255,0.5)"
                    : "1px solid rgba(0,0,0,0.06)",
                  transform: wallpaper === preset.url ? "scale(1.05)" : "scale(1)",
                }}
              >
                {preset.url ? (
                  <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.02)" }}
                  >
                    <span className="text-[10px] text-gray-400/40 font-light">None</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="Custom image URL..."
              className="input-field text-xs"
            />
            <button
              onClick={() => {
                if (customUrl.trim()) {
                  onWallpaperChange(customUrl.trim());
                  setCustomUrl("");
                  setOpen(false);
                }
              }}
              className="btn-primary text-xs whitespace-nowrap"
            >
              Set
            </button>
          </div>
        </div>
      </>,
      document.body
    );

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="glass p-2.5 hover:scale-105 transition-all duration-200"
        title="Wallpaper settings"
        aria-expanded={open}
      >
        <svg className="w-[18px] h-[18px] text-gray-500/50 dark:text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {panel}
    </div>
  );
}
