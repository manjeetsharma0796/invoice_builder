const { join } = require("path");

// Force Puppeteer's browser cache into the project directory.
// This makes the downloaded Chrome available at runtime on Render
// (build-time caches like /opt/render/.cache may not persist into the running service).
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};

