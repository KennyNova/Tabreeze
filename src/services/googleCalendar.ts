import ICAL from "ical.js";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: "google" | "local";
  color?: string;
}

// ─── iCal URL storage ───────────────────────────────────────────────────────

const ICAL_URL_KEY = "dashboard-ical-url";
const ICAL_CACHE_KEY = "dashboard-ical-cache";
const ICAL_CACHE_TS_KEY = "dashboard-ical-cache-ts";
const CACHE_TTL_MS = 5 * 60 * 1000;

export function getStoredIcalUrl(): string {
  return localStorage.getItem(ICAL_URL_KEY) ?? "";
}

export function storeIcalUrl(url: string) {
  localStorage.setItem(ICAL_URL_KEY, url.trim());
  localStorage.removeItem(ICAL_CACHE_KEY);
  localStorage.removeItem(ICAL_CACHE_TS_KEY);
}

export function clearIcalUrl() {
  localStorage.removeItem(ICAL_URL_KEY);
  localStorage.removeItem(ICAL_CACHE_KEY);
  localStorage.removeItem(ICAL_CACHE_TS_KEY);
}

export function isGoogleCalendarConnected(): boolean {
  return !!getStoredIcalUrl();
}

// ─── Fetch & parse iCal ─────────────────────────────────────────────────────

async function fetchIcalText(url: string): Promise<string> {
  const cached = localStorage.getItem(ICAL_CACHE_KEY);
  const cachedTs = localStorage.getItem(ICAL_CACHE_TS_KEY);
  if (cached && cachedTs && Date.now() - Number(cachedTs) < CACHE_TTL_MS) {
    return cached;
  }

  const proxyUrl = url;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Failed to fetch calendar: ${res.status}`);
  const text = await res.text();

  try {
    localStorage.setItem(ICAL_CACHE_KEY, text);
    localStorage.setItem(ICAL_CACHE_TS_KEY, String(Date.now()));
  } catch {
    // localStorage quota exceeded — skip caching
  }

  return text;
}

function parseIcalEvents(icalText: string): CalendarEvent[] {
  const jcal = ICAL.parse(icalText);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 1);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + 60);
  rangeEnd.setHours(23, 59, 59, 999);

  const events: CalendarEvent[] = [];

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);

    if (event.isRecurring()) {
      const iterator = event.iterator();
      let next = iterator.next();
      let safety = 0;
      while (next && safety < 500) {
        safety++;
        const occurrence = event.getOccurrenceDetails(next);
        const start = occurrence.startDate.toJSDate();
        const end = occurrence.endDate.toJSDate();
        if (start > rangeEnd) break;
        if (end >= rangeStart) {
          const allDay = occurrence.startDate.isDate;
          events.push({
            id: `${event.uid}-${start.getTime()}`,
            title: event.summary || "Untitled",
            start,
            end,
            allDay,
            source: "google",
            color: "#4285F4",
          });
        }
        next = iterator.next();
      }
    } else {
      const start = event.startDate.toJSDate();
      const end = event.endDate.toJSDate();
      if (end >= rangeStart && start <= rangeEnd) {
        const allDay = event.startDate.isDate;
        events.push({
          id: event.uid || `ev-${start.getTime()}`,
          title: event.summary || "Untitled",
          start,
          end,
          allDay,
          source: "google",
          color: "#4285F4",
        });
      }
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return events;
}

export async function fetchGoogleCalendarEvents(): Promise<CalendarEvent[]> {
  const url = getStoredIcalUrl();
  if (!url) return [];
  const text = await fetchIcalText(url);
  return parseIcalEvents(text);
}

// ─── Built-in local calendar ────────────────────────────────────────────────

const LOCAL_EVENTS_KEY = "dashboard-local-events";

export interface LocalEventData {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  color: string;
}

export function loadLocalEvents(): LocalEventData[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalEvents(events: LocalEventData[]) {
  localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
}

export function addLocalEvent(event: Omit<LocalEventData, "id">): LocalEventData {
  const newEvent: LocalEventData = { ...event, id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  const all = loadLocalEvents();
  all.push(newEvent);
  saveLocalEvents(all);
  return newEvent;
}

export function removeLocalEvent(id: string) {
  const all = loadLocalEvents().filter((e) => e.id !== id);
  saveLocalEvents(all);
}

export function localEventsToCalendarEvents(localEvents: LocalEventData[]): CalendarEvent[] {
  return localEvents.map((e) => {
    let start: Date;
    let end: Date;
    if (e.allDay) {
      start = new Date(e.date + "T00:00:00");
      end = new Date(e.date + "T23:59:59");
    } else {
      start = new Date(`${e.date}T${e.startTime || "00:00"}`);
      end = new Date(`${e.date}T${e.endTime || "23:59"}`);
    }
    return {
      id: e.id,
      title: e.title,
      start,
      end,
      allDay: e.allDay,
      source: "local" as const,
      color: e.color || "#6366F1",
    };
  });
}
