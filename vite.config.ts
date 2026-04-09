import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname, join } from "node:path";
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = dirname(fileURLToPath(import.meta.url));

/** Ensures root manifest.json is written to dist (public/manifest.json was empty and overwrote nothing useful). */
function copyRootManifest(): Plugin {
  return {
    name: "copy-root-manifest",
    closeBundle() {
      copyFileSync(
        resolve(rootDir, "manifest.json"),
        resolve(rootDir, "dist/manifest.json")
      );
    },
  };
}

/** After each watch-mode build, ask the browser (remote debugging) to reload the extension. */
function reloadExtensionOnWatchBuild(): Plugin {
  return {
    name: "reload-extension-on-watch",
    writeBundle() {
      if (process.env.VITE_EXT_RELOAD !== "1") return;
      const script = join(rootDir, "scripts", "reload-extension.mjs");
      const child = spawn(process.execPath, [script], {
        cwd: rootDir,
        stdio: "inherit",
        detached: true,
        windowsHide: true,
      });
      child.unref();
    },
  };
}

export default defineConfig({
  plugins: [react(), copyRootManifest(), reloadExtensionOnWatchBuild()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        newtab: resolve(rootDir, "index.html"),
      },
    },
  },
});
