const puppeteer = require('puppeteer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

let browser = null;

async function getBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
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
