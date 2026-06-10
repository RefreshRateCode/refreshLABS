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
};

export type EstimateInput = {
  customer_id: string | null;
  title: string;
  kind: EstimateKind;
  status: EstimateStatus;
  tax_rate: number;
  discount_pct: number;
  notes: string | null;
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

// Turn an estimate into a draft invoice (folding any discount into a line item).
export async function convertToInvoice(estimateId: string): Promise<string> {
  const { estimate, lineItems } = await getEstimate(estimateId);
  if (!estimate.customer_id)
    throw new Error("Add a customer to this estimate before converting.");

  const settings = await getSettings();
  const number = await suggestNextNumber(settings.invoice_prefix);

  const items = lineItems.map((li) => ({
    description: li.description,
    quantity: Number(li.quantity),
    unit_price: Number(li.unit_price),
  }));

  if (Number(estimate.discount_pct) > 0) {
    const subtotal = lineItems.reduce((s, li) => s + Number(li.amount), 0);
    const discount =
      Math.round(subtotal * Number(estimate.discount_pct)) / 100;
    items.push({
      description: `Discount (${estimate.discount_pct}%)`,
      quantity: 1,
      unit_price: -discount,
    });
  }

  const invoiceId = await createInvoice(
    {
      customer_id: estimate.customer_id,
      project_id: null,
      invoice_number: number,
      status: "draft",
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      tax_rate: Number(estimate.tax_rate),
      notes: estimate.notes,
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
