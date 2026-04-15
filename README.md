# Tabreeze

> Your new tab page, but actually useful.

I got sick of opening a new tab and staring at a blank page or some stock photo I didn't ask for. Ctrl+T is muscle memory — you do it a hundred times a day — but the browser still makes you take the scenic route every time. So I did what any developer does on a weekend: I built a replacement.

**Tabreeze** is a fully customizable new tab dashboard that runs as a Chrome/Edge extension. Built with React, TypeScript, Tailwind, and Vite.

The name? **Tabriz** is an ancient city in northwestern Iran — rugged, storied. Smoosh that with **breeze**, because using and configuring this thing should feel like exactly that. Oh, and it lives in your browser **tab**. Tabreeze. It was right there.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
  - [Option A — Pre-built ZIP (simplest)](#option-a--pre-built-zip-simplest)
  - [Option B — Build from source](#option-b--build-from-source)
  - [Load as unpacked extension](#load-as-unpacked-extension)
- [Development](#development)
  - [Web UI mode](#web-ui-mode)
  - [Extension auto-reload](#extension-auto-reload)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Search launcher** — pick your AI provider per search (ChatGPT, Claude, Perplexity, and more), add up to 5 custom sources
- **Bookmark sync widget** — your Chrome bookmarks, surfaced and searchable right on your dashboard
- **Tasks** — drag-and-drop ordering, right there on your new tab
- **Calendar** — Google and Outlook support
- **Weather widget** — current conditions at a glance
- **Clock & greeting** — because why not
- **Tile-based layout** — add, remove, and rearrange widgets until the page works the way you do
- **Custom breakpoints** — set your own layout breakpoints so the dashboard snaps exactly how you want at any screen size
- **Themes & wallpaper** — light/dark toggle, custom wallpaper support

---

## Tech stack


|           |                    |
| --------- | ------------------ |
| UI        | React + TypeScript |
| Styling   | Tailwind CSS       |
| Bundler   | Vite               |
| Extension | Chrome Manifest V3 |


---

## Getting started

### Option A — Pre-built ZIP (simplest)

No Node, no terminal — just the extension.

1. Open **[Releases](https://github.com/KennyNova/Tabriz/releases)** and download the latest `**tabreeze.zip`**.
2. Unzip it anywhere you like. You should see `**manifest.json**` right inside that folder (that’s the built extension).
3. Go to [Load as unpacked extension](#load-as-unpacked-extension) below.

### Option B — Build from source

**Prerequisites:** Node.js 18+ and npm.

```bash
git clone https://github.com/KennyNova/Tabriz.git
cd Tabriz
npm install
npm run build
```

Production output lands in `**dist/**`.

### Load as unpacked extension

1. Open your browser’s extension page:
  - **Chrome** → `chrome://extensions`
  - **Edge** → `edge://extensions`
  - **Brave** → `brave://extensions`
2. Turn on **Developer mode** (usually top right).
3. Click **Load unpacked**.
4. Select the unzipped folder — the one whose root contains `**manifest.json`**. (If you built from source, pick `**dist/**` instead.)

That’s it — Tabreeze is now your new tab page.

---

## Developmenttab

### Web UI mode

For fast UI iteration without loading the full extension:

```bash
npm run dev
```

Starts a local Vite dev server.

### Extension auto-reload

For developing extension behavior (service worker, background scripts, etc.):

```bash
npm run dev:ext
```

Watches for build output changes and attempts to refresh the installed extension via the DevTools remote debugging port.


| Option               | Default                                        |
| -------------------- | ---------------------------------------------- |
| Debugging port       | `9222` (override with `CDP_PORT`)              |
| Extension name match | `Tabreeze` (override with `EXT_MANIFEST_NAME`) |


Manual reload trigger:

```bash
npm run reload:ext
```

---

## Contributing

This is a developer preview. If something clicks (or doesn’t) — open an issue, start a discussion, or just DM. Feature requests are very welcome.

Want to go further? Fork it, twist it, make it yours. That’s the whole point.

---

## License

**MIT** — use it, change it, ship it; just keep the copyright notice if you redistribute. Full text in [`LICENSE`](LICENSE).