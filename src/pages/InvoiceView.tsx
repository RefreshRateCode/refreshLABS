import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type {
  Customer,
  Invoice,
  InvoiceLineItem,
  InvoiceSummary,
  Payment,
} from "../lib/database.types";
import { getInvoice, deleteInvoice, displayStatus } from "../lib/invoices";
import {
  listPaymentsByInvoice,
  recordPayment,
  deletePayment,
  type PaymentInput,
} from "../lib/payments";
import { generateInvoicePdf } from "../lib/invoicePdf";
import { money, formatDate } from "../lib/format";
import { getSettings, type Settings } from "../lib/settings";
import { Badge, Button, Field, TextInput, TextArea } from "../components/ui";
import Modal from "../components/Modal";
import { useToast, useConfirm } from "../components/feedback";

const METHODS = ["cash", "check", "card", "ach", "zelle", "venmo", "other"];
const selectCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const today = () => new Date().toISOString().slice(0, 10);

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const { invoice, lineItems } = await getInvoice(id);
      setInvoice(invoice);
      setItems(lineItems);

      const [{ data: cust }, { data: sum }, pays, sett] = await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .eq("id", invoice.customer_id)
          .single(),
        supabase.from("invoice_summary").select("*").eq("id", id).single(),
        listPaymentsByInvoice(id),
        getSettings(),
      ]);
      setCustomer((cust as Customer) ?? null);
      setSummary((sum as InvoiceSummary) ?? null);
      setPayments(pays);
      setSettings(sett);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onDelete = async () => {
    if (!invoice) return;
    const ok = await confirm({
      title: "Delete invoice?",
      message: `Invoice ${invoice.invoice_number}, its line items, and payments will be permanently removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteInvoice(invoice.id);
      toast("Invoice deleted", "success");
      navigate("/invoices");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const markSent = async () => {
    if (!invoice) return;
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", invoice.id);
      if (error) throw error;
      toast("Marked as sent", "success");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const onDeletePayment = async (p: Payment) => {
    if (!invoice) return;
    const ok = await confirm({
      title: "Delete payment?",
      message: `Remove this ${money(p.amount)} payment?`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePayment(p.id, invoice.id);
      toast("Payment removed", "success");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (loading) return <p className="text-faint">Loading…</p>;
  if (error)
    return (
      <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {error}
      </p>
    );
  if (!invoice) return <p className="text-faint">Not found.</p>;

  const custAddr = [
    customer?.bill_line1,
    customer?.bill_line2,
    [customer?.bill_city, customer?.bill_state, customer?.bill_postal]
      .filter(Boolean)
      .join(", "),
    customer?.bill_country,
  ].filter(Boolean);

  return (
    <div>
      {/* Action bar — hidden when printing */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button variant="secondary" onClick={() => navigate("/invoices")}>
          ← Invoices
        </Button>
        <div className="flex flex-wrap justify-end gap-3">
          {invoice.status === "draft" && (
            <Button variant="secondary" onClick={markSent}>
              Mark sent
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
          >
            Edit
          </Button>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
          <Button
            onClick={() =>
              generateInvoicePdf({ invoice, items, customer, summary })
            }
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Printable area */}
      <div className="print-area mx-auto max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* Dark branded header band */}
        <div className="flex items-end justify-between bg-[#0a0a0a] px-10 py-7">
          <div>
            <img src="/logo.png" alt="noalanPRO" className="h-8 w-auto" />
            {settings?.business_name && (
              <div className="mt-2 text-sm font-semibold text-white/90">
                {settings.business_name}
              </div>
            )}
            <div className="mt-2 space-y-0.5 text-xs text-white/50">
              {settings?.business_line1 && <div>{settings.business_line1}</div>}
              {settings?.business_line2 && <div>{settings.business_line2}</div>}
              {settings?.business_city_state_zip && (
                <div>{settings.business_city_state_zip}</div>
              )}
              {settings?.business_email && <div>{settings.business_email}</div>}
              {settings?.business_phone && <div>{settings.business_phone}</div>}
            </div>
          </div>
          <div className="text-right text-white">
            <div className="text-2xl font-light uppercase tracking-[0.2em] text-white/60">
              Invoice
            </div>
            <div className="mt-1 text-sm font-semibold">
              {invoice.invoice_number}
            </div>
            <div className="mt-2">
              <Badge
                status={displayStatus({
                  status: invoice.status,
                  balance_due: Number(summary?.balance_due ?? 0),
                  due_date: invoice.due_date,
                })}
              />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-10 py-8">
        <div className="flex justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Bill to
            </div>
            <div className="mt-1 font-medium text-slate-900">
              {customer?.display_name ?? "—"}
            </div>
            {customer?.company && (
              <div className="text-sm text-slate-600">{customer.company}</div>
            )}
            {custAddr.map((line, i) => (
              <div key={i} className="text-sm text-slate-600">
                {line}
              </div>
            ))}
            {customer?.email && (
              <div className="text-sm text-slate-600">{customer.email}</div>
            )}
          </div>
          <div className="text-right text-sm">
            <div className="text-slate-500">
              Issued{" "}
              <span className="text-slate-900">
                {formatDate(invoice.issue_date)}
              </span>
            </div>
            {invoice.due_date && (
              <div className="text-slate-500">
                Due{" "}
                <span className="text-slate-900">
                  {formatDate(invoice.due_date)}
                </span>
              </div>
            )}
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-800">{it.description}</td>
                <td className="py-2 text-right text-slate-600">
                  {Number(it.quantity)}
                </td>
                <td className="py-2 text-right text-slate-600">
                  {money(it.unit_price)}
                </td>
                <td className="py-2 text-right text-slate-900">
                  {money(it.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 text-sm">
            <SummaryRow label="Subtotal" value={money(summary?.subtotal)} />
            <SummaryRow
              label={`Tax (${invoice.tax_rate}%)`}
              value={money(summary?.tax_amount)}
            />
            <div className="my-1 border-t border-slate-200" />
            <SummaryRow label="Total" value={money(summary?.total)} bold />
            {Number(summary?.amount_paid) > 0 && (
              <>
                <SummaryRow
                  label="Paid"
                  value={`- ${money(summary?.amount_paid)}`}
                />
                <SummaryRow
                  label="Balance due"
                  value={money(summary?.balance_due)}
                  bold
                />
              </>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 border-t border-slate-200 pt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Notes
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
              {invoice.notes}
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Payments — screen only */}
      <div className="mx-auto mt-6 max-w-3xl print:hidden">
        <div className="overflow-x-auto panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div>
              <h2 className="font-semibold text-content">Payments</h2>
              <p className="text-xs text-faint">
                {money(summary?.amount_paid)} received ·{" "}
                {money(summary?.balance_due)} balance
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setPayOpen(true)}
              disabled={Number(summary?.balance_due) <= 0}
            >
              + Record payment
            </Button>
          </div>
          {payments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-faint">
              No payments recorded yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-5 py-3 text-muted">
                      {formatDate(p.paid_on)}
                    </td>
                    <td className="px-5 py-3 capitalize text-muted">
                      {p.method ?? "—"}
                      {p.reference ? (
                        <span className="text-faint"> · {p.reference}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-content">
                      {money(p.amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => onDeletePayment(p)}
                        className="text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <RecordPaymentModal
        open={payOpen}
        invoiceId={invoice.id}
        customerId={invoice.customer_id}
        defaultAmount={Number(summary?.balance_due ?? 0)}
        onClose={() => setPayOpen(false)}
        onSaved={async () => {
          setPayOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between py-1">
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-500"}>
        {label}
      </span>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-700"}>
        {value}
      </span>
    </div>
  );
}

function RecordPaymentModal({
  open,
  invoiceId,
  customerId,
  defaultAmount,
  onClose,
  onSaved,
}: {
  open: boolean;
  invoiceId: string;
  customerId: string | null;
  defaultAmount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PaymentInput>({
    amount: defaultAmount,
    paid_on: today(),
    method: "check",
    reference: null,
    notes: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setForm({
        amount: defaultAmount,
        paid_on: today(),
        method: "check",
        reference: null,
        notes: null,
      });
    }
  }, [open, defaultAmount]);

  const set = <K extends keyof PaymentInput>(k: K, v: PaymentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await recordPayment(invoiceId, customerId, {
        ...form,
        reference: form.reference?.trim() ? form.reference : null,
        notes: form.notes?.trim() ? form.notes : null,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount *">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              required
              value={form.amount}
              onChange={(e) => set("amount", Number(e.target.value))}
            />
          </Field>
          <Field label="Date">
            <TextInput
              type="date"
              value={form.paid_on}
              onChange={(e) => set("paid_on", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Method">
            <select
              className={selectCls}
              value={form.method ?? ""}
              onChange={(e) => set("method", e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reference" hint="check #, txn id…">
            <TextInput
              value={form.reference ?? ""}
              onChange={(e) => set("reference", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes">
          <TextArea
            rows={2}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Record payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
