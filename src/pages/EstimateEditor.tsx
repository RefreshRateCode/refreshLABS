import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  Customer,
  EstimateKind,
  EstimateStatus,
  ServicePreset,
} from "../lib/database.types";
import { listCustomers } from "../lib/customers";
import { listPresets } from "../lib/presets";
import {
  createEstimate,
  updateEstimate,
  getEstimate,
  type EstimateInput,
  type EstLineItemInput,
} from "../lib/estimates";
import { money } from "../lib/format";
import { Button, Field, TextInput, TextArea } from "../components/ui";

const STATUSES: EstimateStatus[] = ["draft", "sent", "accepted", "declined"];
const selectCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const blankRow = (): EstLineItemInput => ({
  description: "",
  quantity: 1,
  unit_price: 0,
});

export default function EstimateEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [presets, setPresets] = useState<ServicePreset[]>([]);
  const [form, setForm] = useState<EstimateInput>({
    customer_id: null,
    title: "",
    kind: "one_time",
    status: "draft",
    tax_rate: 0,
    discount_pct: 0,
    notes: null,
  });
  const [items, setItems] = useState<EstLineItemInput[]>([blankRow()]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [custs, pres] = await Promise.all([
          listCustomers(),
          listPresets(),
        ]);
        setCustomers(custs);
        setPresets(pres);
        if (editing && id) {
          const { estimate, lineItems } = await getEstimate(id);
          setForm({
            customer_id: estimate.customer_id,
            title: estimate.title,
            kind: estimate.kind,
            status: estimate.status,
            tax_rate: estimate.tax_rate,
            discount_pct: estimate.discount_pct,
            notes: estimate.notes,
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
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, id]);

  const set = <K extends keyof EstimateInput>(k: K, v: EstimateInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i: number, patch: Partial<EstLineItemInput>) =>
    setItems((arr) =>
      arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    );
  const addRow = () => setItems((arr) => [...arr, blankRow()]);
  const removeRow = (i: number) =>
    setItems((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  const addPreset = (presetId: string) => {
    const p = presets.find((x) => x.id === presetId);
    if (!p) return;
    const row: EstLineItemInput = {
      description: p.description?.trim() ? `${p.name} — ${p.description}` : p.name,
      quantity: Number(p.default_qty),
      unit_price: Number(p.default_rate),
    };
    setItems((arr) => {
      const onlyBlank =
        arr.length === 1 && !arr[0].description && !arr[0].unit_price;
      return onlyBlank ? [row] : [...arr, row];
    });
  };

  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0),
    0,
  );
  const discount = Math.round(subtotal * Number(form.discount_pct || 0)) / 100;
  const net = subtotal - discount;
  const tax = Math.round(net * Number(form.tax_rate || 0)) / 100;
  const total = net + tax;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: EstimateInput = {
        ...form,
        notes: form.notes?.trim() ? form.notes : null,
      };
      if (editing && id) {
        await updateEstimate(id, payload, items);
        navigate(`/estimator/${id}`);
      } else {
        const newId = await createEstimate(payload, items);
        navigate(`/estimator/${newId}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-faint">Loading…</p>;

  return (
    <form onSubmit={onSubmit}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-content">
          {editing ? "Edit estimate" : "New estimate"}
        </h1>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save estimate"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 panel p-6 sm:grid-cols-3">
        <Field label="Title *">
          <TextInput
            required
            placeholder="Website redesign, Care plan…"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Customer">
          <select
            className={selectCls}
            value={form.customer_id ?? ""}
            onChange={(e) => set("customer_id", e.target.value || null)}
          >
            <option value="">— none yet —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select
            className={selectCls}
            value={form.kind}
            onChange={(e) => set("kind", e.target.value as EstimateKind)}
          >
            <option value="one_time">One-time quote</option>
            <option value="monthly">Monthly plan</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            className={selectCls}
            value={form.status}
            onChange={(e) => set("status", e.target.value as EstimateStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Discount (%)">
          <TextInput
            type="number"
            step="0.001"
            min="0"
            value={form.discount_pct}
            onChange={(e) => set("discount_pct", Number(e.target.value))}
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
      </div>

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
                    placeholder="Service or deliverable…"
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
        <div className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={addRow}
            className="text-sm font-medium text-brand hover:underline"
          >
            + Add line
          </button>
          {presets.length > 0 && (
            <select
              className="rounded-md border border-line bg-surface2 px-2 py-1 text-sm text-content"
              value=""
              onChange={(e) => {
                if (e.target.value) addPreset(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">+ Add from preset…</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({money(p.default_rate)}/{p.unit})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div className="sm:w-1/2">
          <Field label="Notes">
            <TextArea
              rows={4}
              placeholder="Scope, assumptions, terms…"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:w-72">
          <div className="panel p-4 text-sm">
            <Row label="Subtotal" value={money(subtotal)} />
            {Number(form.discount_pct) > 0 && (
              <Row
                label={`Discount (${form.discount_pct}%)`}
                value={`- ${money(discount)}`}
              />
            )}
            <Row label={`Tax (${form.tax_rate || 0}%)`} value={money(tax)} />
            <div className="mt-2 border-t border-line pt-2">
              <Row
                label={form.kind === "monthly" ? "Total / month" : "Total"}
                value={money(total)}
                bold
              />
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
