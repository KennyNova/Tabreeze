export interface SearchSource {
  id: string;
  label: string;
  urlTemplate: string;
  builtin?: boolean;
}

export const SEARCH_SOURCES_STORAGE_KEY = "dashboard-search-sources-v1";
export const MAX_CUSTOM_SEARCH_SOURCES = 5;

export const DEFAULT_SEARCH_SOURCES: SearchSource[] = [
  {
    id: "google",
    label: "Google",
    urlTemplate: "https://www.google.com/search?q={query}",
    builtin: true,
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    urlTemplate: "https://chatgpt.com/?q={query}",
    builtin: true,
  },
  {
    id: "claude",
    label: "Claude",
    urlTemplate: "https://claude.ai/new?q={query}",
    builtin: true,
  },
  {
    id: "bing",
    label: "Bing",
    urlTemplate: "https://www.bing.com/search?q={query}",
    builtin: true,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    urlTemplate: "https://www.perplexity.ai/search?q={query}",
    builtin: true,
  },
];

function sanitizeLabel(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, 40);
}

function sanitizeTemplate(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim();
}

function normalizeTemplate(template: string): string {
  if (template.includes("{query}") || template.includes("%s")) return template;
  return `${template}${template.includes("?") ? "&" : "?"}q={query}`;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function buildSearchUrl(template: string, query: string): string {
  const encoded = encodeURIComponent(query);
  if (template.includes("{query}")) return template.split("{query}").join(encoded);
  if (template.includes("%s")) return template.split("%s").join(encoded);
  return `${template}${template.includes("?") ? "&" : "?"}q=${encoded}`;
}

export function isValidSourceTemplate(template: string): boolean {
  const normalized = normalizeTemplate(template);
  const url = buildSearchUrl(normalized, "test");
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function loadCustomSearchSources(): SearchSource[] {
  const raw = localStorage.getItem(SEARCH_SOURCES_STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) return [];
  const custom = parsed
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item, idx) => {
      const label = sanitizeLabel(item.label);
      const template = sanitizeTemplate(item.urlTemplate);
      if (!label || !template) return null;
      return {
        id: typeof item.id === "string" && item.id ? item.id : `custom-${Date.now()}-${idx}`,
        label,
        urlTemplate: normalizeTemplate(template),
        builtin: false,
      } as SearchSource;
    })
    .filter((item): item is SearchSource => item !== null)
    .slice(0, MAX_CUSTOM_SEARCH_SOURCES);
  return uniqueById(custom);
}

export function saveCustomSearchSources(customSources: SearchSource[]): void {
  const toSave = customSources
    .filter((s) => !s.builtin)
    .slice(0, MAX_CUSTOM_SEARCH_SOURCES)
    .map((s) => ({ id: s.id, label: s.label, urlTemplate: s.urlTemplate }));
  localStorage.setItem(SEARCH_SOURCES_STORAGE_KEY, JSON.stringify(toSave));
}

export function getAvailableSearchSources(customSources: SearchSource[]): SearchSource[] {
  return [...DEFAULT_SEARCH_SOURCES, ...customSources.filter((s) => !s.builtin)];
}

export function resolveSearchSource(sourceId?: string): SearchSource {
  const available = getAvailableSearchSources(loadCustomSearchSources());
  if (sourceId) {
    const match = available.find((s) => s.id === sourceId);
    if (match) return match;
  }
  return DEFAULT_SEARCH_SOURCES[0];
}

export function createCustomSearchSource(label: string, template: string): SearchSource {
  const cleanedLabel = sanitizeLabel(label);
  const cleanedTemplate = normalizeTemplate(sanitizeTemplate(template));
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: cleanedLabel,
    urlTemplate: cleanedTemplate,
    builtin: false,
  };
}
