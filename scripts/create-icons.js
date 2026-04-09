import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Minimal valid 1x1 blue PNG placeholder
const buf = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==",
  "base64"
);

[16, 48, 128].forEach((size) => {
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), buf);
  console.log(`Created placeholder icon${size}.png`);
});

console.log(
  "\nFor proper icons, open scripts/generate-icons.html in a browser and save the canvases."
);
