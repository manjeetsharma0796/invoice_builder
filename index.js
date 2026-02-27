require("dotenv").config();

const express = require("express");
const path = require("path");

const invoiceRoutes = require("./routes/invoice");
const configRoutes = require("./routes/config");
const templateRoutes = require("./routes/templates");
const viewRoutes = require("./routes/views");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(express.json({ limit: "50mb" })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ===== Request Logger =====
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const ms = Date.now() - start;
        const color = res.statusCode >= 400 ? "\x1b[31m" : res.statusCode >= 300 ? "\x1b[33m" : "\x1b[32m";
        const reset = "\x1b[0m";
        console.log(`${color}[${res.statusCode}]${reset} ${req.method} ${req.path} → ${ms}ms`);
    });
    next();
});

// Static files
app.use(express.static(path.join(__dirname, "public")));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ===== API Routes =====
app.use("/api/invoice", invoiceRoutes);
app.use("/api/config", configRoutes);
app.use("/api/templates", templateRoutes);

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
    console.log(`\n  \x1b[36mInvoice Agent\x1b[0m running at http://localhost:${PORT}\n`);
    console.log(`  \x1b[33mMain Features:\x1b[0m`);
    console.log(`    - Dynamic Excel Filling (Classic Mode)`);
    console.log(`    - Pixel-Perfect PDF Reconstruction (New)`);
    console.log(`    - AI Template Builder (/builder)`);
});
