import { useMemo } from "react";
import type { ReactNode } from "react";
import Greeting from "./Greeting";
import SearchBar from "./SearchBar";
import BookmarksGrid from "./BookmarksGrid";
import QuotesWidget from "./QuotesWidget";
import TasksWidget from "./TasksWidget";
import CalendarWidget from "./CalendarWidget";
import WeatherWidget from "./WeatherWidget";
import HomelabWidget from "./HomelabSidebar";
import type { TileItem, WidgetConstraintsMap, WidgetType } from "../layout/types";

export interface WidgetDefinition {
  label: string;
  defaultColSpan: number;
  defaultRowSpan: number;
  minColSpan: number;
  maxColSpan: number;
  minRowSpan: number;
  maxRowSpan: number;
  render: (tile: Pick<TileItem, "id" | "type" | "colSpan" | "rowSpan" | "settings">) => ReactNode;
}

export const widgetDefinitions: Record<WidgetType, WidgetDefinition> = {
  greeting: {
    label: "Greeting + Clock",
    defaultColSpan: 12,
    defaultRowSpan: 2,
    minColSpan: 6,
    maxColSpan: 12,
    minRowSpan: 2,
    maxRowSpan: 4,
    render: () => (
      <div className="h-full flex items-center justify-center px-2">
        <Greeting />
      </div>
    ),
  },
  search: {
    label: "Search Bar",
    defaultColSpan: 12,
    defaultRowSpan: 1,
    minColSpan: 4,
    maxColSpan: 12,
    minRowSpan: 1,
    maxRowSpan: 2,
    render: (tile) => (
      <div className="h-full flex items-center justify-center px-2">
        <SearchBar sourceId={tile.settings?.searchSourceId ?? tile.settings?.searchProvider ?? "chatgpt"} />
      </div>
    ),
  },
  bookmarks: {
    label: "Bookmarks",
    defaultColSpan: 12,
    defaultRowSpan: 2,
    minColSpan: 4,
    maxColSpan: 12,
    minRowSpan: 1,
    maxRowSpan: 5,
    render: () => <BookmarksGrid />,
  },
  quotes: {
    label: "Quotes / News",
    defaultColSpan: 12,
    defaultRowSpan: 2,
    minColSpan: 3,
    maxColSpan: 12,
    minRowSpan: 2,
    maxRowSpan: 5,
    render: () => <QuotesWidget />,
  },
  tasks: {
    label: "Tasks",
    defaultColSpan: 6,
    defaultRowSpan: 3,
    minColSpan: 3,
    maxColSpan: 12,
    minRowSpan: 2,
    maxRowSpan: 5,
    render: () => <TasksWidget />,
  },
  calendar: {
    label: "Calendar",
    defaultColSpan: 6,
    defaultRowSpan: 3,
    minColSpan: 3,
    maxColSpan: 12,
    minRowSpan: 2,
    maxRowSpan: 5,
    render: (tile) => <CalendarWidget rowSpan={tile.rowSpan} colSpan={tile.colSpan} />,
  },
  weather: {
    label: "Weather",
    defaultColSpan: 4,
    defaultRowSpan: 1,
    minColSpan: 2,
    maxColSpan: 12,
    minRowSpan: 1,
    maxRowSpan: 5,
    render: (tile) => (
      <div className="h-full w-full flex items-stretch">
        <WeatherWidget tileId={tile.id} rowSpan={tile.rowSpan} colSpan={tile.colSpan} />
      </div>
    ),
  },
  homelab: {
    label: "Homelab Services",
    defaultColSpan: 4,
    defaultRowSpan: 4,
    minColSpan: 3,
    maxColSpan: 12,
    minRowSpan: 2,
    maxRowSpan: 5,
    render: () => <HomelabWidget />,
  },
};

function buildWidgetConstraints(): WidgetConstraintsMap {
  const map = {} as WidgetConstraintsMap;
  (Object.keys(widgetDefinitions) as WidgetType[]).forEach((key) => {
    const def = widgetDefinitions[key];
    map[key] = {
      minColSpan: def.minColSpan,
      maxColSpan: def.maxColSpan,
      minRowSpan: def.minRowSpan,
      maxRowSpan: def.maxRowSpan,
      defaultColSpan: def.defaultColSpan,
      defaultRowSpan: def.defaultRowSpan,
    };
  });
  return map;
}

export const widgetConstraints = buildWidgetConstraints();
export const selectableWidgetTypes = Object.keys(widgetDefinitions) as WidgetType[];

export function renderWidgetIcon(type: WidgetType): ReactNode {
  if (type === "greeting") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>;
  if (type === "search") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 21l-4.3-4.3m1.3-4.7a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>;
  if (type === "bookmarks") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" /></svg>;
  if (type === "quotes") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 8h6M7 12h10M7 16h5M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>;
  if (type === "tasks") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01" /></svg>;
  if (type === "calendar") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 3v3m8-3v3M4 9h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  if (type === "weather") return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 15a4 4 0 014-4 5 5 0 019.6-1.5A3.5 3.5 0 0117.5 17H6a3 3 0 01-3-2z" /></svg>;
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" /></svg>;
}

export function TileContent({ tile }: { tile: Pick<TileItem, "id" | "type" | "colSpan" | "rowSpan" | "settings"> }) {
  const rendered = useMemo(
    () => widgetDefinitions[tile.type].render({ id: tile.id, type: tile.type, colSpan: tile.colSpan, rowSpan: tile.rowSpan, settings: tile.settings }),
    [tile.id, tile.colSpan, tile.rowSpan, tile.settings, tile.type]
  );
  return <div className="h-full min-h-0 [&>.widget-card]:h-full [&>.widget-card]:min-h-0">{rendered}</div>;
}
