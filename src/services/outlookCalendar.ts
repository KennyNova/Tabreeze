import { CalendarEvent } from "./googleCalendar";

const OUTLOOK_CLIENT_ID_KEY = "dashboard-outlook-client-id";
const OUTLOOK_TOKEN_KEY = "dashboard-outlook-token";

export function getStoredOutlookToken(): string | null {
  return localStorage.getItem(OUTLOOK_TOKEN_KEY);
}

export function storeOutlookToken(token: string) {
  localStorage.setItem(OUTLOOK_TOKEN_KEY, token);
}

export function clearOutlookToken() {
  localStorage.removeItem(OUTLOOK_TOKEN_KEY);
}

export function getStoredOutlookClientId(): string {
  return localStorage.getItem(OUTLOOK_CLIENT_ID_KEY) || "";
}

export function storeOutlookClientId(clientId: string) {
  localStorage.setItem(OUTLOOK_CLIENT_ID_KEY, clientId);
}

export async function getOutlookToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      reject(new Error("Chrome runtime not available"));
      return;
    }
    chrome.runtime.sendMessage(
      { type: "GET_OUTLOOK_TOKEN", clientId },
      (response) => {
        if (response?.error) reject(new Error(response.error));
        else if (response?.token) {
          storeOutlookToken(response.token);
          resolve(response.token);
        } else reject(new Error("No token received"));
      }
    );
  });
}

export async function fetchOutlookCalendarEvents(token: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?` +
      `startDateTime=${now.toISOString()}&endDateTime=${endOfDay.toISOString()}&$top=10&$orderby=start/dateTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    if (res.status === 401) {
      clearOutlookToken();
      throw new Error("Token expired");
    }
    throw new Error(`Outlook API error: ${res.status}`);
  }

  const data = await res.json();

  return (data.value || []).map((item: any) => ({
    id: item.id,
    title: item.subject || "Untitled",
    start: new Date(item.start.dateTime + "Z"),
    end: new Date(item.end.dateTime + "Z"),
    allDay: item.isAllDay || false,
    source: "outlook" as const,
    color: "#0078D4",
  }));
}
