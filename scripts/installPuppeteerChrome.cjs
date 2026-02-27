const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const cacheDir = path.join(projectRoot, ".cache", "puppeteer");

try {
  fs.mkdirSync(cacheDir, { recursive: true });
} catch (e) {
  console.error("[puppeteer-install] Failed to create cache dir:", e?.message || e);
  process.exit(1);
}

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["puppeteer", "browsers", "install", "chrome"];

console.log(`[puppeteer-install] Installing Chrome into ${cacheDir}`);

const result = spawnSync(npxCmd, args, {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    // Ensure the install uses a cache directory that will be present at runtime.
    PUPPETEER_CACHE_DIR: cacheDir,
  },
});

process.exit(typeof result.status === "number" ? result.status : 1);

