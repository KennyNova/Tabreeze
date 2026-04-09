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
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500/70 dark:text-white/35
                     group-focus-within:text-[rgba(0,122,255,0.78)] transition-colors duration-200"
        >
          <SearchSourceLogo sourceId={source.id} className="w-5 h-5 object-contain" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Ask ${source.label}...`}
          className="w-full pl-12 pr-12 py-3.5 rounded-2xl backdrop-blur-2xl
                     text-gray-900 dark:text-white/90
                     placeholder:text-gray-400/50 dark:placeholder:text-white/20
                     focus:outline-none transition-all duration-300 text-[15px]"
          style={{
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.7)";
            e.currentTarget.style.borderColor = "rgba(0,122,255,0.3)";
            e.currentTarget.style.boxShadow = "0 2px 20px rgba(0,0,0,0.06), 0 0 0 3px rgba(0,122,255,0.08)";
          }}
          onBlur={(e) => {
            const isDark = document.documentElement.classList.contains("dark");
            e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)";
            e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.2)";
            e.currentTarget.style.boxShadow = isDark ? "0 2px 16px rgba(0,0,0,0.2)" : "0 2px 16px rgba(0,0,0,0.04)";
          }}
        />
        <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex
                        items-center px-2 py-0.5 rounded-md text-[10px] font-mono
                        text-gray-400/50 dark:text-white/20
                        border border-gray-200/30 dark:border-white/[0.06]
                        group-focus-within:hidden"
             style={{ background: "rgba(0,0,0,0.03)" }}>
          /
        </kbd>
      </div>
    </form>
  );
}
