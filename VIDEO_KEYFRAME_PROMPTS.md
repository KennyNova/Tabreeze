# Tabreeze Keyframe Prompt Pack

Use these prompts to generate stylized filler keyframes that visually match your real captures.

## Base Prompt (Small Reusable Prompt)

`Create a clean SaaS product-demo keyframe for a browser new-tab dashboard called Tabreeze. Style: modern B2B SaaS, soft gradients, glassmorphism cards, subtle depth, premium UI polish, realistic browser chrome, 16:9. Scene: [SCENE_DESCRIPTION]. Keep text minimal and legible. Emphasize productivity widgets (search, bookmarks, tasks, calendar, weather), consistent spacing, and accessible contrast. Add gentle cinematic lighting, no clutter, no watermark, no logos except Tabreeze wordmark.`

## Transition Add-On

Append to any base prompt:

`Generate [N] sequential keyframes for the same interface with only incremental state changes between frames, preserving camera angle, lighting, and layout consistency to enable smooth morph/cut transitions in video editing.`

## Global Negative Prompt

`No distorted text, no duplicate UI elements, no floating toolbars, no unreadable micro-text, no random brand logos, no extra browser tabs, no watermark, no heavy bloom, no chaotic composition.`

## Scene Prompts (Copy/Paste)

### Scene A — Hero Dashboard

`[SCENE_DESCRIPTION] = A polished Tabreeze dashboard hero state with wallpaper, top-right settings button, tile layout visible, and a calm premium look.`

### Scene B — Search Focus

`[SCENE_DESCRIPTION] = Search widget focused with provider selector visible and a typed query, while the surrounding dashboard remains clean and subtly blurred.`

### Scene C — Bookmarks + Tasks Productivity

`[SCENE_DESCRIPTION] = Bookmarks widget with nested folders next to tasks with checked and unchecked items, showing practical daily workflow.`

### Scene D — Calendar + Weather Context

`[SCENE_DESCRIPTION] = Calendar events and weather card visible together in the same dashboard view, emphasizing at-a-glance planning.`

### Scene E — Layout Editing Moment

`[SCENE_DESCRIPTION] = Dashboard in layout edit mode with clear drag handles, resize handles, and save/exit controls, one tile being actively moved.`

### Scene F — Breakpoint/Reactive Adaptation

`[SCENE_DESCRIPTION] = Same dashboard adapting across screen sizes with subtle layout changes, showing responsive grid behavior and stable visual identity.`

### Scene G — Theme Shift

`[SCENE_DESCRIPTION] = Matched light and dark theme variants of the same layout, preserving component positions while palette transitions smoothly.`

### Scene H — Optional Homelab Differentiator

`[SCENE_DESCRIPTION] = Homelab services panel with mixed online/offline/checking statuses, integrated naturally into the productivity dashboard aesthetic.`

### Scene I — Closing CTA

`[SCENE_DESCRIPTION] = Final hero frame with clean lower-third safe area for CTA text: Tabreeze - Make every tab useful.`

## Generator Settings (Suggested)

- Aspect ratio: `16:9`
- Resolution: `1920x1080` minimum
- Style consistency seed: fixed per scene sequence
- Batch strategy: generate 4 to 8 candidates per scene, pick top 1 to 2

## Assembly Tip

For smooth transitions, pair each stylized frame with a real screenshot of a similar state. Use stylized frames as short bridge shots between real product captures.