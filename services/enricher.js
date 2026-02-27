const { strict: assert } = require("assert");

function numberToWordsEN(n) {
  if (n == null || isNaN(n)) return "";
  n = Math.round(Number(n));

  const below20 = [
    "zero","one","two","three","four","five","six","seven","eight","nine","ten",
    "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"
  ];
  const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  const thousands = ["","thousand","million","billion"];

  function chunkToWords(num) {
    let words = [];
    if (num >= 100) {
      words.push(below20[Math.floor(num / 100)], "hundred");
      num = num % 100;
      if (num) words.push("and");
    }
    if (num >= 20) {
      words.push(tens[Math.floor(num / 10)]);
      if (num % 10) words.push(below20[num % 10]);
    } else if (num > 0) {
      words.push(below20[num]);
    }
    return words.join(" ");
  }

  if (n === 0) return "zero";

  let words = [];
  let i = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) {
      const chunkWords = chunkToWords(chunk);
      const suffix = thousands[i];
      words.unshift(chunkWords + (suffix ? " " + suffix : ""));
    }
    n = Math.floor(n / 1000);
    i++;
  }

  return words.join(" ");
}

function deriveCurrencySymbol(currency) {
  if (!currency) return "";
  const c = String(currency).toUpperCase();
  if (c === "INR") return "₹";
  if (c === "USD") return "$";
  if (c === "EUR") return "€";
  if (c === "GBP") return "£";
  return c + " ";
}

function capitaliseFirst(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Post-process and enrich raw extraction output:
 * - compute amount_in_words, tax_amount_in_words from numbers
 * - derive SGST/CGST/IGST totals from tax_breakdown if missing
 */
function enrichInvoiceData(raw) {
  if (!raw || typeof raw !== "object") return raw;

  const d = { ...raw };

  // Amount in words from total_amount
  if (!d.amount_in_words && d.total_amount != null) {
    const symbol = deriveCurrencySymbol(d.currency);
    const words = numberToWordsEN(d.total_amount);
    d.amount_in_words = `${capitaliseFirst(words)} only (${symbol}${Number(d.total_amount).toFixed(2)})`;
  }

  // Tax amount in words
  if (!d.tax_amount_in_words && d.tax_amount != null) {
    const symbol = deriveCurrencySymbol(d.currency);
    const words = numberToWordsEN(d.tax_amount);
    d.tax_amount_in_words = `${capitaliseFirst(words)} only (${symbol}${Number(d.tax_amount).toFixed(2)})`;
  }

  // Derive SGST/CGST/IGST from tax_breakdown if missing
  if ((d.sgst_amount == null || d.cgst_amount == null || d.igst_amount == null) && Array.isArray(d.tax_breakdown)) {
    let sgst = 0, cgst = 0, igst = 0;
    for (const t of d.tax_breakdown) {
      if (!t || t.amount == null) continue;
      const type = String(t.tax_type || "").toUpperCase();
      if (type.includes("SGST")) sgst += Number(t.amount);
      else if (type.includes("CGST")) cgst += Number(t.amount);
      else if (type.includes("IGST")) igst += Number(t.amount);
    }
    if (d.sgst_amount == null && sgst) d.sgst_amount = sgst;
    if (d.cgst_amount == null && cgst) d.cgst_amount = cgst;
    if (d.igst_amount == null && igst) d.igst_amount = igst;
  }

  return d;
}

module.exports = { enrichInvoiceData, numberToWordsEN };

