# Tabreeze Video QA and Export Checklist

Use this checklist before publishing.

## Claim Accuracy QA

- Video states Tabreeze `replaces the new tab page` (no popup language).
- Bookmarks are described as browser-native bookmarks.
- Homelab checks are presented as optional and user-configured.
- No claim implies modifying external Google Search behavior.
- Feature naming matches in-app labels where practical.

## Visual QA

- Keyframes use consistent browser framing and scale.
- Text is readable at 100% and mobile preview.
- No cursor flicker or accidental private data in captures.
- Light/dark comparison frames maintain same composition.
- CTA frame has clear safe area and contrast.

## Edit QA

- Runtime is between `60s` and `90s`.
- Captions are one-line and concise.
- Transition style follows: dissolve for similar states, directional only for section changes.
- Motion is subtle (no aggressive zoom or shake).
- VO and captions are synchronized.

## Audio QA

- Music sits under VO without masking speech.
- No clipping on master bus.
- Loudness normalized for target platform.

## Export Presets

### 16:9 Master

- Resolution: `1920x1080`
- FPS: `30`
- Codec: `H.264`
- Bitrate target: `15-20 Mbps`
- Filename: `tabreeze-product-demo-16x9-master.mp4`

### 9:16 Vertical Crop

- Resolution: `1080x1920`
- Keep search and central dashboard elements centered.
- Reposition lower-thirds upward to avoid platform UI overlap.
- Filename: `tabreeze-product-demo-9x16.mp4`

### 1:1 Square Crop

- Resolution: `1080x1080`
- Keep caption safe margins wider than usual.
- Prioritize dashboard center content over side widgets.
- Filename: `tabreeze-product-demo-1x1.mp4`

## Final Packaging

- Include source project file (`.prproj` / `.drp` / equivalent).
- Include `/assets/keyframes` folder with `KF-XX` naming.
- Include final script and messaging lock docs with the render handoff.

