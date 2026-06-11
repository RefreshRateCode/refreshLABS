import {
  ESTIMATE_STATUS_LABEL,
  type Customer,
  type Estimate,
  type EstimateLineItem,
  type EstimateSummary,
} from "./database.types";
import { money } from "./format";
import { resolveBusinessIdentity } from "./businessProfiles";

const M = 50;

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

export async function generateEstimatePdf(args: {
  estimate: Estimate;
  items: EstimateLineItem[];
  customer: Customer | null;
  summary: EstimateSummary | null;
}): Promise<void> {
  const { estimate, items, customer, summary } = args;
  const identity = await resolveBusinessIdentity(estimate.business_profile_id);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const right = pageW - M;

  // ---- Dark header band ----
  const BAND_H = 96;
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageW, BAND_H, "F");

  const logo = await loadPng("/logo.png");
  if (logo) {
    const h = 26;
    const w = (logo.w / logo.h) * h;
    doc.addImage(logo.dataUrl, "PNG", M, 26, w, h);
  }
  if (identity.name) {
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.setTextColor(235, 235, 235);
    doc.text(identity.name, M, 60);
  }
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.setTextColor(150, 150, 150);
  let by = 72;
  for (const line of [
    identity.line1,
    identity.city_state_zip,
    identity.email,
    identity.phone,
  ].filter(Boolean)) {
    doc.text(String(line), M, by);
    by += 11;
  }

  doc.setFont("helvetica", "normal").setFontSize(20);
  doc.setTextColor(190, 190, 190);
  doc.text("ESTIMATE", right, 42, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.setTextColor(190, 190, 190);
  doc.text(
    estimate.kind === "monthly" ? "MONTHLY PLAN" : "QUOTE",
    right,
    60,
    { align: "right" },
  );
  doc.text(
    ESTIMATE_STATUS_LABEL[estimate.status].toUpperCase(),
    right,
    74,
    { align: "right" },
  );

  let y = BAND_H + 28;

  // ---- Title + bill-to ----
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(estimate.title, M, y);
  y += 20;
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("PREPARED FOR", M, y);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(customer?.display_name ?? "—", M, y + 14);
  y += 36;

  // ---- Line items ----
  const qtyX = right - 230;
  const unitX = right - 120;
  const amtX = right;
  doc.setDrawColor(200);
  doc.setLineWidth(0.75);
  doc.line(M, y, right, y);
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("DESCRIPTION", M, y);
  doc.text("QTY", qtyX, y, { align: "right" });
  doc.text("UNIT", unitX, y, { align: "right" });
  doc.text("AMOUNT", amtX, y, { align: "right" });
  y += 8;
  doc.line(M, y, right, y);
  y += 14;

  doc.setFont("helvetica", "normal").setFontSize(9.5);
  for (const it of items) {
    const label =
      Number(it.discount_pct) > 0
        ? `${it.description || "—"}  (-${Number(it.discount_pct)}%)`
        : it.description || "—";
    const descLines = doc.splitTextToSize(label, qtyX - M - 12);
    if (y > pageH - 140) {
      doc.addPage();
      y = M;
    }
    doc.setTextColor(40, 40, 40);
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
  const labelX = right - 160;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(10);
    doc.setTextColor(bold ? 20 : 110, bold ? 20 : 110, bold ? 20 : 110);
    doc.text(label, labelX, y, { align: "right" });
    doc.setTextColor(bold ? 20 : 60, bold ? 20 : 60, bold ? 20 : 60);
    doc.text(value, amtX, y, { align: "right" });
    y += 16;
  };
  totalRow("Subtotal", money(summary?.subtotal));
  if (Number(summary?.discount_amount) > 0) {
    totalRow(
      `Discount (${estimate.discount_pct}%)`,
      `- ${money(summary?.discount_amount)}`,
    );
  }
  totalRow(`Tax (${estimate.tax_rate}%)`, money(summary?.tax_amount));
  doc.setDrawColor(200);
  doc.line(labelX - 4, y - 8, right, y - 8);
  totalRow(
    estimate.kind === "monthly" ? "Total / month" : "Total",
    money(summary?.total),
    true,
  );

  // ---- Notes ----
  if (estimate.notes) {
    y += 14;
    if (y > pageH - 80) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("NOTES", M, y);
    y += 13;
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(doc.splitTextToSize(estimate.notes, right - M), M, y);
  }

  const safeTitle = estimate.title.replace(/[^a-zA-Z0-9._-]/g, "_");
  doc.save(`estimate-${safeTitle}.pdf`);
}
