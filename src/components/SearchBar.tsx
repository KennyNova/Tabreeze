import { useState, useRef, useEffect } from "react";
import { buildSearchUrl, resolveSearchSource } from "../search/sources";
import SearchSourceLogo from "../search/SearchSourceLogo";

interface SearchBarProps {
  sourceId?: string;
}

export default function SearchBar({ sourceId = "chatgpt" }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const source = resolveSearchSource(sourceId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      window.location.href = buildSearchUrl(source.urlTemplate, trimmed);
    }
  };

  return (
    <form onSubmit={handleSearch} className="w-full max-w-xl">
      <div className="relative group">
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200"
          style={{ color: "var(--theme-text-secondary)" }}
        >
          <SearchSourceLogo sourceId={source.id} className="w-5 h-5 object-contain" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Ask ${source.label}...`}
          className="w-full pl-12 pr-12 py-3.5 rounded-2xl backdrop-blur-2xl placeholder:text-gray-400/50 focus:outline-none transition-all duration-300 text-[15px]"
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
