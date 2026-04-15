import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import BookmarkCard from "./BookmarkCard";
import { LAYOUT_CONFIG_V2_KEY } from "../layout/constants";

const MAX_CHROME_BOOKMARKS = 48;
const PRELOAD_FOLDER_LINK_LIMIT = 8;
const PRELOAD_FOLDER_HOST_LIMIT = 6;

interface Bookmark {
  id: string;
  title: string;
  url: string;
  /** Path from root (e.g. "Bookmarks bar / Work") when pulled from Chrome */
  folderPath?: string;
}

interface BookmarkFolder {
  id: string;
  title: string;
  bookmarks: Bookmark[];
}

interface BarData {
  folders: BookmarkFolder[];
  looseBookmarks: Bookmark[];
}

const isBookmarkSeparator = (node: chrome.bookmarks.BookmarkTreeNode) =>
  (node as chrome.bookmarks.BookmarkTreeNode & { type?: string }).type === "separator";

/** Depth-first collection matching nested folders; skips separators and empty URLs. */
function collectBookmarksFromFolderNode(
  folder: chrome.bookmarks.BookmarkTreeNode,
  path: string[]
): Bookmark[] {
  const items: Bookmark[] = [];
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[]) => {
    for (const node of nodes) {
      if (isBookmarkSeparator(node)) continue;

      if (node.url?.trim()) {
        if (items.length < MAX_CHROME_BOOKMARKS) {
          const folderPath = path.filter(Boolean).join(" / ");
          items.push({
            id: node.id,
            title: node.title,
            url: node.url,
            ...(folderPath ? { folderPath } : {}),
          });
        }
        continue;
      }

      if (node.children?.length) {
        const segment = node.title?.trim() || "Folder";
        walk(node.children, [...path, segment]);
      }
    }
  };

  if (!folder.children?.length) return items;
  walk(folder.children, path);
  return items;
}

function resolveBookmarkBarNode(tree: chrome.bookmarks.BookmarkTreeNode[]) {
  const root = tree[0];
  if (!root?.children?.length) return null;

  const byId = root.children.find((node) => node.id === "1");
  if (byId?.children) return byId;

  const byTitle = root.children.find((node) =>
    (node.title || "").toLowerCase().includes("bookmark") &&
    (node.title || "").toLowerCase().includes("bar")
  );
  if (byTitle?.children) return byTitle;

  return root.children.find((node) => node.children?.length) ?? null;
}

function collectBarData(tree: chrome.bookmarks.BookmarkTreeNode[]): BarData {
  const bar = resolveBookmarkBarNode(tree);
  if (!bar?.children?.length) return { folders: [], looseBookmarks: [] };

  const folders: BookmarkFolder[] = [];
  const looseBookmarks: Bookmark[] = [];

  for (const node of bar.children) {
    if (isBookmarkSeparator(node)) continue;

    if (node.url?.trim()) {
      looseBookmarks.push({ id: node.id, title: node.title || "", url: node.url });
      continue;
    }

    if (!node.children) continue;

    const folderTitle = node.title?.trim() || "Folder";
    folders.push({
      id: node.id,
      title: folderTitle,
      bookmarks: collectBookmarksFromFolderNode(node, [folderTitle]),
    });
  }

  return { folders, looseBookmarks };
}

const STORAGE_KEY = "dashboard-custom-bookmarks";
const ORDER_KEY = "dashboard-bookmark-order";

function detectAnimationsEnabled(): boolean {
  try {
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return false;

    const raw = localStorage.getItem(LAYOUT_CONFIG_V2_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { reactive?: { animationStyle?: string } } | null;
    const style = parsed?.reactive?.animationStyle;
    return style !== "none";
  } catch {
    return true;
  }
}

function loadCustomBookmarks(): Bookmark[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCustomBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

function loadBookmarkOrder(): string[] {
  try {
    const data = localStorage.getItem(ORDER_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveBookmarkOrder(ids: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

function applyOrder(bookmarks: Bookmark[], order: string[]): Bookmark[] {
  if (order.length === 0) return bookmarks;
  const map = new Map(bookmarks.map((b) => [b.id, b]));
  const ordered: Bookmark[] = [];
  for (const id of order) {
    if (map.has(id)) {
      ordered.push(map.get(id)!);
      map.delete(id);
    }
  }
  for (const b of map.values()) ordered.push(b);
  return ordered;
}

interface BookmarksGridProps {
  filter?: string;
  isSidebar?: boolean;
}

export default function BookmarksGrid({ filter = "", isSidebar = false }: BookmarksGridProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [chromeFolders, setChromeFolders] = useState<BookmarkFolder[]>([]);
  const [chromeLoose, setChromeLoose] = useState<Bookmark[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeFolderRect, setActiveFolderRect] = useState<DOMRect | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [source, setSource] = useState<"chrome" | "custom">("custom");

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(6);
  const [animationsEnabled, setAnimationsEnabled] = useState(detectAnimationsEnabled);
  const preloadedUrlsRef = useRef(new Set<string>());
  const preconnectedHostsRef = useRef(new Set<string>());
  const activeFolderPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    const updateAnimations = () => {
      setAnimationsEnabled(detectAnimationsEnabled());
    };

    updateAnimations();
    mediaQuery?.addEventListener("change", updateAnimations);
    window.addEventListener("storage", updateAnimations);
    return () => {
      mediaQuery?.removeEventListener("change", updateAnimations);
      window.removeEventListener("storage", updateAnimations);
    };
  }, []);

  useEffect(() => {
    const order = loadBookmarkOrder();
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.getTree((tree) => {
        const { folders, looseBookmarks } = collectBarData(tree);
        if (folders.length > 0 || looseBookmarks.length > 0) {
          setChromeFolders(folders);
          setChromeLoose(looseBookmarks);
          setSource("chrome");
          return;
        }
        setBookmarks(applyOrder(loadCustomBookmarks(), order));
        setSource("custom");
      });
    } else {
      setBookmarks(applyOrder(loadCustomBookmarks(), order));
      setSource("custom");
    }
  }, []);

  const normalizedFilter = filter.trim().toLowerCase();

  const matchesFilter = (bookmark: Bookmark) => {
    if (!normalizedFilter) return true;
    return (
      bookmark.title.toLowerCase().includes(normalizedFilter) ||
      bookmark.url.toLowerCase().includes(normalizedFilter) ||
      (bookmark.folderPath ?? "").toLowerCase().includes(normalizedFilter)
    );
  };

  const visibleChromeLoose = chromeLoose.filter(matchesFilter);
  const visibleChromeFolders = chromeFolders
    .map((folder) => {
      const filteredBookmarks = folder.bookmarks.filter(matchesFilter);
      const folderTitleMatch = folder.title.toLowerCase().includes(normalizedFilter);
      return {
        ...folder,
        bookmarks: normalizedFilter && !folderTitleMatch ? filteredBookmarks : folder.bookmarks,
        filteredCount: filteredBookmarks.length,
      };
    })
    .filter((folder) => {
      if (!normalizedFilter) return true;
      return folder.title.toLowerCase().includes(normalizedFilter) || folder.filteredCount > 0;
    });

  const visibleBookmarks = bookmarks.filter(matchesFilter);

  const activeFolder =
    source === "chrome" ? chromeFolders.find((folder) => folder.id === activeFolderId) : null;
  const activeFolderVisibleBookmarks = activeFolder?.bookmarks.filter(matchesFilter) ?? [];

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateColumns = (width: number) => {
      const minCardWidth = 130;
      const gap = 12;
      const cols = Math.max(1, Math.min(8, Math.floor((width + gap) / (minCardWidth + gap))));
      setColumnCount(cols);
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateColumns(entry.contentRect.width);
    });

    observer.observe(node);
    updateColumns(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  const handleReorder = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      setHoverIndex(null);
      return;
    }
    const updated = [...bookmarks];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(toIndex, 0, moved);
    setBookmarks(updated);
    saveBookmarkOrder(updated.map((b) => b.id));
    if (source === "custom") saveCustomBookmarks(updated);
    setDragIndex(null);
    setHoverIndex(null);
  };

  const handleAdd = () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    let url = newUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const bm: Bookmark = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      url,
    };

    if (source === "chrome" && chrome.bookmarks) {
      chrome.bookmarks.create({ title: bm.title, url: bm.url }, (created) => {
        setBookmarks((prev) => [...prev, { id: created.id, title: created.title, url: created.url! }]);
      });
    } else {
      const updated = [...bookmarks, bm];
      setBookmarks(updated);
      saveCustomBookmarks(updated);
    }
    setNewTitle("");
    setNewUrl("");
    setShowAdd(false);
  };

  const handleEdit = (id: string, title: string, url: string) => {
    if (source === "chrome" && chrome.bookmarks) {
      chrome.bookmarks.update(id, { title, url }, () => {
        setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, title, url } : b)));
      });
    } else {
      const updated = bookmarks.map((b) => (b.id === id ? { ...b, title, url } : b));
      setBookmarks(updated);
      saveCustomBookmarks(updated);
    }
  };

  const handleDelete = (id: string) => {
    if (source === "chrome" && chrome.bookmarks) {
      chrome.bookmarks.remove(id, () => {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      });
    } else {
      const updated = bookmarks.filter((b) => b.id !== id);
      setBookmarks(updated);
      saveCustomBookmarks(updated);
    }
  };

  const preloadFolderLinks = (folder: BookmarkFolder) => {
    if (typeof document === "undefined") return;

    const eligibleUrls = folder.bookmarks
      .map((bookmark) => {
        try {
          const parsed = new URL(bookmark.url);
          if (!/^https?:$/i.test(parsed.protocol)) return null;
          return parsed.href;
        } catch {
          return null;
        }
      })
      .filter((url): url is string => Boolean(url))
      .slice(0, PRELOAD_FOLDER_LINK_LIMIT);

    for (const url of eligibleUrls) {
      if (preloadedUrlsRef.current.has(url)) continue;
      preloadedUrlsRef.current.add(url);

      const prefetchTag = document.createElement("link");
      prefetchTag.rel = "prefetch";
      prefetchTag.as = "document";
      prefetchTag.href = url;
      document.head.appendChild(prefetchTag);
    }

    const hosts = eligibleUrls
      .map((url) => {
        try {
          return new URL(url).origin;
        } catch {
          return null;
        }
      })
      .filter((origin): origin is string => Boolean(origin))
      .slice(0, PRELOAD_FOLDER_HOST_LIMIT);

    for (const origin of hosts) {
      if (preconnectedHostsRef.current.has(origin)) continue;
      preconnectedHostsRef.current.add(origin);

      const dnsTag = document.createElement("link");
      dnsTag.rel = "dns-prefetch";
      dnsTag.href = origin;
      document.head.appendChild(dnsTag);

      const preconnectTag = document.createElement("link");
      preconnectTag.rel = "preconnect";
      preconnectTag.href = origin;
      preconnectTag.crossOrigin = "anonymous";
      document.head.appendChild(preconnectTag);
    }
  };

  useEffect(() => {
    if (!activeFolder) return;
    preloadFolderLinks(activeFolder);
  }, [activeFolder]);

  useEffect(() => {
    if (!activeFolder) return;
    const focusTimer = window.setTimeout(() => {
      const firstLink = activeFolderPanelRef.current?.querySelector<HTMLAnchorElement>("a[href]");
      firstLink?.focus();
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, [activeFolder?.id, activeFolderVisibleBookmarks.length]);

  useEffect(() => {
    if (!activeFolder) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveFolderId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeFolder]);

  if (source === "chrome") {
    return (
      <>
        <div ref={containerRef} className="relative h-full min-h-0 overflow-y-auto pr-1">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {visibleChromeLoose.map((bm, idx) => (
              <div
                key={bm.id}
                className={animationsEnabled ? "bookmark-item-enter" : ""}
                style={animationsEnabled && !isSidebar ? { animationDelay: `${Math.min(idx, 12) * 35}ms` } : undefined}
              >
                <BookmarkCard
                  title={bm.title}
                  url={bm.url}
                  showActions={false}
                />
              </div>
            ))}

            {visibleChromeFolders.map((folder, idx) => (
              <button
                key={folder.id}
                type="button"
                onMouseEnter={() => preloadFolderLinks(folder)}
                onFocus={() => preloadFolderLinks(folder)}
              onClick={() => {
                preloadFolderLinks(folder);
                setActiveFolderRect(containerRef.current?.getBoundingClientRect() ?? null);
                setActiveFolderId(folder.id);
              }}
                className={`widget-card text-left p-4 min-h-[90px] hover:scale-[1.02] transition-all duration-200 ${animationsEnabled ? "bookmark-item-enter bookmark-folder-card" : ""}`}
                style={animationsEnabled && !isSidebar ? { animationDelay: `${Math.min(idx + visibleChromeLoose.length, 12) * 35}ms` } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black/[0.06] dark:bg-white/[0.08] text-gray-600/80 dark:text-white/65">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2H3V6zm0 5h18v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z" />
                    </svg>
                  </span>
                  <span className="text-[11px] text-gray-400/80 dark:text-white/35 whitespace-nowrap">
                    {normalizedFilter ? folder.filteredCount : folder.bookmarks.length} links
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-[13px] font-medium text-gray-700/90 dark:text-white/70 truncate">
                    {folder.title}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {visibleChromeFolders.length === 0 && visibleChromeLoose.length === 0 ? (
            <div className="mt-3 text-[13px] text-gray-500/80 dark:text-white/45">
              No bookmark matches found.
            </div>
          ) : null}
        </div>
        {activeFolder && activeFolderRect && typeof document !== "undefined"
          ? createPortal(
              <>
                {/* invisible backdrop — closes on click, no dim so context stays visible */}
                <button
                  type="button"
                  aria-label="Close folder view"
                  className="fixed inset-0 z-[139]"
                  style={{ background: "transparent" }}
                  onClick={() => setActiveFolderId(null)}
                />
                <div
                  ref={activeFolderPanelRef}
                  className={`fixed z-[140] rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white/95 dark:bg-[#101215]/95 backdrop-blur-xl p-3 shadow-2xl ${
                    animationsEnabled ? "bookmark-folder-overlay" : ""
                  }`}
                  style={{
                    left: activeFolderRect.left,
                    top: activeFolderRect.top,
                    width: activeFolderRect.width,
                    maxHeight: `calc(100vh - ${activeFolderRect.top}px - 16px)`,
                    overflowY: "auto",
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-[12px] uppercase tracking-wide text-gray-400/80 dark:text-white/35">
                        Bookmark folder
                      </p>
                      <h3 className="text-sm font-semibold text-gray-700/90 dark:text-white/75 truncate">
                        {activeFolder.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(null)}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      Close
                    </button>
                  </div>
                  {activeFolderVisibleBookmarks.length > 0 ? (
                    <div
                      className="grid gap-3 pr-1"
                      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                    >
                      {activeFolderVisibleBookmarks.map((bookmark, idx) => (
                        <div
                          key={bookmark.id}
                          className={animationsEnabled ? "bookmark-item-enter" : ""}
                          style={animationsEnabled && !isSidebar ? { animationDelay: `${Math.min(idx, 12) * 28}ms` } : undefined}
                        >
                          <BookmarkCard
                            title={bookmark.title}
                            url={bookmark.url}
                            folderPath={bookmark.folderPath}
                            showActions={false}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[13px] text-gray-500/80 dark:text-white/45">
                      No bookmark matches in this folder.
                    </div>
                  )}
                </div>
              </>,
              document.body
            )
          : null}
      </>
    );
  }

  return (
    <div ref={containerRef} className="h-full min-h-0 overflow-y-auto pr-1">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {visibleBookmarks.map((bm, i) => (
          <div
            key={bm.id}
            draggable={!normalizedFilter}
            className={animationsEnabled ? "bookmark-item-enter bookmark-custom-item" : ""}
            style={animationsEnabled && !isSidebar ? { animationDelay: `${Math.min(i, 14) * 30}ms` } : undefined}
            onDragStart={(e) => {
              if (normalizedFilter) return;
              setDragIndex(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (normalizedFilter) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (hoverIndex !== i) setHoverIndex(i);
            }}
            onDrop={(e) => {
              if (normalizedFilter) return;
              e.preventDefault();
              handleReorder(i);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setHoverIndex(null);
            }}
          >
            <BookmarkCard
              id={bm.id}
              title={bm.title}
              url={bm.url}
              folderPath={bm.folderPath}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDragging={dragIndex === i}
              isDragOver={hoverIndex === i && dragIndex !== i}
            />
          </div>
        ))}

        {showAdd ? (
          <div className={`widget-card flex flex-col gap-2 p-4 ${animationsEnabled ? "bookmark-item-enter" : ""}`}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              className="input-field text-sm"
              autoFocus
            />
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="URL"
              className="input-field text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="btn-primary text-xs flex-1">Add</button>
              <button onClick={() => setShowAdd(false)} className="btn-ghost text-xs flex-1">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className={`rounded-2xl flex flex-col items-center justify-center gap-2 min-h-[120px]
                       hover:scale-[1.02] cursor-pointer transition-all duration-300
                       border border-dashed border-black/[0.08] dark:border-white/[0.08] ${animationsEnabled ? "bookmark-item-enter bookmark-add-card" : ""}`}
            style={{ background: "rgba(0,0,0,0.02)" }}
          >
            <svg className="w-7 h-7 text-gray-400/40 dark:text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[13px] text-gray-400/50 dark:text-white/20 font-medium">Add bookmark</span>
          </button>
        )}
      </div>
      {normalizedFilter && visibleBookmarks.length === 0 ? (
        <div className="mt-3 text-[13px] text-gray-500/80 dark:text-white/45 text-center">
          No bookmark matches found.
        </div>
      ) : null}
    </div>
  );
}
