export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: "google" | "outlook";
  color?: string;
}

export async function getGoogleToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      reject(new Error("Chrome runtime not available"));
      return;
    }
    chrome.runtime.sendMessage({ type: "GET_GOOGLE_TOKEN" }, (response) => {
      if (response?.error) reject(new Error(response.error));
      else if (response?.token) resolve(response.token);
      else reject(new Error("No token received"));
    });
  });
}

export async function revokeGoogleToken(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      resolve();
      return;
    }
    chrome.runtime.sendMessage({ type: "REVOKE_GOOGLE_TOKEN" }, () => resolve());
  });
}

export async function fetchGoogleCalendarEvents(token: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const timeMin = now.toISOString();
  const timeMax = endOfDay.toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);

  const data = await res.json();

  return (data.items || []).map((item: any) => ({
    id: item.id,
    title: item.summary || "Untitled",
    start: new Date(item.start.dateTime || item.start.date),
    end: new Date(item.end.dateTime || item.end.date),
    allDay: !item.start.dateTime,
    source: "google" as const,
    color: "#4285F4",
  }));
}
