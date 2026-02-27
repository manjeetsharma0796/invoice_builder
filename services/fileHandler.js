const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

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
 * Extract text from PDF using pdf-parse v2
 */
async function extractPDFText(filePath) {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    try {
        const data = await parser.getText();
        return data.text || "";
    } finally {
        await parser.destroy().catch(() => { });
    }
}

/**
 * Render first PDF page as a PNG data URI using pdf-parse v2 getScreenshot
 */
async function pdfToImageDataUri(filePath) {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    try {
        const result = await parser.getScreenshot({ desiredWidth: 1600, partial: [1] });
        if (result && result.pages && result.pages[0]) {
            const page = result.pages[0];
            if (page.imageDataUrl) return page.imageDataUrl;
            if (page.data) {
                // pdf-parse v2 returns image data as a Uint8Array. Calling
                // toString("base64") on a Uint8Array produces a comma‑separated
                // list of numbers (e.g. "137,80,78,..."), which breaks APIs
                // that expect real base64. We must explicitly wrap it in a Buffer.
                const buf = Buffer.isBuffer(page.data)
                    ? page.data
                    : Buffer.from(page.data);
                return `data:image/png;base64,${buf.toString("base64")}`;
            }
        }
        throw new Error("getScreenshot returned no page data");
    } finally {
        await parser.destroy().catch(() => { });
    }
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

        // Scanned/image-based PDF — render first page as PNG for vision LLM
        console.log("[fileHandler] Scanned PDF detected — rendering page 1 as PNG...");
        const dataUri = await pdfToImageDataUri(filePath);
        return {
            type: "image",
            dataUri,
            mimeType: "image/png",
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
    pdfToImageDataUri,
    prepareForLLM,
    getSupportedFormats,
    cleanupFile,
    SUPPORTED_TYPES,
};
