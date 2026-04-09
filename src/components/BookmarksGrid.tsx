import { useState, useEffect, useRef } from "react";
import BookmarkCard from "./BookmarkCard";

const MAX_CHROME_BOOKMARKS = 48;

interface Bookmark {
  id: string;
  title: string;
  url: string;
  /** Path from root (e.g. "Bookmarks bar / Work") when pulled from Chrome */
  folderPath?: string;
}

const isBookmarkSeparator = (node: chrome.bookmarks.BookmarkTreeNode) =>
  (node as chrome.bookmarks.BookmarkTreeNode & { type?: string }).type === "separator";

/** Depth-first collection matching nested folders; skips separators and empty URLs. */
function collectBookmarksFromChromeTree(
  tree: chrome.bookmarks.BookmarkTreeNode[]
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

  const root = tree[0];
  if (!root?.children?.length) return items;

  for (const top of root.children) {
    if (!top.children?.length) continue;
    const topName = top.title?.trim() || "Bookmarks";
    walk(top.children, [topName]);
  }

  return items;
}

const STORAGE_KEY = "dashboard-custom-bookmarks";
const ORDER_KEY = "dashboard-bookmark-order";

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

export default function BookmarksGrid() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [source, setSource] = useState<"chrome" | "custom">("custom");

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(6);

  useEffect(() => {
    const order = loadBookmarkOrder();
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.getTree((tree) => {
        const items = collectBookmarksFromChromeTree(tree);
        if (items.length > 0) {
          setBookmarks(applyOrder(items, order));
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

  return (
    <div ref={containerRef} className="h-full min-h-0 overflow-y-auto pr-1">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {bookmarks.map((bm, i) => (
          <div
            key={bm.id}
            draggable
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (hoverIndex !== i) setHoverIndex(i);
            }}
            onDrop={(e) => {
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
          <div className="widget-card flex flex-col gap-2 p-4">
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
            className="rounded-2xl flex flex-col items-center justify-center gap-2 min-h-[120px]
                       hover:scale-[1.02] cursor-pointer transition-all duration-300
                       border border-dashed border-black/[0.08] dark:border-white/[0.08]"
            style={{ background: "rgba(0,0,0,0.02)" }}
          >
            <svg className="w-7 h-7 text-gray-400/40 dark:text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[13px] text-gray-400/50 dark:text-white/20 font-medium">Add bookmark</span>
          </button>
        )}
      </div>
    </div>
  );
}
