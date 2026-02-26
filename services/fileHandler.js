const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

// Supported MIME types
const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
];

const PDF_TYPES = ["application/pdf"];

const SUPPORTED_TYPES = [...IMAGE_TYPES, ...PDF_TYPES];

/**
 * Check if file type is supported
 */
function isSupported(mimetype) {
  return SUPPORTED_TYPES.includes(mimetype);
}

/**
 * Check if file is an image
 */
function isImage(mimetype) {
  return IMAGE_TYPES.includes(mimetype);
}

/**
 * Check if file is a PDF
 */
function isPDF(mimetype) {
  return PDF_TYPES.includes(mimetype);
}

/**
 * Convert file to base64 data URI for vision LLM
 */
function fileToBase64(filePath, mimetype) {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  return `data:${mimetype};base64,${base64}`;
}

/**
 * Extract text from PDF (for text-based PDFs)
 */
async function extractPDFText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  return data.text;
}

/**
 * Prepare file for LLM processing
 * Returns an object with type and content ready for the LLM
 */
async function prepareForLLM(filePath, mimetype) {
  if (isImage(mimetype)) {
    return {
      type: "image",
      dataUri: fileToBase64(filePath, mimetype),
      mimeType: mimetype,
    };
  }

  if (isPDF(mimetype)) {
    // For PDFs, try text extraction first
    const text = await extractPDFText(filePath);

    if (text && text.trim().length > 50) {
      // Text-based PDF — use extracted text
      return {
        type: "text",
        content: text,
        mimeType: mimetype,
      };
    }

    // Scanned/image-based PDF — send as base64 image
    return {
      type: "image",
      dataUri: fileToBase64(filePath, "application/pdf"),
      mimeType: "application/pdf",
    };
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
}

/**
 * Get human-readable list of supported formats
 */
function getSupportedFormats() {
  return {
    images: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".tiff"],
    documents: [".pdf"],
    maxSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || "10"),
  };
}

/**
 * Clean up uploaded file
 */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`Failed to cleanup file ${filePath}:`, err.message);
  }
}

module.exports = {
  isSupported,
  isImage,
  isPDF,
  fileToBase64,
  extractPDFText,
  prepareForLLM,
  getSupportedFormats,
  cleanupFile,
  SUPPORTED_TYPES,
};
