export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  snippet?: string;
}

export interface NewsSourceDefinition {
  id: string;
  label: string;
  rssUrl: string;
}

export const NEWS_SOURCE_KEY = "dashboard-news-source-v1";
export const NEWS_CUSTOM_SOURCE_ID = "custom-rss";
export const NEWS_CUSTOM_RSS_KEY = "dashboard-news-custom-rss-v1";
export const NEWS_SOURCES: NewsSourceDefinition[] = [
  { id: "google-top", label: "Google Top Stories", rssUrl: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en" },
  { id: "google-tech", label: "Google Technology", rssUrl: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en" },
  { id: "google-business", label: "Google Business", rssUrl: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en" },
  { id: "google-world", label: "Google World", rssUrl: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en" },
  { id: NEWS_CUSTOM_SOURCE_ID, label: "Custom RSS Feed", rssUrl: "" },
];

const CACHE_KEY = "dashboard-news-cache";
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

interface CachedNews {
  items: NewsItem[];
  timestamp: number;
  sourceKey: string;
}

function getSelectedNewsSourceId(): string {
  const raw = localStorage.getItem(NEWS_SOURCE_KEY);
  return NEWS_SOURCES.some((source) => source.id === raw) ? (raw as string) : NEWS_SOURCES[0].id;
}

function loadCustomRssUrl(): string {
  const raw = localStorage.getItem(NEWS_CUSTOM_RSS_KEY);
  if (!raw) return "";
  const value = raw.trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function getSelectedNewsFeed(): { rssUrl: string; sourceKey: string } {
  const sourceId = getSelectedNewsSourceId();
  if (sourceId === NEWS_CUSTOM_SOURCE_ID) {
    const customUrl = loadCustomRssUrl();
    if (customUrl) {
      return {
        rssUrl: customUrl,
        sourceKey: `${NEWS_CUSTOM_SOURCE_ID}:${customUrl}`,
      };
    }
  }
  const source = NEWS_SOURCES.find((item) => item.id === sourceId && item.rssUrl) ?? NEWS_SOURCES[0];
  return {
    rssUrl: source.rssUrl,
    sourceKey: `${source.id}:${source.rssUrl}`,
  };
}

function getCached(): CachedNews | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedNews = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_DURATION) return null;
    if (cached.sourceKey !== getSelectedNewsFeed().sourceKey) return null;
    return cached;
  } catch {
    return null;
  }
}

function setCache(items: NewsItem[]) {
  const selectedFeed = getSelectedNewsFeed();
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ items, timestamp: Date.now(), sourceKey: selectedFeed.sourceKey })
  );
}

function decodeHTMLEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trimEnd()}…`;
}

export async function fetchNews(): Promise<NewsItem[]> {
  const cached = getCached();
  if (cached) return cached.items;

  const selectedFeed = getSelectedNewsFeed();
  const rssUrl = selectedFeed.rssUrl;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;

  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error("Failed to fetch news");

  const text = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "text/xml");

  const items = xml.querySelectorAll("item");
  const newsItems: NewsItem[] = [];

  items.forEach((item, i) => {
    if (i >= 20) return;

    const titleEl = item.querySelector("title");
    const linkEl = item.querySelector("link");
    const sourceEl = item.querySelector("source");
    const pubDateEl = item.querySelector("pubDate");
    const descriptionEl = item.querySelector("description");

    if (titleEl?.textContent && linkEl?.textContent) {
      const descriptionHtml = descriptionEl?.textContent ?? "";
      const snippet = truncateText(
        decodeHTMLEntities(stripHtml(descriptionHtml)),
        220
      );
      newsItems.push({
        title: decodeHTMLEntities(stripHtml(titleEl.textContent)),
        link: linkEl.textContent,
        source: sourceEl?.textContent || "Google News",
        pubDate: pubDateEl?.textContent || "",
        snippet: snippet || undefined,
      });
    }
  });

  setCache(newsItems);
  return newsItems;
}

export function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
