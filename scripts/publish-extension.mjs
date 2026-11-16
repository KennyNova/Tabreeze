import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const zipPath = join(rootDir, "release", "tabreeze-extension.zip");
const envPath = join(rootDir, ".env");
const API_BASE = "https://chromewebstore.googleapis.com";

const REQUIRED_ENV = [
  "CWS_CLIENT_ID",
  "CWS_CLIENT_SECRET",
  "CWS_REFRESH_TOKEN",
  "CWS_PUBLISHER_ID",
  "CWS_EXTENSION_ID",
];

function fail(message) {
  console.error(`\n[publish:ext] ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[publish:ext] ${message}`);
}

// Minimal .env reader so the script has no extra dependencies.
function loadEnvFile() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

async function readJson(response, label) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) fail(`${label} failed (${response.status}): ${JSON.stringify(body, null, 2)}`);
  return body;
}

async function getAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.CWS_CLIENT_ID,
      client_secret: process.env.CWS_CLIENT_SECRET,
      refresh_token: process.env.CWS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const body = await readJson(response, "Token refresh");
  return body.access_token;
}

async function main() {
  loadEnvFile();
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) fail(`Missing env vars (set them in .env): ${missing.join(", ")}`);
  if (!existsSync(zipPath)) fail(`No package at ${zipPath}. Run "npm run pack:ext" first.`);

  const itemName = `publishers/${process.env.CWS_PUBLISHER_ID}/items/${process.env.CWS_EXTENSION_ID}`;
  const token = await getAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  log(`Uploading ${zipPath}...`);
  const upload = await readJson(
    await fetch(`${API_BASE}/upload/v2/${itemName}:upload`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/zip" },
      body: readFileSync(zipPath),
    }),
    "Upload"
  );
  log(`Upload state: ${upload.uploadState ?? "unknown"}${upload.crxVersion ? ` (v${upload.crxVersion})` : ""}`);
  if (upload.uploadState === "FAILED") fail(`Upload rejected: ${JSON.stringify(upload, null, 2)}`);

  log("Submitting for review...");
  const publish = await readJson(
    await fetch(`${API_BASE}/v2/${itemName}:publish`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    "Publish"
  );
  log(`Submission state: ${publish.state ?? JSON.stringify(publish)}`);
  log("Done.");
}

main().catch((error) => fail(error?.stack ?? String(error)));
