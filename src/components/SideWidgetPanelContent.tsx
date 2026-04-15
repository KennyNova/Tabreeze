import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetType } from "../layout/types";
import { buildSearchUrl, getAvailableSearchSources, loadCustomSearchSources, resolveSearchSource } from "../search/sources";
import { fetchWeather, getAqiLabel, getWeatherDescription, getWeatherIcon, getWeatherSettings } from "../services/weather";
import type { WeatherData } from "../services/weather";
import { fetchNews, formatTimeAgo, type NewsItem } from "../services/news";
import { quoteCategories, type Quote } from "../data/quotes";
import {
  fetchGoogleCalendarEvents,
  isGoogleCalendarConnected,
  storeIcalUrl,
  clearIcalUrl,
  loadLocalEvents,
  localEventsToCalendarEvents,
  addLocalEvent,
  removeLocalEvent,
  type CalendarEvent,
  type LocalEventData,
} from "../services/googleCalendar";
import HomelabWidget from "./HomelabSidebar";
import BookmarksGrid from "./BookmarksGrid";

interface SideWidgetPanelContentProps {
  widget: WidgetType;
  side: "left" | "right";
}

// ─── Search ────────────────────────────────────────────────────────────────────

function SideSearchPanel({ side }: { side: "left" | "right" }) {
  const key = `dashboard-side-search-bars-${side}`;
  const sources = useMemo(() => getAvailableSearchSources(loadCustomSearchSources()), []);
  const sourceIds = new Set(sources.map((s) => s.id));
  const defaultSourceId = sources.find((s) => s.id === "chatgpt")?.id ?? sources[0]?.id ?? "google";
  const [barSources, setBarSources] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [defaultSourceId];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [defaultSourceId];
      const cleaned = parsed.filter((id): id is string => typeof id === "string" && sourceIds.has(id));
      return cleaned.length > 0 ? cleaned.slice(0, 6) : [defaultSourceId];
    } catch { return [defaultSourceId]; }
  });
  const [queries, setQueries] = useState<Record<string, string>>({});

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(barSources));
  }, [barSources, key]);

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <div className="glass rounded-xl p-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45">Search stack</div>
          <div className="text-xs text-gray-500/70 dark:text-white/45">{barSources.length} provider{barSources.length > 1 ? "s" : ""}</div>
        </div>
        <button type="button" onClick={() => barSources.length < 6 && setBarSources((p) => [...p, defaultSourceId])} disabled={barSources.length >= 6} className="btn-primary text-xs px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed">+ Bar</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
        {barSources.map((srcId, idx) => {
          const src = resolveSearchSource(srcId);
          return (
            <div key={`${srcId}-${idx}`} className="glass rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <select value={srcId} onChange={(e) => setBarSources((p) => p.map((id, i) => i === idx ? e.target.value : id))} className="h-7 rounded-lg px-2 text-[11px] bg-black/[0.04] dark:bg-white/[0.08] border border-black/10 dark:border-white/15 text-gray-700 dark:text-white/80">
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button type="button" onClick={() => setBarSources((p) => p.length <= 1 ? p : p.filter((_, i) => i !== idx))} disabled={barSources.length <= 1} className="w-7 h-7 rounded-lg inline-flex items-center justify-center border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.08] text-gray-600 dark:text-white/75 hover:bg-black/[0.08] dark:hover:bg-white/[0.14] disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Remove bar">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); const q = (queries[String(idx)] ?? "").trim(); if (q) window.location.href = buildSearchUrl(src.urlTemplate, q); }} className="flex gap-2">
                <input value={queries[String(idx)] ?? ""} onChange={(e) => setQueries((p) => ({ ...p, [String(idx)]: e.target.value }))} placeholder={`Ask ${src.label}...`} className="input-field text-sm !py-2" />
                <button type="submit" className="btn-primary text-xs px-3 py-2">Go</button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weather ───────────────────────────────────────────────────────────────────

function humidityTone(humidity: number): { badge: string; text: string } {
  if (humidity < 35) return { badge: "Dry", text: "text-red-500 dark:text-red-300" };
  if (humidity < 60) return { badge: "Balanced", text: "text-emerald-500 dark:text-emerald-300" };
  if (humidity < 80) return { badge: "Humid", text: "text-blue-500 dark:text-blue-300" };
  return { badge: "Very humid", text: "text-blue-600 dark:text-blue-200" };
}

function aqiTone(aqi: number | null): { pill: string; text: string } {
  if (aqi === null) return { pill: "bg-gray-400/20 dark:bg-white/10", text: "text-gray-500 dark:text-white/55" };
  if (aqi <= 50) return { pill: "bg-emerald-500/20 dark:bg-emerald-400/20", text: "text-emerald-600 dark:text-emerald-300" };
  if (aqi <= 100) return { pill: "bg-amber-500/20 dark:bg-amber-400/20", text: "text-amber-600 dark:text-amber-300" };
  if (aqi <= 150) return { pill: "bg-orange-500/20 dark:bg-orange-400/20", text: "text-orange-600 dark:text-orange-300" };
  return { pill: "bg-red-500/20 dark:bg-red-400/20", text: "text-red-600 dark:text-red-300" };
}

function windCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function SideWeatherPanel() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDayDate, setSelectedDayDate] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchWeather();
      setWeather(data);
    } catch (err: any) {
      setError(err.message ?? "Failed to load weather");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!weather?.daily?.length) return;
    const exists = weather.daily.some((day) => day.date === selectedDayDate);
    if (!selectedDayDate || !exists) {
      setSelectedDayDate(weather.daily[0].date);
    }
  }, [weather, selectedDayDate]);

  if (loading && !weather) return <div className="text-center text-gray-400/50 dark:text-white/25 py-10 text-sm">Loading weather...</div>;
  if (error && !weather) return <div className="text-center text-red-400/70 py-10 text-sm">{error}</div>;
  if (!weather) return null;

  const settings = getWeatherSettings();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const humidTone = humidityTone(weather.humidity);
  const aqiStyle = aqiTone(weather.airQuality.usAqi);
  const selectedDay = weather.daily.find((day) => day.date === selectedDayDate) ?? weather.daily[0];

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
      {/* Current conditions */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white/90">{weather.temperature}°{weather.unit}</div>
            <div className="text-xs text-gray-500 dark:text-white/50">Feels like {weather.feelsLike}°{weather.unit}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl">{getWeatherIcon(weather.weatherCode, weather.isDay)}</div>
            <div className="text-[11px] text-gray-500 dark:text-white/50">{weather.city}</div>
          </div>
        </div>
        <div className="text-xs text-gray-600 dark:text-white/60 mb-3">{getWeatherDescription(weather.weatherCode)}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-2">
            <div className="text-[10px] text-gray-500/80 dark:text-white/40">Humidity</div>
            <div className={`text-sm font-medium ${humidTone.text}`}>{weather.humidity}%</div>
            <div className={`text-[10px] ${humidTone.text}`}>{humidTone.badge}</div>
          </div>
          <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-2">
            <div className="text-[10px] text-gray-500/80 dark:text-white/40">Wind</div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/[0.04] dark:bg-white/[0.08]">
                <svg className="w-3 h-3 text-gray-700 dark:text-white/80" viewBox="0 0 24 24" fill="currentColor" style={{ transform: `rotate(${weather.windDirection}deg)` }}>
                  <path d="M12 3l4.5 9H13.8V21h-3.6v-9H7.5L12 3z" />
                </svg>
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-white/80">{weather.windSpeed} km/h</span>
            </div>
            <div className="text-[10px] text-gray-500/70 dark:text-white/40">{windCompass(weather.windDirection)} ({weather.windDirection}°)</div>
          </div>
          <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-2">
            <div className="text-[10px] text-gray-500/80 dark:text-white/40">Precip</div>
            <div className="text-sm font-medium text-gray-700 dark:text-white/80">{weather.precipitation} mm</div>
          </div>
          <div className={`rounded-lg p-2 ${aqiStyle.pill}`}>
            <div className="text-[10px] text-gray-500/80 dark:text-white/40">AQI</div>
            <div className={`text-sm font-medium ${aqiStyle.text}`}>{weather.airQuality.usAqi ?? "–"} <span className="text-[10px] font-normal">{getAqiLabel(weather.airQuality.usAqi)}</span></div>
          </div>
        </div>
      </div>

      {/* Air quality detail */}
      {(weather.airQuality.pm25 !== null || weather.airQuality.pm10 !== null) && (
        <div className="glass rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">Air Quality Detail</div>
          <div className="flex gap-3">
            {weather.airQuality.pm25 !== null && <div className="flex-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-2"><div className="text-[10px] text-gray-500/70 dark:text-white/40">PM2.5</div><div className="text-sm font-medium text-gray-700 dark:text-white/80">{weather.airQuality.pm25} µg/m³</div></div>}
            {weather.airQuality.pm10 !== null && <div className="flex-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-2"><div className="text-[10px] text-gray-500/70 dark:text-white/40">PM10</div><div className="text-sm font-medium text-gray-700 dark:text-white/80">{weather.airQuality.pm10} µg/m³</div></div>}
          </div>
        </div>
      )}

      {/* Radar embed */}
      <div className="glass rounded-xl p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">Radar & Map</div>
        <div className="rounded-lg overflow-hidden border border-black/[0.06] dark:border-white/[0.08]" style={{ height: 220 }}>
          <iframe
            title="Weather radar"
            src={`https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°${settings.unit}&metricWind=km/h&zoom=7&overlay=rain&product=ecmwf&level=surface&lat=${weather.lat}&lon=${weather.lon}&message=true`}
            className="w-full h-full border-0"
            loading="lazy"
            allowFullScreen
          />
        </div>
      </div>

      {/* 7-day forecast */}
      <div className="glass rounded-xl p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">7-Day Forecast</div>
        <div className="space-y-1">
          {weather.daily.map((day) => {
            const d = new Date(day.date + "T12:00:00");
            const name = dayNames[d.getDay()];
            const isToday = day.date === weather.daily[0]?.date;
            const isSelected = day.date === selectedDayDate;
            return (
              <button
                type="button"
                key={day.date}
                onClick={() => setSelectedDayDate(day.date)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left ${isSelected ? "bg-blue-500/15 dark:bg-blue-400/15" : isToday ? "bg-blue-500/10 dark:bg-blue-400/10" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}
              >
                <span className="w-9 text-xs text-gray-600 dark:text-white/70 font-medium">{isToday ? "Now" : name}</span>
                <span className="text-base leading-none">{getWeatherIcon(day.weatherCode, true)}</span>
                <span className="text-xs text-blue-500/80 dark:text-blue-300/70 w-7 text-right">{day.tempMin}°</span>
                <div className="flex-1 h-1.5 rounded-full bg-gradient-to-r from-blue-400/40 to-orange-400/40 mx-1" />
                <span className="text-xs text-orange-500/80 dark:text-orange-300/70 w-7">{day.tempMax}°</span>
                <span className="text-[10px] text-gray-400 dark:text-white/35 w-8 text-right">{day.precipitationProbability}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hourly selected day */}
      {selectedDay?.hourly && selectedDay.hourly.length > 0 && (
        <div className="glass rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">Hourly {selectedDay.date === weather.daily[0]?.date ? "Today" : new Date(selectedDay.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })}</div>
          <div className="flex gap-2 overflow-x-auto pb-1 pr-1">
            {selectedDay.hourly.filter((_, i) => i % 2 === 0).map((h) => {
              const hour = new Date(h.time).getHours();
              return (
                <div key={h.time} className="flex flex-col items-center gap-1 min-w-[44px] rounded-lg bg-black/[0.02] dark:bg-white/[0.04] p-2">
                  <span className="text-[10px] text-gray-500 dark:text-white/50">{hour}:00</span>
                  <span className="text-sm">{getWeatherIcon(h.weatherCode, hour >= 6 && hour < 20)}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-white/80">{h.temperature}°</span>
                  <span className="text-[9px] text-gray-400 dark:text-white/35">{h.precipitationProbability}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button type="button" onClick={load} className="btn-ghost text-xs self-center">Refresh weather</button>
    </div>
  );
}

// ─── Tasks ─────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  board?: string;
  priority?: "low" | "medium" | "high";
}

const TASKS_KEY = "dashboard-tasks";
const BOARDS_KEY = "dashboard-task-boards";

function loadTasks(): Task[] {
  try { const d = localStorage.getItem(TASKS_KEY); return d ? JSON.parse(d) : []; } catch { return []; }
}
function saveTasks(tasks: Task[]) { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }
function loadBoards(): string[] {
  try { const d = localStorage.getItem(BOARDS_KEY); return d ? JSON.parse(d) : ["General"]; } catch { return ["General"]; }
}
function saveBoards(boards: string[]) { localStorage.setItem(BOARDS_KEY, JSON.stringify(boards)); }

const PRIORITY_COLORS = {
  high: "bg-red-400/70",
  medium: "bg-amber-400/70",
  low: "bg-blue-400/50",
};

function SideTasksPanel() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [boards, setBoards] = useState<string[]>(loadBoards);
  const [activeBoard, setActiveBoard] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [editingBoard, setEditingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveTasks(tasks); }, [tasks]);
  useEffect(() => { saveBoards(boards); }, [boards]);

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setTasks((prev) => [...prev, { id: `task-${Date.now()}`, text, completed: false, createdAt: Date.now(), board: activeBoard ?? "General", priority: newPriority }]);
    setNewTask("");
    inputRef.current?.focus();
  };

  const toggleTask = (id: string) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));
  const deleteTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const clearCompleted = () => setTasks((prev) => prev.filter((t) => !t.completed || (activeBoard && t.board !== activeBoard)));

  const addBoard = () => {
    const name = newBoardName.trim();
    if (!name || boards.includes(name)) return;
    setBoards((p) => [...p, name]);
    setNewBoardName("");
    setEditingBoard(false);
  };
  const removeBoard = (name: string) => {
    if (boards.length <= 1) return;
    setBoards((p) => p.filter((b) => b !== name));
    setTasks((p) => p.map((t) => t.board === name ? { ...t, board: boards[0] } : t));
    if (activeBoard === name) setActiveBoard(null);
  };

  const filtered = tasks
    .filter((t) => !activeBoard || t.board === activeBoard)
    .filter((t) => filter === "all" ? true : filter === "done" ? t.completed : !t.completed)
    .sort((a, b) => {
      const po = { high: 0, medium: 1, low: 2 };
      return (po[a.priority ?? "medium"] - po[b.priority ?? "medium"]) || (b.createdAt - a.createdAt);
    });

  const completedCount = tasks.filter((t) => (!activeBoard || t.board === activeBoard) && t.completed).length;
  const totalCount = tasks.filter((t) => !activeBoard || t.board === activeBoard).length;

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      {/* Board tabs */}
      <div className="glass rounded-xl p-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button type="button" onClick={() => setActiveBoard(null)} className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors ${!activeBoard ? "bg-blue-500/20 text-blue-700 dark:text-blue-200" : "bg-black/[0.04] dark:bg-white/[0.08] text-gray-600 dark:text-white/70 hover:bg-black/[0.08] dark:hover:bg-white/[0.14]"}`}>All</button>
          {boards.map((b) => (
            <button key={b} type="button" onClick={() => setActiveBoard(b)} className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors group relative ${activeBoard === b ? "bg-blue-500/20 text-blue-700 dark:text-blue-200" : "bg-black/[0.04] dark:bg-white/[0.08] text-gray-600 dark:text-white/70 hover:bg-black/[0.08] dark:hover:bg-white/[0.14]"}`}>
              {b}
              {boards.length > 1 && <span onClick={(e) => { e.stopPropagation(); removeBoard(b); }} className="ml-1 opacity-0 group-hover:opacity-100 text-red-400 cursor-pointer">&times;</span>}
            </button>
          ))}
          {editingBoard ? (
            <form onSubmit={(e) => { e.preventDefault(); addBoard(); }} className="flex gap-1">
              <input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} placeholder="Name" className="w-20 input-field text-[10px] !py-1 !px-2 !rounded-lg" autoFocus />
              <button type="submit" className="btn-primary text-[10px] !py-1 !px-2">+</button>
            </form>
          ) : (
            <button type="button" onClick={() => setEditingBoard(true)} className="w-6 h-6 rounded-lg inline-flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.08] text-gray-500 dark:text-white/50 hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-xs">+</button>
          )}
        </div>
      </div>

      {/* Filter + stats */}
      <div className="flex items-center justify-between px-1">
        <div className="flex gap-1">
          {(["all", "active", "done"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`px-2 py-0.5 rounded-md text-[10px] capitalize ${filter === f ? "bg-blue-500/15 text-blue-700 dark:text-blue-200" : "text-gray-500 dark:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"}`}>{f}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500/70 dark:text-white/40">
          <span>{completedCount}/{totalCount}</span>
          {completedCount > 0 && <button type="button" onClick={clearCompleted} className="text-red-400/70 hover:text-red-500">Clear done</button>}
        </div>
      </div>

      {/* Add task */}
      <div className="glass rounded-xl p-3 space-y-2">
        <div className="flex gap-2">
          <input ref={inputRef} value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Add a task..." className="input-field text-sm !py-2" />
          <button type="button" onClick={addTask} className="btn-primary text-xs px-3 py-2">Add</button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500/70 dark:text-white/40">Priority:</span>
          {(["low", "medium", "high"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setNewPriority(p)} className={`px-2 py-0.5 rounded-md text-[10px] capitalize ${newPriority === p ? "bg-blue-500/15 text-blue-700 dark:text-blue-200" : "text-gray-500 dark:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"}`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-0.5">
        {filtered.length === 0 && <div className="text-center text-gray-400/40 dark:text-white/15 text-sm py-6">No tasks</div>}
        {filtered.map((task) => (
          <div key={task.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl group hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLORS[task.priority ?? "medium"]}`} />
            <button type="button" onClick={() => toggleTask(task.id)} className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all" style={task.completed ? { background: "rgba(0,122,255,0.7)" } : { border: "1.5px solid rgba(0,0,0,0.12)" }}>
              {task.completed && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </button>
            <div className="flex-1 min-w-0">
              <span className={`text-[13px] ${task.completed ? "line-through text-gray-400/40 dark:text-white/15" : "text-gray-700/80 dark:text-white/60"}`}>{task.text}</span>
              {task.board && <span className="ml-1.5 text-[9px] text-gray-400/50 dark:text-white/25">{task.board}</span>}
            </div>
            <button type="button" onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400/40 hover:text-red-400/70 transition-all shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quotes / News ─────────────────────────────────────────────────────────────

interface SavedQuote extends Quote {
  key: string;
  savedAt: number;
}

interface SavedNewsItem extends NewsItem {
  savedAt: number;
}

type QuoteTab = "quote" | "news" | "favorites" | "savedNews";
type CalendarView = "month" | "week" | "day";
type CalendarFilter = "today" | "thisWeek" | "google" | "local" | "30min" | "1hr";

const QUOTE_CATEGORY_KEY = "dashboard-quote-category";
const QUOTE_FAVORITES_KEY = "dashboard-quote-favorites-v2";
const QUOTE_FAVORITES_LEGACY_KEY = "dashboard-quote-favorites";
const SAVED_NEWS_KEY = "dashboard-saved-news";
const CALENDAR_VIEW_KEY = "dashboard-calendar-side-view";
const CALENDAR_FILTERS_KEY = "dashboard-calendar-side-filters";
const FOCUS_OF_DAY_KEY = "dashboard-focus-of-day";
const WORLD_CLOCKS_KEY = "dashboard-world-clocks";

const WORLD_CLOCK_PRESETS = [
  { label: "New York (US)", value: "America/New_York" },
  { label: "London (UK)", value: "Europe/London" },
  { label: "Paris (France)", value: "Europe/Paris" },
  { label: "Dubai (UAE)", value: "Asia/Dubai" },
  { label: "Delhi (India)", value: "Asia/Kolkata" },
  { label: "Tokyo (Japan)", value: "Asia/Tokyo" },
  { label: "Seoul (South Korea)", value: "Asia/Seoul" },
  { label: "Sydney (Australia)", value: "Australia/Sydney" },
];

const CALENDAR_FILTER_CHIPS: Array<{ id: CalendarFilter; label: string }> = [
  { id: "today", label: "Today" },
  { id: "thisWeek", label: "This Week" },
  { id: "google", label: "Google" },
  { id: "local", label: "Local" },
  { id: "30min", label: "30min" },
  { id: "1hr", label: "1hr" },
];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function formatCountdown(ms: number): string {
  const safe = Math.max(ms, 0);
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getNextMidnight(from: Date): Date {
  const next = new Date(from);
  next.setHours(24, 0, 0, 0);
  return next;
}

function quoteKey(quote: Quote): string {
  return `${quote.text}__${quote.author}`;
}

function isCalendarView(value: string | null): value is CalendarView {
  return value === "month" || value === "week" || value === "day";
}

function isCalendarFilter(value: string): value is CalendarFilter {
  return CALENDAR_FILTER_CHIPS.some((chip) => chip.id === value);
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function endOfWeek(date: Date): Date {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function eventDurationMinutes(event: CalendarEvent): number {
  return Math.max(0, Math.round((event.end.getTime() - event.start.getTime()) / 60000));
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

function SideQuotesPanel() {
  const [categoryId, setCategoryId] = useState(() => localStorage.getItem(QUOTE_CATEGORY_KEY) ?? "inspirational");
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [favorites, setFavorites] = useState<SavedQuote[]>(() => {
    try {
      const nextRaw = localStorage.getItem(QUOTE_FAVORITES_KEY);
      if (nextRaw) {
        const parsed = JSON.parse(nextRaw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is SavedQuote => !!item?.text && !!item?.author)
            .map((item) => ({
              ...item,
              key: item.key || quoteKey(item),
              savedAt: item.savedAt || Date.now(),
            }));
        }
      }
      const legacyRaw = localStorage.getItem(QUOTE_FAVORITES_LEGACY_KEY);
      if (!legacyRaw) return [];
      const legacyParsed = JSON.parse(legacyRaw);
      if (!Array.isArray(legacyParsed)) return [];
      return legacyParsed
        .filter((item): item is Quote => !!item?.text && !!item?.author)
        .map((item, idx) => ({ ...item, key: quoteKey(item), savedAt: Date.now() - idx }));
    } catch {
      return [];
    }
  });
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [savedNews, setSavedNews] = useState<SavedNewsItem[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_NEWS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is SavedNewsItem => typeof item?.link === "string");
    } catch {
      return [];
    }
  });
  const [newsLoading, setNewsLoading] = useState(false);
  const [tab, setTab] = useState<QuoteTab>("quote");
  const [hoveredNewsLink, setHoveredNewsLink] = useState<string | null>(null);
  const newsRefreshInFlightRef = useRef(false);

  const category = quoteCategories.find((c) => c.id === categoryId) ?? quoteCategories[0];

  useEffect(() => {
    const seed = new Date().toDateString().split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    setCurrentQuote(category.quotes[seed % category.quotes.length]);
  }, [category]);

  useEffect(() => {
    localStorage.setItem(QUOTE_FAVORITES_KEY, JSON.stringify(favorites));
    localStorage.setItem(QUOTE_FAVORITES_LEGACY_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(SAVED_NEWS_KEY, JSON.stringify(savedNews));
  }, [savedNews]);

  const shuffle = () => {
    setCurrentQuote(category.quotes[Math.floor(Math.random() * category.quotes.length)]);
  };

  const isFavorite = (quote: Quote) => {
    const key = quoteKey(quote);
    return favorites.some((saved) => saved.key === key);
  };

  const toggleFav = (quote: Quote) => {
    const key = quoteKey(quote);
    setFavorites((prev) => {
      const exists = prev.some((saved) => saved.key === key);
      if (exists) return prev.filter((saved) => saved.key !== key);
      return [{ ...quote, key, savedAt: Date.now() }, ...prev];
    });
  };

  const loadNews = useCallback(async () => {
    if (newsRefreshInFlightRef.current) return;
    newsRefreshInFlightRef.current = true;
    setNewsLoading(true);
    try {
      setNewsItems(await fetchNews());
    } catch {
      setNewsItems([]);
    } finally {
      newsRefreshInFlightRef.current = false;
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
    const intervalId = window.setInterval(() => {
      loadNews();
    }, 30 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [loadNews]);

  const isNewsSaved = (item: NewsItem) => savedNews.some((saved) => saved.link === item.link);

  const toggleSavedNews = (item: NewsItem) => {
    setSavedNews((prev) => {
      const exists = prev.some((saved) => saved.link === item.link);
      if (exists) return prev.filter((saved) => saved.link !== item.link);
      return [{ ...item, savedAt: Date.now() }, ...prev];
    });
  };

  const hoveredPreview =
    (hoveredNewsLink && newsItems.find((item) => item.link === hoveredNewsLink)) ||
    (hoveredNewsLink && savedNews.find((item) => item.link === hoveredNewsLink)) ||
    null;

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <div className="glass rounded-xl p-2 grid grid-cols-4 gap-1">
        <button
          type="button"
          onClick={() => setTab("quote")}
          className={`px-2 py-1.5 rounded-lg text-[11px] transition-colors ${tab === "quote" ? "bg-blue-500/15 text-blue-700 dark:text-blue-200" : "text-gray-600 dark:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"}`}
        >
          Quote
        </button>
        <button
          type="button"
          onClick={() => setTab("news")}
          className={`px-2 py-1.5 rounded-lg text-[11px] transition-colors ${tab === "news" ? "bg-blue-500/15 text-blue-700 dark:text-blue-200" : "text-gray-600 dark:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"}`}
        >
          News
        </button>
        <button
          type="button"
          onClick={() => setTab("favorites")}
          className={`px-2 py-1.5 rounded-lg text-[11px] transition-colors ${tab === "favorites" ? "bg-blue-500/15 text-blue-700 dark:text-blue-200" : "text-gray-600 dark:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"}`}
        >
          Quotes ({favorites.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("savedNews")}
          className={`px-2 py-1.5 rounded-lg text-[11px] transition-colors ${tab === "savedNews" ? "bg-blue-500/15 text-blue-700 dark:text-blue-200" : "text-gray-600 dark:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"}`}
        >
          Saved ({savedNews.length})
        </button>
      </div>

      {tab === "quote" && (
        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="glass rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">Category</div>
            <div className="grid grid-cols-2 gap-1.5">
              {quoteCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(cat.id);
                    localStorage.setItem(QUOTE_CATEGORY_KEY, cat.id);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors ${cat.id === categoryId ? "bg-blue-500/10 text-blue-700 dark:text-blue-200" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-gray-600 dark:text-white/60"}`}
                >
                  <span>{cat.icon}</span>
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
          {currentQuote ? (
            <div className="glass rounded-xl p-4">
              <blockquote>
                <p className="text-[14px] leading-relaxed text-gray-700/85 dark:text-white/70 italic">"{currentQuote.text}"</p>
                <footer className="mt-3 flex items-center gap-2">
                  <div className="w-4 h-px bg-gray-300/40 dark:bg-white/10" />
                  <cite className="text-[12px] text-gray-500/60 dark:text-white/35 not-italic font-medium">{currentQuote.author}</cite>
                </footer>
              </blockquote>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={shuffle} className="btn-ghost text-xs">Shuffle</button>
                <button type="button" onClick={() => toggleFav(currentQuote)} className="btn-ghost text-xs">
                  {isFavorite(currentQuote) ? "Unsave" : "Save"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {tab === "news" && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {newsLoading ? <div className="text-center text-gray-400/40 dark:text-white/20 text-sm py-6">Loading headlines...</div> : null}
          {!newsLoading && newsItems.length === 0 ? <div className="text-center text-gray-400/40 dark:text-white/20 text-sm py-6">No headlines</div> : null}
          {!newsLoading && newsItems.length > 0 ? (
            <div className="space-y-2">
              {newsItems.map((item) => (
                <div
                  key={item.link}
                  className="glass rounded-xl p-3"
                  onMouseEnter={() => setHoveredNewsLink(item.link)}
                  onFocusCapture={() => setHoveredNewsLink(item.link)}
                  onMouseLeave={() => setHoveredNewsLink((prev) => (prev === item.link ? null : prev))}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[13px] leading-snug text-gray-700/80 dark:text-white/60 hover:text-blue-600/80 dark:hover:text-blue-400/70 line-clamp-2">
                        {item.title}
                      </a>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400/50 dark:text-white/20 font-medium">{item.source}</span>
                        {item.pubDate ? (
                          <>
                            <span className="text-[10px] text-gray-300/30 dark:text-white/10">·</span>
                            <span className="text-[10px] text-gray-400/40 dark:text-white/15">{formatTimeAgo(item.pubDate)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSavedNews(item)}
                      className={`px-2 py-1 rounded-lg text-[10px] border transition-colors ${isNewsSaved(item) ? "border-blue-500/30 text-blue-600/80 dark:text-blue-300/80 bg-blue-500/10" : "border-black/10 dark:border-white/15 text-gray-500/80 dark:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"}`}
                    >
                      {isNewsSaved(item) ? "Saved" : "Save"}
                    </button>
                  </div>
                  {hoveredNewsLink === item.link ? (
                    <div className="mt-2 pl-4 border-l border-blue-500/25">
                      <p className="text-[11px] leading-relaxed text-gray-600/80 dark:text-white/55">
                        {item.snippet || "Open the article to read the full story."}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={loadNews} className="btn-ghost text-xs mx-auto block mt-2">Refresh</button>
        </div>
      )}

      {tab === "favorites" ? (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
          {favorites.length === 0 ? <div className="text-center text-gray-400/40 dark:text-white/20 text-sm py-6">No saved quotes yet</div> : null}
          {favorites.map((quote) => (
            <div key={quote.key} className="glass rounded-xl p-3">
              <p className="text-[13px] leading-relaxed text-gray-700/85 dark:text-white/70 italic">"{quote.text}"</p>
              <div className="flex items-center justify-between mt-2">
                <cite className="text-[11px] text-gray-500/60 dark:text-white/35 not-italic font-medium">{quote.author}</cite>
                <button type="button" onClick={() => toggleFav(quote)} className="text-[10px] text-red-400/70 hover:text-red-500">Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "savedNews" ? (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
          {savedNews.length === 0 ? <div className="text-center text-gray-400/40 dark:text-white/20 text-sm py-6">No saved articles yet</div> : null}
          {savedNews.map((item) => (
            <div
              key={item.link}
              className="glass rounded-xl p-3"
              onMouseEnter={() => setHoveredNewsLink(item.link)}
              onMouseLeave={() => setHoveredNewsLink((prev) => (prev === item.link ? null : prev))}
            >
              <div className="flex items-start justify-between gap-2">
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[13px] leading-snug text-gray-700/80 dark:text-white/60 hover:text-blue-600/80 dark:hover:text-blue-400/70 line-clamp-2">
                  {item.title}
                </a>
                <button type="button" onClick={() => toggleSavedNews(item)} className="text-[10px] text-red-400/70 hover:text-red-500 shrink-0">
                  Remove
                </button>
              </div>
              <div className="text-[10px] text-gray-400/45 dark:text-white/20 mt-1">{item.source} {item.pubDate ? `· ${formatTimeAgo(item.pubDate)}` : ""}</div>
              {hoveredPreview?.link === item.link ? (
                <div className="mt-2 pl-4 border-l border-blue-500/25">
                  <p className="text-[11px] leading-relaxed text-gray-600/80 dark:text-white/55">
                    {item.snippet || "Open the article to read the full story."}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Calendar ──────────────────────────────────────────────────────────────────

const SIDE_CALENDAR_EVENT_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444"];

function SideCalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(isGoogleCalendarConnected);
  const [localEvents, setLocalEvts] = useState<LocalEventData[]>(loadLocalEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [view, setView] = useState<CalendarView>(() => {
    const stored = localStorage.getItem(CALENDAR_VIEW_KEY);
    return isCalendarView(stored) ? stored : "month";
  });
  const [activeFilters, setActiveFilters] = useState<CalendarFilter[]>(() => {
    try {
      const raw = localStorage.getItem(CALENDAR_FILTERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value): value is CalendarFilter => typeof value === "string" && isCalendarFilter(value));
    } catch {
      return [];
    }
  });
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showSetup, setShowSetup] = useState(false);
  const [icalInput, setIcalInput] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newAllDay, setNewAllDay] = useState(false);
  const [newColor, setNewColor] = useState(SIDE_CALENDAR_EVENT_COLORS[0]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    const all: CalendarEvent[] = [];
    if (googleConnected) {
      try {
        all.push(...await fetchGoogleCalendarEvents());
      } catch {
        setError("Could not load Google Calendar. Check your iCal URL.");
      }
    }
    all.push(...localEventsToCalendarEvents(localEvents));
    all.sort((a, b) => a.start.getTime() - b.start.getTime());
    setEvents(all);
    setLoading(false);
  }, [googleConnected, localEvents]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    localStorage.setItem(CALENDAR_VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem(CALENDAR_FILTERS_KEY, JSON.stringify(activeFilters));
  }, [activeFilters]);

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
    setLocalEvts(loadLocalEvents());
    setNewTitle("");
    setShowAddEvent(false);
  };

  const handleRemoveLocal = (id: string) => {
    removeLocalEvent(id);
    setLocalEvts(loadLocalEvents());
  };

  const now = new Date();
  const todayKey = toDateKey(now);
  const selectedDateObj = parseDateKey(selectedDate);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = event.start;
      const eventKey = toDateKey(eventDate);
      const sourceFilters = activeFilters.filter((item) => item === "google" || item === "local");
      if (sourceFilters.length > 0 && !sourceFilters.includes(event.source)) return false;

      if (activeFilters.includes("today") && eventKey !== todayKey) return false;
      if (activeFilters.includes("thisWeek")) {
        const weekStart = startOfWeek(now);
        const weekEnd = endOfWeek(now);
        if (eventDate < weekStart || eventDate > weekEnd) return false;
      }

      const durationLimits: number[] = [];
      if (activeFilters.includes("30min")) durationLimits.push(30);
      if (activeFilters.includes("1hr")) durationLimits.push(60);
      if (durationLimits.length > 0) {
        const maxDuration = Math.max(...durationLimits);
        if (eventDurationMinutes(event) > maxDuration) return false;
      }

      return true;
    });
  }, [events, activeFilters, now, todayKey]);

  const filteredByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const key = toDateKey(event.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [filteredEvents]);

  const dayEvents = filteredByDate.get(selectedDate) ?? [];

  const monthCells = useMemo(() => buildMonthCells(monthAnchor), [monthAnchor]);
  const monthLabel = monthAnchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const weekDates = useMemo(() => {
    const start = startOfWeek(selectedDateObj);
    return Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return date;
    });
  }, [selectedDateObj]);

  const upcomingEvents = useMemo(() => {
    return filteredEvents
      .filter((event) => event.end >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 14);
  }, [filteredEvents, now]);

  const toggleFilter = (filter: CalendarFilter) => {
    setActiveFilters((prev) => (
      prev.includes(filter) ? prev.filter((item) => item !== filter) : [...prev, filter]
    ));
  };

  const stepMonth = (offset: number) => {
    setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
      {/* Connection & add event */}
      <div className="glass rounded-xl p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">Calendar</div>
        <div className="flex flex-wrap gap-2">
          {googleConnected ? (
            <button type="button" onClick={disconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: "rgba(66,133,244,0.06)", color: "rgba(66,133,244,0.8)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(66,133,244,0.8)" }} />
              Google Calendar
            </button>
          ) : (
            <button type="button" onClick={() => setShowSetup(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-gray-500/60 dark:text-white/30" style={{ background: "rgba(0,0,0,0.03)" }}>
              Connect Google Calendar
            </button>
          )}
          <button type="button" onClick={() => setShowAddEvent(!showAddEvent)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-gray-500/60 dark:text-white/30" style={{ background: "rgba(0,0,0,0.03)" }}>
            + Add Event
          </button>
        </div>
        {error ? <div className="text-[11px] text-red-400/80 mt-2">{error}</div> : null}
      </div>

      {/* iCal setup */}
      {showSetup && (
        <div className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600/80 dark:text-white/50">Paste your Google Calendar iCal URL</p>
            <button onClick={() => setShowTutorial(!showTutorial)}
              className="text-[10px] px-2 py-0.5 rounded-lg transition-colors"
              style={{ background: "rgba(66,133,244,0.08)", color: "rgba(66,133,244,0.8)" }}>
              {showTutorial ? "Hide guide" : "How to find it"}
            </button>
          </div>
          {showTutorial && (
            <div className="p-2.5 rounded-lg text-[11px] leading-relaxed space-y-1.5"
                 style={{ background: "rgba(66,133,244,0.04)", border: "1px solid rgba(66,133,244,0.1)" }}>
              <div className="font-medium text-gray-700/80 dark:text-white/60">Quick steps:</div>
              <ol className="list-decimal pl-4 space-y-1 text-gray-600/80 dark:text-white/50">
                <li>
                  Open{" "}
                  <a href="https://calendar.google.com/calendar/r/settings"
                    target="_blank" rel="noopener noreferrer"
                    className="underline font-medium"
                    style={{ color: "rgba(66,133,244,0.9)" }}>
                    Google Calendar Settings
                  </a>
                </li>
                <li>Click your calendar name on the left sidebar</li>
                <li>Scroll down to <strong>"Secret address in iCal format"</strong></li>
                <li>Copy the URL and paste it below</li>
              </ol>
              <div className="pt-1 text-gray-500/60 dark:text-white/30">
                Your calendar stays private — the URL is only stored locally.
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={icalInput} onChange={(e) => setIcalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connectIcal()}
              placeholder="https://calendar.google.com/calendar/ical/..."
              className="input-field text-xs" />
            <button onClick={connectIcal} className="btn-primary text-xs whitespace-nowrap">Connect</button>
          </div>
          <button onClick={() => setShowSetup(false)} className="text-[10px] text-gray-400/60 dark:text-white/25">Cancel</button>
        </div>
      )}

      {/* Add local event */}
      {showAddEvent && (
        <div className="glass rounded-xl p-3 space-y-2">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddEvent()}
            placeholder="Event title" className="input-field text-xs" />
          <div className="flex gap-2">
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input-field text-xs" />
            <label className="flex items-center gap-1 text-[11px] text-gray-500/70 dark:text-white/40 whitespace-nowrap">
              <input type="checkbox" checked={newAllDay} onChange={(e) => setNewAllDay(e.target.checked)} />
              All day
            </label>
          </div>
          {!newAllDay && (
            <div className="flex gap-2">
              <input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="input-field text-xs" />
              <input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} className="input-field text-xs" />
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500/60 dark:text-white/30">Color:</span>
            {SIDE_CALENDAR_EVENT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                className="w-4 h-4 rounded-full transition-transform"
                style={{
                  background: c,
                  transform: newColor === c ? "scale(1.3)" : "scale(1)",
                  boxShadow: newColor === c ? `0 0 0 2px ${c}40` : "none",
                }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddEvent} className="btn-primary text-xs">Add</button>
            <button onClick={() => setShowAddEvent(false)} className="btn-ghost text-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* Calendar view selector + nav */}
      <div className="glass rounded-xl p-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1">
            {(["month", "week", "day"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`px-2 py-1 rounded-md text-[10px] capitalize ${view === mode ? "bg-blue-500/15 text-blue-700 dark:text-blue-200" : "text-gray-500 dark:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button type="button" className="btn-ghost text-xs !px-2 !py-1" onClick={() => stepMonth(-1)}>Prev</button>
          <button
            type="button"
            className="text-[12px] text-gray-600/80 dark:text-white/65 hover:text-blue-600/80 dark:hover:text-blue-300/80"
            onClick={() => {
              const anchor = parseDateKey(selectedDate);
              setMonthAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
              setView("month");
            }}
          >
            {monthLabel}
          </button>
          <button type="button" className="btn-ghost text-xs !px-2 !py-1" onClick={() => stepMonth(1)}>Next</button>
        </div>
      </div>

      {/* Month view */}
      {view === "month" ? (
        <div className="glass rounded-xl p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map((day) => (
              <div key={day} className="text-[10px] text-center text-gray-400/60 dark:text-white/30">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((date) => {
              const key = toDateKey(date);
              const isCurrentMonth = date.getMonth() === monthAnchor.getMonth();
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              const eventCount = filteredByDate.get(key)?.length ?? 0;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => {
                    setSelectedDate(key);
                    setView("day");
                  }}
                  className={`rounded-lg py-1.5 px-1 text-center transition-colors ${isSelected ? "bg-blue-500/20 text-blue-700 dark:text-blue-200" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"} ${isCurrentMonth ? "text-gray-700/80 dark:text-white/65" : "text-gray-400/55 dark:text-white/25"}`}
                >
                  <div className={`text-[11px] ${isToday ? "font-semibold" : ""}`}>{date.getDate()}</div>
                  <div className="h-2 mt-0.5 flex items-center justify-center gap-0.5">
                    {eventCount > 0 ? Array.from({ length: Math.min(eventCount, 3) }).map((_, idx) => (
                      <span key={idx} className="w-1 h-1 rounded-full bg-blue-500/70" />
                    )) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Week view */}
      {view === "week" ? (
        <div className="glass rounded-xl p-3">
          <div className="space-y-1.5">
            {weekDates.map((date) => {
              const key = toDateKey(date);
              const eventsForDate = filteredByDate.get(key) ?? [];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDate(key);
                    setView("day");
                  }}
                  className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${key === selectedDate ? "bg-blue-500/15 dark:bg-blue-400/15" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-700/80 dark:text-white/65">
                      {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-[10px] text-gray-400/60 dark:text-white/30">{eventsForDate.length} event{eventsForDate.length === 1 ? "" : "s"}</span>
                  </div>
                  {eventsForDate.slice(0, 2).map((event) => (
                    <div key={`${event.source}-${event.id}`} className="text-[11px] text-gray-500/70 dark:text-white/45 truncate mt-0.5">
                      {event.title}
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Day view */}
      {view === "day" ? (
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView("week")} className="btn-ghost text-xs !px-2 !py-1">Week</button>
            <div className="text-[12px] text-gray-700/80 dark:text-white/65">{selectedDateObj.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
            <button type="button" onClick={() => setView("month")} className="btn-ghost text-xs !px-2 !py-1">Month</button>
          </div>
          {dayEvents.length === 0 ? (
            <div className="text-center text-gray-400/40 dark:text-white/15 text-sm py-4">No events</div>
          ) : (
            <div className="space-y-1.5">
              {dayEvents.map((event) => (
                <div key={`${event.source}-${event.id}`} className="rounded-lg px-2.5 py-2 bg-black/[0.02] dark:bg-white/[0.03] group">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: event.color || "#6366F1" }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-gray-700/85 dark:text-white/70 truncate">{event.title}</div>
                      <div className="text-[10px] text-gray-400/60 dark:text-white/28">
                        {event.allDay ? "All day" : `${event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${event.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} · {event.source === "google" ? "Google" : "Local"}
                      </div>
                    </div>
                    {event.source === "local" && (
                      <button onClick={() => handleRemoveLocal(event.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400/40 hover:text-red-400/70 transition-all shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Filters & upcoming */}
      <div className="glass rounded-xl p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">Agenda Filters</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CALENDAR_FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => toggleFilter(chip.id)}
              className={`px-2 py-1 rounded-md text-[10px] transition-colors ${activeFilters.includes(chip.id) ? "bg-blue-500/15 text-blue-700 dark:text-blue-200" : "text-gray-500 dark:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">Upcoming</div>
        {loading && upcomingEvents.length === 0 ? <div className="text-center text-gray-400/40 dark:text-white/15 text-sm py-4">Loading...</div> : null}
        {!loading && upcomingEvents.length === 0 ? <div className="text-center text-gray-400/40 dark:text-white/15 text-sm py-4">No upcoming events</div> : null}
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {upcomingEvents.map((event) => (
            <div key={`${event.source}-${event.id}`} className="rounded-lg px-2.5 py-2 bg-black/[0.02] dark:bg-white/[0.03]">
              <div className="text-[12px] font-medium text-gray-700/85 dark:text-white/70 truncate">{event.title}</div>
              <div className="text-[10px] text-gray-400/60 dark:text-white/28">
                {event.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {event.allDay ? "All day" : event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {event.source === "google" ? "Google" : "Local"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button" onClick={fetchEvents} className="btn-ghost text-xs self-center">Refresh events</button>
    </div>
  );
}

// ─── Bookmarks ─────────────────────────────────────────────────────────────────

function SideBookmarksPanel() {
  const [search, setSearch] = useState("");
  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <div className="glass rounded-xl p-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter bookmarks..." className="input-field text-sm !py-2" />
      </div>
      <div className="flex-1 min-h-0">
        <div className="h-full min-h-0">
          <BookmarksGrid filter={search} isSidebar />
        </div>
      </div>
    </div>
  );
}

// ─── Greeting ──────────────────────────────────────────────────────────────────

interface FocusOfDayState {
  date: string;
  text: string;
}

// ── Focus text effect helpers ───────────────────────────────────────────────

const FOCUS_ANIM_COUNT = 10;
const FOCUS_ANIM_NAMES = ["Typewriter", "Flood", "Wave", "Glitch", "Scramble", "Blur", "Stamp", "Neon", "Skew", "Split"] as const;
const SCRAMBLE_CHARS = "!@#$%&ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?*";
const sc = () => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];

function FocusTypewriter({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  useEffect(() => { setShown(""); setPhase("in"); }, [text]);
  useEffect(() => {
    if (phase === "in") {
      if (shown.length < text.length) {
        const id = setTimeout(() => setShown(text.slice(0, shown.length + 1)), 90);
        return () => clearTimeout(id);
      }
      const id = setTimeout(() => setPhase("hold"), 1200);
      return () => clearTimeout(id);
    }
    if (phase === "hold") {
      const id = setTimeout(() => setPhase("out"), 600);
      return () => clearTimeout(id);
    }
    if (phase === "out") {
      if (shown.length > 0) {
        const id = setTimeout(() => setShown(shown.slice(0, -1)), 52);
        return () => clearTimeout(id);
      }
      const id = setTimeout(() => setPhase("in"), 380);
      return () => clearTimeout(id);
    }
  }, [shown, phase, text]);
  return (
    <p className="text-[22px] font-bold text-gray-800 dark:text-white/90 tracking-tight font-mono">
      {shown}
      <span className="inline-block w-[2px] h-[1.1em] bg-current ml-0.5 align-middle" style={{ animation: "fw-cursor-blink 0.75s step-end infinite" }} />
    </p>
  );
}

function FocusFlood({ text }: { text: string }) {
  const MAX = 36;
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"fill" | "hold" | "wipe">("fill");
  useEffect(() => { setCount(0); setPhase("fill"); }, [text]);
  useEffect(() => {
    if (phase === "fill") {
      if (count < MAX) {
        const id = setTimeout(() => setCount((c) => c + 1), 55);
        return () => clearTimeout(id);
      }
      const id = setTimeout(() => setPhase("hold"), 350);
      return () => clearTimeout(id);
    }
    if (phase === "hold") {
      const id = setTimeout(() => setPhase("wipe"), 500);
      return () => clearTimeout(id);
    }
    if (phase === "wipe") {
      if (count > 0) {
        const id = setTimeout(() => setCount((c) => Math.max(0, c - 3)), 28);
        return () => clearTimeout(id);
      }
      const id = setTimeout(() => setPhase("fill"), 350);
      return () => clearTimeout(id);
    }
  }, [phase, count]);
  return (
    <div className="relative w-full min-h-[88px] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 flex flex-wrap content-start gap-x-2 gap-y-1.5 p-3 overflow-hidden pointer-events-none select-none">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="text-[10px] font-semibold text-gray-400/40 dark:text-white/18 whitespace-nowrap uppercase tracking-wide">
            {text}
          </span>
        ))}
      </div>
      <p className="relative z-10 text-[22px] font-bold text-gray-800 dark:text-white/90 select-none">{text}</p>
    </div>
  );
}

function FocusWave({ text }: { text: string }) {
  return (
    <p className="text-[22px] font-bold text-gray-800 dark:text-white/90 tracking-tight select-none">
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="inline-block"
          style={{ animation: "fw-letter-wave 1.35s ease-in-out infinite", animationDelay: `${i * 0.06}s` }}
        >
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </p>
  );
}

function FocusGlitch({ text }: { text: string }) {
  return (
    <div className="relative inline-flex items-center justify-center select-none">
      <p className="text-[22px] font-bold text-gray-800 dark:text-white/90">{text}</p>
      <p
        className="absolute inset-0 flex items-center justify-center text-[22px] font-bold text-red-500/65 pointer-events-none"
        style={{ animation: "fw-glitch-1 2.2s infinite linear", clipPath: "polygon(0 16%, 100% 16%, 100% 40%, 0 40%)" }}
      >{text}</p>
      <p
        className="absolute inset-0 flex items-center justify-center text-[22px] font-bold text-cyan-500/65 pointer-events-none"
        style={{ animation: "fw-glitch-2 2.2s infinite linear", clipPath: "polygon(0 60%, 100% 60%, 100% 84%, 0 84%)" }}
      >{text}</p>
    </div>
  );
}

function FocusScramble({ text }: { text: string }) {
  const [chars, setChars] = useState<string[]>(() => text.split("").map(sc));
  const [locked, setLocked] = useState(0);
  const [mode, setMode] = useState<"lock" | "hold" | "shake">("lock");
  useEffect(() => { setChars(text.split("").map(sc)); setLocked(0); setMode("lock"); }, [text]);
  useEffect(() => {
    if (mode === "lock") {
      if (locked >= text.length) {
        const id = setTimeout(() => setMode("hold"), 1500);
        return () => clearTimeout(id);
      }
      const id = setTimeout(() => {
        const next = locked + 1;
        setLocked(next);
        setChars(text.split("").map((ch, i) => i < next ? ch : sc()));
      }, 82);
      return () => clearTimeout(id);
    }
    if (mode === "hold") {
      const id = setTimeout(() => setMode("shake"), 400);
      return () => clearTimeout(id);
    }
    if (mode === "shake") {
      const tick = setInterval(() => setChars(text.split("").map(sc)), 52);
      const done = setTimeout(() => { clearInterval(tick); setLocked(0); setMode("lock"); }, 650);
      return () => { clearInterval(tick); clearTimeout(done); };
    }
  }, [mode, locked, text]);
  return (
    <p className="text-[22px] font-bold font-mono tracking-wider text-gray-800 dark:text-white/90 select-none">
      {chars.map((ch, i) => (
        <span key={i} className={i < locked ? "text-gray-800 dark:text-white/90" : "text-gray-400/55 dark:text-white/28"}>
          {text[i] === " " ? "\u00a0" : ch}
        </span>
      ))}
    </p>
  );
}

function FocusBlur({ text }: { text: string }) {
  return (
    <p className="text-[22px] font-bold text-gray-800 dark:text-white/90 select-none"
       style={{ animation: "fw-blur-breathe 2.6s ease-in-out infinite" }}>
      {text}
    </p>
  );
}

function FocusStamp({ text }: { text: string }) {
  return (
    <div style={{ animation: "fw-stamp 3.6s ease-in-out infinite" }}>
      <p className="text-[26px] font-black tracking-tight text-gray-800 dark:text-white/90 select-none uppercase">{text}</p>
    </div>
  );
}

function FocusNeon({ text }: { text: string }) {
  return (
    <p className="text-[22px] font-bold text-gray-800 dark:text-white/90 select-none"
       style={{ animation: "fw-neon-flicker 2.8s infinite linear" }}>
      {text}
    </p>
  );
}

function FocusSkew({ text }: { text: string }) {
  return (
    <div className="w-full overflow-hidden flex items-center justify-center">
      <p className="text-[22px] font-bold text-gray-800 dark:text-white/90 select-none whitespace-nowrap"
         style={{ animation: "fw-skew-slide 4s ease-in-out infinite" }}>
        {text}
      </p>
    </div>
  );
}

function FocusSplit({ text }: { text: string }) {
  return (
    <div className="relative select-none" style={{ lineHeight: 1.15 }}>
      <p className="text-[22px] font-bold text-gray-800 dark:text-white/90 invisible">{text}</p>
      <p className="absolute top-0 left-0 w-full text-center text-[22px] font-bold text-gray-800 dark:text-white/90"
         style={{ clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)", animation: "fw-split-top 2.6s ease-in-out infinite" }}>
        {text}
      </p>
      <p className="absolute top-0 left-0 w-full text-center text-[22px] font-bold text-gray-800 dark:text-white/90"
         style={{ clipPath: "polygon(0 50%, 100% 50%, 100% 100%, 0 100%)", animation: "fw-split-bot 2.6s ease-in-out infinite" }}>
        {text}
      </p>
    </div>
  );
}

function FocusTextEffect({ text, mode }: { text: string; mode: number }) {
  if (mode === 0) return <FocusTypewriter text={text} />;
  if (mode === 1) return <FocusFlood text={text} />;
  if (mode === 2) return <FocusWave text={text} />;
  if (mode === 3) return <FocusGlitch text={text} />;
  if (mode === 4) return <FocusScramble text={text} />;
  if (mode === 5) return <FocusBlur text={text} />;
  if (mode === 6) return <FocusStamp text={text} />;
  if (mode === 7) return <FocusNeon text={text} />;
  if (mode === 8) return <FocusSkew text={text} />;
  return <FocusSplit text={text} />;
}

function SideGreetingPanel() {
  const [now, setNow] = useState(new Date());
  const [focusInput, setFocusInput] = useState("");
  const [focusEditing, setFocusEditing] = useState(false);
  const [animMode, setAnimMode] = useState(0);
  const [focus, setFocus] = useState<FocusOfDayState>(() => {
    const today = toDateKey(new Date());
    try {
      const raw = localStorage.getItem(FOCUS_OF_DAY_KEY);
      if (!raw) return { date: today, text: "" };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.text !== "string" || typeof parsed.date !== "string") {
        return { date: today, text: "" };
      }
      if (parsed.date !== today) {
        return { date: today, text: "" };
      }
      return { date: parsed.date, text: parsed.text };
    } catch {
      return { date: today, text: "" };
    }
  });
  const [worldClocks, setWorldClocks] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(WORLD_CLOCKS_KEY);
      if (!raw) return ["America/New_York", "Europe/London"];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return ["America/New_York", "Europe/London"];
      return parsed.filter((value): value is string => typeof value === "string");
    } catch {
      return ["America/New_York", "Europe/London"];
    }
  });
  const [selectedTimezone, setSelectedTimezone] = useState(WORLD_CLOCK_PRESETS[0].value);
  const [customTimezone, setCustomTimezone] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem(FOCUS_OF_DAY_KEY, JSON.stringify(focus));
  }, [focus]);

  useEffect(() => {
    localStorage.setItem(WORLD_CLOCKS_KEY, JSON.stringify(worldClocks));
  }, [worldClocks]);

  useEffect(() => {
    if (!focus.text) return;
    const id = window.setInterval(() => {
      setAnimMode((prev) => {
        let next = prev;
        while (next === prev) next = Math.floor(Math.random() * FOCUS_ANIM_COUNT);
        return next;
      });
    }, 5500);
    return () => window.clearInterval(id);
  }, [focus.text]);

  useEffect(() => {
    const today = toDateKey(now);
    if (today === focus.date) return;
    if (focus.text.trim()) {
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 2800);
    }
    setFocus({ date: today, text: "" });
    setFocusEditing(false);
  }, [now, focus]);

  const addFocus = () => {
    const text = focusInput.trim();
    if (!text) return;
    setFocus({ date: toDateKey(now), text });
    setFocusInput("");
    setFocusEditing(false);
  };

  const clearFocus = () => {
    setFocus({ date: toDateKey(now), text: "" });
    setFocusEditing(false);
  };

  const addTimezone = (timezone: string) => {
    const value = timezone.trim();
    if (!value || worldClocks.includes(value)) return;
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: value }).format(new Date());
      setWorldClocks((prev) => [...prev, value]);
      setCustomTimezone("");
    } catch {
      // invalid timezone, ignore
    }
  };

  const removeTimezone = (timezone: string) => {
    setWorldClocks((prev) => prev.filter((item) => item !== timezone));
  };

  const countdown = formatCountdown(getNextMidnight(now).getTime() - now.getTime());
  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const hasFocus = Boolean(focus.text);

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
      <div className="glass rounded-xl p-5 relative overflow-hidden">
        {showConfetti ? (
          <div className="focus-confetti" aria-hidden="true">
            {Array.from({ length: 26 }, (_, idx) => (
              <span key={idx} className="focus-confetti-piece" style={{ left: `${(idx * 37) % 100}%`, animationDelay: `${(idx % 7) * 0.08}s` }} />
            ))}
          </div>
        ) : null}
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-800 dark:text-white/90 tabular-nums">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
          <div className="text-sm text-gray-500 dark:text-white/50 mt-1">{dateStr}</div>
        </div>
        <div className="mt-4 rounded-xl px-3 py-2 bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 dark:border-blue-400/20">
          <div className="text-[10px] uppercase tracking-wide text-blue-700/80 dark:text-blue-200/75">Countdown to reset</div>
          <div className="text-lg font-semibold text-blue-700/90 dark:text-blue-100/90 tabular-nums">{countdown}</div>
        </div>
      </div>

      {/* Focus of the day — full-card text animation when active */}
      {hasFocus && !focusEditing ? (
        <div className="glass rounded-2xl relative overflow-hidden flex flex-col items-center justify-center px-5 py-8 text-center min-h-[180px]">
          {/* label */}
          <div className="text-[9px] uppercase tracking-[0.28em] font-bold text-gray-400/55 dark:text-white/28 mb-4 select-none">
            Focus on
          </div>

          {/* animated text — key forces remount + fade-in on each mode change */}
          <div
            key={animMode}
            className="flex items-center justify-center w-full px-4"
            style={{ animation: "fw-mode-enter 0.55s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            <FocusTextEffect text={focus.text} mode={animMode} />
          </div>

          {/* edit pencil */}
          <button
            type="button"
            onClick={() => { setFocusInput(focus.text); setFocusEditing(true); }}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg inline-flex items-center justify-center bg-black/[0.05] dark:bg-white/[0.08] text-gray-500/60 dark:text-white/35 hover:bg-black/[0.1] dark:hover:bg-white/[0.15] hover:text-gray-700 dark:hover:text-white/70 transition-colors"
            aria-label="Edit focus"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="glass rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">Focus of the day</div>
          <form onSubmit={(e) => { e.preventDefault(); addFocus(); }} className="flex gap-2 mb-2">
            <input
              autoFocus={focusEditing}
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
              placeholder="What's your one focus today?"
              className="input-field text-sm !py-2"
            />
            <button type="submit" className="btn-primary text-xs px-3 py-2">Set</button>
          </form>
          {focusEditing && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setFocusEditing(false)} className="btn-ghost text-xs">Cancel</button>
              <button type="button" onClick={clearFocus} className="text-[11px] text-red-400/70 hover:text-red-500 px-1">Clear focus</button>
            </div>
          )}
          {!focusEditing && !hasFocus && (
            <div className="text-center text-gray-400/40 dark:text-white/15 text-[12px] py-2">Set one clear priority for today</div>
          )}
        </div>
      )}

      <div className="glass rounded-xl p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500/80 dark:text-white/45 mb-2">World clocks</div>
        <div className="flex gap-2 mb-2">
          <select value={selectedTimezone} onChange={(e) => setSelectedTimezone(e.target.value)} className="input-field text-xs !py-2 !px-2">
            {WORLD_CLOCK_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => addTimezone(selectedTimezone)} className="btn-primary text-xs px-3 py-2">Add</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); addTimezone(customTimezone); }} className="flex gap-2 mb-2">
          <input value={customTimezone} onChange={(e) => setCustomTimezone(e.target.value)} placeholder="Custom timezone (e.g. Asia/Tehran)" className="input-field text-xs !py-2" />
          <button type="submit" className="btn-ghost text-xs">Use</button>
        </form>
        <div className="space-y-1.5">
          {worldClocks.map((timezone) => (
            <div key={timezone} className="rounded-lg px-3 py-2 bg-black/[0.02] dark:bg-white/[0.04] flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-gray-500/70 dark:text-white/40 truncate">{timezone.replace(/_/g, " ")}</div>
                <div className="text-[13px] text-gray-700/85 dark:text-white/65 font-medium tabular-nums">
                  {new Intl.DateTimeFormat(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZone: timezone,
                  }).format(now)}
                </div>
              </div>
              <button type="button" onClick={() => removeTimezone(timezone)} className="text-[10px] text-red-400/70 hover:text-red-500">Remove</button>
            </div>
          ))}
          {worldClocks.length === 0 ? <div className="text-center text-gray-400/40 dark:text-white/15 text-[12px] py-2">Add clocks for multiple countries</div> : null}
        </div>
      </div>
    </div>
  );
}

// ─── Router ────────────────────────────────────────────────────────────────────

export default function SideWidgetPanelContent({ widget, side }: SideWidgetPanelContentProps) {
  if (widget === "homelab") return <HomelabWidget />;
  if (widget === "search") return <SideSearchPanel side={side} />;
  if (widget === "weather") return <SideWeatherPanel />;
  if (widget === "tasks") return <SideTasksPanel />;
  if (widget === "quotes") return <SideQuotesPanel />;
  if (widget === "calendar") return <SideCalendarPanel />;
  if (widget === "bookmarks") return <SideBookmarksPanel />;
  if (widget === "greeting") return <SideGreetingPanel />;
  return null;
}
