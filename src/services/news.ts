export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

const CACHE_KEY = "dashboard-news-cache";
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

interface CachedNews {
  items: NewsItem[];
  timestamp: number;
}

function getCached(): CachedNews | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedNews = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_DURATION) return null;
    return cached;
  } catch {
    return null;
  }
}

function setCache(items: NewsItem[]) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ items, timestamp: Date.now() }));
}

function decodeHTMLEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export async function fetchNews(): Promise<NewsItem[]> {
  const cached = getCached();
  if (cached) return cached.items;

  const rssUrl = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";
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

    if (titleEl?.textContent && linkEl?.textContent) {
      newsItems.push({
        title: decodeHTMLEntities(stripHtml(titleEl.textContent)),
        link: linkEl.textContent,
        source: sourceEl?.textContent || "Google News",
        pubDate: pubDateEl?.textContent || "",
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
