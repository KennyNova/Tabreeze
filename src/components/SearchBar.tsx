import { useState, useRef, useEffect } from "react";
import { executeDashboardSearch } from "../search/executeSearch";
import { getAvailableSearchSources, loadCustomSearchSources, resolveSearchSource } from "../search/sources";
import SearchSourceLogo from "../search/SearchSourceLogo";

interface SearchBarProps {
  sourceId?: string;
}

const SEARCH_BAR_PROVIDER_MENU_OPEN_EVENT = "dashboard-searchbar-provider-menu-open";

export default function SearchBar({ sourceId = "chatgpt" }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState(sourceId);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const availableSources = getAvailableSearchSources(loadCustomSearchSources());
  const source = resolveSearchSource(selectedSourceId);
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const instanceIdRef = useRef(`searchbar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    setSelectedSourceId(sourceId);
  }, [sourceId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!isSourceMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const container = sourceMenuRef.current;
      if (container && !container.contains(event.target as Node)) {
        setIsSourceMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSourceMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSourceMenuOpen]);

  useEffect(() => {
    const handleOtherMenuOpen = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail !== instanceIdRef.current) {
        setIsSourceMenuOpen(false);
      }
    };
    window.addEventListener(
      SEARCH_BAR_PROVIDER_MENU_OPEN_EVENT,
      handleOtherMenuOpen as EventListener
    );
    return () => {
      window.removeEventListener(
        SEARCH_BAR_PROVIDER_MENU_OPEN_EVENT,
        handleOtherMenuOpen as EventListener
      );
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) void executeDashboardSearch(trimmed, source);
  };

  return (
    <form onSubmit={handleSearch} className="w-full max-w-xl">
      <div className="relative group">
        <div
          ref={sourceMenuRef}
          className={`absolute left-4 top-1/2 -translate-y-1/2 ${isSourceMenuOpen ? "z-[90]" : "z-20"}`}
        >
          <button
            type="button"
            onClick={() =>
              setIsSourceMenuOpen((prev) => {
                const next = !prev;
                if (next) {
                  window.dispatchEvent(
                    new CustomEvent<string>(SEARCH_BAR_PROVIDER_MENU_OPEN_EVENT, {
                      detail: instanceIdRef.current,
                    })
                  );
                }
                return next;
              })
            }
            className="inline-flex items-center gap-0.5 rounded-md p-0.5 transition-colors hover:opacity-85"
            style={{ color: "var(--theme-text-secondary)" }}
            title="Choose search provider"
            aria-label="Choose search provider"
            aria-haspopup="menu"
            aria-expanded={isSourceMenuOpen}
          >
            <SearchSourceLogo sourceId={source.id} className="w-5 h-5 object-contain" />
            <svg
              className={`w-2.5 h-2.5 transition-transform duration-200 ${isSourceMenuOpen ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
            </svg>
          </button>
          {isSourceMenuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-[calc(100%+0.4rem)] z-[100] min-w-[190px] max-h-64 overflow-y-auto rounded-xl border backdrop-blur-md shadow-xl"
              style={{
                borderColor: "color-mix(in srgb, var(--theme-border) 65%, transparent)",
                background: "color-mix(in srgb, var(--theme-surface) 94%, transparent)",
              }}
            >
              {availableSources.map((candidate) => {
                const selected = candidate.id === source.id;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      setSelectedSourceId(candidate.id);
                      setIsSourceMenuOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-2 text-xs transition-colors inline-flex items-center gap-2"
                    style={{
                      color: selected ? "var(--theme-accent)" : "var(--theme-text)",
                      background: selected
                        ? "color-mix(in srgb, var(--theme-accent) 15%, transparent)"
                        : "transparent",
                    }}
                  >
                    <SearchSourceLogo sourceId={candidate.id} className="w-3.5 h-3.5 object-contain shrink-0" />
                    <span className="truncate">{candidate.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Ask ${source.label}...`}
          className="w-full pl-16 pr-12 py-3.5 rounded-2xl backdrop-blur-2xl placeholder:text-gray-400/50 focus:outline-none transition-all duration-300 text-[15px]"
          style={{
            color: "var(--theme-text)",
            background: "color-mix(in srgb, var(--theme-surface) 78%, transparent)",
            border: "1px solid color-mix(in srgb, var(--theme-border) 65%, transparent)",
            boxShadow: "0 2px 16px color-mix(in srgb, var(--theme-bg) 40%, transparent)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = "color-mix(in srgb, var(--theme-surface-hover) 82%, transparent)";
            e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-accent) 40%, transparent)";
            e.currentTarget.style.boxShadow =
              "0 2px 20px color-mix(in srgb, var(--theme-bg) 45%, transparent), 0 0 0 3px color-mix(in srgb, var(--theme-accent) 18%, transparent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = "color-mix(in srgb, var(--theme-surface) 78%, transparent)";
            e.currentTarget.style.borderColor = "color-mix(in srgb, var(--theme-border) 65%, transparent)";
            e.currentTarget.style.boxShadow = "0 2px 16px color-mix(in srgb, var(--theme-bg) 40%, transparent)";
          }}
        />
        <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex
                        items-center px-2 py-0.5 rounded-md text-[10px] font-mono
                        border
                        group-focus-within:hidden"
             style={{
               color: "var(--theme-text-secondary)",
               borderColor: "color-mix(in srgb, var(--theme-border) 60%, transparent)",
               background: "color-mix(in srgb, var(--theme-surface-hover) 68%, transparent)",
             }}>
          /
        </kbd>
      </div>
    </form>
  );
}
