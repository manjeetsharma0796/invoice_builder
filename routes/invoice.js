const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { extractInvoice } = require("../services/extractor");
const { readTemplateImage } = require("../services/templateReader");
const { fillDefaultTemplate, fillDynamicTemplate } = require("../services/filler");
const { isSupported, cleanupFile, getSupportedFormats } = require("../services/fileHandler");

const router = express.Router();

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (isSupported(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Supported: PDF, JPG, PNG, WebP, TIFF`));
    }
  },
});

/**
 * POST /api/invoice/process
 * Main endpoint — upload raw invoice + optional form image
 * Returns extracted JSON + filled Excel download link
 */
router.post(
  "/process",
  upload.fields([
    { name: "raw_invoice", maxCount: 1 },
    { name: "form_image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      // Validate raw invoice was uploaded
      if (!req.files || !req.files.raw_invoice || req.files.raw_invoice.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No invoice file uploaded. Field name must be 'raw_invoice'.",
        });
      }

      const rawInvoice = req.files.raw_invoice[0];
      const formImage = req.files.form_image ? req.files.form_image[0] : null;

      const invoiceId = uuidv4();
      console.log(`[${invoiceId}] Processing invoice: ${rawInvoice.originalname}`);

      // Step 1: Extract invoice data using AI
      console.log(`[${invoiceId}] Extracting data...`);
      const extraction = await extractInvoice(rawInvoice.path, rawInvoice.mimetype);

      if (!extraction.success) {
        cleanupFile(rawInvoice.path);
        if (formImage) cleanupFile(formImage.path);
        return res.status(422).json({
          success: false,
          error: extraction.error,
          rawResponse: extraction.rawResponse,
        });
      }

      // Step 2: Fill template
      const outputDir = path.join(__dirname, "..", "outputs");
      const outputFilename = `invoice_${invoiceId}.xlsx`;
      const outputPath = path.join(outputDir, outputFilename);

      if (formImage) {
        // Dynamic form: AI reads template image → fills dynamically
        console.log(`[${invoiceId}] Reading custom form template...`);
        const templateResult = await readTemplateImage(formImage.path, formImage.mimetype);

        if (!templateResult.success) {
          cleanupFile(rawInvoice.path);
          cleanupFile(formImage.path);
          return res.status(422).json({
            success: false,
            error: templateResult.error,
            rawResponse: templateResult.rawResponse,
          });
        }

        await fillDynamicTemplate(extraction.data, templateResult.structure, outputPath);
        console.log(`[${invoiceId}] Filled dynamic template`);
      } else {
        // Default template
        console.log(`[${invoiceId}] Filling default template...`);
        await fillDefaultTemplate(extraction.data, outputPath);
      }

      // Save JSON alongside Excel
      const jsonOutputPath = path.join(outputDir, `invoice_${invoiceId}.json`);
      fs.writeFileSync(jsonOutputPath, JSON.stringify(extraction.data, null, 2));

      // Cleanup uploaded files
      cleanupFile(rawInvoice.path);
      if (formImage) cleanupFile(formImage.path);

      console.log(`[${invoiceId}] Done!`);

      res.json({
        success: true,
        invoiceId,
        data: extraction.data,
        download: `/api/invoice/${invoiceId}/download`,
        json: `/api/invoice/${invoiceId}`,
      });
    } catch (err) {
      console.error("Invoice processing error:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
      });
    }
  }
);

/**
 * GET /api/invoice/:id
 * Fetch extracted JSON data by invoice ID
 */
router.get("/:id", (req, res) => {
  const jsonPath = path.join(__dirname, "..", "outputs", `invoice_${req.params.id}.json`);

  if (!fs.existsSync(jsonPath)) {
    return res.status(404).json({ success: false, error: "Invoice not found" });
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  res.json({ success: true, invoiceId: req.params.id, data });
});

/**
 * GET /api/invoice/:id/download
 * Download filled Excel file
 */
router.get("/:id/download", (req, res) => {
  const xlsxPath = path.join(__dirname, "..", "outputs", `invoice_${req.params.id}.xlsx`);

  if (!fs.existsSync(xlsxPath)) {
    return res.status(404).json({ success: false, error: "Invoice file not found" });
  }

  res.download(xlsxPath, `invoice_${req.params.id}.xlsx`);
});

/**
 * GET /api/invoice/formats/supported
 * List supported input formats
 */
router.get("/formats/supported", (req, res) => {
  res.json({ success: true, formats: getSupportedFormats() });
});

module.exports = router;
