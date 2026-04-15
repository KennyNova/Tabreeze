import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  WeatherData,
  GeocodingResult,
  WeatherSettings,
  HourlyForecast,
  fetchWeather,
  getWeatherSettings,
  saveWeatherSettings,
  searchCity,
  getWeatherDescription,
  getWeatherIcon,
  getAqiLabel,
} from "../services/weather";

function formatDay(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tmrw";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function formatDayLong(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatHour(timeStr: string): string {
  const hour = parseInt(timeStr.slice(11, 13), 10);
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

function getWeatherTheme(code: number): "clear" | "cloud" | "fog" | "rain" | "snow" | "storm" {
  if (code >= 95) return "storm";
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return "snow";
  if (code === 51 || code === 53 || code === 55 || code === 61 || code === 63 || code === 65 || code === 80 || code === 81 || code === 82) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code === 1 || code === 2 || code === 3) return "cloud";
  return "clear";
}

function getAqiTone(aqi: number | null): string {
  if (aqi === null) return "text-gray-500/70 dark:text-white/50";
  if (aqi <= 50) return "text-emerald-600/85 dark:text-emerald-300";
  if (aqi <= 100) return "text-amber-600/85 dark:text-amber-300";
  return "text-rose-600/85 dark:text-rose-300";
}

const PANEL_W = 320;

interface DayDetailData {
  date: string;
  dayIndex: number;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  hourly: HourlyForecast[];
  unit: "C" | "F";
}

function TempLineGraph({
  hours,
  hourlyMin,
  hourlyRange,
  graphId,
}: {
  hours: HourlyForecast[];
  hourlyMin: number;
  hourlyRange: number;
  graphId: string;
}) {
  if (hours.length < 2) return null;

  const w = 100;
  const h = 100;
  const padY = 8;
  const usableH = h - padY * 2;

  const points = hours.map((hr, i) => {
    const x = (i / (hours.length - 1)) * w;
    const pct = (hr.temperature - hourlyMin) / hourlyRange;
    const y = padY + usableH * (1 - pct);
    return { x, y };
  });

  const line = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  const fill = `${line} L${w},${h} L0,${h} Z`;

  const stops: { offset: string; color: string }[] = [];
  for (let i = 0; i < hours.length; i++) {
    const pct = (hours[i].temperature - hourlyMin) / hourlyRange;
    const offset = `${((i / (hours.length - 1)) * 100).toFixed(1)}%`;
    const r = Math.round(60 + pct * 195);
    const g = Math.round(130 + pct * 40 - pct * pct * 80);
    const b = Math.round(250 - pct * 200);
    stops.push({ offset, color: `rgb(${r},${g},${b})` });
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full temp-line-graph"
    >
      <defs>
        <linearGradient id={`${graphId}-line`} x1="0" x2="1" y1="0" y2="0">
          {stops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
        <linearGradient id={`${graphId}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
        <mask id={`${graphId}-mask`}>
          <rect width={w} height={h} fill="white" />
        </mask>
      </defs>
      <path
        d={fill}
        fill={`url(#${graphId}-fill)`}
        style={{ color: stops[Math.floor(stops.length / 2)]?.color }}
        opacity="0.5"
      />
      <path
        d={line}
        fill="none"
        stroke={`url(#${graphId}-line)`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="1.2"
          fill={stops[i]?.color ?? "#888"}
          opacity="0.7"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function InlineDayDetail({
  day,
  onClose,
  isCompact,
}: {
  day: DayDetailData;
  onClose: () => void;
  isCompact: boolean;
}) {
  const [hoveredHour, setHoveredHour] = useState<HourlyForecast | null>(null);
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 200);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const theme = getWeatherTheme(day.weatherCode);
  const displayHours = isCompact
    ? day.hourly.filter((_, i) => i % 3 === 0)
    : day.hourly.filter((_, i) => i % 2 === 0);
  const hourlyMin = day.hourly.length > 0 ? Math.min(...day.hourly.map((h) => h.temperature)) : day.tempMin;
  const hourlyMax = day.hourly.length > 0 ? Math.max(...day.hourly.map((h) => h.temperature)) : day.tempMax;
  const hourlyRange = Math.max(hourlyMax - hourlyMin, 1);

  const active = hoveredHour ?? null;

  if (isCompact) {
    return (
      <div
        className={`absolute inset-0 z-10 rounded-xl overflow-hidden day-detail-inline ${
          closing ? "day-detail-inline--closing" : "day-detail-inline--open"
        }`}
        style={{
          background: "color-mix(in srgb, var(--theme-surface) 92%, transparent)",
          backdropFilter: "blur(30px) saturate(1.5)",
        }}
      >
        <div className={`weather-widget weather-widget--${theme} h-full flex flex-col p-1.5 rounded-xl`}>
          {/* Compact: single header line + hourly bars below */}
          <div className="flex items-center gap-1.5 mb-1 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="w-4 h-4 rounded bg-black/[0.06] dark:bg-white/[0.1] flex items-center justify-center hover:bg-black/[0.12] dark:hover:bg-white/[0.18] transition-colors shrink-0"
              aria-label="Back"
            >
              <svg className="w-2.5 h-2.5 text-gray-600/80 dark:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[9px] font-semibold text-gray-700/80 dark:text-white/75 truncate">
              {formatDay(day.date, day.dayIndex)}
            </span>
            <span className="text-[9px] tabular-nums text-gray-500/60 dark:text-white/45">
              {day.tempMax}°/{day.tempMin}°
            </span>
            {active && (
              <span className="text-[9px] tabular-nums font-medium text-gray-800/85 dark:text-white/85 ml-auto day-detail-tooltip">
                {formatHour(active.time)} {active.temperature}°{day.unit}
              </span>
            )}
          </div>

          {/* Hourly bars with line graph */}
          <div className="flex-1 min-h-0 relative">
            <TempLineGraph hours={displayHours} hourlyMin={hourlyMin} hourlyRange={hourlyRange} graphId="compact-temp" />
            <div className="relative z-[1] h-full flex items-end gap-0">
              {displayHours.map((h, i) => {
                const isHovered = active?.time === h.time;
                return (
                  <div
                    key={h.time}
                    className={`day-detail-hour flex flex-col items-center justify-end flex-1 min-w-0 cursor-pointer transition-all duration-150 h-full ${
                      isHovered ? "opacity-100" : active ? "opacity-40" : "opacity-100"
                    }`}
                    style={{ animationDelay: `${i * 25}ms` }}
                    onMouseEnter={() => setHoveredHour(h)}
                    onMouseLeave={() => setHoveredHour(null)}
                  >
                    <span className={`text-[7px] tabular-nums leading-none transition-colors mt-auto ${
                      isHovered ? "text-gray-800/90 dark:text-white/90 font-bold" : "text-gray-400/50 dark:text-white/30"
                    }`}>
                      {formatHour(h.time)}
                    </span>
                    <span className={`text-[7px] tabular-nums leading-none transition-colors mt-0.5 ${
                      isHovered ? "text-gray-800/90 dark:text-white/90 font-bold" : "text-gray-500/50 dark:text-white/40"
                    }`}>
                      {h.temperature}°
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute inset-0 z-10 rounded-xl overflow-hidden day-detail-inline ${
        closing ? "day-detail-inline--closing" : "day-detail-inline--open"
      }`}
      style={{
        background: "color-mix(in srgb, var(--theme-surface) 92%, transparent)",
        backdropFilter: "blur(30px) saturate(1.5)",
      }}
    >
      <div className={`weather-widget weather-widget--${theme} h-full flex flex-col p-2.5 rounded-xl`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-1 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="w-5 h-5 rounded-md bg-black/[0.06] dark:bg-white/[0.1] flex items-center justify-center hover:bg-black/[0.12] dark:hover:bg-white/[0.18] transition-colors shrink-0"
            aria-label="Back"
          >
            <svg className="w-3 h-3 text-gray-600/80 dark:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-[11px] font-semibold text-gray-800/85 dark:text-white/80 truncate">
            {formatFullDate(day.date)}
          </span>
          <span className="text-[10px] tabular-nums text-gray-500/55 dark:text-white/40 shrink-0">
            {day.tempMax}° / {day.tempMin}°
          </span>
          <span className={`weather-icon weather-icon--${theme} text-base leading-none shrink-0 ml-auto`}>
            {getWeatherIcon(day.weatherCode, true)}
          </span>
        </div>

        {/* Hover tooltip */}
        <div className="h-5 shrink-0 mb-1 flex items-center">
          {active ? (
            <div className="day-detail-tooltip flex items-center gap-2.5 text-[10px] w-full">
              <span className="font-semibold text-gray-700/85 dark:text-white/80">{formatHour(active.time)}</span>
              <span className="text-sm leading-none">{getWeatherIcon(active.weatherCode, true)}</span>
              <span className="tabular-nums font-medium text-gray-700/85 dark:text-white/80">{active.temperature}°{day.unit}</span>
              <span className="text-gray-500/55 dark:text-white/40">💨 {active.windSpeed}</span>
              <span className="text-gray-500/55 dark:text-white/40">💧 {active.humidity}%</span>
              {active.precipitationProbability > 0 && (
                <span className="text-blue-500/75 dark:text-blue-300/75 tabular-nums">🌧 {active.precipitationProbability}%</span>
              )}
            </div>
          ) : (
            <span className="text-[9px] text-gray-400/45 dark:text-white/25">Hover an hour for details</span>
          )}
        </div>

        {/* Hourly timeline with line graph */}
        <div className="flex-1 min-h-0 relative">
          <TempLineGraph hours={displayHours} hourlyMin={hourlyMin} hourlyRange={hourlyRange} graphId="full-temp" />
          <div className="relative z-[1] h-full flex items-end overflow-x-auto gap-0 pb-0.5">
            {displayHours.map((h, i) => {
              const isHovered = active?.time === h.time;
              return (
                <div
                  key={h.time}
                  className={`day-detail-hour flex flex-col items-center justify-end flex-1 min-w-[24px] cursor-pointer transition-all duration-150 h-full ${
                    isHovered ? "opacity-100" : active ? "opacity-40" : "opacity-100"
                  }`}
                  style={{ animationDelay: `${i * 30}ms` }}
                  onMouseEnter={() => setHoveredHour(h)}
                  onMouseLeave={() => setHoveredHour(null)}
                >
                  <span className={`text-[8px] tabular-nums leading-none transition-colors mt-auto ${
                    isHovered ? "text-gray-800/90 dark:text-white/90 font-semibold" : "text-gray-500/45 dark:text-white/30"
                  }`}>
                    {formatHour(h.time)}
                  </span>
                  <span className="text-xs weather-forecast-icon leading-none mt-0.5" style={{ animationDelay: `${i * 30 + 50}ms` }}>
                    {getWeatherIcon(h.weatherCode, true)}
                  </span>
                  <span className={`text-[9px] tabular-nums mt-0.5 leading-none transition-colors ${
                    isHovered ? "text-gray-800/90 dark:text-white/90 font-bold" : "text-gray-600/65 dark:text-white/50 font-medium"
                  }`}>
                    {h.temperature}°
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface WeatherWidgetProps {
  tileId?: string;
  rowSpan?: number;
  colSpan?: number;
}

function ForecastCard({
  day,
  index,
  globalMin,
  tempRange,
  compact,
  delay,
  onClick,
}: {
  day: { date: string; weatherCode: number; tempMax: number; tempMin: number; precipitationProbability: number };
  index: number;
  globalMin: number;
  tempRange: number;
  compact?: boolean;
  delay: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const minPct = ((day.tempMin - globalMin) / tempRange) * 100;
  const maxPct = ((day.tempMax - globalMin) / tempRange) * 100;

  return (
    <div
      className={`forecast-day-card group flex items-center gap-2 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2 py-1.5 transition-colors ${
        onClick ? "cursor-pointer hover:bg-black/[0.08] dark:hover:bg-white/[0.13] active:scale-[0.98]" : "hover:bg-black/[0.07] dark:hover:bg-white/[0.11]"
      }`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <span className="w-[38px] text-[11px] font-medium text-gray-600/80 dark:text-white/60 shrink-0">
        {compact ? formatDay(day.date, index) : formatDayLong(day.date, index)}
      </span>
      <span className="text-sm w-5 text-center shrink-0 weather-forecast-icon" style={{ animationDelay: `${delay + 100}ms` }}>
        {getWeatherIcon(day.weatherCode, true)}
      </span>
      <span className="w-6 text-[10px] text-blue-500/75 dark:text-blue-300/80 text-right shrink-0">
        {day.precipitationProbability > 0 ? `${day.precipitationProbability}%` : ""}
      </span>
      <div className="flex-1 relative h-[3px] rounded-full bg-black/[0.08] dark:bg-white/[0.12] mx-0.5">
        <div
          className="absolute h-full rounded-full forecast-temp-bar"
          style={{
            left: `${minPct}%`,
            width: `${maxPct - minPct}%`,
            animationDelay: `${delay + 200}ms`,
          }}
        />
      </div>
      <span className="w-6 text-[11px] text-right text-gray-500/65 dark:text-white/50 shrink-0 tabular-nums">{day.tempMin}°</span>
      <span className="w-6 text-[11px] text-right text-gray-700/80 dark:text-white/75 shrink-0 tabular-nums font-medium">{day.tempMax}°</span>
    </div>
  );
}

function ForecastColumn({
  day,
  index,
  delay,
  onClick,
}: {
  day: { date: string; weatherCode: number; tempMax: number; tempMin: number; precipitationProbability: number };
  index: number;
  delay: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`forecast-day-card flex flex-col items-center gap-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.07] px-1.5 py-2 transition-all flex-1 min-w-0 ${
        onClick ? "cursor-pointer hover:bg-black/[0.08] dark:hover:bg-white/[0.13] active:scale-[0.97]" : "hover:bg-black/[0.07] dark:hover:bg-white/[0.11]"
      }`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <span className="text-[10px] font-medium text-gray-500/70 dark:text-white/50">{formatDay(day.date, index)}</span>
      <span className="text-base weather-forecast-icon" style={{ animationDelay: `${delay + 100}ms` }}>
        {getWeatherIcon(day.weatherCode, true)}
      </span>
      <span
        className={`text-[9px] leading-none min-h-[10px] ${
          day.precipitationProbability > 0
            ? "text-blue-500/75 dark:text-blue-300/80"
            : "text-transparent select-none"
        }`}
      >
        {day.precipitationProbability > 0 ? `${day.precipitationProbability}%` : "0%"}
      </span>
      <div className="flex flex-col items-center">
        <span className="text-[11px] font-medium text-gray-700/80 dark:text-white/75 tabular-nums">{day.tempMax}°</span>
        <span className="text-[10px] text-gray-500/55 dark:text-white/45 tabular-nums">{day.tempMin}°</span>
      </div>
    </div>
  );
}

export default function WeatherWidget({ tileId, rowSpan = 1, colSpan = 4 }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  const [selectedDay, setSelectedDay] = useState<DayDetailData | null>(null);

  const [unit, setUnit] = useState<"C" | "F">("C");
  const [customLat, setCustomLat] = useState<number | undefined>();
  const [customLon, setCustomLon] = useState<number | undefined>();
  const [customCity, setCustomCity] = useState<string | undefined>();

  const [locationSearch, setLocationSearch] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadWeather = async (settings: WeatherSettings, forceRefresh = false) => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchWeather(settings, forceRefresh);
      setWeather(data);
    } catch (err: any) {
      setError(err?.code === 1 ? "Location access denied" : "Unable to load weather");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const settings = getWeatherSettings();
    setUnit(settings.unit);
    if (settings.customLat !== undefined) {
      setCustomLat(settings.customLat);
      setCustomLon(settings.customLon);
      setCustomCity(settings.customCity);
    }
    loadWeather(settings);
  }, []);

  const clampPanelPos = (top: number, left: number) => {
    const maxLeft = Math.max(8, window.innerWidth - PANEL_W - 8);
    const maxTop = Math.max(8, window.innerHeight - 16);
    return {
      top: Math.min(Math.max(8, top), maxTop),
      left: Math.min(Math.max(8, left - PANEL_W), maxLeft),
    };
  };

  useEffect(() => {
    const onOpenSettings = (event: Event) => {
      const customEvent = event as CustomEvent<{ tileId?: string; top: number; left: number }>;
      if (!customEvent.detail) return;
      if (!tileId || customEvent.detail.tileId !== tileId) return;
      setPanelPos(clampPanelPos(customEvent.detail.top, customEvent.detail.left));
      setOpen(true);
    };
    window.addEventListener("weather:open-settings", onOpenSettings as EventListener);
    return () => window.removeEventListener("weather:open-settings", onOpenSettings as EventListener);
  }, [tileId]);

  useEffect(() => {
    if (!open || !panelPos) return;
    const onResize = () => {
      setPanelPos((prev) => (prev ? clampPanelPos(prev.top, prev.left + PANEL_W) : prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, panelPos]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const applySettings = (newSettings: WeatherSettings) => {
    saveWeatherSettings(newSettings);
    loadWeather(newSettings, true);
  };

  const handleUnitChange = (newUnit: "C" | "F") => {
    setUnit(newUnit);
    applySettings({ unit: newUnit, customLat, customLon, customCity });
  };

  const handleLocationSelect = (result: GeocodingResult) => {
    const city = [result.name, result.admin1, result.country].filter(Boolean).join(", ");
    setCustomLat(result.latitude);
    setCustomLon(result.longitude);
    setCustomCity(city);
    setLocationSearch("");
    setSearchResults([]);
    applySettings({ unit, customLat: result.latitude, customLon: result.longitude, customCity: city });
    setOpen(false);
  };

  const handleCurrentLocation = () => {
    setCustomLat(undefined);
    setCustomLon(undefined);
    setCustomCity(undefined);
    setLocationSearch("");
    setSearchResults([]);
    applySettings({ unit });
    setOpen(false);
  };

  const handleSearch = async () => {
    if (!locationSearch.trim()) return;
    setSearchLoading(true);
    const results = await searchCity(locationSearch.trim());
    setSearchResults(results);
    setSearchLoading(false);
  };

  const handleDayClick = (dayData: typeof visibleForecast[number], dayIndex: number) => {
    if (!weather) return;
    setSelectedDay({
      ...dayData,
      dayIndex,
      unit: weather.unit,
    });
  };

  const isCompact = rowSpan === 1;
  const isTiny = isCompact && colSpan <= 2;
  const isWide = colSpan >= 7;
  const isSuperWide = colSpan >= 10;
  const isTall = rowSpan >= 3;

  const forecastDays = (() => {
    if (isCompact && colSpan <= 3) return 0;
    if (isCompact && colSpan <= 5) return 3;
    if (isCompact && colSpan <= 7) return 5;
    if (isCompact) return 7;
    if (isSuperWide) return 7;
    if (isWide) return 7;
    if (colSpan >= 5) return Math.min(7, rowSpan + 3);
    return Math.min(5, rowSpan + 2);
  })();

  const visibleForecast = weather ? weather.daily.slice(0, forecastDays) : [];
  const globalMin = visibleForecast.length > 0 ? Math.min(...visibleForecast.map((d) => d.tempMin)) : 0;
  const globalMax = visibleForecast.length > 0 ? Math.max(...visibleForecast.map((d) => d.tempMax)) : 1;
  const tempRange = Math.max(globalMax - globalMin, 1);
  const weatherTheme = weather ? getWeatherTheme(weather.weatherCode) : "clear";

  const popup =
    open &&
    panelPos &&
    createPortal(
      <>
        <div className="fixed inset-0 z-[100] bg-black/0" onClick={() => setOpen(false)} aria-hidden />
        <div
          className="fixed z-[101] w-80 rounded-2xl shadow-xl overflow-hidden"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            maxWidth: `min(${PANEL_W}px, calc(100vw - 16px))`,
            background: "color-mix(in srgb, var(--theme-surface) 90%, transparent)",
            backdropFilter: "blur(40px)",
            border: "1px solid color-mix(in srgb, var(--theme-border) 65%, transparent)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4">
            <div className="text-[13px] font-medium mb-4 theme-text-secondary">Weather settings</div>
            <div className="mb-5">
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-2 theme-text-secondary">Temperature Unit</div>
              <div className="flex gap-2">
                {(["C", "F"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleUnitChange(u)}
                    className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
                    style={{
                      background:
                        unit === u
                          ? "color-mix(in srgb, var(--theme-accent) 18%, transparent)"
                          : "color-mix(in srgb, var(--theme-surface-hover) 75%, transparent)",
                      color: unit === u ? "var(--theme-accent)" : "var(--theme-text-secondary)",
                      border:
                        unit === u
                          ? "1px solid color-mix(in srgb, var(--theme-accent) 36%, transparent)"
                          : "1px solid transparent",
                    }}
                  >
                    °{u}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-2 theme-text-secondary">Location</div>
              {customCity && (
                <div className="text-[12px] mb-2 px-1 truncate theme-text-secondary">Current: {customCity}</div>
              )}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search city..."
                  className="flex-1 px-3 py-2 rounded-xl text-[12px] outline-none"
                  style={{
                    color: "var(--theme-text)",
                    background: "color-mix(in srgb, var(--theme-surface-hover) 78%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--theme-border) 65%, transparent)",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searchLoading || !locationSearch.trim()}
                  className="px-3 py-2 rounded-xl text-[12px] transition-colors disabled:opacity-40"
                  style={{
                    background: "color-mix(in srgb, var(--theme-surface-hover) 78%, transparent)",
                    color: "var(--theme-text-secondary)",
                    border: "1px solid color-mix(in srgb, var(--theme-border) 65%, transparent)",
                  }}
                >
                  {searchLoading ? "..." : "Search"}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div
                  className="rounded-xl overflow-hidden mb-2"
                  style={{ border: "1px solid color-mix(in srgb, var(--theme-border) 65%, transparent)" }}
                >
                  {searchResults.map((r, i) => (
                    <button
                      key={`${r.latitude}-${r.longitude}-${i}`}
                      type="button"
                      onClick={() => handleLocationSelect(r)}
                      className="w-full text-left px-3 py-2.5 text-[12px] transition-colors hover:bg-black/5 flex items-center gap-2"
                      style={{
                        borderBottom:
                          i < searchResults.length - 1
                            ? "1px solid color-mix(in srgb, var(--theme-border) 55%, transparent)"
                            : "none",
                      }}
                    >
                      <span className="font-medium theme-text-secondary">{r.name}</span>
                      <span className="text-[11px] theme-text-secondary" style={{ opacity: 0.75 }}>
                        {[r.admin1, r.country].filter(Boolean).join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={handleCurrentLocation}
                className="text-[12px] py-1 transition-colors"
                style={{ color: "color-mix(in srgb, var(--theme-accent) 75%, transparent)" }}
              >
                Use current location
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    );

  const renderCurrentWeather = (size: "tiny" | "compact" | "normal" | "large") => {
    if (!weather) return null;
    const tempSize = size === "large" ? "text-4xl" : size === "normal" ? "text-3xl" : size === "compact" ? "text-xl" : "text-lg";
    const iconSize = size === "large" ? "text-4xl" : size === "normal" ? "text-3xl" : "text-2xl";

    return (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className={`${tempSize} font-light text-gray-700/85 dark:text-white/80 leading-none tabular-nums`}>
              {weather.temperature}°
            </span>
            {size !== "tiny" && (
              <span className="text-[11px] text-gray-500/55 dark:text-white/40">
                {weather.unit} · feels {weather.feelsLike}°
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-500/60 dark:text-white/45 mt-0.5 truncate">
            {getWeatherDescription(weather.weatherCode)}
          </div>
        </div>
        <span
          className={`weather-icon weather-icon--${weatherTheme} ${iconSize} leading-none shrink-0`}
          role="img"
          aria-label={getWeatherDescription(weather.weatherCode)}
        >
          {getWeatherIcon(weather.weatherCode, weather.isDay)}
        </span>
      </div>
    );
  };

  const renderMetrics = (layout: "inline" | "grid" | "row") => {
    if (!weather) return null;
    const items = [
      { label: "AQI", value: weather.airQuality.usAqi ?? "--", tone: getAqiTone(weather.airQuality.usAqi) },
      { label: "Humidity", value: `${weather.humidity}%`, tone: "text-gray-600/75 dark:text-white/60" },
      { label: "Wind", value: `${weather.windSpeed} km/h`, tone: "text-gray-600/75 dark:text-white/60" },
      { label: "Precip", value: `${weather.precipitation} mm`, tone: "text-gray-600/75 dark:text-white/60" },
    ];

    if (layout === "inline") {
      return (
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          {items.slice(0, 3).map((item) => (
            <span key={item.label} className={item.tone}>{item.label} {item.value}</span>
          ))}
        </div>
      );
    }

    if (layout === "row") {
      return (
        <div className="flex items-center gap-2 text-[10px]">
          {items.map((item) => (
            <div key={item.label} className={`rounded-md bg-black/[0.04] dark:bg-white/[0.07] px-2 py-1 ${item.tone}`}>
              {item.label} {item.value}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        {items.map((item) => (
          <div key={item.label} className={`rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2 py-1.5 ${item.tone}`}>
            <span className="text-gray-400/60 dark:text-white/35">{item.label}</span> {item.value}
          </div>
        ))}
      </div>
    );
  };

  const renderForecastRows = (days: typeof visibleForecast, compact = false) => (
    <div className="space-y-1">
      {days.map((day, i) => (
        <ForecastCard key={day.date} day={day} index={i} globalMin={globalMin} tempRange={tempRange} compact={compact} delay={i * 60} onClick={() => handleDayClick(day, i)} />
      ))}
    </div>
  );

  const renderForecastColumns = (days: typeof visibleForecast) => (
    <div className="flex gap-1.5">
      {days.map((day, i) => (
        <ForecastColumn key={day.date} day={day} index={i} delay={i * 60} onClick={() => handleDayClick(day, i)} />
      ))}
    </div>
  );

  const renderContent = () => {
    if (!weather) return null;

    if (isCompact) {
      return (
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-2 items-stretch">
          <div className={`${isTiny ? "col-span-12" : colSpan >= 8 ? "col-span-3" : "col-span-5"} min-w-0`}>
            {renderCurrentWeather(isTiny ? "tiny" : "compact")}
          </div>
          {!isTiny && colSpan >= 8 && (
            <div className="col-span-2 min-w-0">{renderMetrics("inline")}</div>
          )}
          {!isTiny && visibleForecast.length > 0 && (
            <div className="col-span-7 min-w-0 flex gap-1 items-stretch relative">
              {visibleForecast.map((day, i) => (
                <div
                  key={day.date}
                  className="forecast-day-card flex flex-col items-center justify-between rounded-lg border border-black/[0.06] dark:border-white/[0.12] bg-black/[0.05] dark:bg-white/[0.08] px-1 py-2 min-w-0 flex-1 h-full min-h-[54px] cursor-pointer hover:bg-black/[0.09] dark:hover:bg-white/[0.14] active:scale-[0.97] transition-all"
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => handleDayClick(day, i)}
                >
                  <span className="text-[9px] text-gray-500/60 dark:text-white/45 leading-none mt-[1px]">{formatDay(day.date, i)}</span>
                  <span className="text-xs weather-forecast-icon leading-none mt-0.5" style={{ animationDelay: `${i * 60 + 100}ms` }}>
                    {getWeatherIcon(day.weatherCode, true)}
                  </span>
                  <span className="text-[9px] tabular-nums text-gray-600/70 dark:text-white/55 leading-none mb-[1px]">{day.tempMax}°</span>
                </div>
              ))}
              {selectedDay && (
                <InlineDayDetail
                  day={selectedDay}
                  onClose={() => setSelectedDay(null)}
                  isCompact={true}
                />
              )}
            </div>
          )}
        </div>
      );
    }

    if (isWide) {
      return (
        <div className="flex-1 flex gap-3 min-h-0">
          <div className="flex flex-col justify-between shrink-0" style={{ width: isSuperWide ? "220px" : "180px" }}>
            {renderCurrentWeather(isSuperWide ? "large" : "normal")}
            <div className="mt-2">{renderMetrics(isTall ? "grid" : "row")}</div>
          </div>
          {visibleForecast.length > 0 && (
            <div className="flex-1 min-w-0 min-h-0 relative">
              {rowSpan <= 2 ? renderForecastColumns(visibleForecast) : (
                <div className="h-full overflow-y-auto pr-0.5">{renderForecastRows(visibleForecast)}</div>
              )}
              {selectedDay && (
                <InlineDayDetail
                  day={selectedDay}
                  onClose={() => setSelectedDay(null)}
                  isCompact={false}
                />
              )}
            </div>
          )}
        </div>
      );
    }

    if (isTall) {
      return (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {renderCurrentWeather("normal")}
          {renderMetrics("grid")}
          {visibleForecast.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 relative">
              {renderForecastRows(visibleForecast)}
              {selectedDay && (
                <InlineDayDetail
                  day={selectedDay}
                  onClose={() => setSelectedDay(null)}
                  isCompact={false}
                />
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {renderCurrentWeather("normal")}
        {renderMetrics("inline")}
        {visibleForecast.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 relative">
            {renderForecastRows(visibleForecast, true)}
            {selectedDay && (
              <InlineDayDetail
                day={selectedDay}
                onClose={() => setSelectedDay(null)}
                isCompact={false}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative h-full w-full">
      <div className={`widget-card weather-widget weather-widget--${weatherTheme} h-full min-h-0 ${isCompact ? "p-2.5" : "p-3"} relative overflow-hidden flex flex-col`}>
        <div className="weather-widget-effects" aria-hidden>
          {weatherTheme === "rain" &&
            Array.from({ length: 14 }).map((_, i) => (
              <span key={`rain-${i}`} className="weather-particle weather-particle--rain" style={{ left: `${i * 8}%`, animationDelay: `${(i % 6) * 0.23}s` }} />
            ))}
          {weatherTheme === "snow" &&
            Array.from({ length: 12 }).map((_, i) => (
              <span key={`snow-${i}`} className="weather-particle weather-particle--snow" style={{ left: `${i * 9}%`, animationDelay: `${(i % 5) * 0.4}s` }} />
            ))}
        </div>

        <div className="relative z-[2] flex h-full flex-col min-h-0">
          <div className={isCompact ? "mb-0.5" : "mb-1.5"}>
            <span className="text-[10px] font-medium text-gray-500/65 dark:text-white/40 uppercase tracking-wider truncate block">
              {weather?.city || "Weather"}
            </span>
          </div>

          {loading && !weather ? (
            <div className="flex items-center justify-center flex-1">
              <div className="w-4 h-4 rounded-full border-[1.5px] border-gray-300/30 border-t-gray-500/40 animate-spin" />
            </div>
          ) : error && !weather ? (
            <div className="flex-1 flex items-center text-[12px] text-gray-500/70 dark:text-white/45">{error}</div>
          ) : (
            weather && renderContent()
          )}
        </div>

      </div>
      {popup}
    </div>
  );
}
