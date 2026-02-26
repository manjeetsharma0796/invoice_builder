require("dotenv").config();

const express = require("express");
const path = require("path");

const invoiceRoutes = require("./routes/invoice");
const configRoutes = require("./routes/config");
const viewRoutes = require("./routes/views");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ===== API Routes =====
app.use("/api/invoice", invoiceRoutes);
app.use("/api/config", configRoutes);

// ===== Frontend Routes =====
app.use("/", viewRoutes);

// ===== Error handling =====
app.use((err, req, res, next) => {
  // Multer file size error
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: `File too large. Max size: ${process.env.MAX_FILE_SIZE_MB || 10}MB`,
    });
  }

  // Multer / file type error
  if (err.message && err.message.includes("Unsupported file type")) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`\n  Invoice Agent running at http://localhost:${PORT}\n`);
  console.log(`  API Endpoints:`);
  console.log(`    POST /api/invoice/process    — Process invoice`);
  console.log(`    GET  /api/invoice/:id         — Get extracted data`);
  console.log(`    GET  /api/invoice/:id/download — Download filled Excel`);
  console.log(`    GET  /api/config/providers     — List providers`);
  console.log(`    POST /api/config/set           — Switch provider/model\n`);
});
