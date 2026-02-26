document.addEventListener("DOMContentLoaded", async () => {
  const summaryEl = document.getElementById("invoiceSummary");
  const rawJsonEl = document.getElementById("rawJson");

  try {
    const res = await fetch(`/api/invoice/${invoiceId}`);
    const result = await res.json();

    if (!result.success) {
      summaryEl.innerHTML = `<div class="error-box">${result.error}</div>`;
      return;
    }

    const data = result.data;
    rawJsonEl.textContent = JSON.stringify(data, null, 2);

    let html = "";

    // Invoice Info
    html += `<div class="summary-section-title">Invoice Info</div>`;
    html += summaryRow("Invoice Number", data.invoice_number);
    html += summaryRow("Invoice Date", data.invoice_date);
    html += summaryRow("Due Date", data.due_date);
    html += summaryRow("PO Number", data.purchase_order);
    html += summaryRow("Currency", data.currency);

    // Vendor
    if (data.vendor) {
      html += `<div class="summary-section-title">Vendor / From</div>`;
      html += summaryRow("Name", data.vendor.name);
      html += summaryRow("Address", data.vendor.address);
      html += summaryRow("GSTIN", data.vendor.gstin);
      html += summaryRow("Phone", data.vendor.phone);
      html += summaryRow("Email", data.vendor.email);
    }

    // Bill To
    if (data.bill_to) {
      html += `<div class="summary-section-title">Bill To</div>`;
      html += summaryRow("Name", data.bill_to.name);
      html += summaryRow("Address", data.bill_to.address);
      html += summaryRow("GSTIN", data.bill_to.gstin);
    }

    // Line Items
    if (data.line_items && data.line_items.length > 0) {
      html += `<div class="summary-section-title">Line Items</div>`;
      html += `<table class="line-items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Tax %</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>`;

      data.line_items.forEach((item, i) => {
        html += `<tr>
          <td>${item.sl_no || i + 1}</td>
          <td>${item.description || "-"}</td>
          <td>${item.quantity ?? "-"}</td>
          <td>${item.unit_price ?? "-"}</td>
          <td>${item.tax_rate ?? "-"}</td>
          <td>${item.amount ?? "-"}</td>
        </tr>`;
      });

      html += `</tbody></table>`;
    }

    // Totals
    html += `<div class="summary-section-title">Totals</div>`;
    html += summaryRow("Subtotal", formatCurrency(data.subtotal, data.currency));
    html += summaryRow("Discount", formatCurrency(data.discount_total, data.currency));
    html += summaryRow("Tax", formatCurrency(data.tax_amount, data.currency));
    html += summaryRow("Total", formatCurrency(data.total_amount, data.currency));
    html += summaryRow("In Words", data.amount_in_words);

    // Tax Breakdown
    if (data.tax_breakdown && data.tax_breakdown.length > 0) {
      html += `<div class="summary-section-title">Tax Breakdown</div>`;
      data.tax_breakdown.forEach((t) => {
        html += summaryRow(`${t.tax_type} @ ${t.rate}%`, formatCurrency(t.amount, data.currency));
      });
    }

    // Bank Details
    if (data.bank_details) {
      html += `<div class="summary-section-title">Bank Details</div>`;
      html += summaryRow("Bank", data.bank_details.bank_name);
      html += summaryRow("Account", data.bank_details.account_number);
      html += summaryRow("IFSC", data.bank_details.ifsc);
      html += summaryRow("Branch", data.bank_details.branch);
    }

    // Notes
    if (data.payment_terms) {
      html += summaryRow("Payment Terms", data.payment_terms);
    }
    if (data.notes) {
      html += summaryRow("Notes", data.notes);
    }

    summaryEl.innerHTML = html;
  } catch (err) {
    summaryEl.innerHTML = `<div class="error-box">Failed to load invoice data: ${err.message}</div>`;
  }
});

function summaryRow(label, value) {
  if (value == null || value === "") return "";
  return `<div class="summary-row">
    <span class="summary-label">${label}</span>
    <span class="summary-value">${value}</span>
  </div>`;
}

function formatCurrency(amount, currency) {
  if (amount == null) return null;
  const cur = currency || "INR";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: cur }).format(amount);
  } catch {
    return `${cur} ${amount}`;
  }
}
