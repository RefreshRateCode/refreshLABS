import { supabase } from "./supabase";
import type {
  Estimate,
  EstimateKind,
  EstimateLineItem,
  EstimateStatus,
  EstimateSummary,
} from "./database.types";
import { createInvoice, suggestNextNumber } from "./invoices";
import { getSettings } from "./settings";

export type EstLineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
};

export type EstimateInput = {
  customer_id: string | null;
  title: string;
  kind: EstimateKind;
  status: EstimateStatus;
  tax_rate: number;
  discount_pct: number;
  notes: string | null;
  business_profile_id: string | null;
};

export type EstimateListRow = EstimateSummary & {
  customer: { display_name: string } | null;
};

export async function listEstimates(): Promise<EstimateListRow[]> {
  const { data, error } = await supabase
    .from("estimate_summary")
    .select("*, customer:customers(display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as EstimateListRow[];
}

export async function getEstimate(id: string): Promise<{
  estimate: Estimate;
  lineItems: EstimateLineItem[];
}> {
  const { data: estimate, error: e1 } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", id)
    .single();
  if (e1) throw e1;
  const { data: lineItems, error: e2 } = await supabase
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", id)
    .order("position", { ascending: true });
  if (e2) throw e2;
  return {
    estimate: estimate as Estimate,
    lineItems: lineItems as EstimateLineItem[],
  };
}

async function replaceLineItems(estimateId: string, items: EstLineItemInput[]) {
  const { error: delErr } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", estimateId);
  if (delErr) throw delErr;

  const rows = items
    .filter((it) => it.description.trim() !== "" || it.unit_price || it.quantity)
    .map((it, i) => ({
      estimate_id: estimateId,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_pct: it.discount_pct ?? 0,
      position: i,
    }));
  if (rows.length) {
    const { error } = await supabase.from("estimate_line_items").insert(rows);
    if (error) throw error;
  }
}

export async function createEstimate(
  input: EstimateInput,
  items: EstLineItemInput[],
): Promise<string> {
  const { data, error } = await supabase
    .from("estimates")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  await replaceLineItems(id, items);
  return id;
}

export async function updateEstimate(
  id: string,
  input: EstimateInput,
  items: EstLineItemInput[],
): Promise<void> {
  const { error } = await supabase.from("estimates").update(input).eq("id", id);
  if (error) throw error;
  await replaceLineItems(id, items);
}

export async function deleteEstimate(id: string): Promise<void> {
  const { error } = await supabase.from("estimates").delete().eq("id", id);
  if (error) throw error;
}

type InvoiceItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
};

// Translate an estimate's line items into invoice line items. Invoices have no
// per-line discount field, so any per-line discounts are folded into a single
// consolidated "Discount" line; the estimate-level discount adds its own line.
// (The two are mutually exclusive in the editor, so at most one appears.)
function buildInvoiceItems(
  lineItems: EstimateLineItem[],
  discountPct: number,
): InvoiceItemInput[] {
  const items: InvoiceItemInput[] = lineItems.map((li) => ({
    description: li.description,
    quantity: Number(li.quantity),
    unit_price: Number(li.unit_price),
  }));

  const gross = lineItems.reduce(
    (s, li) => s + Number(li.quantity) * Number(li.unit_price),
    0,
  );
  const net = lineItems.reduce((s, li) => s + Number(li.amount), 0);
  const lineDiscount = Math.round((gross - net) * 100) / 100;
  if (lineDiscount > 0) {
    items.push({ description: "Discount", quantity: 1, unit_price: -lineDiscount });
  }

  if (Number(discountPct) > 0) {
    const discount = Math.round(net * Number(discountPct)) / 100;
    items.push({
      description: `Discount (${discountPct}%)`,
      quantity: 1,
      unit_price: -discount,
    });
  }
  return items;
}

function dueFromTerms(issue: string, days: number): string | null {
  if (days <= 0) return null;
  const d = new Date(issue + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Create draft invoices for every accepted monthly plan that doesn't already
// have an invoice this calendar month. Returns how many were created/skipped.
export async function generateMonthlyInvoices(): Promise<{
  created: number;
  skipped: number;
}> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const settings = await getSettings();

  const { data: plans, error } = await supabase
    .from("estimates")
    .select("id, customer_id, tax_rate, discount_pct, notes, business_profile_id")
    .eq("kind", "monthly")
    .eq("status", "accepted");
  if (error) throw error;

  let created = 0;
  let skipped = 0;
  for (const plan of (plans ?? []) as {
    id: string;
    customer_id: string | null;
    tax_rate: number;
    discount_pct: number;
    notes: string | null;
    business_profile_id: string | null;
  }[]) {
    if (!plan.customer_id) {
      skipped++;
      continue;
    }
    const { count, error: cErr } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("source_estimate_id", plan.id)
      .gte("issue_date", monthStart);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      skipped++;
      continue;
    }

    const { lineItems } = await getEstimate(plan.id);
    const issue = new Date().toISOString().slice(0, 10);
    const number = await suggestNextNumber(settings.invoice_prefix);
    await createInvoice(
      {
        customer_id: plan.customer_id,
        project_id: null,
        invoice_number: number,
        status: "draft",
        issue_date: issue,
        due_date: dueFromTerms(issue, settings.default_payment_terms_days),
        tax_rate: Number(plan.tax_rate),
        notes: plan.notes ?? settings.default_invoice_notes,
        business_profile_id: plan.business_profile_id,
        source_estimate_id: plan.id,
      },
      buildInvoiceItems(lineItems, Number(plan.discount_pct)),
    );
    created++;
  }
  return { created, skipped };
}

// Turn an estimate into a draft invoice (folding any discount into a line item).
export async function convertToInvoice(estimateId: string): Promise<string> {
  const { estimate, lineItems } = await getEstimate(estimateId);
  if (!estimate.customer_id)
    throw new Error("Add a customer to this estimate before converting.");

  const settings = await getSettings();
  const number = await suggestNextNumber(settings.invoice_prefix);

  const items = buildInvoiceItems(lineItems, Number(estimate.discount_pct));

  const issue = new Date().toISOString().slice(0, 10);
  const terms = settings.default_payment_terms_days;
  let due: string | null = null;
  if (terms > 0) {
    const d = new Date(issue + "T00:00:00");
    d.setDate(d.getDate() + terms);
    due = d.toISOString().slice(0, 10);
  }

  const invoiceId = await createInvoice(
    {
      customer_id: estimate.customer_id,
      project_id: null,
      invoice_number: number,
      status: "draft",
      issue_date: issue,
      due_date: due,
      tax_rate: Number(estimate.tax_rate),
      notes: estimate.notes ?? settings.default_invoice_notes,
      business_profile_id: estimate.business_profile_id,
      source_estimate_id: estimateId,
    },
    items,
  );

  const { error } = await supabase
    .from("estimates")
    .update({ converted_invoice_id: invoiceId, status: "accepted" })
    .eq("id", estimateId);
  if (error) throw error;

  return invoiceId;
}
