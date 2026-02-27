const fs = require('fs');
const path = require('path');
const { getLLM, isVisionCapable, getConfig } = require('./llm');
const { pdfToImageDataUri } = require('./fileHandler');
const { HumanMessage } = require("@langchain/core/messages");

/**
 * Generate an HTML/CSS template from an invoice image using a Vision LLM.
 * @param {string} imagePath - Path to the invoice image/PDF preview
 * @returns {Promise<string>} Generated HTML/EJS template code
 */
async function generateHtmlTemplate(imagePath) {
    const config = getConfig();

    // Ensure we have a vision-capable model
    if (!isVisionCapable(config.activeModel)) {
        throw new Error(`Current model "${config.activeModel}" does not support vision. Please switch to a vision model (e.g., gpt-4o, claude-3-5-sonnet) to generate templates.`);
    }

    const ext = path.extname(imagePath).toLowerCase();

    let dataUri;
    let mimeType;

    if (ext === '.pdf') {
        // For PDFs, render the first page to PNG just like the main pipeline,
        // then feed that image to the vision model.
        console.log("[templateGenerator] PDF detected — rendering first page to PNG...");
        dataUri = await pdfToImageDataUri(imagePath);
        mimeType = 'image/png';
    } else {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        mimeType = ext === '.png' ? 'image/png'
            : ext === '.webp' ? 'image/webp'
            : ext === '.gif'  ? 'image/gif'
            : 'image/jpeg';
        dataUri = `data:${mimeType};base64,${base64Image}`;
    }

    const prompt = `You are an elite Frontend Developer performing pixel-perfect invoice replication.

STEP 1 — ANALYZE the image section by section (do this mentally before writing code):
  A. Top area: company name, address, phone, GSTIN, any labels like "Original Buyer/Seller/Transporter"
  B. Title bar: e.g. "TAX INVOICE" — centered, bordered, bolded
  C. Two-column header block: Left = Customer/Bill-To details (name, address, PAN, GSTIN, state). Right = Invoice meta (Invoice No, Date, Delivery Note, Supplier Ref, Buyer Order No, Despatch Doc No, Despatch Through, Terms of Delivery, Mode of Payment, Destination)
  D. Line items table: List ALL column headers exactly as shown (Sl No., Description of Goods, HSN/SAC, GST Rate, Quantity, Rate, per, Disc%, Amount — whatever appears)
  E. Sub-total rows inside or below the table: SGST, CGST, Round Off, Total row
  F. "Amount Chargeable (in words)" row
  G. GST / HSN tax summary table: HSN/SAC, Taxable Value, Central Tax Rate/Amount, State Tax Rate/Amount, Total Tax Amount — and a totals row
  H. "Tax Amount (in words)" row
  I. Bottom two-column section: Left = Company Bank Details (Bank Name, Branch, IFSC, A/C No). Right = "For [Company Name]" and "Authorised Signatory"
  J. Footer: Any numbered terms and conditions text

STEP 2 — WRITE the HTML/CSS template following these STRICT RULES:

LAYOUT RULES:
- Use a single outer wrapper div with max-width ~750px, border: 1px solid #000, font-family: Arial/sans-serif, font-size: 11px
- The top company header uses a centered layout with a top-right label if present
- The two-column invoice header uses a CSS table or flex row, each column separated by a vertical border, with small labeled fields
- All tables use border-collapse: collapse, with 1px solid #000 borders on all cells
- Column widths in the line items table must approximately match the original proportions
- Sub-total rows (SGST, CGST, Round Off) appear as right-aligned rows inside the line items table, spanning description columns
- The GST breakdown table at the bottom is a separate full-width table
- The bank details / signatory section is a two-column flex or table row
- Footer terms use small font, numbered list style

EJS TEMPLATING RULES:
- STATIC TEXT that is always the same (company name, address, GSTIN, column headers, terms) → keep as hardcoded text
- DYNAMIC DATA that changes per invoice → replace with EJS tags using these exact variable names:
  * \`<%= client_name %>\`             — buyer/customer name
  * \`<%= client_address %>\`          — buyer address (use <%- %> if it contains line breaks/HTML)
  * \`<%= client_gstin %>\`            — buyer GSTIN/UIN
  * \`<%= client_state %>\`            — buyer state name & code
  * \`<%= invoice_number %>\`          — invoice / MR number
  * \`<%= invoice_date %>\`            — invoice date
  * \`<%= delivery_note %>\`           — delivery note value
  * \`<%= supplier_ref %>\`            — supplier reference
  * \`<%= buyer_order_no %>\`          — buyer order number
  * \`<%= despatch_doc_no %>\`         — despatch document number
  * \`<%= despatch_through %>\`        — despatch through / carrier
  * \`<%= destination %>\`             — destination
  * \`<%= terms_of_delivery %>\`       — terms of delivery
  * \`<%= amount_in_words %>\`         — amount chargeable in words
  * \`<%= total_amount %>\`            — grand total amount
  * \`<%= sgst_amount %>\`             — SGST amount
  * \`<%= cgst_amount %>\`             — CGST amount
  * \`<%= round_off %>\`               — round off amount
  * \`<%= tax_amount_in_words %>\`     — tax amount in words
  - Line items loop (reproduce ALL columns from the table):
    \`<% (line_items || []).forEach(function(item) { %>\`
    \`<%= item.sl_no %>\`, \`<%= item.description %>\`, \`<%= item.hsn_sac %>\`,
    \`<%= item.gst_rate %>\`, \`<%= item.quantity %>\`, \`<%= item.rate %>\`,
    \`<%= item.per %>\`, \`<%= item.disc_percent %>\`, \`<%= item.amount %>\`
    \`<% }); %>\`
  - HSN tax summary loop:
    \`<% (hsn_summary || []).forEach(function(row) { %>\`
    \`<%= row.hsn_sac %>\`, \`<%= row.taxable_value %>\`, \`<%= row.cgst_rate %>\`,
    \`<%= row.cgst_amount %>\`, \`<%= row.sgst_rate %>\`, \`<%= row.sgst_amount %>\`, \`<%= row.total_tax %>\`
    \`<% }); %>\`

OUTPUT RULES:
- Output ONLY the raw HTML. No markdown fences, no explanation, no comments outside the HTML.
- Start with exactly: <!DOCTYPE html>
- Include ALL sections found in the image — do not skip any section even if it seems complex
- Aim for the output to look indistinguishable from the original when printed
`;


    const llm = getLLM();

    // Some LangChain chat models support `.bind`, others expect options
    // passed per-invoke. Support both for maximum compatibility.
    const runnable = typeof llm.bind === "function" ? llm.bind({ max_tokens: 16000 }) : llm;

    const response = await runnable.invoke([
        new HumanMessage({
            content: [
                // Image FIRST — better attention from vision models
                {
                    type: "image_url",
                    image_url: {
                        url: dataUri,
                        detail: "high"
                    }
                },
                { type: "text", text: prompt }
            ]
        })
    ], typeof llm.bind === "function" ? undefined : { max_tokens: 16000 });

    let html = response.content;

    // Clean up markdown code blocks if the model included them
    html = html.replace(/```html/g, '').replace(/```/g, '').trim();

    return html;
}

module.exports = { generateHtmlTemplate };
