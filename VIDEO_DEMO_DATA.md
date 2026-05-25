# Video Demo Data Quickstart

Use this to populate Tabreeze with realistic fake data for screenshots/video capture.

## Enable Demo Data
1. Start local dev server:
   - `npm run dev`
2. Open:
   - `http://localhost:5173/?videoDemo=1`

This seeds and persists demo data (name, location, weather, tasks, calendar events, bookmarks, search sources, quote/news cache, homelab statuses, wallpaper).

## Keep Demo Data Enabled
After first run with `?videoDemo=1`, demo mode remains enabled for that browser profile (stored in localStorage).  
You can open plain `http://localhost:5173/` and keep the seeded content.

## Disable Demo Mode
Open:
- `http://localhost:5173/?videoDemo=0`

This turns off automatic reseeding. Existing data stays until you clear site storage.

## What Gets Seeded
- `dashboard-username`: `Navid`
- Weather location: `San Francisco` (mock weather forced for stable visuals)
- Tasks: 4 sample product/workflow tasks
- Calendar: 4 upcoming local events
- Bookmarks: 8 demo links
- Search sources: Docs + YouTube custom providers
- News cache: 3 synthetic headlines
- Homelab: mixed online/offline/checking statuses
- Wallpaper: cinematic background image

