import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, Paperclip } from "lucide-react";
import type { Customer, Expense, Project } from "../lib/database.types";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadReceipt,
  getReceiptUrl,
  deleteReceipt,
  type ExpenseInput,
  type ExpenseRow,
} from "../lib/expenses";
import { listCustomers } from "../lib/customers";
import { listProjects } from "../lib/projects";
import { exportExpensesCsv } from "../lib/quickbooks";
import { money, formatDate } from "../lib/format";
import Modal from "../components/Modal";
import BrandSelect from "../components/BrandSelect";
import { Button, Field, TextInput, TextArea } from "../components/ui";
import { useToast, useConfirm } from "../components/feedback";
import { useBrand } from "../brand/BrandContext";

const METHODS = ["cash", "card", "check", "ach", "zelle", "venmo", "other"];
const selectCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const today = () => new Date().toISOString().slice(0, 10);

const empty: ExpenseInput = {
  expense_date: today(),
  merchant: "",
  category: null,
  amount: 0,
  payment_method: "card",
  customer_id: null,
  project_id: null,
  tax_deductible: false,
  tax_category: null,
  receipt_path: null,
  notes: null,
  business_profile_id: null,
};

export default function Expenses() {
  const toast = useToast();
  const confirm = useConfirm();
  const { brand } = useBrand();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, c, p] = await Promise.all([
        listExpenses(brand),
        listCustomers(brand),
        listProjects(brand),
      ]);
      setRows(e);
      setCustomers(c);
      setProjects(p);
    } catch (err) {
      setError((err as Error).message);
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
    if (!q) return rows;
    return rows.filter((r) =>
      [r.merchant, r.category, r.customer?.display_name, r.payment_method]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const deductible = rows
    .filter((r) => r.tax_deductible)
    .reduce((s, r) => s + Number(r.amount), 0);

  const openReceipt = async (path: string) => {
    try {
      const url = await getReceiptUrl(path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const onDelete = async (e: ExpenseRow) => {
    const ok = await confirm({
      title: "Delete expense?",
      message: `The ${money(e.amount)} expense at ${e.merchant} will be removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      if (e.receipt_path) await deleteReceipt(e.receipt_path);
      await deleteExpense(e.id);
      setRows((prev) => prev.filter((x) => x.id !== e.id));
      toast("Expense deleted", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-content">Expenses</h1>
          <p className="mt-1 text-sm text-muted">
            {money(total)} spent · {money(deductible)} tax-deductible
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const n = await exportExpensesCsv();
                toast(`Exported ${n} expenses for QuickBooks`, "success");
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
            + New expense
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <TextInput
          placeholder="Search merchant, category, customer, method…"
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
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-faint">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-faint">
                  {rows.length === 0
                    ? "No expenses yet. Log your first one."
                    : "No matches."}
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-line last:border-0 hover:bg-surface2"
                >
                  <td className="px-4 py-3 text-muted">
                    {formatDate(e.expense_date)}
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3 font-medium text-content hover:text-brand"
                    onClick={() => {
                      setEditing(e);
                      setFormOpen(true);
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {e.merchant}
                      {e.receipt_path && (
                        <Paperclip size={13} className="text-faint" />
                      )}
                      {e.tax_deductible && (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                          deductible
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{e.category ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {e.customer?.display_name ?? e.project?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted">
                    {e.payment_method ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-content">
                    {money(e.amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {e.receipt_path && (
                      <button
                        onClick={() => openReceipt(e.receipt_path!)}
                        className="mr-3 text-brand hover:underline"
                      >
                        Receipt
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditing(e);
                        setFormOpen(true);
                      }}
                      className="mr-3 text-brand hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(e)}
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

      <ExpenseFormModal
        open={formOpen}
        editing={editing}
        customers={customers}
        projects={projects}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
          toast("Expense saved", "success");
        }}
      />
    </div>
  );
}

function ExpenseFormModal({
  open,
  editing,
  customers,
  projects,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Expense | null;
  customers: Customer[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ExpenseInput>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
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

  const set = <K extends keyof ExpenseInput>(k: K, v: ExpenseInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let receipt_path = form.receipt_path;
      if (file) {
        receipt_path = await uploadReceipt(file);
        if (editing?.receipt_path) await deleteReceipt(editing.receipt_path);
      } else if (editing?.receipt_path && !form.receipt_path) {
        // Receipt was removed without replacing it.
        await deleteReceipt(editing.receipt_path);
      }
      const payload: ExpenseInput = {
        ...form,
        receipt_path,
        category: form.category?.trim() ? form.category : null,
        notes: form.notes?.trim() ? form.notes : null,
        tax_category:
          form.tax_deductible && form.tax_category?.trim()
            ? form.tax_category
            : null,
      };
      if (editing) await updateExpense(editing.id, payload);
      else await createExpense(payload);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit expense" : "New expense"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Merchant *">
            <TextInput
              required
              value={form.merchant}
              onChange={(e) => set("merchant", e.target.value)}
            />
          </Field>
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
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Date">
            <TextInput
              type="date"
              value={form.expense_date}
              onChange={(e) => set("expense_date", e.target.value)}
            />
          </Field>
          <Field label="Category" hint="QB account">
            <TextInput
              value={form.category ?? ""}
              onChange={(e) => set("category", e.target.value)}
            />
          </Field>
          <Field label="Payment method">
            <select
              className={selectCls}
              value={form.payment_method ?? ""}
              onChange={(e) => set("payment_method", e.target.value || null)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer">
            <select
              className={selectCls}
              value={form.customer_id ?? ""}
              onChange={(e) => set("customer_id", e.target.value || null)}
            >
              <option value="">— none —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project">
            <select
              className={selectCls}
              value={form.project_id ?? ""}
              onChange={(e) => set("project_id", e.target.value || null)}
            >
              <option value="">— none —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-md border border-line p-3">
          <label className="flex items-center gap-2 text-sm text-content">
            <input
              type="checkbox"
              checked={form.tax_deductible}
              onChange={(e) => set("tax_deductible", e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Tax-deductible
          </label>
          {form.tax_deductible && (
            <div className="mt-3">
              <Field label="Tax category" hint="e.g. Office, Travel, Meals">
                <TextInput
                  value={form.tax_category ?? ""}
                  onChange={(e) => set("tax_category", e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        <Field label="Receipt" hint="image or PDF">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-content hover:file:bg-line"
          />
          {form.receipt_path && !file && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-faint">A receipt is attached.</span>
              <button
                type="button"
                onClick={() => set("receipt_path", null)}
                className="text-red-400 hover:underline"
              >
                Remove
              </button>
            </div>
          )}
        </Field>

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
            {busy ? "Saving…" : editing ? "Save changes" : "Create expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
