import newsModeArt from "../assets/news/news-mode.svg";
import quotesModeArt from "../assets/news/quotes-mode.svg";
import googleTopStoriesArt from "../assets/news/google-top-stories.svg";
import googleTechnologyArt from "../assets/news/google-technology.svg";
import googleBusinessArt from "../assets/news/google-business.svg";
import googleWorldArt from "../assets/news/google-world.svg";
import customRssSourceArt from "../assets/news/custom-rss-source.svg";
import { NEWS_CUSTOM_SOURCE_ID } from "../services/news";

export function getContentModeArt(mode: "quotes" | "news"): string | null {
  if (mode === "quotes") return quotesModeArt;
  if (mode === "news") return newsModeArt;
  return null;
}

export function getNewsSourceArt(sourceId: string): string {
  if (sourceId === NEWS_CUSTOM_SOURCE_ID) return customRssSourceArt;
  if (sourceId === "google-tech") return googleTechnologyArt;
  if (sourceId === "google-business") return googleBusinessArt;
  if (sourceId === "google-world") return googleWorldArt;
  return googleTopStoriesArt;
}
