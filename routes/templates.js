const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateHtmlTemplate } = require('../services/templateGenerator');
const { renderPdfFromHtml } = require('../services/pdfRenderer');
const { listTemplates } = require('../services/pdfTemplater');

const router = express.Router();

// Configure multer for template reference images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) { }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => cb(null, `TEMPLATE-${Date.now()}-${file.originalname}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for reference images
});

/**
 * POST /api/templates/generate
 * Generate HTML/CSS template from uploaded image
 */
router.post('/generate', upload.single('reference_image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No reference image provided' });
        }

        const filePath = req.file.path;
        console.log(`[Template] Generating from ${filePath}`);

        // Generate HTML using Vision LLM
        const htmlCode = await generateHtmlTemplate(filePath);

        // Cleanup file
        try { fs.unlinkSync(filePath); } catch (e) { }

        res.json({
            success: true,
            html: htmlCode
        });

    } catch (error) {
        console.error('[Template] Generation failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/templates/preview
 * Render HTML -> PDF Buffer for previewing
 */
router.post('/preview', express.json({ limit: '2mb' }), async (req, res) => {
    try {
        const { html } = req.body;
        if (!html) return res.status(400).send('No HTML provided');

        // Render PDF
        const pdfBuffer = await renderPdfFromHtml(html);

        res.set('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (err) {
        console.error('[Template] Preview failed:', err);
        res.status(500).send(err.message);
    }
});

/**
 * POST /api/templates/save
 * Save HTML string as a .ejs template
 */
router.post('/save', express.json({ limit: '2mb' }), async (req, res) => {
    try {
        const { name, html } = req.body;
        if (!name || !html) return res.status(400).json({ error: 'Name and HTML are required' });

        // Sanitize filename
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
        const outPath = path.join(__dirname, '..', 'templates', `${safeName}.ejs`);

        fs.writeFileSync(outPath, html, 'utf-8');

        res.json({ success: true, name: safeName, path: outPath });
    } catch (err) {
        console.error('[Template] Save failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/templates
 * List available templates
 */
router.get('/', (req, res) => {
    try {
        const templates = listTemplates();
        res.json({ success: true, templates });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
