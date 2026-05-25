import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(rootDir, "dist");
const releaseDir = join(rootDir, "release");
const stagingDir = join(releaseDir, "tabreeze-extension");
const zipPath = join(releaseDir, "tabreeze-extension.zip");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const REQUIRED_DIST_FILES = [
  "manifest.json",
  "index.html",
  "background.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

const EXCLUDED_EXTENSIONS = new Set([".map", ".md"]);
const EXCLUDED_FILE_NAMES = new Set([".ds_store", "thumbs.db"]);

function fail(message) {
  console.error(`\n[pack:ext] ${message}`);
  process.exit(1);
}

function run(command, args, label, cwd = rootDir) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) fail(`${label} failed.`);
}

function shouldIncludeFile(filePath) {
  const fileName = filePath.toLowerCase().split(/[\\/]/).pop() ?? "";
  const extension = extname(fileName);
  if (EXCLUDED_FILE_NAMES.has(fileName)) return false;
  if (EXCLUDED_EXTENSIONS.has(extension)) return false;
  if (fileName.includes(".license")) return false;
  return true;
}

function copyFilteredDirectory(sourceDir, targetDir) {
  const entries = readdirSync(sourceDir);
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      mkdirSync(targetPath, { recursive: true });
      copyFilteredDirectory(sourcePath, targetPath);
      continue;
    }

    if (!shouldIncludeFile(sourcePath)) continue;
    cpSync(sourcePath, targetPath);
  }
}

function verifyRequiredArtifacts() {
  for (const relativePath of REQUIRED_DIST_FILES) {
    if (!existsSync(join(distDir, relativePath))) {
      fail(`Missing required build artifact: dist/${relativePath}`);
    }
  }
}

function collectFiles(dir, baseDir = dir, out = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectFiles(fullPath, baseDir, out);
      continue;
    }
    out.push(relative(baseDir, fullPath));
  }
  return out;
}

function createZipFromStaging() {
  if (process.platform === "win32") {
    run(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Compress-Archive -Path "${stagingDir}\\*" -DestinationPath "${zipPath}" -Force`,
      ],
      "Zip creation"
    );
    return;
  }

  run("zip", ["-r", zipPath, "."], "Zip creation (zip)", stagingDir);
}

console.log("[pack:ext] Building extension...");
run(npmCommand, ["run", "build"], "Build");

if (!existsSync(distDir)) fail("dist folder not found after build.");
verifyRequiredArtifacts();

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });
mkdirSync(releaseDir, { recursive: true });
rmSync(zipPath, { force: true });

console.log("[pack:ext] Copying filtered build artifacts...");
copyFilteredDirectory(distDir, stagingDir);

const includedFiles = collectFiles(stagingDir).sort();
if (includedFiles.length === 0) fail("No files included in release package.");

console.log("[pack:ext] Creating upload zip...");
createZipFromStaging();

console.log("\n[pack:ext] Package ready.");
console.log(`[pack:ext] Staging folder: ${stagingDir}`);
console.log(`[pack:ext] Zip file: ${zipPath}`);
console.log(`[pack:ext] Included ${includedFiles.length} files`);
