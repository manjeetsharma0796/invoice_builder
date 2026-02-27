const path = require('path');
const fs = require('fs');
const { renderPdfFromTemplate } = require('./pdfRenderer');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/**
 * Normalize extracted invoice data → EJS template variable names.
 * The extractor uses schema names (vendor, bill_to, unit_price…)
 * while templates use human-friendly names matching the prompt variable list.
 */
function normalizeForTemplate(d) {
    const v = d.vendor || {};
    const b = d.bill_to || {};

    const lineItems = (d.line_items || []).map((item, i) => ({
        sl_no:              item.sl_no != null ? item.sl_no : i + 1,
        description:        item.description || '',
        hsn_sac:            item.hsn_sac || '',
        gst_rate:           item.tax_rate != null ? `${item.tax_rate}%` : '',
        quantity:           item.quantity != null ? item.quantity : '',
        rate:               item.unit_price != null ? item.unit_price.toFixed(2) : '',
        per:                item.unit || 'pcs',
        disc_percent:       item.discount != null ? item.discount : '',
        amount:             item.amount != null ? item.amount.toFixed(2) : '',
        // pass-through any extra fields the extractor found
        ...item,
    }));

    const hsnSummary = (d.hsn_summary || []).map(row => ({
        hsn_sac:        row.hsn_sac || '',
        taxable_value:  row.taxable_value != null ? row.taxable_value.toFixed(2) : '',
        cgst_rate:      row.cgst_rate != null ? `${row.cgst_rate}%` : '',
        cgst_amount:    row.cgst_amount != null ? row.cgst_amount.toFixed(2) : '',
        sgst_rate:      row.sgst_rate != null ? `${row.sgst_rate}%` : '',
        sgst_amount:    row.sgst_amount != null ? row.sgst_amount.toFixed(2) : '',
        total_tax:      row.total_tax != null ? row.total_tax.toFixed(2) : '',
        ...row,
    }));

    const fmtAmt = n => (n != null ? Number(n).toFixed(2) : '');

    return {
        // Raw data passthrough (so templates can access any field directly)
        ...d,

        // Company / vendor (static in template but useful for multi-vendor scenarios)
        vendor_name:     v.name || '',
        vendor_address:  v.address || '',
        vendor_gstin:    v.gstin || '',
        vendor_phone:    v.phone || '',

        // Customer / bill-to
        client_name:     b.name || '',
        client_address:  b.address || '',
        client_gstin:    b.gstin || '',
        client_state:    b.state || (d.bill_to_state) || '',
        client_pan:      b.pan || d.buyer_pan || '',

        // Invoice meta
        invoice_number:  d.invoice_number || '',
        invoice_date:    d.invoice_date || '',
        due_date:        d.due_date || '',
        delivery_note:   d.delivery_note || '',
        supplier_ref:    d.supplier_ref || '',
        buyer_order_no:  d.purchase_order || d.buyer_order_no || '',
        despatch_doc_no: d.despatch_doc_no || '',
        despatch_through:d.despatch_through || '',
        destination:     d.destination || '',
        terms_of_delivery: d.terms_of_delivery || '',
        payment_terms:   d.payment_terms || '',

        // Financials
        subtotal:   fmtAmt(d.subtotal),
        sgst_amount: fmtAmt(d.sgst_amount || (d.tax_amount ? d.tax_amount / 2 : null)),
        cgst_amount: fmtAmt(d.cgst_amount || (d.tax_amount ? d.tax_amount / 2 : null)),
        igst_amount: fmtAmt(d.igst_amount),
        tax_amount:  fmtAmt(d.tax_amount),
        round_off:   fmtAmt(d.round_off || 0),
        total_amount: fmtAmt(d.total_amount),

        // Words
        amount_in_words:    d.amount_in_words || d.total_in_words || '',
        tax_amount_in_words: d.tax_amount_in_words || '',

        // Collections
        line_items:  lineItems,
        hsn_summary: hsnSummary,

        // Helpers
        formatDate: (dateStr) => {
            if (!dateStr) return '';
            try { return new Date(dateStr).toLocaleDateString('en-IN'); } catch { return dateStr; }
        },
        formatCurrency: (amount, symbol = '') => {
            if (amount == null) return '';
            return `${symbol}${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        },
    };
}

/**
 * Generate a PDF invoice using an EJS template.
 *
 * This supports two calling styles:
 *  1) generateInvoicePdf(data)                    → uses "default.ejs", returns Buffer
 *  2) generateInvoicePdf(data, nameOrPath, out)  → writes PDF to out, returns out path
 *
 * - nameOrPath: template name ("standard_gst") OR absolute path to .ejs
 * - outputPath: if provided, PDF is written to disk at this location
 *
 * @param {object} invoiceData   Extracted JSON data
 * @param {string} [nameOrPath]  Template name (without .ejs) or absolute .ejs path
 * @param {string} [outputPath]  Optional path where the PDF should be saved
 * @returns {Promise<Buffer|string>} PDF buffer (no out path) or outputPath
 */
async function generateInvoicePdf(invoiceData, nameOrPath = 'default', outputPath) {
    let templatePath;

    if (!nameOrPath) {
        // Fallback to default.ejs in templates directory
        templatePath = path.join(TEMPLATES_DIR, 'default.ejs');
    } else {
        // If caller passed an absolute/relative path, honour it.
        const looksLikePath =
            nameOrPath.includes(path.sep) ||
            nameOrPath.endsWith('.ejs') ||
            nameOrPath.startsWith('.') ||
            nameOrPath.startsWith('/');

        if (looksLikePath) {
            templatePath = nameOrPath.endsWith('.ejs')
                ? nameOrPath
                : `${nameOrPath}.ejs`;
        } else {
            // Treat as template name living under TEMPLATES_DIR
            templatePath = path.join(TEMPLATES_DIR, `${nameOrPath}.ejs`);
        }
    }

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found at ${templatePath}`);
    }

    const context = normalizeForTemplate(invoiceData);
    const pdfBuffer = await renderPdfFromTemplate(templatePath, context);

    if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, pdfBuffer);
        return outputPath;
    }

    return pdfBuffer;
}

/**
 * List available EJS templates
 */
function listTemplates() {
    if (!fs.existsSync(TEMPLATES_DIR)) {
        fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
        return [];
    }
    return fs.readdirSync(TEMPLATES_DIR)
        .filter(file => file.endsWith('.ejs'))
        .map(file => file.replace('.ejs', ''));
}

module.exports = {
    generateInvoicePdf,
    listTemplates,
    normalizeForTemplate,
};
