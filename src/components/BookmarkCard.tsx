import { useState, useMemo, useEffect } from "react";

interface BookmarkCardProps {
  id?: string;
  title: string;
  url: string;
  /** Folder path from Chrome bookmarks tree (for context) */
  folderPath?: string;
  onEdit?: (id: string, title: string, url: string) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  showActions?: boolean;
}

/** Ordered candidates; Google often works, gstatic/ddg cover edge cases and CDNs. */
function getFaviconCandidates(url: string): string[] {
  try {
    const u = new URL(url);
    const protocol = u.protocol.toLowerCase();
    if (
      protocol === "chrome:" ||
      protocol === "chrome-extension:" ||
      protocol === "file:" ||
      protocol === "about:" ||
      protocol === "javascript:" ||
      protocol === "data:"
    ) {
      return [];
    }
    const host = u.hostname;
    if (!host) return [];
    const encodedPage = encodeURIComponent(url);
    return [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
      `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=${encodedPage}&size=64`,
      `https://icons.duckduckgo.com/ip3/${host}.ico`,
    ];
  } catch {
    return [];
  }
}

function getInitialLetter(title: string, url: string): string {
  const t = title?.trim();
  if (t) return t.charAt(0).toUpperCase();
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return (h.charAt(0) || "?").toUpperCase();
  } catch {
    return "?";
  }
}

function getDomainName(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export default function BookmarkCard({
  id,
  title,
  url,
  folderPath,
  onEdit,
  onDelete,
  isDragging,
  isDragOver,
  showActions = true,
}: BookmarkCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editUrl, setEditUrl] = useState(url);
  const faviconCandidates = useMemo(() => getFaviconCandidates(url), [url]);
  const [faviconFailIndex, setFaviconFailIndex] = useState(0);

  useEffect(() => {
    setFaviconFailIndex(0);
  }, [url]);

  const faviconSrc =
    faviconCandidates.length > 0 && faviconFailIndex < faviconCandidates.length
      ? faviconCandidates[faviconFailIndex]
      : null;

  const handleSave = () => {
    if (id && onEdit && editTitle.trim() && editUrl.trim()) {
      onEdit(id, editTitle.trim(), editUrl.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="widget-card flex flex-col gap-2 p-4">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Title"
          className="input-field text-sm"
          autoFocus
        />
        <input
          type="text"
          value={editUrl}
          onChange={(e) => setEditUrl(e.target.value)}
          placeholder="URL"
          className="input-field text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <div className="flex gap-2">
          <button onClick={handleSave} className="btn-primary text-xs flex-1">Save</button>
          <button onClick={() => setEditing(false)} className="btn-ghost text-xs flex-1">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative group"
      onMouseLeave={() => {
        if (showActions) setShowMenu(false);
      }}
      style={{
        opacity: isDragging ? 0.35 : 1,
        transition: "opacity 0.15s",
        outline: isDragOver ? "2px solid color-mix(in srgb, var(--theme-accent) 45%, transparent)" : "none",
        outlineOffset: "3px",
        borderRadius: "16px",
      }}
    >
      <a
        href={url}
        draggable={false}
        className={`widget-card flex flex-col items-center justify-center p-4 min-h-[90px] w-full
                   hover:scale-[1.02] cursor-pointer no-underline ${folderPath ? "gap-2" : "gap-3"}`}
      >
        {faviconSrc ? (
          <img
            src={faviconSrc}
            alt=""
            draggable={false}
            className="w-10 h-10 rounded-xl object-contain bg-white/5"
            onError={() => setFaviconFailIndex((i) => i + 1)}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[15px] font-semibold
                       theme-text-secondary"
            style={{ background: "color-mix(in srgb, var(--theme-surface-hover) 76%, transparent)" }}
            aria-hidden
          >
            {getInitialLetter(title, url)}
          </div>
        )}
        <span className="text-[13px] font-medium text-center truncate w-full theme-text-secondary">
          {title || getDomainName(url)}
        </span>
        {folderPath ? (
          <span
            className="text-[10px] theme-text-secondary text-center truncate w-full -mt-1 max-w-full"
            title={folderPath}
            style={{ opacity: 0.72 }}
          >
            {folderPath}
          </span>
        ) : null}
      </a>

      {showActions ? (
        <div
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100
                     w-6 h-6 rounded-full flex items-center justify-center
                     cursor-grab active:cursor-grabbing
                     transition-all duration-200"
          style={{
            color: "var(--theme-text-secondary)",
            background: "color-mix(in srgb, var(--theme-surface-hover) 72%, transparent)",
          }}
          title="Drag to reorder"
        >
          <svg className="w-3 h-3.5" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2"  r="1.2" />
            <circle cx="7" cy="2"  r="1.2" />
            <circle cx="3" cy="7"  r="1.2" />
            <circle cx="7" cy="7"  r="1.2" />
            <circle cx="3" cy="12" r="1.2" />
            <circle cx="7" cy="12" r="1.2" />
          </svg>
        </div>
      ) : null}

      {showActions ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                     w-6 h-6 rounded-full flex items-center justify-center
                     transition-all duration-200"
          style={{
            color: "var(--theme-text-secondary)",
            background: "color-mix(in srgb, var(--theme-surface-hover) 72%, transparent)",
          }}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      ) : null}

      {showActions && showMenu && (
        <div className="absolute top-8 right-2 z-20 glass py-1 min-w-[100px]"
             style={{ background: "color-mix(in srgb, var(--theme-surface) 90%, transparent)", backdropFilter: "blur(40px)" }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowMenu(false);
              setEditing(true);
            }}
            className="w-full px-3 py-1.5 text-left text-sm transition-colors"
            style={{ color: "var(--theme-text-secondary)" }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = "color-mix(in srgb, var(--theme-surface-hover) 78%, transparent)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
            }}
          >
            Edit
          </button>
          <div className="mx-2 border-t" style={{ borderColor: "color-mix(in srgb, var(--theme-border) 60%, transparent)" }} />
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowMenu(false);
              if (id && onDelete) onDelete(id);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-red-500/85 transition-colors"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = "color-mix(in srgb, var(--theme-surface-hover) 78%, transparent)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
