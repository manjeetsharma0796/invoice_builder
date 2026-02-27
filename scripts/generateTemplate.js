/**
 * Script to generate the default invoice Excel template.
 * Run once: node scripts/generateTemplate.js
 */
const ExcelJS = require("exceljs");
const path = require("path");

async function generateTemplate() {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Invoice");

    // ===== Column widths =====
    ws.getColumn("A").width = 8;
    ws.getColumn("B").width = 30;
    ws.getColumn("C").width = 18;
    ws.getColumn("D").width = 12;
    ws.getColumn("E").width = 16;
    ws.getColumn("F").width = 12;
    ws.getColumn("G").width = 16;

    // ===== TITLE =====
    ws.mergeCells("A1:G1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "INVOICE";
    titleCell.font = { bold: true, size: 20 };
    titleCell.alignment = { horizontal: "center" };

    // ===== Separator =====
    for (let c = 1; c <= 7; c++) {
        ws.getCell(2, c).border = { bottom: { style: "thick" } };
    }

    // ===== Invoice Info =====
    ws.getCell("A3").value = "Invoice Number:";
    ws.getCell("A3").font = { bold: true };
    // C3 = invoice_number value

    ws.getCell("A4").value = "Invoice Date:";
    ws.getCell("A4").font = { bold: true };
    // C4 = invoice_date value

    ws.getCell("A5").value = "Due Date:";
    ws.getCell("A5").font = { bold: true };
    // C5 = due_date value

    ws.getCell("A6").value = "PO Number:";
    ws.getCell("A6").font = { bold: true };
    // C6 = purchase_order value

    ws.getCell("D3").value = "Currency:";
    ws.getCell("D3").font = { bold: true };
    // E3 = currency value

    // ===== Vendor =====
    ws.getCell("A8").value = "VENDOR / FROM";
    ws.getCell("A8").font = { bold: true, size: 12 };
    ws.getCell("A8").border = { bottom: { style: "thin" } };

    ws.getCell("A9").value = "Name:";
    ws.getCell("A9").font = { bold: true };
    // B9 = vendor.name

    ws.getCell("A10").value = "Address:";
    ws.getCell("A10").font = { bold: true };
    // B10 = vendor.address

    ws.getCell("A11").value = "GSTIN:";
    ws.getCell("A11").font = { bold: true };
    // B11 = vendor.gstin

    ws.getCell("A12").value = "Phone:";
    ws.getCell("A12").font = { bold: true };
    // B12 = vendor.phone

    ws.getCell("A13").value = "Email:";
    ws.getCell("A13").font = { bold: true };
    // B13 = vendor.email

    // ===== Bill To =====
    ws.getCell("D8").value = "BILL TO";
    ws.getCell("D8").font = { bold: true, size: 12 };
    ws.getCell("D8").border = { bottom: { style: "thin" } };

    ws.getCell("D9").value = "Name:";
    ws.getCell("D9").font = { bold: true };
    // E9 = bill_to.name

    ws.getCell("D10").value = "Address:";
    ws.getCell("D10").font = { bold: true };
    // E10 = bill_to.address

    ws.getCell("D11").value = "GSTIN:";
    ws.getCell("D11").font = { bold: true };
    // E11 = bill_to.gstin

    // ===== Line Items Header (Row 15) =====
    const lineHeaderRow = 15;
    const headers = ["#", "Description", "HSN/SAC", "Qty", "Unit Price", "Tax %", "Amount"];
    const headerCols = ["A", "B", "C", "D", "E", "F", "G"];

    headers.forEach((h, i) => {
        const cell = ws.getCell(`${headerCols[i]}${lineHeaderRow}`);
        cell.value = h;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF333333" },
        };
        cell.alignment = { horizontal: "center" };
        cell.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
        };
    });

    // ===== Empty line item rows (16-25) =====
    for (let r = 16; r <= 25; r++) {
        for (const col of headerCols) {
            ws.getCell(`${col}${r}`).border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
            };
        }
    }

    const outputPath = path.join(__dirname, "..", "templates", "default_template.xlsx");
    await workbook.xlsx.writeFile(outputPath);
    console.log(`Default template created at: ${outputPath}`);
}

generateTemplate().catch(console.error);
