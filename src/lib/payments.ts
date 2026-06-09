import { supabase } from "./supabase";
import type { Payment, InvoiceStatus } from "./database.types";

export type PaymentInput = {
  amount: number;
  paid_on: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
};

export async function listPaymentsByInvoice(
  invoiceId: string,
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("paid_on", { ascending: false });
  if (error) throw error;
  return data as Payment[];
}

export async function recordPayment(
  invoiceId: string,
  customerId: string | null,
  input: PaymentInput,
): Promise<void> {
  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    customer_id: customerId,
    ...input,
  });
  if (error) throw error;
  await reconcileInvoiceStatus(invoiceId);
}

export async function deletePayment(
  paymentId: string,
  invoiceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId);
  if (error) throw error;
  await reconcileInvoiceStatus(invoiceId);
}

// Keep invoice.status in sync with what's been paid. Never overrides a
// manually-set "void", and only nudges paid/partial/sent automatically.
export async function reconcileInvoiceStatus(invoiceId: string): Promise<void> {
  const { data, error } = await supabase
    .from("invoice_summary")
    .select("status, total, amount_paid, balance_due")
    .eq("id", invoiceId)
    .single();
  if (error) throw error;

  const { status, total, amount_paid, balance_due } = data as {
    status: InvoiceStatus;
    total: number;
    amount_paid: number;
    balance_due: number;
  };

  if (status === "void") return;

  let next: InvoiceStatus = status;
  if (Number(total) > 0 && Number(balance_due) <= 0) {
    next = "paid";
  } else if (Number(amount_paid) > 0) {
    next = "partial";
  } else if (status === "paid" || status === "partial") {
    // payments were removed — fall back to "sent"
    next = "sent";
  }

  if (next !== status) {
    const { error: upErr } = await supabase
      .from("invoices")
      .update({ status: next })
      .eq("id", invoiceId);
    if (upErr) throw upErr;
  }
}
