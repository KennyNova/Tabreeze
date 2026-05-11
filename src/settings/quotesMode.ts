export type QuotesDefaultMode = "quotes" | "news";

export const QUOTES_DEFAULT_MODE_KEY = "dashboard-quotes-default-mode-v1";

export function loadQuotesDefaultMode(): QuotesDefaultMode {
  return localStorage.getItem(QUOTES_DEFAULT_MODE_KEY) === "news" ? "news" : "quotes";
}

export function saveQuotesDefaultMode(mode: QuotesDefaultMode): void {
  localStorage.setItem(QUOTES_DEFAULT_MODE_KEY, mode === "news" ? "news" : "quotes");
}
