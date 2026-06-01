import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { quoteCategories, Quote, QuoteCategory } from "../data/quotes";
import { getPoetPortraitForAuthor, getPoetPortraitForCategory } from "../data/poetPortraits";
import { fetchNews, formatTimeAgo, NewsItem } from "../services/news";
import { loadQuotesDefaultMode, saveQuotesDefaultMode } from "../settings/quotesMode";

const CATEGORY_KEY = "dashboard-quote-category";
const QUOTE_SELECTION_MODE_KEY = "dashboard-quote-selection-mode-v1";
const QUOTE_POET_COLLECTION_KEY = "dashboard-quote-poet-collection-v1";
const QUOTE_CONTEXT_KEY = "dashboard-quote-context-v1";
const QUOTE_INDEX_KEY = "dashboard-quote-index";
const LAST_QUOTE_DATE_KEY = "dashboard-quote-date";

type Mode = "quotes" | "news";
type QuoteSelection =
  | { mode: "single"; categoryId: string }
  | { mode: "poet-collection"; categoryIds: string[] };

function getTodayStr() {
  return new Date().toDateString();
}

function loadSavedSelection(): QuoteSelection {
  const selectionMode = localStorage.getItem(QUOTE_SELECTION_MODE_KEY);
  if (selectionMode === "poet-collection") {
    try {
      const parsed = JSON.parse(localStorage.getItem(QUOTE_POET_COLLECTION_KEY) || "[]");
      if (Array.isArray(parsed)) {
        const validIds = [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0))];
        const validPoetCategories = quoteCategories.filter((category) => !!getPoetPortraitForCategory(category.id)).map((category) => category.id);
        const categoryIds = validIds.filter((id) => validPoetCategories.includes(id));
        if (categoryIds.length > 0) return { mode: "poet-collection", categoryIds };
      }
    } catch {
      // Fall back to single selection.
    }
  }
  return { mode: "single", categoryId: localStorage.getItem(CATEGORY_KEY) || "inspirational" };
}

function getDailyQuote(categories: QuoteCategory[], contextKey: string): { quote: Quote; index: number } {
  const pool = categories.flatMap((category) => category.quotes);
  if (pool.length === 0) {
    return { quote: quoteCategories[0]!.quotes[0]!, index: 0 };
  }
  const today = getTodayStr();
  const savedDate = localStorage.getItem(LAST_QUOTE_DATE_KEY);
  const savedIndex = parseInt(localStorage.getItem(QUOTE_INDEX_KEY) || "0", 10);
  const savedContext = localStorage.getItem(QUOTE_CONTEXT_KEY);

  if (savedDate === today && savedContext === contextKey && savedIndex < pool.length) {
    return { quote: pool[savedIndex], index: savedIndex };
  }

  const seed = today.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const index = seed % pool.length;

  localStorage.setItem(LAST_QUOTE_DATE_KEY, today);
  localStorage.setItem(QUOTE_CONTEXT_KEY, contextKey);
  localStorage.setItem(QUOTE_INDEX_KEY, String(index));

  return { quote: pool[index], index };
}

export default function QuotesWidget() {
  const [mode, setMode] = useState<Mode>(() => loadQuotesDefaultMode());
  const [quoteSelection, setQuoteSelection] = useState<QuoteSelection>(loadSavedSelection);
  const [showPicker, setShowPicker] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [fade, setFade] = useState(true);

  const activeCategories = quoteSelection.mode === "poet-collection"
    ? quoteSelection.categoryIds
        .map((id) => quoteCategories.find((category) => category.id === id))
        .filter((category): category is QuoteCategory => Boolean(category))
    : [quoteCategories.find((category) => category.id === quoteSelection.categoryId) || quoteCategories[0]];

  const activeQuotes = activeCategories.flatMap((category) => category.quotes);
  const categoryLabel =
    quoteSelection.mode === "poet-collection"
      ? `Poet Collection (${activeCategories.length})`
      : `${activeCategories[0]?.icon ?? "✨"} ${activeCategories[0]?.name ?? "Quotes"}`;
  const contextKey =
    quoteSelection.mode === "poet-collection"
      ? `collection:${quoteSelection.categoryIds.join("|")}`
      : `single:${quoteSelection.categoryId}`;
  const poetPortrait = mode === "quotes" && currentQuote ? getPoetPortraitForAuthor(currentQuote.author) : null;

  useEffect(() => {
    const { quote } = getDailyQuote(activeCategories, contextKey);
    setCurrentQuote(quote);
  }, [contextKey]);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError("");
    try {
      const items = await fetchNews();
      setNewsItems(items);
    } catch {
      setNewsError("Unable to load news");
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "news") loadNews();
  }, [mode, loadNews]);

  useEffect(() => {
    saveQuotesDefaultMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!showPicker) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPicker(false);
        setDropdownRect(null);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [showPicker]);

  const handleCategoryChange = (id: string) => {
    setFade(false);
    const nextSelection: QuoteSelection = { mode: "single", categoryId: id };
    localStorage.setItem(CATEGORY_KEY, id);
    localStorage.setItem(QUOTE_SELECTION_MODE_KEY, "theme");
    localStorage.removeItem(QUOTE_POET_COLLECTION_KEY);
    localStorage.removeItem(LAST_QUOTE_DATE_KEY);
    setQuoteSelection(nextSelection);
    setShowPicker(false);
    setDropdownRect(null);

    setTimeout(() => setFade(true), 50);
  };

  const shuffleQuote = () => {
    if (activeQuotes.length === 0) return;
    setFade(false);
    setTimeout(() => {
      const randomIdx = Math.floor(Math.random() * activeQuotes.length);
      setCurrentQuote(activeQuotes[randomIdx] ?? null);
      localStorage.setItem(QUOTE_INDEX_KEY, String(randomIdx));
      localStorage.setItem(QUOTE_CONTEXT_KEY, contextKey);
      setFade(true);
    }, 200);
  };

  return (
    <div className="widget-card flex flex-col relative overflow-hidden">
      {poetPortrait ? (
        <>
          <div className="quote-widget-poet-bg" aria-hidden="true">
            <img src={poetPortrait} alt="" className="quote-widget-poet-bg-image" loading="lazy" />
          </div>
          <div className="quote-widget-poet-overlay" aria-hidden="true" />
        </>
      ) : null}

      {/* Header */}
      <div className="relative z-[1] flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {mode === "quotes" ? (
            <svg className="w-[18px] h-[18px] text-gray-500/60 dark:text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.2 48.2 0 005.327-.533c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          ) : (
            <svg className="w-[18px] h-[18px] text-gray-500/60 dark:text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
          )}
          <h2 className="font-medium text-[15px] text-gray-700/80 dark:text-white/60">
            {mode === "quotes" ? "Daily Quote" : "Headlines"}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Mode toggle */}
          <button
            onClick={() => setMode(mode === "quotes" ? "news" : "quotes")}
            className="p-1.5 rounded-lg text-gray-400/50 hover:text-gray-600/70 dark:text-white/20 dark:hover:text-white/50 transition-all duration-200"
            title={mode === "quotes" ? "Switch to news" : "Switch to quotes"}
          >
            {mode === "quotes" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.2 48.2 0 005.327-.533c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            )}
          </button>

          {mode === "quotes" && (
            <>
              {/* Shuffle */}
              <button
                onClick={shuffleQuote}
                className="p-1.5 rounded-lg text-gray-400/50 hover:text-gray-600/70 dark:text-white/20 dark:hover:text-white/50 transition-all duration-200"
                title="New quote"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992" />
                </svg>
              </button>

              {/* Category picker toggle */}
              <button
                ref={triggerRef}
                onClick={() => {
                  if (!showPicker && triggerRef.current) {
                    setDropdownRect(triggerRef.current.closest(".widget-card")?.getBoundingClientRect() ?? null);
                  }
                  setShowPicker(!showPicker);
                }}
                className="p-1.5 rounded-lg text-gray-400/50 hover:text-gray-600/70 dark:text-white/20 dark:hover:text-white/50 transition-all duration-200"
                title="Choose category"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
              </button>
            </>
          )}

          {mode === "news" && (
            <button
              onClick={loadNews}
              className="p-1.5 rounded-lg text-gray-400/50 hover:text-gray-600/70 dark:text-white/20 dark:hover:text-white/50 transition-all duration-200"
              title="Refresh news"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Quote content */}
      {mode === "quotes" && currentQuote && (
        <div className={`relative z-[1] flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col justify-center transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`}>
          <div className="mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.04] text-gray-500/60 dark:text-white/25 font-light">
              {categoryLabel}
            </span>
          </div>

          <blockquote className="mt-3">
            <p className="text-[15px] leading-relaxed text-gray-700/85 dark:text-white/70 font-light italic">
              "{currentQuote.text}"
            </p>
            <footer className="mt-3 flex items-center gap-2">
              <div className="w-4 h-px bg-gray-300/40 dark:bg-white/10" />
              <cite className="text-[13px] text-gray-500/60 dark:text-white/35 not-italic font-medium">
                {currentQuote.author}
              </cite>
              {currentQuote.source && (
                <span className="text-[11px] text-gray-400/40 dark:text-white/15 font-light">
                  {currentQuote.source}
                </span>
              )}
            </footer>
          </blockquote>
        </div>
      )}

      {/* News content */}
      {mode === "news" && (
        <div className="relative z-[1] flex-1 flex flex-col">
          {newsLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full border-[1.5px] border-gray-300/30 border-t-gray-500/40 animate-spin" />
              <span className="ml-2 text-[13px] text-gray-400/40 dark:text-white/20 font-light">Loading headlines...</span>
            </div>
          )}

          {newsError && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[13px] text-gray-400/40 dark:text-white/20 font-light">{newsError}</span>
            </div>
          )}

          {!newsLoading && !newsError && newsItems.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col gap-0.5 overflow-y-auto pr-1">
              {newsItems.slice(0, 8).map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 dark:bg-blue-400/40 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-gray-700/80 dark:text-white/60 group-hover:text-blue-600/80 dark:group-hover:text-blue-400/70 transition-colors line-clamp-2">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400/50 dark:text-white/20 font-medium">
                        {item.source}
                      </span>
                      {item.pubDate && (
                        <>
                          <span className="text-[10px] text-gray-300/30 dark:text-white/10">·</span>
                          <span className="text-[10px] text-gray-400/40 dark:text-white/15 font-light">
                            {formatTimeAgo(item.pubDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-gray-300/30 dark:text-white/10 group-hover:text-blue-500/40 flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              ))}
            </div>
          )}

          {!newsLoading && !newsError && newsItems.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[13px] text-gray-400/40 dark:text-white/20 font-light">No headlines available</span>
            </div>
          )}
        </div>
      )}

      {/* Category picker dropdown - rendered in portal for proper stacking */}
      {showPicker &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => {
                setShowPicker(false);
                setDropdownRect(null);
              }}
              aria-hidden="true"
            />
            {mode === "quotes" && dropdownRect && (
              <div
                className="fixed z-[9999]"
                style={{
                  top: dropdownRect.top + 56,
                  left: dropdownRect.left + 8,
                  width: dropdownRect.width - 16,
                }}
              >
                <div className="glass p-3 max-h-[320px] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1.5">
                    {quoteCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryChange(cat.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all duration-200
                          ${quoteSelection.mode === "single" && cat.id === quoteSelection.categoryId
                            ? "bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400"
                            : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-gray-600/80 dark:text-white/50"
                          }`}
                      >
                        <span className="text-base flex-shrink-0">{cat.icon}</span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">{cat.name}</div>
                          <div className="text-[10px] opacity-50 truncate">{cat.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body
        )}
    </div>
  );
}
