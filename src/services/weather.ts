export interface HourlyForecast {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitationProbability: number;
  windSpeed: number;
  humidity: number;
}

interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  hourly: HourlyForecast[];
}

interface AirQualityData {
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  weatherCode: number;
  city: string;
  isDay: boolean;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  airQuality: AirQualityData;
  daily: DailyForecast[];
  unit: "C" | "F";
  lat: number;
  lon: number;
}

export interface GeocodingResult {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export interface WeatherSettings {
  unit: "C" | "F";
  customLat?: number;
  customLon?: number;
  customCity?: string;
}

const SETTINGS_KEY = "dashboard-weather-settings";
const CACHE_DURATION_MS = 30 * 60 * 1000;
const MOCK_WEATHER_KEY = "dashboard-weather-mock";

export function getWeatherSettings(): WeatherSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { unit: "C", ...JSON.parse(raw) };
  } catch {}
  return { unit: "C" };
}

export function saveWeatherSettings(settings: WeatherSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function cacheKey(lat: number, lon: number, unit: string): string {
  return `dashboard-weather-v2-${unit}-${lat.toFixed(2)}-${lon.toFixed(2)}`;
}

function toTemp(valueC: number, unit: "C" | "F"): number {
  return unit === "F" ? Math.round(valueC * 9 / 5 + 32) : Math.round(valueC);
}

function createMockWeather(unit: "C" | "F", lat = 33.94, lon = -84.38, city = "Sample City"): WeatherData {
  const today = new Date();
  const mockDaily = [0, 1, 2, 3, 4, 5, 6].map((idx) => {
    const d = new Date(today);
    d.setDate(today.getDate() + idx);
    const minC = [10, 11, 12, 10, 9, 11, 12][idx];
    const maxC = [18, 20, 21, 19, 17, 20, 22][idx];
    const weatherCodes = [1, 2, 61, 3, 80, 71, 0];
    const precip = [5, 12, 55, 20, 65, 35, 0];
    const dateStr = d.toISOString().split("T")[0];
    const hourly: HourlyForecast[] = Array.from({ length: 24 }, (_, h) => {
      const fraction = Math.sin((h - 6) * Math.PI / 12);
      const tempC = minC + (maxC - minC) * Math.max(0, fraction * 0.8 + 0.2);
      return {
        time: `${dateStr}T${String(h).padStart(2, "0")}:00`,
        temperature: toTemp(tempC, unit),
        weatherCode: weatherCodes[idx],
        precipitationProbability: h >= 10 && h <= 16 ? precip[idx] : Math.round(precip[idx] * 0.3),
        windSpeed: 10 + Math.round(Math.random() * 15),
        humidity: 40 + Math.round(Math.random() * 30),
      };
    });
    return {
      date: dateStr,
      weatherCode: weatherCodes[idx],
      tempMax: toTemp(maxC, unit),
      tempMin: toTemp(minC, unit),
      precipitationProbability: precip[idx],
      hourly,
    };
  });

  return {
    temperature: toTemp(19, unit),
    feelsLike: toTemp(18, unit),
    weatherCode: 2,
    city,
    isDay: true,
    humidity: 49,
    windSpeed: 17,
    windDirection: 235,
    precipitation: 0,
    airQuality: { usAqi: 43, pm25: 10, pm10: 16 },
    daily: mockDaily,
    unit,
    lat,
    lon,
  };
}

function shouldUseMockWeather(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem(MOCK_WEATHER_KEY) === "1";
  } catch {
    return false;
  }
}

function normalizeWeatherData(data: any): WeatherData | null {
  if (!data || typeof data !== "object") return null;
  if (typeof data.temperature !== "number" || typeof data.weatherCode !== "number") return null;
  const daily = Array.isArray(data.daily) ? data.daily : [];
  return {
    temperature: Math.round(data.temperature),
    feelsLike: Math.round(typeof data.feelsLike === "number" ? data.feelsLike : data.temperature),
    weatherCode: data.weatherCode,
    city: typeof data.city === "string" ? data.city : "Your location",
    isDay: typeof data.isDay === "boolean" ? data.isDay : true,
    humidity: Math.round(typeof data.humidity === "number" ? data.humidity : 0),
    windSpeed: Math.round(typeof data.windSpeed === "number" ? data.windSpeed : 0),
    windDirection: Math.round(typeof data.windDirection === "number" ? data.windDirection : 0),
    precipitation: Math.round(typeof data.precipitation === "number" ? data.precipitation : 0),
    airQuality: {
      usAqi: typeof data.airQuality?.usAqi === "number" ? Math.round(data.airQuality.usAqi) : null,
      pm25: typeof data.airQuality?.pm25 === "number" ? Math.round(data.airQuality.pm25) : null,
      pm10: typeof data.airQuality?.pm10 === "number" ? Math.round(data.airQuality.pm10) : null,
    },
    daily: daily.map((d: any) => ({
      date: typeof d?.date === "string" ? d.date : "",
      weatherCode: typeof d?.weatherCode === "number" ? d.weatherCode : 0,
      tempMax: Math.round(typeof d?.tempMax === "number" ? d.tempMax : 0),
      tempMin: Math.round(typeof d?.tempMin === "number" ? d.tempMin : 0),
      precipitationProbability: Math.round(
        typeof d?.precipitationProbability === "number" ? d.precipitationProbability : 0
      ),
      hourly: Array.isArray(d?.hourly) ? d.hourly.map((h: any) => ({
        time: typeof h?.time === "string" ? h.time : "",
        temperature: Math.round(typeof h?.temperature === "number" ? h.temperature : 0),
        weatherCode: typeof h?.weatherCode === "number" ? h.weatherCode : 0,
        precipitationProbability: Math.round(typeof h?.precipitationProbability === "number" ? h.precipitationProbability : 0),
        windSpeed: Math.round(typeof h?.windSpeed === "number" ? h.windSpeed : 0),
        humidity: Math.round(typeof h?.humidity === "number" ? h.humidity : 0),
      })) : [],
    })),
    unit: data.unit === "F" ? "F" : "C",
    lat: typeof data.lat === "number" ? data.lat : 0,
    lon: typeof data.lon === "number" ? data.lon : 0,
  };
}

function getCached(lat: number, lon: number, unit: string): WeatherData | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon, unit));
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp < CACHE_DURATION_MS) return normalizeWeatherData(data);
  } catch {}
  return null;
}

function setCache(lat: number, lon: number, unit: string, data: WeatherData): void {
  localStorage.setItem(cacheKey(lat, lon, unit), JSON.stringify({ data, timestamp: Date.now() }));
}

export function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Light snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm",
  };
  return descriptions[code] || "Unknown";
}

export function getWeatherIcon(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code <= 2) return isDay ? "⛅" : "☁️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 55) return "🌦️";
  if (code <= 65) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

export function getAqiLabel(aqi: number | null): string {
  if (aqi === null) return "N/A";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy (Sensitive)";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${lat}&longitude=${lon}&count=1`
    );
    if (!res.ok) return "Your location";
    const data = await res.json();
    return data.results?.[0]?.name || "Your location";
  } catch {
    return "Your location";
  }
}

export async function searchCity(query: string): Promise<GeocodingResult[]> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      name: r.name,
      country: r.country,
      admin1: r.admin1,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  } catch {
    return [];
  }
}

async function fetchAirQuality(lat: number, lon: number): Promise<AirQualityData> {
  try {
    const res = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
        `&current=us_aqi,pm2_5,pm10&timezone=auto`
    );
    if (!res.ok) {
      return { usAqi: null, pm25: null, pm10: null };
    }
    const json = await res.json();
    const current = json?.current ?? {};
    const asNumberOrNull = (value: unknown): number | null =>
      typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
    return {
      usAqi: asNumberOrNull(current.us_aqi),
      pm25: asNumberOrNull(current.pm2_5),
      pm10: asNumberOrNull(current.pm10),
    };
  } catch {
    return { usAqi: null, pm25: null, pm10: null };
  }
}

export async function fetchWeather(
  settings?: Partial<WeatherSettings>,
  forceRefresh = false
): Promise<WeatherData> {
  const s: WeatherSettings = { ...getWeatherSettings(), ...settings };
  const unit = s.unit;
  const useMock = shouldUseMockWeather();

  let lat: number;
  let lon: number;
  let cityOverride: string | undefined;

  if (s.customLat !== undefined && s.customLon !== undefined) {
    lat = s.customLat;
    lon = s.customLon;
    cityOverride = s.customCity;
  } else {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: CACHE_DURATION_MS,
        });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {
      if (useMock) return createMockWeather(unit, 33.94, -84.38, "Sample City");
      throw new Error("Location access denied");
    }
  }

  if (useMock) {
    return createMockWeather(unit, lat, lon, cityOverride || "Sample City");
  }

  if (!forceRefresh) {
    const cached = getCached(lat, lon, unit);
    if (cached) return cached;
  }

  const tempUnit = unit === "F" ? "fahrenheit" : "celsius";
  const [weatherRes, city, airQuality] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation` +
        `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
        `&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m` +
        `&timezone=auto&temperature_unit=${tempUnit}&forecast_days=7`
    ),
    cityOverride ? Promise.resolve(cityOverride) : reverseGeocode(lat, lon),
    fetchAirQuality(lat, lon),
  ]);

  if (!weatherRes.ok) {
    if (useMock) return createMockWeather(unit, lat, lon, cityOverride || city);
    throw new Error(`Weather API error: ${weatherRes.status}`);
  }

  const json = await weatherRes.json();
  const current = json.current;
  const daily = json.daily;
  const hourly = json.hourly;

  const hourlyByDate = new Map<string, HourlyForecast[]>();
  if (hourly?.time) {
    (hourly.time as string[]).forEach((isoTime: string, i: number) => {
      const dateKey = isoTime.slice(0, 10);
      const entry: HourlyForecast = {
        time: isoTime,
        temperature: Math.round(hourly.temperature_2m?.[i] ?? 0),
        weatherCode: hourly.weather_code?.[i] ?? 0,
        precipitationProbability: Math.round(hourly.precipitation_probability?.[i] ?? 0),
        windSpeed: Math.round(hourly.wind_speed_10m?.[i] ?? 0),
        humidity: Math.round(hourly.relative_humidity_2m?.[i] ?? 0),
      };
      const bucket = hourlyByDate.get(dateKey);
      if (bucket) bucket.push(entry);
      else hourlyByDate.set(dateKey, [entry]);
    });
  }

  const data: WeatherData = {
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    weatherCode: current.weather_code,
    city,
    isDay: current.is_day === 1,
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    windSpeed: Math.round(current.wind_speed_10m ?? 0),
    windDirection: Math.round(current.wind_direction_10m ?? 0),
    precipitation: Math.round(current.precipitation ?? 0),
    airQuality,
    unit,
    lat,
    lon,
    daily: (daily.time as string[]).map((date: string, i: number) => ({
      date,
      weatherCode: daily.weather_code[i],
      tempMax: Math.round(daily.temperature_2m_max[i]),
      tempMin: Math.round(daily.temperature_2m_min[i]),
      precipitationProbability: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
      hourly: hourlyByDate.get(date) ?? [],
    })),
  };

  setCache(lat, lon, unit, data);
  return data;
}
