export interface BookmarkSyncScope {
  includedFolderIds: string[];
  excludedBookmarkIds: string[];
}

export interface BookmarkLeaf {
  id: string;
  title: string;
  url: string;
  folderPath?: string;
}

export interface BookmarkFolderCollection {
  id: string;
  title: string;
  bookmarks: BookmarkLeaf[];
}

export const BOOKMARKS_SYNC_SCOPE_KEY = "dashboard-bookmarks-sync-v1";
export const BOOKMARKS_SYNC_UPDATED_EVENT = "dashboard:bookmarks-sync-updated";
const MAX_CHROME_BOOKMARKS = 48;

const DEFAULT_SCOPE: BookmarkSyncScope = {
  includedFolderIds: [],
  excludedBookmarkIds: [],
};

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isFolderNode(node: chrome.bookmarks.BookmarkTreeNode): boolean {
  return Array.isArray(node.children);
}

function isBookmarkNode(node: chrome.bookmarks.BookmarkTreeNode): boolean {
  return typeof node.url === "string" && node.url.trim().length > 0;
}

const isBookmarkSeparator = (node: chrome.bookmarks.BookmarkTreeNode) =>
  (node as chrome.bookmarks.BookmarkTreeNode & { type?: string }).type === "separator";

export function sanitizeBookmarkSyncScope(value: unknown): BookmarkSyncScope {
  if (!value || typeof value !== "object") return { ...DEFAULT_SCOPE };
  const source = value as Record<string, unknown>;
  const includedFolderIds = Array.isArray(source.includedFolderIds)
    ? source.includedFolderIds.filter((item): item is string => typeof item === "string")
    : [];
  const excludedBookmarkIds = Array.isArray(source.excludedBookmarkIds)
    ? source.excludedBookmarkIds.filter((item): item is string => typeof item === "string")
    : [];
  return { includedFolderIds, excludedBookmarkIds };
}

export function loadBookmarkSyncScope(): BookmarkSyncScope | null {
  const parsed = parseJson(localStorage.getItem(BOOKMARKS_SYNC_SCOPE_KEY));
  if (!parsed) return null;
  return sanitizeBookmarkSyncScope(parsed);
}

export function saveBookmarkSyncScope(scope: BookmarkSyncScope): BookmarkSyncScope {
  const sanitized = sanitizeBookmarkSyncScope(scope);
  localStorage.setItem(BOOKMARKS_SYNC_SCOPE_KEY, JSON.stringify(sanitized));
  window.dispatchEvent(
    new CustomEvent<BookmarkSyncScope>(BOOKMARKS_SYNC_UPDATED_EVENT, {
      detail: sanitized,
    })
  );
  return sanitized;
}

export function clearBookmarkSyncScope(): void {
  localStorage.removeItem(BOOKMARKS_SYNC_SCOPE_KEY);
  window.dispatchEvent(
    new CustomEvent<BookmarkSyncScope>(BOOKMARKS_SYNC_UPDATED_EVENT, {
      detail: { ...DEFAULT_SCOPE },
    })
  );
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

function findNodeById(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  id: string
): chrome.bookmarks.BookmarkTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (!node.children?.length) continue;
    const childHit = findNodeById(node.children, id);
    if (childHit) return childHit;
  }
  return null;
}

function collectBookmarksFromFolder(
  folder: chrome.bookmarks.BookmarkTreeNode,
  path: string[],
  excludedBookmarkIds: Set<string>
): BookmarkLeaf[] {
  const items: BookmarkLeaf[] = [];
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], currentPath: string[]) => {
    for (const node of nodes) {
      if (isBookmarkSeparator(node)) continue;
      if (isBookmarkNode(node)) {
        if (excludedBookmarkIds.has(node.id)) continue;
        if (items.length >= MAX_CHROME_BOOKMARKS) break;
        const folderPath = currentPath.filter(Boolean).join(" / ");
        items.push({
          id: node.id,
          title: node.title,
          url: node.url!,
          ...(folderPath ? { folderPath } : {}),
        });
        continue;
      }
      if (isFolderNode(node) && node.children?.length) {
        const segment = node.title?.trim() || "Folder";
        walk(node.children, [...currentPath, segment]);
      }
    }
  };

  if (folder.children?.length) {
    walk(folder.children, path);
  }
  return items;
}

export function collectBookmarksForScope(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  scope: BookmarkSyncScope | null
): { folders: BookmarkFolderCollection[]; looseBookmarks: BookmarkLeaf[] } {
  const includedFolderIds = scope?.includedFolderIds ?? [];
  const excludedBookmarkIds = new Set(scope?.excludedBookmarkIds ?? []);

  const folders: BookmarkFolderCollection[] = [];
  const looseBookmarks: BookmarkLeaf[] = [];

  const pushLooseFromBar = (barNode: chrome.bookmarks.BookmarkTreeNode) => {
    for (const node of barNode.children ?? []) {
      if (isBookmarkSeparator(node)) continue;
      if (!isBookmarkNode(node)) continue;
      if (excludedBookmarkIds.has(node.id)) continue;
      if (looseBookmarks.length >= MAX_CHROME_BOOKMARKS) break;
      looseBookmarks.push({ id: node.id, title: node.title, url: node.url! });
    }
  };

  const rootNodes = tree[0]?.children ?? [];
  if (includedFolderIds.length === 0) {
    const bar = resolveBookmarkBarNode(tree);
    if (!bar?.children?.length) {
      return { folders: [], looseBookmarks: [] };
    }
    pushLooseFromBar(bar);
    for (const node of bar.children) {
      if (isBookmarkSeparator(node) || !isFolderNode(node) || !node.children) continue;
      const folderTitle = node.title?.trim() || "Folder";
      folders.push({
        id: node.id,
        title: folderTitle,
        bookmarks: collectBookmarksFromFolder(node, [folderTitle], excludedBookmarkIds),
      });
    }
    return { folders, looseBookmarks };
  }

  const seenFolderIds = new Set<string>();
  for (const folderId of includedFolderIds) {
    const folder = findNodeById(rootNodes, folderId);
    if (!folder || !isFolderNode(folder) || !folder.children?.length || seenFolderIds.has(folder.id)) continue;
    seenFolderIds.add(folder.id);
    const folderTitle = folder.title?.trim() || "Folder";
    folders.push({
      id: folder.id,
      title: folderTitle,
      bookmarks: collectBookmarksFromFolder(folder, [folderTitle], excludedBookmarkIds),
    });
  }

  return { folders, looseBookmarks };
}

export interface BookmarkTreeFolderNode {
  id: string;
  title: string;
  children: BookmarkTreeFolderNode[];
}

export interface BookmarkTreeFolderLeaf {
  id: string;
  title: string;
  url: string;
}

export function buildFolderTree(
  tree: chrome.bookmarks.BookmarkTreeNode[]
): BookmarkTreeFolderNode[] {
  const root = tree[0];
  if (!root?.children) return [];

  const mapFolder = (node: chrome.bookmarks.BookmarkTreeNode): BookmarkTreeFolderNode | null => {
    if (!isFolderNode(node) || isBookmarkSeparator(node)) return null;
    const children = (node.children ?? [])
      .map(mapFolder)
      .filter((child): child is BookmarkTreeFolderNode => child !== null);
    return {
      id: node.id,
      title: node.title?.trim() || "Folder",
      children,
    };
  };

  return root.children
    .map(mapFolder)
    .filter((child): child is BookmarkTreeFolderNode => child !== null);
}

export function collectBookmarkLeaves(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  folderId: string
): BookmarkTreeFolderLeaf[] {
  const rootNodes = tree[0]?.children ?? [];
  const folder = findNodeById(rootNodes, folderId);
  if (!folder?.children?.length) return [];
  const leaves: BookmarkTreeFolderLeaf[] = [];
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
    for (const node of nodes) {
      if (isBookmarkSeparator(node)) continue;
      if (isBookmarkNode(node)) {
        leaves.push({
          id: node.id,
          title: node.title || node.url!,
          url: node.url!,
        });
        continue;
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(folder.children);
  return leaves;
}

export function pruneOrphanExclusions(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  scope: BookmarkSyncScope
): BookmarkSyncScope {
  const availableFolders = new Set(scope.includedFolderIds);
  const validExclusions = new Set<string>();
  for (const folderId of availableFolders) {
    const leaves = collectBookmarkLeaves(tree, folderId);
    for (const leaf of leaves) validExclusions.add(leaf.id);
  }
  return {
    includedFolderIds: [...availableFolders],
    excludedBookmarkIds: scope.excludedBookmarkIds.filter((id) => validExclusions.has(id)),
  };
}
