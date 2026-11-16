// One-time helper: runs the OAuth consent flow and saves CWS_REFRESH_TOKEN to .env.
// Needs CWS_CLIENT_ID and CWS_CLIENT_SECRET (a "Desktop app" OAuth client) in .env first.
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(rootDir, ".env");
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";

function fail(message) {
  console.error(`\n[cws-auth] ${message}`);
  process.exit(1);
}

function readEnv() {
  const env = {};
  if (!existsSync(envPath)) return env;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}

function saveEnvValue(key, value) {
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(envPath, lines.join("\n").replace(/\n*$/, "\n"));
}

function openBrowser(url) {
  const [command, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url.replace(/&/g, "^&")]]
      : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
  spawn(command, args, { stdio: "ignore", detached: true }).unref();
}

const env = readEnv();
if (!env.CWS_CLIENT_ID || !env.CWS_CLIENT_SECRET) fail("Set CWS_CLIENT_ID and CWS_CLIENT_SECRET in .env first.");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const code = url.searchParams.get("code");
  if (!code) {
    res.end(`No code received: ${url.searchParams.get("error") ?? "unknown error"}`);
    return;
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.CWS_CLIENT_ID,
      client_secret: env.CWS_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.refresh_token) {
    res.end("Token exchange failed. Check the terminal.");
    server.close();
    fail(`Token exchange failed: ${JSON.stringify(body)}`);
  }
  saveEnvValue("CWS_REFRESH_TOKEN", body.refresh_token);
  res.end("Saved. You can close this tab.");
  console.log("[cws-auth] Refresh token saved to .env.");
  server.close();
});

let redirectUri;
server.listen(0, "127.0.0.1", () => {
  redirectUri = `http://127.0.0.1:${server.address().port}`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: env.CWS_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  }).toString();
  console.log(`[cws-auth] Opening consent page. If it doesn't open, visit:\n${authUrl}`);
  openBrowser(authUrl.toString());
});
