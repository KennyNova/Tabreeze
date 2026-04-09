# Tabreeze

Tabreeze is a customizable new-tab dashboard extension for Chromium-based browsers. It focuses on a clean layout and daily-use widgets such as bookmarks, tasks, calendar, weather, and quick search.

The name is a three-way pun and honestly pretty clever if you ask us. **Tabriz** is an ancient, rugged city nestled in the mountains of northwestern Iran. We took that name, smooshed it together with **breeze**, because getting it exactly how you want it should feel like exactly that — a breeze. Oh, and it goes in your browser **tab**. So yeah. Tabreeze. It was right there.

## Features

- Clock and greeting
- Search launcher (per-widget source dropdown + custom source add button, up to 5 custom sources)
- Speed-dial style bookmarks
- Tasks widget with drag-and-drop ordering
- Calendar widget (Google + Outlook)
- Weather widget
- Light and dark theme toggle
- Wallpaper customization
- Flexible responsive tile layout

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Chrome Extension Manifest V3

## Prerequisites

- Node.js 18+
- npm

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

The production extension output is generated in `dist/`.

## Run for Web UI Development

```bash
npm run dev
```

This starts a local Vite server for quick UI iteration.

## Load as Unpacked Extension

1. Build the project with `npm run build` (or use `npm run dev:ext` for watch mode).
2. Open `chrome://extensions` or `brave://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `dist/` folder from this project.

## Extension Auto-Reload Workflow

Use this when developing extension behavior instead of only local UI:

```bash
npm run dev:ext
```

When build output changes, the reload script attempts to refresh the installed extension using the DevTools remote debugging port.

- Default debugging port: `9222`
- Override port with `CDP_PORT`
- Override extension display name match with `EXT_MANIFEST_NAME` (default: `Tabreeze`)

Manual reload command:

```bash
npm run reload:ext
```

## Project Structure

```text
src/
  App.tsx
  main.tsx
  components/
  services/
  layout/
  styles/
public/
  background.js
  icons/
manifest.json
```

## License

This project is licensed under the terms in `LICENSE`.
