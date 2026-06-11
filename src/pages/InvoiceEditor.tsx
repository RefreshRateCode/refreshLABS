import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import type {
  BusinessProfile,
  Customer,
  InvoiceStatus,
} from "../lib/database.types";
import { listCustomers } from "../lib/customers";
import { listBusinessProfiles } from "../lib/businessProfiles";
import {
  listContractsForCustomer,
  getContract,
  getContractUrl,
} from "../lib/contracts";
import type { Contract } from "../lib/database.types";
import { useToast } from "../components/feedback";
import {
  createInvoice,
  updateInvoice,
  getInvoice,
  suggestNextNumber,
  type InvoiceInput,
  type LineItemInput,
} from "../lib/invoices";
import { money } from "../lib/format";
import { getSettings } from "../lib/settings";
import { Button, Field, TextInput, TextArea } from "../components/ui";

const STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "void",
];

const selectCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

const today = () => new Date().toISOString().slice(0, 10);

const blankRow = (): LineItemInput => ({
  description: "",
  quantity: 1,
  unit_price: 0,
});

export default function InvoiceEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [customerContracts, setCustomerContracts] = useState<Contract[]>([]);
  const [form, setForm] = useState<InvoiceInput>({
    customer_id: "",
    project_id: null,
    invoice_number: "",
    status: "draft",
    issue_date: today(),
    due_date: null,
    tax_rate: 0,
    notes: null,
    business_profile_id: null,
  });
  const [items, setItems] = useState<LineItemInput[]>([blankRow()]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [custs, profs] = await Promise.all([
          listCustomers(),
          listBusinessProfiles(),
        ]);
        setCustomers(custs);
        setProfiles(profs);

        if (editing && id) {
          const { invoice, lineItems } = await getInvoice(id);
          setForm({
            customer_id: invoice.customer_id,
            project_id: invoice.project_id,
            invoice_number: invoice.invoice_number,
            status: invoice.status,
            issue_date: invoice.issue_date,
            due_date: invoice.due_date,
            tax_rate: invoice.tax_rate,
            notes: invoice.notes,
            business_profile_id: invoice.business_profile_id,
          });
          setItems(
            lineItems.length
              ? lineItems.map((li) => ({
                  description: li.description,
                  quantity: Number(li.quantity),
                  unit_price: Number(li.unit_price),
                }))
              : [blankRow()],
          );
        } else {
          const settings = await getSettings();
          const num = await suggestNextNumber(settings.invoice_prefix);
          let due: string | null = null;
          if (settings.default_payment_terms_days > 0) {
            const d = new Date(today() + "T00:00:00");
            d.setDate(d.getDate() + settings.default_payment_terms_days);
            due = d.toISOString().slice(0, 10);
          }
          setForm((f) => ({
            ...f,
            invoice_number: num,
            customer_id: custs[0]?.id ?? "",
            tax_rate: settings.default_tax_rate,
            due_date: due,
            notes: settings.default_invoice_notes,
          }));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, id]);

  // Load the selected customer's contracts so we can offer to pre-fill.
  useEffect(() => {
    if (!form.customer_id) {
      setCustomerContracts([]);
      return;
    }
    let active = true;
    listContractsForCustomer(form.customer_id)
      .then((cs) => active && setCustomerContracts(cs))
      .catch(() => active && setCustomerContracts([]));
    return () => {
      active = false;
    };
  }, [form.customer_id]);

  const set = <K extends keyof InvoiceInput>(k: K, v: InvoiceInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const prefillFromContract = async (contractId: string) => {
    try {
      const { contract, lineItems } = await getContract(contractId);
      if (lineItems.length) {
        setItems(
          lineItems.map((li) => ({
            description: li.description,
            quantity: Number(li.quantity),
            unit_price: Number(li.unit_price),
          })),
        );
      }
      if (contract.notes) set("notes", contract.notes);
      if (contract.payment_terms_days > 0) {
        const d = new Date(form.issue_date + "T00:00:00");
        d.setDate(d.getDate() + contract.payment_terms_days);
        set("due_date", d.toISOString().slice(0, 10));
      }
      toast("Pre-filled from contract", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const openContract = async (path: string | null) => {
    if (!path) return;
    try {
      window.open(await getContractUrl(path), "_blank", "noopener");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const setItem = (i: number, patch: Partial<LineItemInput>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addRow = () => setItems((arr) => [...arr, blankRow()]);
  const removeRow = (i: number) =>
    setItems((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0),
    0,
  );
  const taxAmount =
    Math.round(subtotal * Number(form.tax_rate || 0)) / 100;
  const total = subtotal + taxAmount;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.customer_id) {
      setError("Pick a customer first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: InvoiceInput = {
        ...form,
        notes: form.notes?.trim() ? form.notes : null,
        due_date: form.due_date || null,
      };
      if (editing && id) {
        await updateInvoice(id, payload, items);
        navigate(`/invoices/${id}`);
      } else {
        const newId = await createInvoice(payload, items);
        navigate(`/invoices/${newId}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-faint">Loading…</p>;

  if (!editing && customers.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-content">New invoice</h1>
        <p className="mt-4 text-sm text-muted">
          You need a customer first.{" "}
          <Link to="/customers" className="text-brand hover:underline">
            Add a customer
          </Link>{" "}
          and come back.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-content">
          {editing ? `Edit ${form.invoice_number}` : "New invoice"}
        </h1>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save invoice"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 panel p-6 sm:grid-cols-3">
        <Field label="Customer *">
          <select
            className={selectCls}
            value={form.customer_id}
            onChange={(e) => set("customer_id", e.target.value)}
          >
            <option value="">Select…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Invoice number *">
          <TextInput
            required
            value={form.invoice_number}
            onChange={(e) => set("invoice_number", e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className={selectCls}
            value={form.status}
            onChange={(e) => set("status", e.target.value as InvoiceStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Issue date">
          <TextInput
            type="date"
            value={form.issue_date}
            onChange={(e) => set("issue_date", e.target.value)}
          />
        </Field>
        <Field label="Due date">
          <TextInput
            type="date"
            value={form.due_date ?? ""}
            onChange={(e) => set("due_date", e.target.value || null)}
          />
        </Field>
        <Field label="Tax rate (%)">
          <TextInput
            type="number"
            step="0.001"
            min="0"
            value={form.tax_rate}
            onChange={(e) => set("tax_rate", Number(e.target.value))}
          />
        </Field>
        {profiles.length > 0 && (
          <Field label="Issued by">
            <select
              className={selectCls}
              value={form.business_profile_id ?? ""}
              onChange={(e) =>
                set("business_profile_id", e.target.value || null)
              }
            >
              <option value="">Primary (default)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {/* Contracts on file for this customer */}
      {customerContracts.length > 0 && (
        <div className="mt-6 panel p-4">
          <div className="text-sm font-semibold text-content">
            Contracts on file
          </div>
          <ul className="mt-2 space-y-2">
            {customerContracts.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-muted">{c.title}</span>
                <span className="flex gap-3">
                  {c.path && (
                    <button
                      type="button"
                      onClick={() => openContract(c.path)}
                      className="text-brand hover:underline"
                    >
                      Open
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => prefillFromContract(c.id)}
                    className="text-brand hover:underline"
                  >
                    Use in this invoice
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Line items */}
      <div className="mt-6 overflow-x-auto panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="w-24 px-4 py-3 text-right font-medium">Qty</th>
              <th className="w-32 px-4 py-3 text-right font-medium">Unit price</th>
              <th className="w-32 px-4 py-3 text-right font-medium">Amount</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-4 py-2">
                  <TextInput
                    placeholder="Work performed…"
                    value={it.description}
                    onChange={(e) => setItem(i, { description: e.target.value })}
                  />
                </td>
                <td className="px-4 py-2">
                  <TextInput
                    type="number"
                    step="0.01"
                    className="text-right"
                    value={it.quantity}
                    onChange={(e) =>
                      setItem(i, { quantity: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="px-4 py-2">
                  <TextInput
                    type="number"
                    step="0.01"
                    className="text-right"
                    value={it.unit_price}
                    onChange={(e) =>
                      setItem(i, { unit_price: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="px-4 py-2 text-right text-content">
                  {money(Number(it.quantity || 0) * Number(it.unit_price || 0))}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-faint hover:text-red-400"
                    aria-label="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={addRow}
            className="text-sm font-medium text-brand hover:underline"
          >
            + Add line
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div className="sm:w-1/2">
          <Field label="Notes">
            <TextArea
              rows={4}
              placeholder="Payment terms, thank-you note, etc."
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:w-72">
          <div className="panel p-4 text-sm">
            <Row label="Subtotal" value={money(subtotal)} />
            <Row
              label={`Tax (${form.tax_rate || 0}%)`}
              value={money(taxAmount)}
            />
            <div className="mt-2 border-t border-line pt-2">
              <Row label="Total" value={money(total)} bold />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function Row({
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
      <span className={bold ? "font-semibold text-content" : "text-muted"}>
        {label}
      </span>
      <span className={bold ? "font-semibold text-content" : "text-content"}>
        {value}
      </span>
    </div>
  );
}
