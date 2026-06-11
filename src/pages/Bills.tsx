import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Bill, BillStatus } from "../lib/database.types";
import {
  listBills,
  createBill,
  updateBill,
  deleteBill,
  type BillInput,
} from "../lib/bills";
import { Download } from "lucide-react";
import { money, formatDate } from "../lib/format";
import { exportBillsCsv } from "../lib/quickbooks";
import Modal from "../components/Modal";
import BrandSelect from "../components/BrandSelect";
import { Badge, Button, Field, TextInput, TextArea } from "../components/ui";
import { useToast, useConfirm } from "../components/feedback";
import { useBrand } from "../brand/BrandContext";

const selectCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const today = () => new Date().toISOString().slice(0, 10);

const empty: BillInput = {
  vendor: "",
  category: null,
  amount: 0,
  bill_date: today(),
  due_date: null,
  status: "unpaid",
  paid_on: null,
  notes: null,
  business_profile_id: null,
};

export default function Bills() {
  const toast = useToast();
  const confirm = useConfirm();
  const { brand } = useBrand();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setBills(await listBills(brand));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter((b) =>
      [b.vendor, b.category, b.status]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [bills, query]);

  const unpaidTotal = bills
    .filter((b) => b.status === "unpaid")
    .reduce((s, b) => s + Number(b.amount), 0);

  const onDelete = async (b: Bill) => {
    const ok = await confirm({
      title: "Delete bill?",
      message: `The ${money(b.amount)} bill from ${b.vendor} will be removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBill(b.id);
      setBills((prev) => prev.filter((x) => x.id !== b.id));
      toast("Bill deleted", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-content">Bills</h1>
          <p className="mt-1 text-sm text-muted">
            {money(unpaidTotal)} unpaid across {bills.length}{" "}
            {bills.length === 1 ? "bill" : "bills"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const n = await exportBillsCsv();
                toast(`Exported ${n} bills for QuickBooks`, "success");
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }}
          >
            <Download size={16} className="mr-1.5" /> Export
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + New bill
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <TextInput
          placeholder="Search vendor, category, status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-faint">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-faint">
                  {bills.length === 0
                    ? "No bills yet. Log your first expense."
                    : "No matches."}
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-line last:border-0 hover:bg-surface2"
                >
                  <td
                    className="cursor-pointer px-4 py-3 font-medium text-content"
                    onClick={() => {
                      setEditing(b);
                      setFormOpen(true);
                    }}
                  >
                    {b.vendor}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {b.category ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(b.due_date)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-content">
                    {money(b.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditing(b);
                        setFormOpen(true);
                      }}
                      className="mr-3 text-brand hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(b)}
                      className="text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <BillFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setBills((prev) => {
            const exists = prev.some((b) => b.id === saved.id);
            const next = exists
              ? prev.map((b) => (b.id === saved.id ? saved : b))
              : [saved, ...prev];
            return next.sort((a, b) => b.bill_date.localeCompare(a.bill_date));
          });
          setFormOpen(false);
        }}
      />
    </div>
  );
}

function BillFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Bill | null;
  onClose: () => void;
  onSaved: (b: Bill) => void;
}) {
  const [form, setForm] = useState<BillInput>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      const { id, owner_id, created_at, updated_at, ...rest } = editing;
      void id;
      void owner_id;
      void created_at;
      void updated_at;
      setForm(rest);
    } else {
      setForm(empty);
    }
  }, [open, editing]);

  const set = <K extends keyof BillInput>(k: K, v: BillInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // If marked paid without a paid date, default it to today.
    const payload: BillInput = {
      ...form,
      category: form.category?.trim() ? form.category : null,
      notes: form.notes?.trim() ? form.notes : null,
      due_date: form.due_date || null,
      paid_on:
        form.status === "paid" ? form.paid_on || today() : form.paid_on || null,
    };
    try {
      const saved = editing
        ? await updateBill(editing.id, payload)
        : await createBill(payload);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit bill" : "New bill"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vendor *">
            <TextInput
              required
              value={form.vendor}
              onChange={(e) => set("vendor", e.target.value)}
            />
          </Field>
          <Field label="Category" hint="matches your QB account">
            <TextInput
              value={form.category ?? ""}
              onChange={(e) => set("category", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
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
          <Field label="Bill date">
            <TextInput
              type="date"
              value={form.bill_date}
              onChange={(e) => set("bill_date", e.target.value)}
            />
          </Field>
          <Field label="Due date">
            <TextInput
              type="date"
              value={form.due_date ?? ""}
              onChange={(e) => set("due_date", e.target.value || null)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <select
              className={selectCls}
              value={form.status}
              onChange={(e) => set("status", e.target.value as BillStatus)}
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          {form.status === "paid" && (
            <Field label="Paid on">
              <TextInput
                type="date"
                value={form.paid_on ?? today()}
                onChange={(e) => set("paid_on", e.target.value || null)}
              />
            </Field>
          )}
        </div>
        <Field label="Notes">
          <TextArea
            rows={2}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        <BrandSelect
          value={form.business_profile_id}
          onChange={(v) => set("business_profile_id", v)}
        />

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
            {busy ? "Saving…" : editing ? "Save changes" : "Create bill"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
