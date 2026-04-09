import { useState, useEffect, useRef, useCallback } from "react";

interface HomelabService {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline" | "checking";
  lastChecked: number | null;
}

interface BookmarkFolder {
  id: string;
  title: string;
  children?: BookmarkFolder[];
}

interface BookmarkItem {
  bookmarkId: string;
  title: string;
  url: string;
  enabled: boolean;
  status: "online" | "offline" | "checking" | "idle";
  lastChecked: number | null;
}

const STORAGE_KEY = "dashboard-homelab-services";
const SYNC_FOLDER_KEY = "dashboard-homelab-sync-folder";
const BOOKMARK_ITEMS_KEY = "dashboard-homelab-bookmark-items";
const PING_INTERVAL = 10 * 60 * 1000;

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function timeAgo(timestamp: number | null): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

async function pingUrl(url: string): Promise<boolean> {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 8000);
        chrome.runtime.sendMessage(
          { type: "PING_SERVICE", url },
          (response) => {
            clearTimeout(timer);
            resolve(response?.online ?? false);
          }
        );
      });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { mode: "no-cors", signal: controller.signal });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

function ServiceIcon({ url }: { url: string }) {
  const [hasError, setHasError] = useState(false);
  const origin = getOrigin(url);

  if (hasError) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gray-200/60 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-gray-400 dark:text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={`${origin}/favicon.ico`}
      alt=""
      className="w-8 h-8 rounded-lg flex-shrink-0 object-contain bg-white/40 dark:bg-white/10 p-1"
      onError={() => setHasError(true)}
    />
  );
}

function StatusDot({ status }: { status: "online" | "offline" | "checking" | "idle" }) {
  if (status === "idle") return null;
  const colors = {
    online: "bg-emerald-400 shadow-emerald-400/40",
    offline: "bg-red-400 shadow-red-400/40",
    checking: "bg-amber-400 shadow-amber-400/40 animate-pulse",
  };
  return (
    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_6px] ${colors[status]}`} />
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!enabled); }}
      className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200 ${
        enabled ? "bg-blue-500" : "bg-gray-300/60 dark:bg-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function buildFolderTree(nodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkFolder[] {
  const folders: BookmarkFolder[] = [];
  for (const node of nodes) {
    if (node.children) {
      folders.push({
        id: node.id,
        title: node.title || "Untitled",
        children: buildFolderTree(node.children),
      });
    }
  }
  return folders;
}

function collectBookmarksFromFolder(
  node: chrome.bookmarks.BookmarkTreeNode
): { title: string; url: string; id: string }[] {
  const results: { title: string; url: string; id: string }[] = [];
  if (node.url) {
    results.push({ title: node.title, url: node.url, id: node.id });
  }
  if (node.children) {
    for (const child of node.children) {
      results.push(...collectBookmarksFromFolder(child));
    }
  }
  return results;
}

export default function HomelabSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [services, setServices] = useState<HomelabService[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  // Bookmark sync state
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderTree, setFolderTree] = useState<BookmarkFolder[]>([]);
  const [syncedFolder, setSyncedFolder] = useState<{ id: string; name: string } | null>(null);
  const [bookmarkItems, setBookmarkItems] = useState<BookmarkItem[]>([]);

  const servicesRef = useRef<HomelabService[]>([]);
  const bookmarkItemsRef = useRef<BookmarkItem[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);

  servicesRef.current = services;
  bookmarkItemsRef.current = bookmarkItems;

  // Load data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: HomelabService[] = JSON.parse(stored);
        setServices(parsed.map((s) => ({ ...s, status: "checking" })));
      } catch { /* ignore */ }
    }

    const storedFolder = localStorage.getItem(SYNC_FOLDER_KEY);
    if (storedFolder) {
      try {
        setSyncedFolder(JSON.parse(storedFolder));
      } catch { /* ignore */ }
    }

    const storedBookmarks = localStorage.getItem(BOOKMARK_ITEMS_KEY);
    if (storedBookmarks) {
      try {
        const parsed: BookmarkItem[] = JSON.parse(storedBookmarks);
        setBookmarkItems(parsed.map((b) => ({
          ...b,
          status: b.enabled ? "checking" : "idle",
        })));
      } catch { /* ignore */ }
    }

    setLoaded(true);
  }, []);

  // Re-sync bookmarks when synced folder is set (on load)
  useEffect(() => {
    if (!loaded || !syncedFolder) return;
    syncBookmarksFromFolder(syncedFolder.id);
  }, [loaded, syncedFolder?.id]);

  const saveServices = useCallback((svcs: HomelabService[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(svcs));
  }, []);

  const saveBookmarkItems = useCallback((items: BookmarkItem[]) => {
    localStorage.setItem(BOOKMARK_ITEMS_KEY, JSON.stringify(items));
  }, []);

  const pingAll = useCallback(async () => {
    const currentServices = servicesRef.current;
    const currentBookmarks = bookmarkItemsRef.current;
    const enabledBookmarks = currentBookmarks.filter((b) => b.enabled);

    if (currentServices.length === 0 && enabledBookmarks.length === 0) return;

    if (currentServices.length > 0) {
      setServices((prev) => prev.map((s) => ({ ...s, status: "checking" as const })));
    }
    if (enabledBookmarks.length > 0) {
      setBookmarkItems((prev) =>
        prev.map((b) => (b.enabled ? { ...b, status: "checking" as const } : b))
      );
    }

    const [serviceResults, bookmarkResults] = await Promise.all([
      Promise.all(
        currentServices.map(async (service) => {
          const online = await pingUrl(service.url);
          return { ...service, status: (online ? "online" : "offline") as HomelabService["status"], lastChecked: Date.now() };
        })
      ),
      Promise.all(
        enabledBookmarks.map(async (bm) => {
          const online = await pingUrl(bm.url);
          return { ...bm, status: (online ? "online" : "offline") as BookmarkItem["status"], lastChecked: Date.now() };
        })
      ),
    ]);

    if (serviceResults.length > 0) {
      setServices(serviceResults);
      saveServices(serviceResults);
    }
    if (bookmarkResults.length > 0) {
      setBookmarkItems((prev) => {
        const resultMap = new Map(bookmarkResults.map((r) => [r.bookmarkId, r]));
        const updated = prev.map((b) => resultMap.get(b.bookmarkId) ?? b);
        saveBookmarkItems(updated);
        return updated;
      });
    }
  }, [saveServices, saveBookmarkItems]);

  useEffect(() => {
    if (!loaded) return;
    pingAll();
    const interval = setInterval(pingAll, PING_INTERVAL);
    return () => clearInterval(interval);
  }, [loaded, pingAll]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuId && !(e.target as Element)?.closest(".ctx-menu")) {
        setContextMenuId(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenuId]);

  useEffect(() => {
    if (showAddForm && nameInputRef.current) nameInputRef.current.focus();
  }, [showAddForm]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setShowFolderPicker(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // ── Manual service CRUD ──

  const addService = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const url = normalizeUrl(newUrl);
    const service: HomelabService = { id: generateId(), name: newName.trim(), url, status: "checking", lastChecked: null };
    const updated = [...services, service];
    setServices(updated);
    saveServices(updated);
    setNewName("");
    setNewUrl("");
    setShowAddForm(false);

    pingUrl(url).then((online) => {
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, status: online ? "online" : "offline", lastChecked: Date.now() } : s))
      );
    });
  };

  const removeService = (id: string) => {
    const updated = services.filter((s) => s.id !== id);
    setServices(updated);
    saveServices(updated);
    setContextMenuId(null);
  };

  const startEdit = (service: HomelabService) => {
    setEditingId(service.id);
    setEditName(service.name);
    setEditUrl(service.url);
    setContextMenuId(null);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim() || !editUrl.trim()) return;
    const url = normalizeUrl(editUrl);
    const updated = services.map((s) =>
      s.id === editingId ? { ...s, name: editName.trim(), url, status: "checking" as const } : s
    );
    setServices(updated);
    saveServices(updated);
    setEditingId(null);

    pingUrl(url).then((online) => {
      setServices((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, status: online ? "online" : "offline", lastChecked: Date.now() } : s))
      );
    });
  };

  // ── Bookmark sync ──

  const openFolderPicker = () => {
    if (typeof chrome === "undefined" || !chrome.bookmarks) return;
    chrome.bookmarks.getTree((tree) => {
      if (!tree[0]?.children) return;
      setFolderTree(buildFolderTree(tree[0].children));
      setShowFolderPicker(true);
    });
  };

  const syncBookmarksFromFolder = (folderId: string) => {
    if (typeof chrome === "undefined" || !chrome.bookmarks) return;
    chrome.bookmarks.getSubTree(folderId, (results) => {
      if (!results?.[0]) return;
      const items = collectBookmarksFromFolder(results[0]);

      setBookmarkItems((prev) => {
        const existingMap = new Map(prev.map((b) => [b.bookmarkId, b]));
        const existingServiceUrls = new Set(servicesRef.current.map((s) => s.url));

        const merged: BookmarkItem[] = items
          .filter((item) => !existingServiceUrls.has(item.url) && !existingServiceUrls.has(normalizeUrl(item.url)))
          .map((item) => {
            const existing = existingMap.get(item.id);
            if (existing) {
              return { ...existing, title: item.title, url: item.url };
            }
            return {
              bookmarkId: item.id,
              title: item.title,
              url: item.url,
              enabled: false,
              status: "idle" as const,
              lastChecked: null,
            };
          });

        saveBookmarkItems(merged);
        return merged;
      });
    });
  };

  const selectFolder = (folder: BookmarkFolder) => {
    const folderData = { id: folder.id, name: folder.title };
    setSyncedFolder(folderData);
    localStorage.setItem(SYNC_FOLDER_KEY, JSON.stringify(folderData));
    setShowFolderPicker(false);
    syncBookmarksFromFolder(folder.id);
  };

  const unsyncFolder = () => {
    setSyncedFolder(null);
    setBookmarkItems([]);
    localStorage.removeItem(SYNC_FOLDER_KEY);
    localStorage.removeItem(BOOKMARK_ITEMS_KEY);
  };

  const toggleBookmark = (bookmarkId: string) => {
    setBookmarkItems((prev) => {
      const updated = prev.map((b) => {
        if (b.bookmarkId !== bookmarkId) return b;
        const nowEnabled = !b.enabled;
        if (nowEnabled) {
          pingUrl(b.url).then((online) => {
            setBookmarkItems((p) =>
              p.map((x) =>
                x.bookmarkId === bookmarkId
                  ? { ...x, status: online ? "online" : "offline", lastChecked: Date.now() }
                  : x
              )
            );
          });
          return { ...b, enabled: true, status: "checking" as const };
        }
        return { ...b, enabled: false, status: "idle" as const, lastChecked: null };
      });
      saveBookmarkItems(updated);
      return updated;
    });
  };

  const onlineCount =
    services.filter((s) => s.status === "online").length +
    bookmarkItems.filter((b) => b.enabled && b.status === "online").length;
  const totalTracked =
    services.length + bookmarkItems.filter((b) => b.enabled).length;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 transition-all duration-300 ${
          isOpen ? "opacity-0 pointer-events-none translate-x-4" : "opacity-100"
        }`}
        title="Homelab Services"
      >
        <div className="glass flex items-center gap-2 pl-3 pr-2 py-2.5 rounded-l-xl rounded-r-none cursor-pointer hover:pl-4 transition-all duration-200 group">
          <svg className="w-5 h-5 text-gray-500 dark:text-white/50 group-hover:text-gray-700 dark:group-hover:text-white/80 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
          </svg>
          {totalTracked > 0 && (
            <span className="text-[11px] font-medium text-gray-400 dark:text-white/40 tabular-nums">
              {onlineCount}/{totalTracked}
            </span>
          )}
        </div>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30 backdrop-blur-[2px] homelab-backdrop-in"
          onClick={() => { setIsOpen(false); setShowFolderPicker(false); }}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[340px] max-w-[90vw] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col bg-white/70 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl border-l border-white/20 dark:border-white/[0.08] shadow-[-4px_0_24px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_24px_rgba(0,0,0,0.3)]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/50 dark:border-white/[0.06]">
            <div>
              <h2 className="text-[15px] font-semibold text-gray-800 dark:text-white/90">
                Homelab Services
              </h2>
              {totalTracked > 0 && (
                <p className="text-[11px] text-gray-400 dark:text-white/35 mt-0.5">
                  {onlineCount} of {totalTracked} online
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {totalTracked > 0 && (
                <button
                  onClick={pingAll}
                  className="p-2 rounded-xl text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-all"
                  title="Refresh all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => { setIsOpen(false); setShowFolderPicker(false); }}
                className="p-2 rounded-xl text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Folder picker view */}
          {showFolderPicker ? (
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="flex items-center gap-2 px-2 mb-3">
                <button
                  onClick={() => setShowFolderPicker(false)}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-white/40 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <span className="text-[13px] font-medium text-gray-600 dark:text-white/60">
                  Select a bookmark folder
                </span>
              </div>
              <FolderList folders={folderTree} onSelect={selectFolder} depth={0} />
            </div>
          ) : (
            <>
              {/* Services list */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                {services.length === 0 && bookmarkItems.length === 0 && !showAddForm && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100/80 dark:bg-white/[0.06] flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-gray-300 dark:text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-400 dark:text-white/30 mb-1">
                      No services added
                    </p>
                    <p className="text-xs text-gray-300 dark:text-white/20 mb-5 leading-relaxed">
                      Add services manually or sync from your bookmarks
                    </p>
                    <div className="flex flex-col gap-2 w-full">
                      <button onClick={() => setShowAddForm(true)} className="btn-primary text-sm px-5 py-2">
                        Add a service
                      </button>
                      <button onClick={openFolderPicker} className="btn-ghost text-sm px-5 py-2 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                        </svg>
                        Sync from bookmarks
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual services */}
                {services.map((service) =>
                  editingId === service.id ? (
                    <div key={service.id} className="glass p-3 space-y-2">
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Service name" className="input-field text-sm !py-2" />
                      <input type="text" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="IP or URL" className="input-field text-sm !py-2" onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditingId(null)} className="btn-ghost text-xs flex-1">Cancel</button>
                        <button onClick={saveEdit} className="btn-primary text-xs flex-1 !py-1.5">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={service.id}
                      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100/60 dark:hover:bg-white/[0.04] transition-all cursor-pointer"
                      onClick={() => window.open(service.url, "_blank")}
                    >
                      <ServiceIcon url={service.url} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-gray-700 dark:text-white/80 truncate">{service.name}</span>
                          <StatusDot status={service.status} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-400 dark:text-white/30 truncate">{service.url.replace(/^https?:\/\//, "")}</span>
                          {service.lastChecked && <span className="text-[10px] text-gray-300 dark:text-white/20 flex-shrink-0">{timeAgo(service.lastChecked)}</span>}
                        </div>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-200/60 dark:hover:bg-white/[0.08] transition-all ctx-menu"
                        onClick={(e) => { e.stopPropagation(); setContextMenuId(contextMenuId === service.id ? null : service.id); }}
                      >
                        <svg className="w-4 h-4 text-gray-400 dark:text-white/40" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {contextMenuId === service.id && (
                        <div className="ctx-menu absolute right-2 top-10 z-20 glass py-1.5 w-32 shadow-lg">
                          <button className="w-full text-left px-3 py-1.5 text-[13px] text-gray-600 dark:text-white/60 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-colors" onClick={(e) => { e.stopPropagation(); startEdit(service); }}>Edit</button>
                          <button className="w-full text-left px-3 py-1.5 text-[13px] text-red-500 dark:text-red-400 hover:bg-red-50/60 dark:hover:bg-red-500/10 transition-colors" onClick={(e) => { e.stopPropagation(); removeService(service.id); }}>Remove</button>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Add form */}
                {showAddForm && (
                  <div className="glass p-3 space-y-2 mt-1">
                    <input ref={nameInputRef} type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Service name (e.g. Pi-hole)" className="input-field text-sm !py-2" />
                    <input type="text" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="IP or URL (e.g. 192.168.1.10:8080)" className="input-field text-sm !py-2" onKeyDown={(e) => e.key === "Enter" && addService()} />
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setShowAddForm(false); setNewName(""); setNewUrl(""); }} className="btn-ghost text-xs flex-1">Cancel</button>
                      <button onClick={addService} disabled={!newName.trim() || !newUrl.trim()} className="btn-primary text-xs flex-1 !py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
                    </div>
                  </div>
                )}

                {/* ── Synced bookmarks section ── */}
                {syncedFolder && bookmarkItems.length > 0 && (
                  <>
                    {services.length > 0 && (
                      <div className="border-t border-gray-200/40 dark:border-white/[0.05] my-3" />
                    )}
                    <div className="flex items-center justify-between px-2 mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-400 dark:text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                        </svg>
                        <span className="text-[11px] font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">
                          {syncedFolder.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => syncBookmarksFromFolder(syncedFolder.id)}
                          className="p-1.5 rounded-lg text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/50 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-all"
                          title="Re-sync bookmarks"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                          </svg>
                        </button>
                        <button
                          onClick={unsyncFolder}
                          className="p-1.5 rounded-lg text-gray-300 dark:text-white/20 hover:text-red-400 hover:bg-red-50/60 dark:hover:bg-red-500/10 transition-all"
                          title="Unsync folder"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.181 8.68l-4.503-4.503m0 0l-1.06 1.06 1.06-1.06zm0 0L5.25 8.552a2.123 2.123 0 00-1.279 1.955v.426a2.123 2.123 0 001.28 1.955l3.366 1.444a2.123 2.123 0 001.955-1.28l.426-.952m2.684-6.92l4.503 4.503m0 0l1.06-1.06-1.06 1.06zm0 0l4.368-4.368a2.123 2.123 0 00-1.955-1.28h-.426a2.123 2.123 0 00-1.955 1.28L14.5 8.552" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {bookmarkItems.map((bm) => (
                      <div
                        key={bm.bookmarkId}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                          bm.enabled
                            ? "hover:bg-gray-100/60 dark:hover:bg-white/[0.04] cursor-pointer"
                            : "opacity-50"
                        }`}
                        onClick={() => bm.enabled && window.open(bm.url, "_blank")}
                      >
                        <ServiceIcon url={bm.url} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[13px] font-medium truncate ${
                              bm.enabled ? "text-gray-700 dark:text-white/80" : "text-gray-400 dark:text-white/30"
                            }`}>
                              {bm.title || bm.url}
                            </span>
                            {bm.enabled && <StatusDot status={bm.status} />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-gray-400 dark:text-white/30 truncate">
                              {bm.url.replace(/^https?:\/\//, "")}
                            </span>
                            {bm.enabled && bm.lastChecked && (
                              <span className="text-[10px] text-gray-300 dark:text-white/20 flex-shrink-0">
                                {timeAgo(bm.lastChecked)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ToggleSwitch enabled={bm.enabled} onChange={() => toggleBookmark(bm.bookmarkId)} />
                      </div>
                    ))}
                  </>
                )}

                {syncedFolder && bookmarkItems.length === 0 && services.length > 0 && (
                  <>
                    <div className="border-t border-gray-200/40 dark:border-white/[0.05] my-3" />
                    <div className="text-center py-4 px-4">
                      <p className="text-[12px] text-gray-300 dark:text-white/20">
                        No bookmarks found in "{syncedFolder.name}"
                      </p>
                      <button onClick={unsyncFolder} className="text-[11px] text-gray-400 dark:text-white/30 hover:text-red-400 mt-1 transition-colors">
                        Unsync folder
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {(services.length > 0 || bookmarkItems.length > 0) && !showAddForm && (
                <div className="px-4 py-3 border-t border-gray-200/50 dark:border-white/[0.06] flex gap-2">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add
                  </button>
                  {!syncedFolder && (
                    <button
                      onClick={openFolderPicker}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                      </svg>
                      Sync
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function FolderList({
  folders,
  onSelect,
  depth,
}: {
  folders: BookmarkFolder[];
  onSelect: (folder: BookmarkFolder) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className={depth > 0 ? "ml-4 border-l border-gray-200/30 dark:border-white/[0.04]" : ""}>
      {folders.map((folder) => {
        const hasChildren = folder.children && folder.children.length > 0;
        const isExpanded = expanded.has(folder.id);

        return (
          <div key={folder.id}>
            <div className="flex items-center gap-1 group">
              {hasChildren ? (
                <button
                  onClick={() => toggle(folder.id)}
                  className="p-1 rounded-md hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-all"
                >
                  <svg
                    className={`w-3 h-3 text-gray-400 dark:text-white/30 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ) : (
                <div className="w-5" />
              )}
              <button
                onClick={() => onSelect(folder)}
                className="flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left text-[13px] text-gray-600 dark:text-white/60 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] hover:text-gray-800 dark:hover:text-white/80 transition-all"
              >
                <svg className="w-4 h-4 text-amber-400 dark:text-amber-400/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                {folder.title}
              </button>
            </div>
            {hasChildren && isExpanded && (
              <FolderList folders={folder.children!} onSelect={onSelect} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}
