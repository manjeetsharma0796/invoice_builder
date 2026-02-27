const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { extractInvoice } = require("../services/extractor");
const { getConfig } = require("../services/llm");
const { readTemplateImage } = require("../services/templateReader");
const { generateInvoicePdf } = require("../services/pdfTemplater");
const { fillDefaultTemplate, fillDynamicTemplate, fillExcelTemplate } = require("../services/filler");
const { isSupported, cleanupFile, getSupportedFormats } = require("../services/fileHandler");

const router = express.Router();

function logStep(invoiceId, message) {
  console.log(`[${invoiceId}] ${message}`);
}

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

// Excel MIME types for custom template upload
const EXCEL_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
];

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (isSupported(file.mimetype)) {
      cb(null, true);
    } else if (file.fieldname === "form_image" && EXCEL_TYPES.includes(file.mimetype)) {
      // Allow Excel files only for the template field
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Supported: PDF, JPG, PNG, WebP, TIFF, XLSX`));
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
      const startedAt = Date.now();

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
      const config = getConfig();

      logStep(invoiceId, `Processing invoice: ${rawInvoice.originalname}`);
      logStep(
        invoiceId,
        `Provider: ${config.activeProvider} / ${config.activeModel}`
      );
      logStep(invoiceId, `Raw invoice type: ${rawInvoice.mimetype}`);
      logStep(invoiceId, `Raw invoice size: ${Math.round(rawInvoice.size / 1024)} KB`);
      if (formImage) {
        logStep(invoiceId, `Form image: ${formImage.originalname}`);
        logStep(invoiceId, `Form image type: ${formImage.mimetype}`);
      }

      // Step 1: Extract invoice data using AI
      logStep(invoiceId, "Extracting data...");
      const extraction = await extractInvoice(rawInvoice.path, rawInvoice.mimetype, invoiceId);
      logStep(invoiceId, `Extraction completed in ${Date.now() - startedAt} ms`);

      if (!extraction.success) {
        logStep(invoiceId, `❌ Extraction failed: ${extraction.error}`);
        if (extraction.parseError) logStep(invoiceId, `   Parse error: ${extraction.parseError}`);
        logStep(invoiceId, `   Raw response snippet: ${String(extraction.rawResponse || "").slice(0, 500)}`);
        cleanupFile(rawInvoice.path);
        if (formImage) cleanupFile(formImage.path);
        return res.status(422).json({
          success: false,
          error: extraction.error,
          parseError: extraction.parseError,
          rawResponseSnippet: String(extraction.rawResponse || "").slice(0, 800),
          provider: config.activeProvider,
          model: config.activeModel,
        });
      }

      const { template_name } = req.body;

      // Step 2: Fill template
      const outputDir = path.join(__dirname, "..", "outputs");
      const isPdfOutput = !!template_name;
      const outputFilename = isPdfOutput ? `invoice_${invoiceId}.pdf` : `invoice_${invoiceId}.xlsx`;
      const outputPath = path.join(outputDir, outputFilename);

      if (isPdfOutput) {
        logStep(invoiceId, `Generating PDF using template name: ${template_name}`);
        // template_name is the logical name (without .ejs); pdfTemplater resolves it.
        await generateInvoicePdf(extraction.data, template_name, outputPath);
        logStep(invoiceId, "Generated PDF template successfully");
      } else if (formImage) {
        const isExcel = EXCEL_TYPES.includes(formImage.mimetype);

        if (isExcel) {
          // Excel template: fill directly using label-matching (no AI needed)
          logStep(invoiceId, `Excel template detected: ${formImage.originalname}`);
          await fillExcelTemplate(extraction.data, formImage.path, outputPath);
          logStep(invoiceId, "Filled Excel template directly");
        } else {
          // Image or PDF template: AI reads layout → fills dynamically
          logStep(invoiceId, `Reading custom form template (${formImage.mimetype})...`);
          const templateResult = await readTemplateImage(formImage.path, formImage.mimetype);

          if (!templateResult.success) {
            logStep(invoiceId, `Template read failed: ${templateResult.error}`);
            cleanupFile(rawInvoice.path);
            cleanupFile(formImage.path);
            return res.status(422).json({
              success: false,
              error: templateResult.error,
              rawResponse: templateResult.rawResponse,
            });
          }

          await fillDynamicTemplate(extraction.data, templateResult.structure, outputPath);
          logStep(invoiceId, "Filled dynamic template");
        }
      } else {
        // Default template
        logStep(invoiceId, "Filling default template...");
        await fillDefaultTemplate(extraction.data, outputPath);
      }

      // Save JSON alongside Excel
      const jsonOutputPath = path.join(outputDir, `invoice_${invoiceId}.json`);
      fs.writeFileSync(jsonOutputPath, JSON.stringify(extraction.data, null, 2));

      // Cleanup uploaded files
      cleanupFile(rawInvoice.path);
      if (formImage) cleanupFile(formImage.path);

      logStep(invoiceId, `Saved outputs to ${outputFilename}`);
      logStep(invoiceId, `Done in ${Date.now() - startedAt} ms`);

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
 * Download filled Excel or PDF file
 */
router.get("/:id/download", (req, res) => {
  const outputDir = path.join(__dirname, "..", "outputs");
  const invoiceId = req.params.id;

  // Search for the file (could be .xlsx or .pdf)
  const files = fs.readdirSync(outputDir);
  const file = files.find((f) => f.startsWith(`invoice_${invoiceId}`) && (f.endsWith(".xlsx") || f.endsWith(".pdf")));

  if (!file) {
    return res.status(404).json({ success: false, error: "Invoice file not found" });
  }

  const filePath = path.join(outputDir, file);
  res.download(filePath, file);
});

/**
 * GET /api/invoice/formats/supported
 * List supported input formats
 */
router.get("/formats/supported", (req, res) => {
  res.json({ success: true, formats: getSupportedFormats() });
});

module.exports = router;
