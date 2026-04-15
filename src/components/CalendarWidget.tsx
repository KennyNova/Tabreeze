import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type CalendarEvent,
  fetchGoogleCalendarEvents,
  isGoogleCalendarConnected,
  storeIcalUrl,
  clearIcalUrl,
  loadLocalEvents,
  localEventsToCalendarEvents,
  addLocalEvent,
  removeLocalEvent,
  type LocalEventData,
} from "../services/googleCalendar";

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  return event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTimeRange(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  return `${event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${event.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildMonthCells(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const cell = new Date(gridStart);
    cell.setDate(gridStart.getDate() + i);
    return cell;
  });
}

function relativeDay(date: Date): string {
  const now = new Date();
  const today = toDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = toDateKey(date);
  if (key === today) return "Today";
  if (key === toDateKey(tomorrow)) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const EVENT_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444"];
const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarWidgetProps {
  rowSpan?: number;
  colSpan?: number;
}

export default function CalendarWidget({ rowSpan = 3, colSpan = 6 }: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(isGoogleCalendarConnected);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [icalInput, setIcalInput] = useState("");
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newAllDay, setNewAllDay] = useState(false);
  const [newColor, setNewColor] = useState(EVENT_COLORS[0]);
  const [localEvents, setLocalEvents] = useState<LocalEventData[]>(loadLocalEvents);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // ─── Size modes ───────────────────────────────────────────────────────────
  const isCompact = rowSpan <= 2;
  const isTiny = isCompact && colSpan <= 3;
  const isNarrow = colSpan <= 4;
  const isWide = colSpan >= 8;
  const isTall = rowSpan >= 4;
  const showMiniCal = !isCompact && colSpan >= 5;
  const showFullCal = !isCompact && isWide;

  const maxVisibleEvents = isCompact
    ? (isTiny ? 2 : colSpan <= 5 ? 3 : 5)
    : isTall
      ? 12
      : 6;

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    const allEvents: CalendarEvent[] = [];

    if (googleConnected) {
      try {
        const gEvents = await fetchGoogleCalendarEvents();
        allEvents.push(...gEvents);
      } catch (err: any) {
        console.error("iCal fetch error:", err);
        setError("Could not load Google Calendar. Check your iCal URL.");
      }
    }

    allEvents.push(...localEventsToCalendarEvents(localEvents));
    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setEvents(allEvents.filter((e) => e.end >= now));
    setLoading(false);
  }, [googleConnected, localEvents]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const connectIcal = () => {
    const url = icalInput.trim();
    if (!url) return;
    storeIcalUrl(url);
    setGoogleConnected(true);
    setShowSetup(false);
    setIcalInput("");
  };

  const disconnect = () => {
    clearIcalUrl();
    setGoogleConnected(false);
    setEvents((prev) => prev.filter((e) => e.source !== "google"));
  };

  const handleAddEvent = () => {
    if (!newTitle.trim()) return;
    addLocalEvent({
      title: newTitle.trim(),
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      allDay: newAllDay,
      color: newColor,
    });
    setLocalEvents(loadLocalEvents());
    setNewTitle("");
    setShowAddEvent(false);
  };

  const handleRemoveLocal = (id: string) => {
    removeLocalEvent(id);
    setLocalEvents(loadLocalEvents());
  };

  // ─── Derived data ─────────────────────────────────────────────────────────

  const now = new Date();
  const todayKey = toDateKey(now);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = toDateKey(event.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const selectedDateEvents = eventsByDate.get(selectedDate) ?? [];
  const monthCells = useMemo(() => buildMonthCells(monthAnchor), [monthAnchor]);
  const monthLabel = monthAnchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const upcomingEvents = useMemo(() => {
    return events.filter((e) => e.end >= now).slice(0, maxVisibleEvents);
  }, [events, now, maxVisibleEvents]);

  const nextEvent = upcomingEvents[0] ?? null;

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderEventRow = (event: CalendarEvent, compact = false) => (
    <div
      key={`${event.source}-${event.id}`}
      className={`flex items-center gap-2 ${compact ? "px-1.5 py-1" : "px-2.5 py-2"} rounded-lg transition-colors duration-200 group`}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div
        className={`${compact ? "w-[2px] h-5" : "w-[3px] h-7"} rounded-full flex-shrink-0 opacity-60`}
        style={{ backgroundColor: event.color || "#6366F1" }}
      />
      <div className="flex-1 min-w-0">
        <div className={`${compact ? "text-[11px]" : "text-[13px]"} font-medium text-gray-700/80 dark:text-white/60 truncate`}>
          {event.title}
        </div>
        {!compact && (
          <div className="text-[10px] text-gray-400/50 dark:text-white/20 font-light">
            {formatEventTime(event)}
            <span className="ml-1 opacity-60">
              {event.source === "google" ? "Google" : "Local"}
            </span>
          </div>
        )}
      </div>
      {event.source === "local" && !compact && (
        <button onClick={() => handleRemoveLocal(event.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400/40 hover:text-red-400/70 transition-all shrink-0">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  const renderMiniCalendar = (compact = false) => {
    const names = compact ? DAY_NAMES : DAY_NAMES_LONG;
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <button type="button" onClick={() => setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-500/50 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-[10px] font-medium text-gray-600/70 dark:text-white/50">{monthLabel}</span>
          <button type="button" onClick={() => setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-500/50 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div className={`grid grid-cols-7 ${compact ? "gap-0" : "gap-0.5"}`}>
          {names.map((d, i) => (
            <div key={`hdr-${i}`} className={`text-center ${compact ? "text-[8px]" : "text-[9px]"} text-gray-400/50 dark:text-white/25 pb-0.5`}>{d}</div>
          ))}
          {monthCells.map((date) => {
            const key = toDateKey(date);
            const isCurrentMonth = date.getMonth() === monthAnchor.getMonth();
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            const hasEvents = (eventsByDate.get(key)?.length ?? 0) > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={`relative rounded ${compact ? "p-0.5" : "p-1"} text-center transition-all duration-150
                  ${isSelected ? "bg-blue-500/20 text-blue-700 dark:text-blue-200" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"}
                  ${isCurrentMonth ? "text-gray-700/75 dark:text-white/60" : "text-gray-400/40 dark:text-white/18"}`}
              >
                <span className={`${compact ? "text-[9px]" : "text-[10px]"} leading-none ${isToday ? "font-bold" : ""}`}>{date.getDate()}</span>
                {hasEvents && (
                  <span className={`absolute ${compact ? "bottom-0" : "bottom-0.5"} left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500/60`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNextEventBanner = () => {
    if (!nextEvent) return null;
    const isNow = nextEvent.start <= now && nextEvent.end > now;
    return (
      <div className="rounded-lg px-2.5 py-2 flex items-center gap-2.5"
        style={{
          background: isNow ? "rgba(99,102,241,0.08)" : "rgba(0,0,0,0.02)",
          border: isNow ? "1px solid rgba(99,102,241,0.15)" : "1px solid rgba(0,0,0,0.03)",
        }}>
        <div className="w-1 h-8 rounded-full" style={{ background: nextEvent.color || "#6366F1", opacity: 0.7 }} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-gray-500/60 dark:text-white/30">
            {isNow ? "Happening now" : "Up next"}
          </div>
          <div className="text-[13px] font-medium text-gray-700/85 dark:text-white/65 truncate">{nextEvent.title}</div>
          <div className="text-[10px] text-gray-400/55 dark:text-white/25">
            {formatTimeRange(nextEvent)}
          </div>
        </div>
      </div>
    );
  };

  const renderSetupAndAddForms = () => (
    <>
      {showSetup && (
        <div className="p-2.5 rounded-lg space-y-2"
             style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-gray-600/80 dark:text-white/50">Paste iCal URL</p>
            <button onClick={() => setShowTutorial(!showTutorial)}
              className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
              style={{ background: "rgba(66,133,244,0.08)", color: "rgba(66,133,244,0.8)" }}>
              {showTutorial ? "Hide" : "How?"}
            </button>
          </div>
          {showTutorial && (
            <div className="p-2 rounded text-[10px] leading-relaxed space-y-1"
                 style={{ background: "rgba(66,133,244,0.04)", border: "1px solid rgba(66,133,244,0.1)" }}>
              <ol className="list-decimal pl-3 space-y-0.5 text-gray-600/80 dark:text-white/50">
                <li>
                  Open{" "}
                  <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener noreferrer"
                    className="underline" style={{ color: "rgba(66,133,244,0.9)" }}>
                    Google Calendar Settings
                  </a>
                </li>
                <li>Click your calendar on the left</li>
                <li>Copy <strong>"Secret address in iCal format"</strong></li>
                <li>Paste below</li>
              </ol>
            </div>
          )}
          <div className="flex gap-1.5">
            <input type="text" value={icalInput} onChange={(e) => setIcalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connectIcal()}
              placeholder="https://calendar.google.com/..." className="input-field text-[10px]" />
            <button onClick={connectIcal} className="btn-primary text-[10px] whitespace-nowrap px-2">Go</button>
          </div>
          <button onClick={() => setShowSetup(false)} className="text-[9px] text-gray-400/50">Cancel</button>
        </div>
      )}

      {showAddEvent && (
        <div className="p-2.5 rounded-lg space-y-1.5"
             style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddEvent()}
            placeholder="Event title" className="input-field text-[10px]" />
          <div className="flex gap-1.5">
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input-field text-[10px]" />
            <label className="flex items-center gap-1 text-[10px] text-gray-500/60 dark:text-white/35 whitespace-nowrap">
              <input type="checkbox" checked={newAllDay} onChange={(e) => setNewAllDay(e.target.checked)} className="w-3 h-3" />
              All day
            </label>
          </div>
          {!newAllDay && (
            <div className="flex gap-1.5">
              <input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="input-field text-[10px]" />
              <input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} className="input-field text-[10px]" />
            </div>
          )}
          <div className="flex items-center gap-1">
            {EVENT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                className="w-3.5 h-3.5 rounded-full transition-transform"
                style={{
                  background: c,
                  transform: newColor === c ? "scale(1.3)" : "scale(1)",
                  boxShadow: newColor === c ? `0 0 0 2px ${c}40` : "none",
                }} />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button onClick={handleAddEvent} className="btn-primary text-[10px] px-2">Add</button>
            <button onClick={() => setShowAddEvent(false)} className="btn-ghost text-[10px]">Cancel</button>
          </div>
        </div>
      )}
    </>
  );

  const renderEmptyState = () => {
    if (googleConnected || localEvents.length > 0) {
      if (events.length === 0 && !loading) {
        return <div className="text-center text-gray-400/40 dark:text-white/15 text-[11px] py-3 font-light">No upcoming events</div>;
      }
      if (loading && events.length === 0) {
        return <div className="text-center text-gray-400/40 dark:text-white/15 text-[11px] py-3 font-light">Loading...</div>;
      }
      return null;
    }
    return (
      <div className="text-center text-gray-400/40 dark:text-white/15 text-[11px] py-3 font-light">
        Add events or connect Google Calendar
      </div>
    );
  };

  // ─── Header (shared across all sizes) ─────────────────────────────────────

  const renderHeader = () => (
    <div className={`flex items-center justify-between ${isCompact ? "mb-1.5" : "mb-3"}`}>
      <div className="flex items-center gap-2">
        <svg className={`${isTiny ? "w-3.5 h-3.5" : "w-[16px] h-[16px]"} text-gray-500/60 dark:text-white/30`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {!isTiny && <h2 className="font-medium text-[13px] text-gray-700/80 dark:text-white/60">Calendar</h2>}
      </div>
      <div className="flex items-center gap-1">
        {!isTiny && (
          <button onClick={() => setShowAddEvent(!showAddEvent)} className="btn-ghost text-[10px]" title="Add event">+</button>
        )}
        {!googleConnected && !showSetup && (
          <button onClick={() => setShowSetup(true)}
            className="text-[9px] px-1.5 py-0.5 rounded transition-colors text-gray-500/50 dark:text-white/25"
            style={{ background: "rgba(0,0,0,0.03)" }}>
            {isTiny ? "Link" : "Connect"}
          </button>
        )}
        {googleConnected && (
          <button onClick={disconnect} className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(66,133,244,0.7)" }} title="Google Calendar connected (click to disconnect)" />
        )}
        {(googleConnected || events.length > 0) && (
          <button onClick={fetchEvents} className="btn-ghost text-[10px]" disabled={loading}>
            {loading ? "…" : "↻"}
          </button>
        )}
      </div>
    </div>
  );

  // ─── LAYOUT: Tiny (≤3 cols, ≤2 rows) ────────────────────────────────────
  // Minimal: header + "up next" card + 2 event titles

  if (isTiny) {
    return (
      <div className="widget-card flex flex-col h-full min-h-0 p-2.5">
        {renderHeader()}
        {error && <div className="text-[9px] text-red-400/70 mb-1 truncate">{error}</div>}
        {renderSetupAndAddForms()}
        <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
          {nextEvent ? (
            <div className="rounded px-1.5 py-1.5" style={{ background: "rgba(0,0,0,0.02)" }}>
              <div className="text-[9px] text-gray-400/50 dark:text-white/20">{formatEventTime(nextEvent)}</div>
              <div className="text-[11px] font-medium text-gray-700/80 dark:text-white/60 truncate">{nextEvent.title}</div>
            </div>
          ) : renderEmptyState()}
          {upcomingEvents.slice(1).map((e) => (
            <div key={`${e.source}-${e.id}`} className="text-[10px] text-gray-600/60 dark:text-white/40 truncate px-1">
              <span className="inline-block w-1 h-1 rounded-full mr-1 align-middle" style={{ background: e.color || "#6366F1", opacity: 0.5 }} />
              {e.title}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── LAYOUT: Compact (≤2 rows, >3 cols) ─────────────────────────────────
  // Horizontal: header row, then "up next" + event list side-by-side

  if (isCompact) {
    return (
      <div className="widget-card flex flex-col h-full min-h-0 p-3">
        {renderHeader()}
        {error && <div className="text-[10px] text-red-400/70 mb-1.5 truncate">{error}</div>}
        {renderSetupAndAddForms()}
        <div className="flex-1 min-h-0 flex gap-3">
          {/* Left: up-next banner */}
          <div className="shrink-0" style={{ width: isWide ? "200px" : "160px" }}>
            {renderNextEventBanner() || renderEmptyState()}
          </div>
          {/* Right: event list */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
            {upcomingEvents.slice(nextEvent ? 1 : 0).map((e) => renderEventRow(e, true))}
          </div>
        </div>
      </div>
    );
  }

  // ─── LAYOUT: Wide (≥8 cols, >2 rows) ─────────────────────────────────────
  // Side-by-side: mini calendar on left, events on right

  if (isWide) {
    return (
      <div className="widget-card flex flex-col h-full min-h-0 p-3">
        {renderHeader()}
        {error && <div className="text-[10px] text-red-400/70 mb-2 truncate">{error}</div>}
        {renderSetupAndAddForms()}
        <div className="flex-1 min-h-0 flex gap-3">
          {/* Left: full mini calendar */}
          <div className="shrink-0" style={{ width: showFullCal ? "210px" : "180px" }}>
            {renderMiniCalendar(false)}
          </div>
          {/* Right: selected day header + events */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-600/70 dark:text-white/50">
                {selectedDate === todayKey ? "Today" : new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <span className="text-[10px] text-gray-400/50 dark:text-white/25">{selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
              {selectedDateEvents.length === 0 ? (
                <div className="text-center text-gray-400/35 dark:text-white/12 text-[11px] py-4">No events on this day</div>
              ) : (
                selectedDateEvents.map((e) => renderEventRow(e, false))
              )}
              {/* Upcoming section below selected day */}
              {isTall && upcomingEvents.length > 0 && (
                <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                  <div className="text-[9px] uppercase tracking-wide text-gray-400/50 dark:text-white/25 mb-1.5">Upcoming</div>
                  {upcomingEvents.map((e) => renderEventRow(e, true))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── LAYOUT: Tall + narrow (≥4 rows, ≤4 cols) ───────────────────────────
  // Vertical stack: mini cal on top, events below

  if (isTall && isNarrow) {
    return (
      <div className="widget-card flex flex-col h-full min-h-0 p-3">
        {renderHeader()}
        {error && <div className="text-[10px] text-red-400/70 mb-2 truncate">{error}</div>}
        {renderSetupAndAddForms()}
        <div className="mb-2">
          {renderMiniCalendar(true)}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="text-[9px] uppercase tracking-wide text-gray-400/50 dark:text-white/25 mb-1 px-1">
            {selectedDate === todayKey ? "Today" : relativeDay(new Date(selectedDate + "T12:00:00"))}
          </div>
          {selectedDateEvents.length === 0 ? (
            <div className="text-center text-gray-400/35 dark:text-white/12 text-[11px] py-3">No events</div>
          ) : (
            selectedDateEvents.map((e) => renderEventRow(e, true))
          )}
        </div>
      </div>
    );
  }

  // ─── LAYOUT: Default / Medium (3 rows, 5–7 cols) ────────────────────────
  // "Up next" banner, optional mini-cal, scrollable event list

  return (
    <div className="widget-card flex flex-col h-full min-h-0 p-3">
      {renderHeader()}
      {error && <div className="text-[10px] text-red-400/70 mb-2 truncate">{error}</div>}
      {renderSetupAndAddForms()}

      {renderNextEventBanner()}

      {showMiniCal && (
        <div className="mt-2 mb-1">
          {renderMiniCalendar(true)}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto mt-2">
        {renderEmptyState()}
        {(showMiniCal ? selectedDateEvents : upcomingEvents).length > 0 && (
          <>
            {showMiniCal && (
              <div className="text-[9px] uppercase tracking-wide text-gray-400/50 dark:text-white/25 mb-1 px-1">
                {selectedDate === todayKey ? "Today" : relativeDay(new Date(selectedDate + "T12:00:00"))}
              </div>
            )}
            {(showMiniCal ? selectedDateEvents : upcomingEvents).map((e) => renderEventRow(e, false))}
          </>
        )}
        {showMiniCal && selectedDateEvents.length === 0 && (googleConnected || localEvents.length > 0) && !loading && (
          <div className="text-center text-gray-400/35 dark:text-white/12 text-[11px] py-3">No events on this day</div>
        )}
      </div>
    </div>
  );
}
