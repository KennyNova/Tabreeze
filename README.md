# New Tab Dashboard - Chrome Extension

A beautiful productivity dashboard that replaces your Chrome new tab page, inspired by Speed Dial 2 Pro.

## Features

- **Clock & Greeting** - Time-based greeting with live clock. Click your name to edit it.
- **AI Prompt Launcher** - Search widgets open ChatGPT or Claude based on each widget's own source setting in edit mode. Press `/` to focus.
- **Speed Dial Bookmarks** - Grid of bookmarks with favicons. Add, edit, and delete. Integrates with Chrome's bookmarks API when installed as an extension.
- **Tasks Widget** - Local to-do list with add, complete, delete, and drag-and-drop reordering.
- **Calendar Widget** - Google Calendar and Microsoft Outlook integration via OAuth2.
- **Weather Widget** - Current weather using Open-Meteo API with geolocation.
- **Dark / Light Mode** - Toggle or auto-detect from system preference.
- **Custom Wallpapers** - Preset backgrounds or enter a custom image URL.
- **Dual layout system** - Under **Customize layout**: **Reactive** mode caps columns from window width (your column preference is the upper bound, so shrinking then widening a tab does not permanently shrink tiles). **Custom breakpoints** mode stores separate presets for pixel width/height ranges (add/remove/slider ranges, per-breakpoint grid and tiles). Settings persist in `localStorage` key `dashboard-layout-config-v2` (v1 keys migrate on first load).

**Manual checks (layout):** (1) Reactive: narrow the tab then widen it — full-width tiles should return once width crosses breakpoints. (2) Custom: add two overlapping ranges, save — ranges are auto-repaired; edit one breakpoint’s grid — others unchanged. (3) Switch modes and save — each mode keeps its data.

## Setup

### Prerequisites

- Node.js 18+
- npm

### Install & Build

```bash
npm install
npm run build
```

### Load in Brave or Chrome (unpacked)

Use the **`dist`** folder after a build — that is what the browser loads.

1. Run `npm run build` (or use `npm run dev:ext`, which builds into `dist` automatically).
2. Open **`brave://extensions`** or **`chrome://extensions`**
3. Turn on **Developer mode** (top right).
4. If an older copy of this project is already installed, click **Remove** on that extension so you do not have two copies.
5. Click **Load unpacked** and choose the **`dist`** folder inside this project (the full path should end with `\google tab extention\dist` on Windows).

### Calendar Integration

**Google Calendar:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the Google Calendar API
3. Create an OAuth 2.0 Client ID (type: Chrome Extension)
4. Copy your Client ID into `manifest.json` at the project root under `oauth2.client_id`
5. Rebuild and reload the extension

**Microsoft Outlook:**
1. Register an app in [Azure AD](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Add redirect URI: the value from `chrome.identity.getRedirectURL()` in your extension
3. Click "Connect Outlook" in the Calendar widget and enter your Client ID

### Development

**Why `npm run dev` (localhost) is different:** Vite serves a normal page at `http://localhost:5173`. Your new tab override, `chrome.*` APIs, OAuth, and extension CSP only exist when the app runs as an unpacked extension. Use `npm run dev` only for quick UI checks; use the extension workflow below for real behavior.

```bash
npm run dev
```

---

#### One-time setup: clean install + automatic reload

Do this when you want **no manual Reload** on the extensions page after each save.

1. **Quit Brave completely** (all windows), so the next step starts a fresh process with debugging enabled.
2. **Start Brave with remote debugging** (pick one):
   - **PowerShell:** `pwsh -File scripts/start-brave-debug.ps1`  
   - **Manual:** run Brave with `--remote-debugging-port=9222`, for example:
     - `"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" --remote-debugging-port=9222`
3. In that Brave window, open **`brave://extensions`**, enable **Developer mode**, **remove** any old copy of this extension, then **Load unpacked** → select your project’s **`dist`** folder (full path should end with `\google tab extention\dist`).
4. In a terminal, from the project folder, run:

```bash
npm run dev:ext
```

Each time Vite finishes rebuilding `dist`, a script connects to Brave on port **9222** and runs **`chrome.runtime.reload()`** in your extension’s service worker. Open a new tab to see changes.

**If auto-reload fails:** ensure Brave was started **with** `--remote-debugging-port=9222` (closing and reopening without that flag disables it). You can still run **`npm run reload:ext`** manually after a build. For a different port, set **`CDP_PORT`** (e.g. `cross-env CDP_PORT=3333 npm run dev:ext`) and start Brave with the same port.

**If you change `manifest.json` `"name"`:** set **`EXT_MANIFEST_NAME`** to the same string when running reload, or update the default in `scripts/reload-extension.mjs` to match.

## Project Structure

```
src/
  App.tsx                 - Main layout
  components/
    Greeting.tsx          - Clock + greeting
    SearchBar.tsx         - AI prompt launcher (ChatGPT/Claude)
    BookmarksGrid.tsx     - Speed dial grid
    BookmarkCard.tsx      - Single bookmark tile
    TasksWidget.tsx       - To-do list
    CalendarWidget.tsx    - Calendar events
    WeatherWidget.tsx     - Weather display
    ThemeToggle.tsx       - Dark/light switch
    WallpaperSettings.tsx - Background picker
  services/
    googleCalendar.ts     - Google Calendar API
    outlookCalendar.ts    - MS Graph API
    weather.ts            - Open-Meteo API
public/
  background.js           - Service worker for OAuth (copied into dist)
  icons/                  - Extension icons
manifest.json             - Extension manifest (root; copied into dist on build)
```
