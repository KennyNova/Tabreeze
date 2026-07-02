# Tabreeze Feedback Endpoint Spec

This document is for the agent implementing the server endpoint on `navidmadani.com` (Next.js app) to receive Tabreeze survey and bug report submissions and email them to `navidm4598@gmail.com`.

## Goal

- Keep owner email private (never exposed in extension client code).
- Accept feedback payloads from the extension.
- Validate/sanitize input.
- Send a formatted email with report contents.
- Return safe JSON status for UI.

## Endpoint

- **Method:** `POST`
- **Path:** `/api/tabreeze-feedback`
- **Content-Type:** `application/json`

### Request Body

```json
{
  "reportType": "survey",
  "message": "Great extension, but weather widget freezes sometimes.",
  "rating": 4,
  "submittedAt": "2026-07-02T19:00:00.000Z",
  "extensionVersion": "1.1.0",
  "appUrl": "chrome://newtab/",
  "userAgent": "Mozilla/5.0 ...",
  "diagnostics": {
    "themePreset": "dev",
    "themeAutomationEnabled": true,
    "wallpaperEnabled": true,
    "onboardingCompleted": true,
    "showCustomizeButton": true
  }
}
```

### Field Rules

- `reportType`: required; enum: `survey | bug_report`
- `message`: required string; min length 3; max length 4000
- `rating`: optional; if present must be integer 1-5
- `submittedAt`: required ISO timestamp string
- `extensionVersion`: optional string (or null)
- `appUrl`: required string
- `userAgent`: required string
- `diagnostics`: optional object; allow null

## Response Contract

### Success

- HTTP `200`

```json
{
  "ok": true,
  "message": "Feedback received."
}
```

### Validation Error

- HTTP `400`

```json
{
  "ok": false,
  "message": "Invalid payload."
}
```

### Server Error

- HTTP `500`

```json
{
  "ok": false,
  "message": "Unable to process feedback."
}
```

## Email Requirements

- Send to: `navidm4598@gmail.com`
- Subject format:
  - `Tabreeze survey feedback`
  - `Tabreeze bug report`
- Body should include:
  - Report type
  - Message
  - Rating (if present)
  - Submitted timestamp
  - Extension version
  - App URL
  - User agent
  - Diagnostics JSON (if present)

## Security / Anti-abuse

- Add rate limiting (per IP + short window), for example:
  - 10 requests per 10 minutes per IP
- Reject oversized bodies early.
- Require exact method (`POST`) and JSON content type.
- Optionally add simple honeypot field check (must be absent/empty).
- Log only minimal metadata; avoid storing full personal data unnecessarily.

## CORS Guidance

Because extension requests can originate from Chrome extension contexts, support:

- `chrome-extension://*` origins for production extension
- local dev origin(s), typically `http://localhost:5173` or current Vite dev port

Recommended behavior:

- Read `Origin` header
- Allow only known list / trusted patterns
- Set:
  - `Access-Control-Allow-Origin`
  - `Access-Control-Allow-Methods: POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
- Respond to `OPTIONS` with `204`

## Suggested Next.js Route Shape

For Next.js App Router (`app/api/tabreeze-feedback/route.ts`):

```ts
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(req: NextRequest) {
  // return CORS headers
}

export async function POST(req: NextRequest) {
  // 1) Parse + validate payload
  // 2) Enforce anti-abuse checks
  // 3) Send email (Resend/Nodemailer/provider)
  // 4) Return { ok: true } on success
}
```

## Environment Variables (server)

- `TABREEZE_FEEDBACK_TO_EMAIL=navidm4598@gmail.com`
- `TABREEZE_FEEDBACK_FROM_EMAIL=<verified-sender>`
- Provider key(s), for example:
  - `RESEND_API_KEY` or
  - SMTP creds for Nodemailer

## Implementation Notes For Extension Compatibility

- Keep response JSON small and stable: always include `ok` boolean.
- Do not expose provider/internal errors in response; return generic message.
- Keep endpoint path stable once published (`/api/tabreeze-feedback`).
