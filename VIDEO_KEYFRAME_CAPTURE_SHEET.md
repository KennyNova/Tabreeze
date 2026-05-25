# Tabreeze Keyframe Capture Sheet

Use this as the live extension capture runbook. Keep all captures in `16:9` at `1920x1080`, same browser zoom (`100%`), and same window size for visual continuity.

## Capture Setup

- Browser: Chrome/Edge with Tabreeze loaded as unpacked extension.
- Open a fresh new tab so `Tabreeze` is the active page.
- Disable distracting browser UI (hide bookmarks bar if it clashes with composition).
- Keep cursor hidden when possible.
- Naming format: `KF-XX-short-name.png`.

## Required Keyframes


| Shot ID | Filename                                  | What to Capture                                                  | Framing Notes                                             |
| ------- | ----------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| KF-01   | `KF-01-hero-dashboard.png`                | Final polished dashboard with wallpaper enabled                  | Center entire dashboard, keep top-right settings visible  |
| KF-02   | `KF-02-search-focused.png`                | Search bar focused with provider shown and sample query typed    | Keep query legible, avoid clipping search source selector |
| KF-03   | `KF-03-bookmarks-depth.png`               | Bookmarks widget showing folder depth or nested path             | Ensure this clearly looks like browser bookmarks          |
| KF-04   | `KF-04-tasks-reordered.png`               | Tasks widget after reorder                                       | Show at least 3 tasks and obvious new order               |
| KF-05   | `KF-05-calendar-weather.png`              | Calendar and weather visible together                            | Both widgets readable in same frame                       |
| KF-06   | `KF-06-quotes-mode.png`                   | Quotes mode visible                                              | Keep quote text and mode label readable                   |
| KF-07   | `KF-07-news-mode.png`                     | News mode visible                                                | Keep at least 2 headlines visible                         |
| KF-08   | `KF-08-layout-toolbar.png`                | Layout edit mode with `Customize layout` / `Save & exit` visible | Capture toolbar plus tiles for context                    |
| KF-09   | `KF-09-mid-drag.png`                      | A tile mid-drag in edit mode                                     | Capture drag ghost/target state if possible               |
| KF-10   | `KF-10-mid-resize.png`                    | A tile mid-resize in edit mode                                   | Include resize handle and changed tile bounds             |
| KF-11   | `KF-11-layout-reactive-or-breakpoint.png` | Reactive preset controls or custom breakpoint panel              | Prefer whichever panel is visually clearer in your build  |
| KF-12   | `KF-12-light-theme.png`                   | Light theme frame                                                | Match framing with dark theme shot                        |
| KF-13   | `KF-13-dark-theme.png`                    | Dark theme frame                                                 | Same camera/framing as KF-12                              |
| KF-14   | `KF-14-homelab-status.png`                | Homelab with mixed status (online/offline/checking)              | Optional in short cut; required in full cut               |
| KF-15   | `KF-15-final-cta-hero.png`                | Clean hero with final CTA overlay area left clear                | Leave lower-third safe area uncluttered                   |


## Continuity Rules

- Keep the same widget arrangement between adjacent keyframes unless the scene is specifically demonstrating layout changes.
- Only one major change per keyframe pair to make transitions smooth.
- Do not change wallpaper, browser theme, and layout all at once.
- Maintain consistent top/bottom padding for easier cross-dissolve.

## Quick Capture Flow

1. Capture static hero states first (`KF-01`, `KF-12`, `KF-13`, `KF-15`).
2. Capture productivity feature states (`KF-02` to `KF-07`).
3. Capture layout-edit sequence (`KF-08` to `KF-11`).
4. Capture optional homelab proof (`KF-14`).
5. Verify names and resolution before moving to editing.