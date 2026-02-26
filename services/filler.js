const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const DEFAULT_TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "templates",
  "default_template.xlsx"
);

// Default cell mapping for the standard template
const DEFAULT_CELL_MAP = {
  // Header
  invoice_number: "C3",
  invoice_date: "C4",
  due_date: "C5",
  purchase_order: "C6",
  currency: "E3",

  // Vendor
  "vendor.name": "B9",
  "vendor.address": "B10",
  "vendor.gstin": "B11",
  "vendor.phone": "B12",
  "vendor.email": "B13",

  // Bill To
  "bill_to.name": "E9",
  "bill_to.address": "E10",
  "bill_to.gstin": "E11",

  // Line items start row
  line_items_start_row: 16,
  line_items_columns: {
    sl_no: "A",
    description: "B",
    hsn_sac: "C",
    quantity: "D",
    unit_price: "E",
    tax_rate: "F",
    amount: "G",
  },

  // Footer
  subtotal: "G__sub",
  discount_total: "G__disc",
  tax_amount: "G__tax",
  total_amount: "G__total",
  amount_in_words: "B__words",
  payment_terms: "B__terms",

  // Bank
  "bank_details.bank_name": "B__bank",
  "bank_details.account_number": "B__acc",
  "bank_details.ifsc": "B__ifsc",
  "bank_details.branch": "B__branch",

  notes: "B__notes",
};

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, keyPath) {
  return keyPath.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), obj);
}

/**
 * Fill the default Excel template with extracted invoice data
 * @param {object} invoiceData - extracted invoice data (JSON)
 * @param {string} outputPath - where to save the filled Excel
 * @returns {string} path to the filled file
 */
async function fillDefaultTemplate(invoiceData, outputPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(DEFAULT_TEMPLATE_PATH);

  const ws = workbook.getWorksheet(1);

  // Fill header fields
  const headerFields = [
    "invoice_number",
    "invoice_date",
    "due_date",
    "purchase_order",
    "currency",
  ];

  for (const field of headerFields) {
    const cell = DEFAULT_CELL_MAP[field];
    const value = invoiceData[field];
    if (cell && value != null) {
      ws.getCell(cell).value = value;
    }
  }

  // Fill vendor fields
  const vendorFields = [
    "vendor.name",
    "vendor.address",
    "vendor.gstin",
    "vendor.phone",
    "vendor.email",
  ];

  for (const field of vendorFields) {
    const cell = DEFAULT_CELL_MAP[field];
    const value = getNestedValue(invoiceData, field);
    if (cell && value != null) {
      ws.getCell(cell).value = value;
    }
  }

  // Fill bill_to fields
  const billToFields = ["bill_to.name", "bill_to.address", "bill_to.gstin"];

  for (const field of billToFields) {
    const cell = DEFAULT_CELL_MAP[field];
    const value = getNestedValue(invoiceData, field);
    if (cell && value != null) {
      ws.getCell(cell).value = value;
    }
  }

  // Fill line items
  const startRow = DEFAULT_CELL_MAP.line_items_start_row;
  const cols = DEFAULT_CELL_MAP.line_items_columns;

  if (invoiceData.line_items && Array.isArray(invoiceData.line_items)) {
    invoiceData.line_items.forEach((item, index) => {
      const row = startRow + index;
      if (item.sl_no != null) ws.getCell(`${cols.sl_no}${row}`).value = item.sl_no;
      else ws.getCell(`${cols.sl_no}${row}`).value = index + 1;

      if (item.description != null)
        ws.getCell(`${cols.description}${row}`).value = item.description;
      if (item.hsn_sac != null)
        ws.getCell(`${cols.hsn_sac}${row}`).value = item.hsn_sac;
      if (item.quantity != null)
        ws.getCell(`${cols.quantity}${row}`).value = item.quantity;
      if (item.unit_price != null)
        ws.getCell(`${cols.unit_price}${row}`).value = item.unit_price;
      if (item.tax_rate != null)
        ws.getCell(`${cols.tax_rate}${row}`).value = item.tax_rate;
      if (item.amount != null)
        ws.getCell(`${cols.amount}${row}`).value = item.amount;
    });
  }

  // Fill totals - placed after line items
  const lineCount = invoiceData.line_items
    ? invoiceData.line_items.length
    : 0;
  const totalsStartRow = startRow + Math.max(lineCount, 1) + 1;

  const totalsMap = [
    { key: "subtotal", label: "Subtotal", offset: 0 },
    { key: "discount_total", label: "Discount", offset: 1 },
    { key: "tax_amount", label: "Tax", offset: 2 },
    { key: "total_amount", label: "TOTAL", offset: 3 },
  ];

  for (const t of totalsMap) {
    const row = totalsStartRow + t.offset;
    ws.getCell(`F${row}`).value = t.label;
    if (invoiceData[t.key] != null) {
      ws.getCell(`G${row}`).value = invoiceData[t.key];
    }
  }

  // Amount in words
  const wordsRow = totalsStartRow + 5;
  if (invoiceData.amount_in_words) {
    ws.getCell(`A${wordsRow}`).value = "Amount in Words:";
    ws.getCell(`B${wordsRow}`).value = invoiceData.amount_in_words;
  }

  // Bank details
  if (invoiceData.bank_details) {
    const bankRow = wordsRow + 2;
    ws.getCell(`A${bankRow}`).value = "Bank Details:";
    const bd = invoiceData.bank_details;
    if (bd.bank_name) {
      ws.getCell(`A${bankRow + 1}`).value = "Bank:";
      ws.getCell(`B${bankRow + 1}`).value = bd.bank_name;
    }
    if (bd.account_number) {
      ws.getCell(`A${bankRow + 2}`).value = "A/C No:";
      ws.getCell(`B${bankRow + 2}`).value = bd.account_number;
    }
    if (bd.ifsc) {
      ws.getCell(`A${bankRow + 3}`).value = "IFSC:";
      ws.getCell(`B${bankRow + 3}`).value = bd.ifsc;
    }
    if (bd.branch) {
      ws.getCell(`A${bankRow + 4}`).value = "Branch:";
      ws.getCell(`B${bankRow + 4}`).value = bd.branch;
    }
  }

  // Payment terms
  if (invoiceData.payment_terms) {
    const ptRow = wordsRow + 8;
    ws.getCell(`A${ptRow}`).value = "Payment Terms:";
    ws.getCell(`B${ptRow}`).value = invoiceData.payment_terms;
  }

  // Notes
  if (invoiceData.notes) {
    const notesRow = wordsRow + 10;
    ws.getCell(`A${notesRow}`).value = "Notes:";
    ws.getCell(`B${notesRow}`).value = invoiceData.notes;
  }

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

/**
 * Fill a dynamically structured Excel from template reader output
 * @param {object} invoiceData - extracted invoice data (JSON)
 * @param {object} templateStructure - structure from templateReader AI
 * @param {string} outputPath - where to save the filled Excel
 */
async function fillDynamicTemplate(invoiceData, templateStructure, outputPath) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Invoice");

  const struct = templateStructure;

  // Title
  if (struct.title) {
    ws.getCell("A1").value = struct.title;
    ws.getCell("A1").font = { bold: true, size: 16 };
  }

  // Header fields
  if (struct.header_fields) {
    for (const field of struct.header_fields) {
      const cellRef = `${field.col}${field.row}`;
      // Label in previous column
      const labelCol = String.fromCharCode(field.col.charCodeAt(0) - 1);
      ws.getCell(`${labelCol}${field.row}`).value = field.label + ":";
      ws.getCell(`${labelCol}${field.row}`).font = { bold: true };

      // Value — try to find in invoice data
      const value = findValue(invoiceData, field.key);
      ws.getCell(cellRef).value = value;
    }
  }

  // Line items
  if (struct.line_item_columns && struct.line_items_start_row) {
    const startRow = struct.line_items_start_row;

    // Column headers
    for (const col of struct.line_item_columns) {
      ws.getCell(`${col.col}${startRow - 1}`).value = col.label;
      ws.getCell(`${col.col}${startRow - 1}`).font = { bold: true };
    }

    // Data rows
    if (invoiceData.line_items && Array.isArray(invoiceData.line_items)) {
      invoiceData.line_items.forEach((item, idx) => {
        const row = startRow + idx;
        for (const col of struct.line_item_columns) {
          const value = findValue(item, col.key);
          ws.getCell(`${col.col}${row}`).value = value;
        }
      });
    }
  }

  // Footer fields
  if (struct.footer_fields) {
    for (const field of struct.footer_fields) {
      const cellRef = `${field.col}${field.row}`;
      const labelCol = String.fromCharCode(field.col.charCodeAt(0) - 1);
      ws.getCell(`${labelCol}${field.row}`).value = field.label + ":";
      ws.getCell(`${labelCol}${field.row}`).font = { bold: true };

      const value = findValue(invoiceData, field.key);
      ws.getCell(cellRef).value = value;
    }
  }

  // Auto-fit columns
  ws.columns.forEach((col) => {
    col.width = 18;
  });

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

/**
 * Find value in invoice data by key with fuzzy matching
 */
function findValue(data, key) {
  if (!data || !key) return null;

  // Direct match
  if (data[key] != null) return data[key];

  // Nested match (vendor.name)
  const nested = getNestedValue(data, key);
  if (nested != null) return nested;

  // Fuzzy: try common aliases
  const aliases = {
    invoice_number: ["invoice_number", "invoice_no", "inv_no", "number"],
    invoice_date: ["invoice_date", "date", "inv_date"],
    vendor_name: ["vendor.name", "vendor_name", "supplier_name"],
    total: ["total_amount", "grand_total", "total"],
    tax: ["tax_amount", "tax", "gst"],
    subtotal: ["subtotal", "sub_total", "net_amount"],
  };

  for (const [canonical, options] of Object.entries(aliases)) {
    if (options.includes(key)) {
      for (const opt of options) {
        const val = data[opt] || getNestedValue(data, opt);
        if (val != null) return val;
      }
    }
  }

  return null;
}

module.exports = { fillDefaultTemplate, fillDynamicTemplate };
