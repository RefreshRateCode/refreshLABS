import { supabase } from "./supabase";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  InvoiceSummary,
} from "./database.types";

export type LineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type InvoiceInput = {
  customer_id: string;
  project_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  tax_rate: number;
  notes: string | null;
  business_profile_id?: string | null;
  source_estimate_id?: string | null;
};

// Summary rows (joined with customer name) for the list view.
export type InvoiceListRow = InvoiceSummary & {
  customer: { display_name: string } | null;
};

// An invoice is overdue if it's been sent (or partially paid), still has a
// balance, and its due date has passed. Derived on read — no stored "overdue".
export function isOverdue(r: {
  status: string;
  balance_due: number;
  due_date: string | null;
}): boolean {
  if (!r.due_date) return false;
  if (r.status !== "sent" && r.status !== "partial") return false;
  if (Number(r.balance_due) <= 0) return false;
  return r.due_date < new Date().toISOString().slice(0, 10);
}

// Status to display, upgrading sent/partial to "overdue" when past due.
export function displayStatus(r: {
  status: string;
  balance_due: number;
  due_date: string | null;
}): string {
  return isOverdue(r) ? "overdue" : r.status;
}

export async function listInvoices(): Promise<InvoiceListRow[]> {
  const { data, error } = await supabase
    .from("invoice_summary")
    .select("*, customer:customers(display_name)")
    .order("issue_date", { ascending: false });
  if (error) throw error;
  return data as InvoiceListRow[];
}

export async function getInvoice(id: string): Promise<{
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
}> {
  const { data: invoice, error: e1 } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();
  if (e1) throw e1;

  const { data: lineItems, error: e2 } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", id)
    .order("position", { ascending: true });
  if (e2) throw e2;

  return {
    invoice: invoice as Invoice,
    lineItems: lineItems as InvoiceLineItem[],
  };
}

// Suggest the next invoice number like "INV-0007" based on existing rows.
export async function suggestNextNumber(prefix = "INV-"): Promise<string> {
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const m = String(row.invoice_number).match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = String(max + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

async function replaceLineItems(invoiceId: string, items: LineItemInput[]) {
  const { error: delErr } = await supabase
    .from("invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId);
  if (delErr) throw delErr;

  const rows = items
    .filter((it) => it.description.trim() !== "" || it.unit_price || it.quantity)
    .map((it, i) => ({
      invoice_id: invoiceId,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      position: i,
    }));

  if (rows.length) {
    const { error: insErr } = await supabase
      .from("invoice_line_items")
      .insert(rows);
    if (insErr) throw insErr;
  }
}

export async function createInvoice(
  input: InvoiceInput,
  items: LineItemInput[],
): Promise<string> {
  const { data, error } = await supabase
    .from("invoices")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  await replaceLineItems(id, items);
  return id;
}

export async function updateInvoice(
  id: string,
  input: InvoiceInput,
  items: LineItemInput[],
): Promise<void> {
  const { error } = await supabase.from("invoices").update(input).eq("id", id);
  if (error) throw error;
  await replaceLineItems(id, items);
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}
