# Tabreeze — Product demo video design spec

**Audience:** Marketing / video production  
**Purpose:** Turn this into a short, proud product demo (hero + feature beats + customization payoff).  
**Product:** **Tabreeze** — a Chrome/Edge (Manifest V3) **new tab** extension that replaces the blank stock page with a **personal productivity dashboard**.

---

## One-line pitch

Every time you hit **Ctrl+T**, Tabreeze gives you **your** layout: search, bookmarks, tasks, calendar, weather, and more—on a **tile grid** that adapts to your screen—or follows **breakpoints you define**.

---

## What Tabreeze is (for the script)

- **Not** another bookmark bar tweak—it **replaces the new tab page** with a full dashboard (`chrome_url_overrides.newtab`).
- Built for people who open tabs constantly and want **one glance** at search, links, schedule, and tasks.
- **Local-first feel:** layout, theme, and many preferences persist in the browser; bookmarks use the **Chrome Bookmarks API** (`bookmarks` permission).
- **Polished UI:** React + TypeScript + Tailwind—modern cards, light/dark, optional wallpaper and deep theme control.

**Name story (optional VO line):** “Tabreeze” evokes **Tabriz** + **breeze**—a calm, personal tab you actually want to land on.

---

## Widget inventory (must-hit list for the video)

These are the **first-class dashboard tiles** users add, remove, resize, and arrange. Use **on-screen labels** that match the in-app names where possible.


| Widget (in-app label) | Why it matters on camera                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Greeting + Clock**  | Instant “human” moment—time-aware header, welcoming first frame.                                                                                                           |
| **Search Bar**        | **High demo value:** show typing → launch. Highlight **multiple providers** (built-ins + custom).                                                                          |
| **Bookmarks**         | **Chrome-native:** real bookmarks, folders, search—power user credibility.                                                                                                 |
| **Quotes / News**     | **Dual mode:** calm “daily quote” *or* live **news**—shows breadth without two separate widgets.                                                                           |
| **Tasks**             | Simple productivity hook; show **drag-and-drop reorder** if time allows.                                                                                                   |
| **Calendar**          | **Google + Outlook** (position as “connects to how you already work”).                                                                                                     |
| **Weather**           | Quick at-a-glance utility; good B-roll while narrating layout.                                                                                                             |
| **Homelab Services**  | **Differentiator for technical users:** service URLs, **reachability / ping-style status**, optional ties to bookmarks—great “this gets me” beat for devs & homelab crowd. |


**Side panels (if you show settings / edge UI):** Left/right **side slots** can host a widget for quick access from the sides of the dashboard—mention briefly as “extra surface area” if visible in the build.

---

## Customizability deep dive (hero differentiators)

### 1) Tile-based grid system

- The dashboard is a **real grid of tiles**, not a fixed template.
- Users **add and remove** widgets, **drag to reorder**, and **resize** tiles within **per-widget min/max** spans so layouts stay sane.
- Each tile has a **position** (column/row start) and **span** (how many columns/rows it occupies)—this is the “power user” layout model under the hood.

**Video beat:** Wide shot of dashboard → enter **layout/edit mode** → drag a tile → resize handles → drop—then exit edit mode and use a widget immediately.

### 2) Two layout modes: Reactive vs custom breakpoints

**Reactive mode (automatic)**  

- The grid **responds to viewport width/height**: column count and row height adjust by **preset**.
- **Presets:** **Balanced** (default readability), **Focus** (fewer, larger columns), **Dense** (more on screen).
- Users can set a **preferred column count** (within safe caps) so the auto layout respects their taste.
- **Animation style** for layout changes: **None / Subtle / Smooth**—nice micro-moment for polish in post.

**Custom breakpoints mode (manual control)**  

- Users define **breakpoint profiles**: each profile has a **viewport range** (width × height window) and its **own grid spec + full tile layout**.
- **Per-profile grid controls:** column count (quick picks like 4/6/8/10/12), **row height (px)**, and **gap (px)**—so “mobile vs ultrawide” can look *intentionally* different, not just scaled.
- **Timeline / boundary editing** UI: profiles sort by range; boundaries can be adjusted for where one layout hands off to the next.

**Video beat:** Split screen or quick resize of the browser window: **same user, three layouts** as breakpoints kick in—or contrast **Reactive preset** slider vs **custom profile** switching.

### 3) Search is yours

- Built-in sources include **Google, ChatGPT, Claude, Bing, Perplexity** (exact set to confirm on camera).
- **Up to 5 custom search sources** via URL templates (`{query}` / `%s` style)—great “make it yours” line for pros who live in niche tools.

### 4) Look & feel

- **Light/dark** and rich **theme token** controls (accent, surfaces, borders, etc.), with **preset themes** and optional **locks** on tokens you don’t want randomized.
- **Theme automation** (e.g. time-of-day / sun-aware patterns—position accurately to what the build exposes in Settings).
- **Wallpaper** support for a cinematic background (great for trailer shots).

---

## Suggested narrative arc (60–90s)

1. **Cold open:** Stock new tab vs Tabreeze—same keystroke, totally different outcome.
2. **“Your command center”:** Search bar → one bookmark drill → task check-off.
3. **“Built-in + personal”:** Calendar glance + weather; Quotes/News mode toggle.
4. **“Power layout”:** Tile edit mode—drag/resize; mention **grid** and **widget spans**.
5. **“Fits every screen”:** Reactive presets **or** custom breakpoints with distinct phone/tablet/desktop layouts.
6. **Closer:** Homelab widget status checks + line about **privacy/local dashboard** (no account required for core use—word to legal/product if you add cloud later).

---

## B-roll & capture checklist

- New tab override loading Tabreeze (Chrome/Edge).  
- Layout edit mode: add widget, drag, resize, save.  
- Breakpoint manager: two profiles, resize window to trigger switch.  
- Reactive mode: toggle **Balanced / Focus / Dense** with same widgets.  
- Grid panel: **columns**, **row height** slider, **gap** slider (custom breakpoint profile).  
- Search: switch provider; show **custom source** if possible.  
- Bookmarks: folder path visible, search.  
- Tasks: reorder.  
- Quotes vs News toggle.  
- Calendar + Weather on one screen.  
- Homelab: service list with **online/offline** state change (or checking → result).  
- Theme: light→dark; optional wallpaper hero shot.

---

## Messaging guardrails

- Say **“new tab dashboard”** or **“replaces your new tab page”**—avoid implying it changes Google Search the website unless you show that explicitly.  
- **Bookmarks** are **synced from the browser**—not a separate cloud bookmark product.  
- **Calendar** integrations: phrase as **Google and Outlook support** per product positioning; show OAuth/consent only if required in the shipped flow.  
- **Homelab pings** may hit user-configured URLs—frame as **optional** and **user-controlled endpoints**.

---

## Technical credibility (optional lower-third)

React · TypeScript · Tailwind · Vite · **Chrome Manifest V3**

---

## Appendix: widget registry (source of truth)

In code, widget types are: `greeting`, `search`, `bookmarks`, `quotes`, `tasks`, `calendar`, `weather`, `homelab` — with human labels such as **“Greeting + Clock”**, **“Quotes / News”**, and **“Homelab Services”** for UI and marketing consistency.