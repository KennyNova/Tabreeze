import { useState, useEffect, useCallback } from "react";
import {
  CalendarEvent,
  getGoogleToken,
  revokeGoogleToken,
  fetchGoogleCalendarEvents,
} from "../services/googleCalendar";
import {
  getOutlookToken,
  fetchOutlookCalendarEvents,
  getStoredOutlookToken,
  clearOutlookToken,
  getStoredOutlookClientId,
  storeOutlookClientId,
} from "../services/outlookCalendar";

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  return event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOutlookSetup, setShowOutlookSetup] = useState(false);
  const [outlookClientId, setOutlookClientId] = useState(getStoredOutlookClientId());

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    const allEvents: CalendarEvent[] = [];

    if (googleConnected) {
      try {
        const token = await getGoogleToken();
        const gEvents = await fetchGoogleCalendarEvents(token);
        allEvents.push(...gEvents);
      } catch (err: any) {
        console.error("Google Calendar error:", err);
      }
    }

    if (outlookConnected) {
      try {
        const token = getStoredOutlookToken();
        if (token) {
          const oEvents = await fetchOutlookCalendarEvents(token);
          allEvents.push(...oEvents);
        }
      } catch (err: any) {
        if (err.message === "Token expired") {
          setOutlookConnected(false);
        }
        console.error("Outlook Calendar error:", err);
      }
    }

    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
    setEvents(allEvents);
    setLoading(false);
  }, [googleConnected, outlookConnected]);

  useEffect(() => {
    const gConnected = localStorage.getItem("dashboard-google-connected") === "true";
    const oConnected = !!getStoredOutlookToken();
    setGoogleConnected(gConnected);
    setOutlookConnected(oConnected);
  }, []);

  useEffect(() => {
    if (googleConnected || outlookConnected) {
      fetchEvents();
    }
  }, [googleConnected, outlookConnected, fetchEvents]);

  const connectGoogle = async () => {
    try {
      setLoading(true);
      await getGoogleToken();
      setGoogleConnected(true);
      localStorage.setItem("dashboard-google-connected", "true");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const disconnectGoogle = async () => {
    await revokeGoogleToken();
    setGoogleConnected(false);
    localStorage.removeItem("dashboard-google-connected");
    setEvents((prev) => prev.filter((e) => e.source !== "google"));
  };

  const connectOutlook = async () => {
    if (!outlookClientId.trim()) {
      setShowOutlookSetup(true);
      return;
    }
    try {
      setLoading(true);
      storeOutlookClientId(outlookClientId.trim());
      await getOutlookToken(outlookClientId.trim());
      setOutlookConnected(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const disconnectOutlook = () => {
    clearOutlookToken();
    setOutlookConnected(false);
    setEvents((prev) => prev.filter((e) => e.source !== "outlook"));
  };

  const isInRuntime = typeof chrome !== "undefined" && !!chrome.runtime?.sendMessage;

  return (
    <div className="widget-card flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <svg className="w-[18px] h-[18px] text-gray-500/60 dark:text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h2 className="font-medium text-[15px] text-gray-700/80 dark:text-white/60">Calendar</h2>
        </div>
        {(googleConnected || outlookConnected) && (
          <button onClick={fetchEvents} className="btn-ghost text-xs" disabled={loading}>
            {loading ? "..." : "Refresh"}
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs rounded-xl px-3 py-2 mb-3"
             style={{ color: "rgba(255,59,48,0.8)", background: "rgba(255,59,48,0.06)" }}>
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {googleConnected ? (
          <button onClick={disconnectGoogle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{ background: "rgba(0,122,255,0.06)", color: "rgba(0,122,255,0.8)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(0,122,255,0.8)" }} />
            Google
          </button>
        ) : (
          <button
            onClick={connectGoogle}
            disabled={!isInRuntime || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                       text-gray-500/60 dark:text-white/30 disabled:opacity-40 transition-colors"
            style={{ background: "rgba(0,0,0,0.03)" }}
          >
            Connect Google
          </button>
        )}

        {outlookConnected ? (
          <button onClick={disconnectOutlook}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{ background: "rgba(0,120,212,0.06)", color: "rgba(0,120,212,0.8)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(0,120,212,0.8)" }} />
            Outlook
          </button>
        ) : (
          <button
            onClick={connectOutlook}
            disabled={!isInRuntime || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                       text-gray-500/60 dark:text-white/30 disabled:opacity-40 transition-colors"
            style={{ background: "rgba(0,0,0,0.03)" }}
          >
            Connect Outlook
          </button>
        )}
      </div>

      {showOutlookSetup && (
        <div className="mb-3 p-3 rounded-xl"
             style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
          <p className="text-xs text-gray-500/50 dark:text-white/25 mb-2">
            Enter your Azure AD app client ID to connect Outlook calendar.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={outlookClientId}
              onChange={(e) => setOutlookClientId(e.target.value)}
              placeholder="Client ID"
              className="input-field text-xs"
            />
            <button
              onClick={() => { setShowOutlookSetup(false); connectOutlook(); }}
              className="btn-primary text-xs"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col gap-0.5 overflow-y-auto">
        {!googleConnected && !outlookConnected && (
          <div className="text-center text-gray-400/40 dark:text-white/15 text-sm py-6 font-light">
            {isInRuntime
              ? "Connect a calendar to see your events"
              : "Install as extension to connect calendars"}
          </div>
        )}

        {(googleConnected || outlookConnected) && events.length === 0 && !loading && (
          <div className="text-center text-gray-400/40 dark:text-white/15 text-sm py-6 font-light">
            No events for today
          </div>
        )}

        {loading && events.length === 0 && (
          <div className="text-center text-gray-400/40 dark:text-white/15 text-sm py-6 font-light">
            Loading events...
          </div>
        )}

        {events.map((event) => (
          <div
            key={`${event.source}-${event.id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-200"
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div
              className="w-[3px] h-7 rounded-full flex-shrink-0 opacity-60"
              style={{ backgroundColor: event.color || "#6366F1" }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-gray-700/80 dark:text-white/60 truncate">
                {event.title}
              </div>
              <div className="text-xs text-gray-400/50 dark:text-white/20 font-light">
                {formatEventTime(event)}
                <span className="ml-1.5 opacity-60">
                  {event.source === "google" ? "Google" : "Outlook"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
