import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  WeatherData,
  GeocodingResult,
  WeatherSettings,
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

interface WeatherWidgetProps {
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
}: {
  day: { date: string; weatherCode: number; tempMax: number; tempMin: number; precipitationProbability: number };
  index: number;
  globalMin: number;
  tempRange: number;
  compact?: boolean;
  delay: number;
}) {
  const minPct = ((day.tempMin - globalMin) / tempRange) * 100;
  const maxPct = ((day.tempMax - globalMin) / tempRange) * 100;

  return (
    <div
      className="forecast-day-card group flex items-center gap-2 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] px-2 py-1.5 hover:bg-black/[0.07] dark:hover:bg-white/[0.11] transition-colors"
      style={{ animationDelay: `${delay}ms` }}
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
}: {
  day: { date: string; weatherCode: number; tempMax: number; tempMin: number; precipitationProbability: number };
  index: number;
  delay: number;
}) {
  return (
    <div
      className="forecast-day-card flex flex-col items-center gap-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.07] px-1.5 py-2 hover:bg-black/[0.07] dark:hover:bg-white/[0.11] transition-colors flex-1 min-w-0"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-[10px] font-medium text-gray-500/70 dark:text-white/50">{formatDay(day.date, index)}</span>
      <span className="text-base weather-forecast-icon" style={{ animationDelay: `${delay + 100}ms` }}>
        {getWeatherIcon(day.weatherCode, true)}
      </span>
      {day.precipitationProbability > 0 && (
        <span className="text-[9px] text-blue-500/75 dark:text-blue-300/80 leading-none">{day.precipitationProbability}%</span>
      )}
      <div className="flex flex-col items-center">
        <span className="text-[11px] font-medium text-gray-700/80 dark:text-white/75 tabular-nums">{day.tempMax}°</span>
        <span className="text-[10px] text-gray-500/55 dark:text-white/45 tabular-nums">{day.tempMin}°</span>
      </div>
    </div>
  );
}

export default function WeatherWidget({ rowSpan = 1, colSpan = 4 }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

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

  const updatePanelPos = () => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - PANEL_W - 8);
    setPanelPos({
      top: r.bottom + 8,
      left: Math.min(Math.max(8, r.left - PANEL_W + r.width), maxLeft),
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPos();
    window.addEventListener("resize", updatePanelPos);
    return () => window.removeEventListener("resize", updatePanelPos);
  }, [open]);

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

  const settingsButton = (
    <button
      ref={anchorRef}
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className="w-6 h-6 rounded-md bg-black/[0.04] dark:bg-white/[0.08] flex items-center justify-center hover:bg-black/[0.08] dark:hover:bg-white/[0.14] transition-colors shrink-0"
      title="Weather settings"
      aria-expanded={open}
    >
      <svg className="w-3.5 h-3.5 text-gray-500/70 dark:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.7}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  );

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
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(40px)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4">
            <div className="text-[13px] font-medium text-gray-600/70 mb-4">Weather settings</div>

            <div className="mb-5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400/60 mb-2">
                Temperature Unit
              </div>
              <div className="flex gap-2">
                {(["C", "F"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleUnitChange(u)}
                    className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
                    style={{
                      background: unit === u ? "rgba(0,122,255,0.1)" : "rgba(0,0,0,0.04)",
                      color: unit === u ? "rgba(0,122,255,0.85)" : "rgba(0,0,0,0.4)",
                      border: unit === u ? "1px solid rgba(0,122,255,0.2)" : "1px solid transparent",
                    }}
                  >
                    °{u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400/60 mb-2">
                Location
              </div>

              {customCity && (
                <div className="text-[12px] text-gray-500/70 mb-2 px-1 truncate">
                  Current: {customCity}
                </div>
              )}

              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search city..."
                  className="flex-1 px-3 py-2 rounded-xl text-[12px] outline-none"
                  style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searchLoading || !locationSearch.trim()}
                  className="px-3 py-2 rounded-xl text-[12px] transition-colors disabled:opacity-40"
                  style={{
                    background: "rgba(0,0,0,0.05)",
                    color: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  {searchLoading ? "..." : "Search"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="rounded-xl overflow-hidden mb-2" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                  {searchResults.map((r, i) => (
                    <button
                      key={`${r.latitude}-${r.longitude}-${i}`}
                      type="button"
                      onClick={() => handleLocationSelect(r)}
                      className="w-full text-left px-3 py-2.5 text-[12px] transition-colors hover:bg-black/5 flex items-center gap-2"
                      style={{ borderBottom: i < searchResults.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}
                    >
                      <span className="text-gray-700/70 font-medium">{r.name}</span>
                      <span className="text-gray-400/50 text-[11px]">
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
                style={{ color: "rgba(0,122,255,0.65)" }}
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
      { label: "AQI", value: weather.airQuality.usAqi ?? "--", extra: getAqiLabel(weather.airQuality.usAqi), tone: getAqiTone(weather.airQuality.usAqi) },
      { label: "Humidity", value: `${weather.humidity}%`, tone: "text-gray-600/75 dark:text-white/60" },
      { label: "Wind", value: `${weather.windSpeed} km/h`, tone: "text-gray-600/75 dark:text-white/60" },
      { label: "Precip", value: `${weather.precipitation} mm`, tone: "text-gray-600/75 dark:text-white/60" },
    ];

    if (layout === "inline") {
      return (
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          {items.slice(0, 3).map((item) => (
            <span key={item.label} className={item.tone}>
              {item.label} {item.value}
            </span>
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
            <span className="text-gray-400/60 dark:text-white/35">{item.label}</span>{" "}
            {item.value}
          </div>
        ))}
      </div>
    );
  };

  const renderForecastRows = (days: typeof visibleForecast, compact = false) => (
    <div className="space-y-1">
      {days.map((day, i) => (
        <ForecastCard
          key={day.date}
          day={day}
          index={i}
          globalMin={globalMin}
          tempRange={tempRange}
          compact={compact}
          delay={i * 60}
        />
      ))}
    </div>
  );

  const renderForecastColumns = (days: typeof visibleForecast) => (
    <div className="flex gap-1.5">
      {days.map((day, i) => (
        <ForecastColumn
          key={day.date}
          day={day}
          index={i}
          delay={i * 60}
        />
      ))}
    </div>
  );

  const renderContent = () => {
    if (!weather) return null;

    // 1×compact: single strip
    if (isCompact) {
      return (
        <div className="flex-1 flex items-center gap-3 min-h-0">
          <div className="shrink-0">
            {renderCurrentWeather(isTiny ? "tiny" : "compact")}
          </div>
          {!isTiny && visibleForecast.length > 0 && (
            <div className="flex-1 min-w-0 flex gap-1 justify-end">
              {visibleForecast.map((day, i) => (
                <div
                  key={day.date}
                  className="forecast-day-card flex flex-col items-center rounded-md bg-black/[0.04] dark:bg-white/[0.07] px-1.5 py-1 min-w-[36px]"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="text-[9px] text-gray-500/60 dark:text-white/45">{formatDay(day.date, i)}</span>
                  <span className="text-xs weather-forecast-icon" style={{ animationDelay: `${i * 60 + 100}ms` }}>
                    {getWeatherIcon(day.weatherCode, true)}
                  </span>
                  <span className="text-[9px] tabular-nums text-gray-600/70 dark:text-white/55">{day.tempMax}°</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Wide layout (colSpan >= 7): horizontal with forecast on the right
    if (isWide) {
      return (
        <div className="flex-1 flex gap-3 min-h-0">
          <div className="flex flex-col justify-between shrink-0" style={{ width: isSuperWide ? "220px" : "180px" }}>
            {renderCurrentWeather(isSuperWide ? "large" : "normal")}
            <div className="mt-2">
              {renderMetrics(isTall ? "grid" : "row")}
            </div>
          </div>
          {visibleForecast.length > 0 && (
            <div className="flex-1 min-w-0 min-h-0">
              {rowSpan <= 2 ? (
                renderForecastColumns(visibleForecast)
              ) : (
                <div className="h-full overflow-y-auto pr-0.5">
                  {renderForecastRows(visibleForecast)}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Tall layout (rowSpan >= 3, narrow): stacked
    if (isTall) {
      return (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {renderCurrentWeather("normal")}
          {renderMetrics("grid")}
          {visibleForecast.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
              {renderForecastRows(visibleForecast)}
            </div>
          )}
        </div>
      );
    }

    // Default medium layout (2-row, 3-6 cols)
    return (
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {renderCurrentWeather("normal")}
        {renderMetrics("inline")}
        {visibleForecast.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
            {renderForecastRows(visibleForecast, true)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative h-full w-full">
      <div className={`widget-card weather-widget weather-widget--${weatherTheme} h-full min-h-0 p-3 relative overflow-hidden flex flex-col`}>
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
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-medium text-gray-500/65 dark:text-white/40 uppercase tracking-wider truncate">
              {weather?.city || "Weather"}
            </span>
            {settingsButton}
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
