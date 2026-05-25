# Tabreeze — Branding Kit

> This document is the single source of truth for Tabreeze's brand identity, visual language, and design principles. All values are derived directly from the live codebase.

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Logo & Icon](#2-logo--icon)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Shape & Spacing](#5-shape--spacing)
6. [Elevation & Glass](#6-elevation--glass)
7. [Motion & Animation](#7-motion--animation)
8. [Design Principles](#8-design-principles)
9. [Feature Overview](#9-feature-overview)

---

## 1. Brand Identity

### Name

**Tabreeze**

One word, no space. Capital **T** only. Never "TabBreeze", "tab breeze", or "TABREEZE".

### Tagline

> **Your new tab, reimagined.**

### One-liner

A beautiful productivity dashboard that replaces your browser's new tab — featuring smart search, bookmarks, tasks, calendar, weather, quotes, news, and a fully reactive drag-and-resize grid layout.

### Vision

A calm, fast, distraction-free start to every browsing session. Tabreeze adapts to your workflow — not the other way around. It feels like a native system app: fluid, quiet, and always one keypress away.

### Brand Personality


| Trait        | Description                                                                             |
| ------------ | --------------------------------------------------------------------------------------- |
| **Calm**     | Never shouts. Soft surfaces, restrained color, generous whitespace.                     |
| **Adaptive** | Themes, layouts, and widgets conform to the user — not a fixed template.                |
| **Precise**  | Pixel-aligned, intentional spacing, legible at all text sizes.                          |
| **Native**   | Follows Apple/iOS design conventions users already know.                                |
| **Capable**  | Deceptively powerful under the calm exterior: calendar, tasks, homelab status, weather. |


---

## 2. Logo & Icon

### Icon Sizes (Chrome Extension)


| Size      | File                | Usage                     |
| --------- | ------------------- | ------------------------- |
| 16 × 16   | `icons/icon16.png`  | Browser toolbar favicon   |
| 48 × 48   | `icons/icon48.png`  | Extension management page |
| 128 × 128 | `icons/icon128.png` | Chrome Web Store listing  |


### Usage Rules

- **Clear space**: Maintain a minimum clear space of 1/4 the icon's height on all sides.
- **Do not** recolor, outline, or add an external drop shadow to the icon itself.
- **Do not** place the icon on a background that makes it unreadable at 16px.
- On dark surfaces, use the icon as-is (it is designed to work on both light and dark backgrounds).

---

## 3. Color System

Tabreeze uses a **token-based color system** driven by 9 CSS custom properties set on `:root`. Themes swap these properties at runtime; all components reference only the tokens, never hard-coded palette colors.

### Design Tokens

```css
:root {
  --theme-bg             /* Page background */
  --theme-surface        /* Card / panel background */
  --theme-surface-hover  /* Card background on hover / focus */
  --theme-text           /* Primary body text */
  --theme-text-secondary /* Labels, captions, secondary info */
  --theme-accent         /* Interactive: links, buttons, focus rings */
  --theme-accent-hover   /* Accent on hover state */
  --theme-border         /* Dividers, input outlines */
  --theme-scrollbar      /* Scrollbar thumb */
}
```

---

### Theme Presets

#### Light — "Clean Daylight" *(default)*

The canonical Tabreeze aesthetic. Soft iOS gray background, pure white surfaces, iOS blue accent.


| Token          | Hex           | Swatch |
| -------------- | ------------- | ------ |
| Background     | `#f2f2f7`     |        |
| Surface        | `#ffffff`     |        |
| Surface Hover  | `#f7f8fb`     |        |
| Text           | `#1c1c1e`     |        |
| Text Secondary | `#66666b`     |        |
| **Accent**     | `**#007aff`** |        |
| Accent Hover   | `#006ce1`     |        |
| Border         | `#d9d9e1`     |        |
| Scrollbar      | `#b8b8c4`     |        |


#### Dark — "Apple Dark"

The nighttime companion. Matches Apple's `systemBackground`/`secondarySystemBackground` semantics.


| Token          | Hex           |
| -------------- | ------------- |
| Background     | `#1c1c1e`     |
| Surface        | `#2c2c2e`     |
| Surface Hover  | `#3a3a3d`     |
| Text           | `#f5f5f7`     |
| Text Secondary | `#b9b9bf`     |
| **Accent**     | `**#0a84ff`** |
| Accent Hover   | `#2994ff`     |
| Border         | `#3f3f45`     |
| Scrollbar      | `#5d5d66`     |


---

#### Dev Suite — Terminal Greens

Three progressive darkness levels for developer/terminal aesthetics.


|                | Dev — "Matrix Green" | Dev · Dark — "Terminal Charcoal" | Dev · Night — "Dim Phosphor" |
| -------------- | -------------------- | -------------------------------- | ---------------------------- |
| Background     | `#000000`            | `#050807`                        | `#020302`                    |
| Surface        | `#001100`            | `#0c120e`                        | `#070a08`                    |
| Surface Hover  | `#0a1a0a`            | `#141c17`                        | `#0d110f`                    |
| Text           | `#00ff41`            | `#c8f7d4`                        | `#5a9d6e`                    |
| Text Secondary | `#00cc33`            | `#6eb584`                        | `#3d6b4c`                    |
| Accent         | `#00ff41`            | `#3dff7a`                        | `#2d8f4a`                    |
| Accent Hover   | `#33ff66`            | `#6eff9e`                        | `#3faa5c`                    |
| Border         | `#0f4d20`            | `#1f3d2a`                        | `#0f2418`                    |
| Scrollbar      | `#1a8f38`            | `#2a5c3d`                        | `#1a3d28`                    |


---

#### Coffee Suite — Warm Browns

Three progressive darkness levels for low-light, warm-tone aesthetics.


|                | Coffee — "Warm Espresso" | Coffee · Dark — "Chocolate Roast" | Coffee · Night — "After Hours" |
| -------------- | ------------------------ | --------------------------------- | ------------------------------ |
| Background     | `#1b1411`                | `#120d0a`                         | `#0a0706`                      |
| Surface        | `#2a1f1a`                | `#1c1612`                         | `#110c0a`                      |
| Surface Hover  | `#372923`                | `#261e19`                         | `#181210`                      |
| Text           | `#e8d5c4`                | `#e5d4c2`                         | `#b8a090`                      |
| Text Secondary | `#bea58f`                | `#a89078`                         | `#7d6b5c`                      |
| Accent         | `#c4956a`                | `#b8875c`                         | `#8b6b4d`                      |
| Accent Hover   | `#d2a67f`                | `#c9986e`                         | `#9c7d5f`                      |
| Border         | `#4a372d`                | `#3d2e25`                         | `#2a2019`                      |
| Scrollbar      | `#7d5b47`                | `#6a4f3f`                         | `#4d3d32`                      |


---

### Accent Color Story

The default accent is **iOS Blue**:

- Light mode: `#007aff` — the exact value Apple uses for interactive elements across iOS and macOS.
- Dark mode: `#0a84ff` — Apple's official dark-mode blue, slightly lighter for contrast on dark surfaces.

This choice is intentional: it signals interactivity universally, has excellent WCAG contrast ratios on both white and the app's dark surfaces, and feels immediately native on any platform.

---

### UI Accent Strip

Used in the layout editor and as categorical color accents across widgets. These colors are Tailwind 500-level values and pair well with both light and dark themes.


| Name    | Hex       | Tailwind      |
| ------- | --------- | ------------- |
| Pink    | `#ec4899` | `pink-500`    |
| Violet  | `#8b5cf6` | `violet-500`  |
| Blue    | `#3b82f6` | `blue-500`    |
| Cyan    | `#06b6d4` | `cyan-500`    |
| Emerald | `#10b981` | `emerald-500` |
| Amber   | `#f59e0b` | `amber-500`   |
| Red     | `#ef4444` | `red-500`     |


---

### Weather Gradient Palette

Contextual gradients used in the weather widget based on current conditions.


| Condition | Gradient                                                                      |
| --------- | ----------------------------------------------------------------------------- |
| Clear     | Radial amber glow — `rgba(251, 191, 36, 0.16)`                                |
| Cloud     | Radial slate — `rgba(148, 163, 184, 0.18)`                                    |
| Fog       | Linear slate — `rgba(148, 163, 184, 0.12 → 0.04)`                             |
| Rain      | Linear blue — `rgba(96, 165, 250, 0.18 → 0.05)`                               |
| Snow      | Linear pale blue — `rgba(191, 219, 254, 0.20 → 0.06)`                         |
| Storm     | Linear sky-to-slate — `rgba(125, 211, 252, 0.20)` → `rgba(71, 85, 105, 0.15)` |


---

### Custom & Random Themes

Tabreeze supports fully custom palettes. The randomizer generates HSL-based palettes from a random hue base with the accent hue offset by 25–180°, ensuring color harmony. Random palettes follow the same 9-token structure.

---

## 4. Typography

### Primary Typeface

**Inter** by Rasmus Andersson (Google Fonts)

```
https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap
```

Inter is chosen for its exceptional legibility at small sizes (critical for dense widget labels at 10–11px), its neutral geometric character that recedes behind content, and its wide platform availability.

### Font Stack

```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
```

On Apple devices, if Inter fails to load, SF Pro Display provides a seamless fallback that matches the same design intent.

### Rendering

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
text-rendering: optimizeLegibility;
```

### Type Scale


| Role                     | Size                                  | Weight                  | Notes                  |
| ------------------------ | ------------------------------------- | ----------------------- | ---------------------- |
| Clock / Hero time        | `text-7xl` (72px) / `text-8xl` (96px) | 200 Extralight          | Dashboard centerpiece  |
| Greeting                 | `text-4xl` (36px)                     | 300 Light               | Welcome line           |
| Widget title             | `text-xl`–`text-2xl` (20–24px)        | 500–600 Medium/Semibold | Section headers        |
| Body / widget content    | 13px–15px                             | 400 Regular             | General content        |
| Labels / metadata        | `text-xs` (12px)                      | 400–500                 | Captions, timestamps   |
| Dense UI (layout editor) | 10px–11px                             | 400–500                 | Compact control labels |


### Letter Spacing

- Headlines and clock: `tracking-tight` (−0.025em) — tighter for large display type.
- Uppercase labels / category chips: `tracking-wide` or `tracking-widest` — adds air to all-caps text.
- Body: default (0em).

---

## 5. Shape & Spacing

### Corner Radius


| Level           | Tailwind       | px     | Used on                                         |
| --------------- | -------------- | ------ | ----------------------------------------------- |
| **Extra Large** | `rounded-2xl`  | 16px   | Glass panels, search bar, primary cards, modals |
| **Large**       | `rounded-xl`   | 12px   | Buttons, input fields, secondary cards          |
| **Medium**      | `rounded-lg`   | 8px    | Chips, tags, small controls                     |
| **Small**       | `rounded-md`   | 6px    | Inline badges, sub-items                        |
| **Full**        | `rounded-full` | 9999px | Pills, scrollbar thumb, avatar badges           |


The dominant radius is `rounded-2xl`. This produces the "soft" Apple-like look. Smaller radii are used contextually for nested or compact elements.

### Spacing Scale

Tabreeze follows Tailwind's default 4px base unit. The most common spacing values in context:


| Usage                        | Value                       |
| ---------------------------- | --------------------------- |
| Widget card internal padding | `p-5` (20px)                |
| Button padding               | `px-4 py-2` (16px / 8px)    |
| Input field padding          | `px-4 py-2.5` (16px / 10px) |
| Small button padding         | `px-3 py-1.5` (12px / 6px)  |
| Widget internal gaps         | `gap-2`–`gap-4` (8px–16px)  |


---

## 6. Elevation & Glass

Tabreeze uses a **glassmorphism** surface model, not traditional Material-style elevation.

### Glass Layer

```css
.glass {
  border-radius: 1rem; /* rounded-2xl */
  backdrop-filter: blur(24px); /* backdrop-blur-2xl */
  background: color-mix(in srgb, var(--theme-surface) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-border) 65%, transparent);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
}

.glass:hover {
  background: color-mix(in srgb, var(--theme-surface-hover) 82%, transparent);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}
```

### Shadow System


| State               | Shadow                                                               |
| ------------------- | -------------------------------------------------------------------- |
| Resting             | `0 2px 16px rgba(0,0,0,0.06)` — barely visible lift                  |
| Hover               | `0 4px 24px rgba(0,0,0,0.12)` — noticeable but not heavy             |
| Focus ring (inputs) | `0 0 0 3px color-mix(in srgb, var(--theme-accent) 16%, transparent)` |


### Translucency Ratios

- **Glass surface**: 78% opaque (22% transparent)
- **Glass surface hover**: 82% opaque
- **Scrollbar thumb**: 80% opaque
- **Input background**: 72% opaque; 82% on focus
- **Border**: 65% opaque

---

## 7. Motion & Animation

### Primary Easing

```css
cubic-bezier(0.16, 1, 0.3, 1)
```

This is a **spring-like** curve: fast initial acceleration, then overshoots slightly and settles. It gives the UI an alive, physical quality without being bouncy or playful. Used for all major entrance animations and interactive scaling.

### Secondary Easing

```css
ease-out  /* generic, exits */
cubic-bezier(0.34, 1.56, 0.64, 1)  /* pop / scale-up, e.g. forecast icons */
```

### Entrance Animation — `fadeUp`

Applied to all dashboard widgets on page open via `.animate-in`.

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px) scale(0.99); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
.animate-in { animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
```

### Stagger System

Widgets stagger in sequentially to avoid a single jarring pop.


| Class      | Delay |
| ---------- | ----- |
| `.delay-1` | 60ms  |
| `.delay-2` | 120ms |
| `.delay-3` | 200ms |
| `.delay-4` | 300ms |
| `.delay-5` | 400ms |


### Micro-Interaction Durations


| Interaction type         | Duration  |
| ------------------------ | --------- |
| Button state change      | 150ms     |
| Panel / card transitions | 200–300ms |
| Bookmark hover lift      | 180ms     |
| Modal open/close         | 200–250ms |
| Forecast slide-in        | 400ms     |


### Hover Transforms

- Cards and bookmarks: `translateY(-2px)` + `filter: saturate(1.03)` — subtle lift.
- Interactive buttons: `scale(0.97)` on active press.
- Bookmarks: 180ms spring easing.

### Confetti Colors (Focus Widget)

Three confetti gradient pairs used in task-completion celebration:

```css
/* Blue → Purple */
background: linear-gradient(180deg, #60a5fa, #c084fc);

/* Pink → Rose */
background: linear-gradient(180deg, #f472b6, #fb7185);

/* Emerald → Teal */
background: linear-gradient(180deg, #34d399, #2dd4bf);
```

---

## 8. Design Principles

### 1. Calm by Default

The background is never white or stark black — it is always a tinted off-white (`#f2f2f7`) or off-black (`#1c1c1e`). Surfaces float above it with translucency. There is no aggressive contrast, no bright primary colors competing for attention. The page should feel like a quiet room.

### 2. Token-Driven Flexibility

Every pixel of color references a CSS variable, never a hard-coded hex (except in preset definitions). This allows the entire UI to theme-switch in microseconds with a single DOM attribute swap. Custom and random themes are first-class citizens.

### 3. Luminance-Aware Dark Mode

Dark mode is not triggered by a preference boolean — it is computed from the **luminance of the background color**. This means any custom palette with a dark background automatically activates `dark:` Tailwind utilities. The system adapts to the palette, not the other way around.

### 4. Apple-Native Language

Color (iOS Blue accent, system gray backgrounds), typography (Inter → SF Pro fallback), and interaction patterns (translucent blur cards, spring animations, 150ms micro-interactions) all follow Apple's Human Interface Guidelines. Users coming from macOS or iOS feel immediately at home.

### 5. Layout Sovereignty

The user owns the canvas. Every widget is draggable and resizable within a responsive grid. Breakpoints are independently configurable. The layout persists to storage. There is no locked default layout.

### 6. Accessible Contrast

Accent and text colors are chosen to meet or exceed WCAG AA contrast requirements on their respective backgrounds across all built-in presets. The focus ring (`0 0 0 3px` accent glow) is always visible regardless of theme.

---

## 9. Feature Overview

These are the core features that define Tabreeze as a product, for use in marketing copy, store listings, and onboarding.


| Feature                          | Description                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Smart Search**                 | One-bar search across Google, Claude, Perplexity, ChatGPT, and Bing. Keyboard-first: press `/` to focus.             |
| **Bookmarks**                    | Browser bookmark tree displayed as a visual grid with favicons. Supports folders, custom items, and drag reordering. |
| **Tasks**                        | Lightweight inline task list with completion state and priority reordering.                                          |
| **Calendar**                     | Pulls events from iCal/CalDAV feeds, displays upcoming events per day.                                               |
| **Weather**                      | Current conditions, hourly forecast, and 7-day outlook with animated weather particles (rain, snow).                 |
| **Quotes & News**                | Rotating inspirational quotes or live news headlines — toggle per preference.                                        |
| **Homelab Status**               | Optional widget for self-hosted service health monitoring.                                                           |
| **Reactive Grid Layout**         | Fully draggable and resizable widget grid. Breakpoints configurable per viewport width.                              |
| **Theme System**                 | 8 built-in presets (Light, Dark, Dev × 3, Coffee × 3) plus fully custom and randomly generated palettes.             |
| **Wallpaper & Video Background** | Supports static wallpaper images and looping video backgrounds with a frosted glass overlay.                         |


---

*Last updated: April 2026 · Source of truth: `src/settings/themeTokens.ts`, `src/styles/index.css`, `manifest.json`*