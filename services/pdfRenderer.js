const puppeteer = require('puppeteer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let browser = null;

const PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR
    || path.join(__dirname, '..', '.cache', 'puppeteer');

try {
    fs.mkdirSync(PUPPETEER_CACHE_DIR, { recursive: true });
    process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_DIR;
} catch (e) { }

function ensureChromeInstalled() {
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const args = ["puppeteer", "browsers", "install", "chrome"];
    const result = spawnSync(npxCmd, args, {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
        env: { ...process.env, PUPPETEER_CACHE_DIR },
    });
    if (typeof result.status === "number" && result.status !== 0) {
        throw new Error(`Failed to install Chrome (exit code ${result.status})`);
    }
}

async function getBrowser() {
    if (!browser) {
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        } catch (err) {
            const msg = String(err?.message || err || "");
            if (msg.includes("Could not find Chrome")) {
                console.warn("[pdfRenderer] Chrome not found. Installing Chrome via Puppeteer...");
                ensureChromeInstalled();
                browser = await puppeteer.launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
            } else {
                throw err;
            }
        }
    }
    return browser;
}

/**
 * Compile EJS template with data and render to PDF
 * @param {string} templatePath - Absolute path to .ejs template
 * @param {object} data - Data to inject into template
 * @returns {Promise<Buffer>} PDF buffer
 */
async function renderPdfFromTemplate(templatePath, data) {
    // 1. Compile EJS to HTML
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const html = ejs.render(templateContent, data);

    // 2. Launch/Get Browser
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        // 3. Set content
        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });

        // 4. Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                bottom: '20px',
                left: '20px',
                right: '20px'
            }
        });

        return pdfBuffer;
    } finally {
        await page.close();
    }
}

/**
 * Render raw HTML string to PDF (for previewing generated templates)
 * @param {string} htmlContent - Raw HTML string
 * @returns {Promise<Buffer>} PDF buffer
 */
async function renderPdfFromHtml(htmlContent) {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });

        return await page.pdf({
            format: 'A4',
            printBackground: true
        });
    } finally {
        await page.close();
    }
}

// Ensure browser closes on exit
process.on('exit', async () => {
    if (browser) await browser.close();
});

module.exports = {
    renderPdfFromTemplate,
    renderPdfFromHtml
};
