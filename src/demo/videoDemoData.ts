const VIDEO_DEMO_ENABLED_KEY = "dashboard-video-demo-enabled";
const VIDEO_DEMO_VERSION_KEY = "dashboard-video-demo-version";
const VIDEO_DEMO_VERSION = "2026-04-video-v1";

type NewsCacheItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  snippet?: string;
};

function setJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function isoDateOffset(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function isoDateTimeOffset(hoursFromNow: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString();
}

function buildDemoTasks() {
  const now = Date.now();
  return [
    { id: "task-demo-1", text: "Finalize onboarding deck for Monday", completed: false, createdAt: now - 86_000_000 },
    { id: "task-demo-2", text: "Review Q2 campaign metrics", completed: false, createdAt: now - 72_000_000 },
    { id: "task-demo-3", text: "Ship landing page copy polish", completed: true, createdAt: now - 64_000_000 },
    { id: "task-demo-4", text: "Plan team standup priorities", completed: false, createdAt: now - 24_000_000 },
  ];
}

function buildDemoLocalEvents() {
  return [
    {
      id: "local-demo-1",
      title: "Daily Focus Block",
      date: isoDateOffset(0),
      startTime: "09:30",
      endTime: "10:30",
      allDay: false,
      color: "#6366F1",
    },
    {
      id: "local-demo-2",
      title: "Product Video Review",
      date: isoDateOffset(1),
      startTime: "14:00",
      endTime: "14:45",
      allDay: false,
      color: "#0EA5E9",
    },
    {
      id: "local-demo-3",
      title: "Launch Checklist",
      date: isoDateOffset(2),
      startTime: "11:00",
      endTime: "12:00",
      allDay: false,
      color: "#10B981",
    },
    {
      id: "local-demo-4",
      title: "Personal Learning Hour",
      date: isoDateOffset(3),
      startTime: "16:00",
      endTime: "17:00",
      allDay: false,
      color: "#F59E0B",
    },
  ];
}

function buildDemoBookmarks() {
  return [
    { id: "demo-bm-1", title: "Linear", url: "https://linear.app" },
    { id: "demo-bm-2", title: "Notion Workspace", url: "https://www.notion.so" },
    { id: "demo-bm-3", title: "Figma", url: "https://www.figma.com" },
    { id: "demo-bm-4", title: "GitHub", url: "https://github.com" },
    { id: "demo-bm-5", title: "Product Hunt", url: "https://www.producthunt.com" },
    { id: "demo-bm-6", title: "OpenAI Docs", url: "https://platform.openai.com/docs" },
    { id: "demo-bm-7", title: "Vercel", url: "https://vercel.com" },
    { id: "demo-bm-8", title: "Cloudflare", url: "https://www.cloudflare.com" },
  ];
}

function buildDemoSearchSources() {
  return [
    {
      id: "custom-demo-1",
      label: "Docs",
      urlTemplate: "https://devdocs.io/#q={query}",
    },
    {
      id: "custom-demo-2",
      label: "YouTube",
      urlTemplate: "https://www.youtube.com/results?search_query={query}",
    },
  ];
}

function buildDemoNewsItems(): NewsCacheItem[] {
  return [
    {
      title: "Teams embrace dashboard-first workflows for daily planning",
      link: "https://example.com/news/dashboard-workflows",
      source: "Tech Daily",
      pubDate: isoDateTimeOffset(-2),
      snippet: "Workspaces are moving from tab sprawl to single-pane productivity dashboards.",
    },
    {
      title: "Browser productivity tools surge among remote-first teams",
      link: "https://example.com/news/remote-productivity",
      source: "Product Weekly",
      pubDate: isoDateTimeOffset(-5),
      snippet: "New tab personalization and lightweight tasking are trending up in 2026.",
    },
    {
      title: "Designing calmer interfaces: less friction, more flow",
      link: "https://example.com/news/calm-interfaces",
      source: "UX Journal",
      pubDate: isoDateTimeOffset(-11),
      snippet: "Subtle UI motion and context-rich home screens improve perceived focus.",
    },
  ];
}

function buildDemoHomelabServices() {
  const checkedAt = Date.now() - 120_000;
  return [
    {
      id: "svc-demo-1",
      name: "NAS",
      url: "http://192.168.1.50:5000",
      status: "online",
      lastChecked: checkedAt,
    },
    {
      id: "svc-demo-2",
      name: "Home Assistant",
      url: "http://192.168.1.60:8123",
      status: "offline",
      lastChecked: checkedAt,
    },
    {
      id: "svc-demo-3",
      name: "Pi-hole",
      url: "http://192.168.1.70/admin",
      status: "checking",
      lastChecked: null,
    },
  ];
}

function buildDemoHomelabBookmarkItems() {
  const checkedAt = Date.now() - 180_000;
  return [
    {
      bookmarkId: "demo-hlbm-1",
      title: "Grafana",
      url: "http://192.168.1.80:3000",
      enabled: true,
      status: "online",
      lastChecked: checkedAt,
    },
    {
      bookmarkId: "demo-hlbm-2",
      title: "Portainer",
      url: "http://192.168.1.90:9443",
      enabled: true,
      status: "offline",
      lastChecked: checkedAt,
    },
    {
      bookmarkId: "demo-hlbm-3",
      title: "Jellyfin",
      url: "http://192.168.1.95:8096",
      enabled: false,
      status: "idle",
      lastChecked: null,
    },
  ];
}

function applyVideoDemoData(force = false) {
  const alreadySeeded = localStorage.getItem(VIDEO_DEMO_VERSION_KEY) === VIDEO_DEMO_VERSION;
  if (alreadySeeded && !force) return;

  localStorage.setItem("dashboard-username", "Navid");
  localStorage.setItem(
    "dashboard-wallpaper",
    "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1920&q=80"
  );

  localStorage.setItem("dashboard-weather-mock", "1");
  setJson("dashboard-weather-settings", {
    unit: "F",
    customLat: 37.7749,
    customLon: -122.4194,
    customCity: "San Francisco",
  });

  setJson("dashboard-tasks", buildDemoTasks());
  setJson("dashboard-local-events", buildDemoLocalEvents());
  setJson("dashboard-custom-bookmarks", buildDemoBookmarks());
  setJson(
    "dashboard-bookmark-order",
    buildDemoBookmarks().map((bookmark) => bookmark.id)
  );
  setJson("dashboard-search-sources-v1", buildDemoSearchSources());
  setJson("dashboard-news-cache", {
    items: buildDemoNewsItems(),
    timestamp: Date.now(),
  });

  localStorage.setItem("dashboard-quote-category", "inspirational");
  localStorage.setItem("dashboard-quote-date", new Date().toDateString());
  localStorage.setItem("dashboard-quote-index", "2");

  setJson("dashboard-homelab-services", buildDemoHomelabServices());
  setJson("dashboard-homelab-bookmark-items", buildDemoHomelabBookmarkItems());
  setJson("dashboard-homelab-sync-folder", { id: "demo-folder", name: "Homelab" });

  localStorage.setItem(VIDEO_DEMO_VERSION_KEY, VIDEO_DEMO_VERSION);
}

export function bootstrapVideoDemoData() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const modeFromUrl = params.get("videoDemo");

  if (modeFromUrl === "1" || modeFromUrl === "true") {
    localStorage.setItem(VIDEO_DEMO_ENABLED_KEY, "1");
    applyVideoDemoData(true);
    return;
  }

  if (modeFromUrl === "0" || modeFromUrl === "false") {
    localStorage.removeItem(VIDEO_DEMO_ENABLED_KEY);
    return;
  }

  if (localStorage.getItem(VIDEO_DEMO_ENABLED_KEY) === "1") {
    applyVideoDemoData(false);
  }
}

