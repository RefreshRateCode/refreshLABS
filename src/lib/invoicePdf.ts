import type {
  Customer,
  Invoice,
  InvoiceLineItem,
  InvoiceSummary,
} from "./database.types";
import { money, formatDate } from "./format";
import { BUSINESS } from "./business";

const M = 50; // page margin (pt)

// Load a PNG (from /public) as a data URL plus natural dimensions, for jsPDF.
async function loadPng(
  url: string,
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });
    return dims.w ? { dataUrl, ...dims } : null;
  } catch {
    return null;
  }
}

// jsPDF is loaded on demand so it stays out of the initial app bundle.
export async function generateInvoicePdf(args: {
  invoice: Invoice;
  items: InvoiceLineItem[];
  customer: Customer | null;
  summary: InvoiceSummary | null;
}): Promise<void> {
  const { invoice, items, customer, summary } = args;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const right = pageW - M;
  let y = M;

  const slate = (v: number) => doc.setTextColor(v);

  // ---- Dark branded header band ----
  const BAND_H = 96;
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageW, BAND_H, "F");

  const logo = await loadPng("/logo.png");
  if (logo) {
    const h = 26;
    const w = (logo.w / logo.h) * h;
    doc.addImage(logo.dataUrl, "PNG", M, 26, w, h);
  }

  // Business contact under the logo (muted on dark)
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.setTextColor(150, 150, 150);
  let by = 68;
  for (const line of [
    BUSINESS.line1,
    BUSINESS.cityStateZip,
    BUSINESS.email,
    BUSINESS.phone,
  ].filter(Boolean)) {
    doc.text(String(line), M, by);
    by += 11;
  }

  // INVOICE / number / status (right side of band)
  doc.setFont("helvetica", "normal").setFontSize(20);
  doc.setTextColor(190, 190, 190);
  doc.text("INVOICE", right, 42, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(invoice.invoice_number, right, 60, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.setTextColor(190, 190, 190);
  doc.text(invoice.status.toUpperCase(), right, 74, { align: "right" });

  y = BAND_H + 28;

  // ---- Bill to (left) + dates (right) ----
  doc.setFont("helvetica", "bold").setFontSize(8);
  slate(150);
  doc.text("BILL TO", M, y);
  doc.setFontSize(10);
  slate(20);
  let cy = y + 15;
  doc.text(customer?.display_name ?? "—", M, cy);
  doc.setFont("helvetica", "normal").setFontSize(9);
  slate(90);
  cy += 13;
  for (const line of [
    customer?.company,
    customer?.bill_line1,
    customer?.bill_line2,
    [customer?.bill_city, customer?.bill_state, customer?.bill_postal]
      .filter(Boolean)
      .join(", "),
    customer?.bill_country,
    customer?.email,
  ].filter(Boolean)) {
    doc.text(String(line), M, cy);
    cy += 13;
  }

  doc.setFontSize(9);
  slate(110);
  doc.text(`Issued: ${formatDate(invoice.issue_date)}`, right, y, {
    align: "right",
  });
  if (invoice.due_date) {
    doc.text(`Due: ${formatDate(invoice.due_date)}`, right, y + 13, {
      align: "right",
    });
  }

  y = Math.max(cy, y + 26) + 16;

  // ---- Line items table ----
  const qtyX = right - 230;
  const unitX = right - 120;
  const amtX = right;

  doc.setDrawColor(200);
  doc.setLineWidth(0.75);
  doc.line(M, y, right, y);
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(8);
  slate(150);
  doc.text("DESCRIPTION", M, y);
  doc.text("QTY", qtyX, y, { align: "right" });
  doc.text("UNIT", unitX, y, { align: "right" });
  doc.text("AMOUNT", amtX, y, { align: "right" });
  y += 8;
  doc.line(M, y, right, y);
  y += 14;

  doc.setFont("helvetica", "normal").setFontSize(9.5);
  for (const it of items) {
    const descLines = doc.splitTextToSize(it.description || "—", qtyX - M - 12);
    if (y > pageH - 140) {
      doc.addPage();
      y = M;
    }
    slate(40);
    doc.text(descLines, M, y);
    doc.text(String(Number(it.quantity)), qtyX, y, { align: "right" });
    doc.text(money(it.unit_price), unitX, y, { align: "right" });
    doc.text(money(it.amount), amtX, y, { align: "right" });
    y += Math.max(descLines.length * 12, 14) + 4;
    doc.setDrawColor(235);
    doc.setLineWidth(0.5);
    doc.line(M, y - 6, right, y - 6);
  }

  // ---- Totals ----
  y += 8;
  const labelX = right - 150;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(10);
    slate(bold ? 20 : 110);
    doc.text(label, labelX, y, { align: "right" });
    slate(bold ? 20 : 60);
    doc.text(value, amtX, y, { align: "right" });
    y += 16;
  };
  totalRow("Subtotal", money(summary?.subtotal));
  totalRow(`Tax (${invoice.tax_rate}%)`, money(summary?.tax_amount));
  doc.setDrawColor(200);
  doc.line(labelX - 4, y - 8, right, y - 8);
  totalRow("Total", money(summary?.total), true);
  if (Number(summary?.amount_paid) > 0) {
    totalRow("Paid", `- ${money(summary?.amount_paid)}`);
    totalRow("Balance due", money(summary?.balance_due), true);
  }

  // ---- Notes ----
  if (invoice.notes) {
    y += 14;
    if (y > pageH - 80) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(8);
    slate(150);
    doc.text("NOTES", M, y);
    y += 13;
    doc.setFont("helvetica", "normal").setFontSize(9);
    slate(90);
    doc.text(doc.splitTextToSize(invoice.notes, right - M), M, y);
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}
