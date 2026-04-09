/**
 * Connects to an already-running Chromium-based browser (Brave, Chrome, Edge)
 * that was started with --remote-debugging-port, finds this extension's service
 * worker, and calls chrome.runtime.reload().
 *
 * Env:
 *   CDP_PORT          - default 9222
 *   EXT_MANIFEST_NAME - must match manifest.json "name" (default: Tabreeze)
 */
import puppeteer from "puppeteer-core";

const port = process.env.CDP_PORT || "9222";
const manifestName = process.env.EXT_MANIFEST_NAME || "Tabreeze";

async function reloadExtension() {
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${port}`,
    });
  } catch {
    console.warn(
      `[ext-reload] No browser on port ${port}. Start Brave with: --remote-debugging-port=${port}`
    );
    return;
  }

  try {
    const targets = await browser.targets();
    const candidates = targets.filter(
      (t) =>
        t.type() === "service_worker" &&
        t.url().startsWith("chrome-extension://")
    );

    for (const target of candidates) {
      const name = await readManifestName(target);
      if (name !== manifestName) continue;

      const worker = await target.worker();
      if (worker) {
        await worker.evaluate(() => chrome.runtime.reload());
      } else {
        const session = await target.createCDPSession();
        await session.send("Runtime.evaluate", {
          expression: "chrome.runtime.reload()",
          awaitPromise: true,
        });
      }

      console.log(`[ext-reload] Reloaded extension "${manifestName}"`);
      return;
    }

    console.warn(
      `[ext-reload] Could not find a service worker for "${manifestName}". Load unpacked from dist/ once on brave://extensions.`
    );
  } finally {
    await browser.disconnect();
  }
}

/** Read manifest name without assuming WebWorker API is exposed. */
async function readManifestName(target) {
  try {
    const worker = await target.worker();
    if (worker) {
      return await worker.evaluate(() => chrome.runtime.getManifest().name);
    }
    const session = await target.createCDPSession();
    const { result, exceptionDetails } = await session.send("Runtime.evaluate", {
      expression: "chrome.runtime.getManifest().name",
      returnByValue: true,
    });
    if (exceptionDetails) return null;
    return result.value;
  } catch {
    return null;
  }
}

reloadExtension().catch((err) => {
  console.warn("[ext-reload]", err.message || err);
});
