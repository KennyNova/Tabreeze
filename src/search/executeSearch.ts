import type { SearchSource } from "./sources";
import { buildSearchUrl } from "./sources";

const POLICY_MANAGED_WEB_SEARCH_SOURCE_IDS = new Set(["google", "bing"]);
const POLICY_MANAGED_WEB_SEARCH_HOSTS = ["google.com", "bing.com"];

function getTemplateHostname(template: string): string | null {
  try {
    const sampleUrl = buildSearchUrl(template, "sample");
    return new URL(sampleUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Web-search sources that should run through chrome.search.query for policy compliance. */
export function shouldUseChromeSearchApi(source: SearchSource): boolean {
  if (POLICY_MANAGED_WEB_SEARCH_SOURCE_IDS.has(source.id)) return true;
  const host = getTemplateHostname(source.urlTemplate);
  if (!host) return false;
  return POLICY_MANAGED_WEB_SEARCH_HOSTS.some(
    (policyHost) => host === policyHost || host.endsWith(`.${policyHost}`)
  );
}

export async function executeDashboardSearch(query: string, source: SearchSource): Promise<void> {
  const text = query.trim();
  if (!text) return;

  const useChromeSearchApi = shouldUseChromeSearchApi(source);

  if (useChromeSearchApi) {
    if (typeof chrome === "undefined" || typeof chrome.search?.query !== "function") {
      console.warn("Chrome Search API is unavailable for this source.");
      return;
    }
    try {
      await chrome.search.query({ text, disposition: "NEW_TAB" });
      return;
    } catch (error) {
      console.warn("Chrome Search API query failed.", error);
      return;
    }
  }

  window.location.href = buildSearchUrl(source.urlTemplate, text);
}
