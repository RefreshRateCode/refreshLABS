import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FileText } from "lucide-react";
import {
  listContracts,
  createContract,
  updateContract,
  deleteContract,
  getContract,
  getContractUrl,
  suggestCustomerId,
  type ContractRow,
  type ContractInput,
  type ContractItemInput,
} from "../lib/contracts";
import { listCustomers, type CustomerListRow } from "../lib/customers";
import { money, formatDate } from "../lib/format";
import Modal from "../components/Modal";
import BrandSelect from "../components/BrandSelect";
import { Button, Field, TextInput, TextArea } from "../components/ui";
import { useToast, useConfirm } from "../components/feedback";
import { useBrand } from "../brand/BrandContext";

const selectCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const ACCEPT = ".pdf,image/*,.doc,.docx,.xls,.xlsx,.csv,.txt";

export default function Contracts() {
  const toast = useToast();
  const confirm = useConfirm();
  const { brand } = useBrand();
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [customers, setCustomers] = useState<CustomerListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContractRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cs, custs] = await Promise.all([
        listContracts(brand),
        listCustomers(brand),
      ]);
      setRows(cs);
      setCustomers(custs);
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
    if (!q) return rows;
    return rows.filter((r) =>
      [r.title, r.customer?.company, r.file_name]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: ContractRow) => {
    setEditing(c);
    setFormOpen(true);
  };

  const openFile = async (c: ContractRow) => {
    if (!c.path) return;
    try {
      window.open(await getContractUrl(c.path), "_blank", "noopener");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const onDelete = async (c: ContractRow) => {
    const ok = await confirm({
      title: "Delete contract?",
      message: `"${c.title}" will be permanently removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteContract(c);
      setRows((prev) => prev.filter((x) => x.id !== c.id));
      toast("Contract deleted", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-content">Contracts</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} {rows.length === 1 ? "contract" : "contracts"}
          </p>
        </div>
        <Button onClick={openNew}>+ New contract</Button>
      </div>

      <div className="mt-5">
        <TextInput
          placeholder="Search title, customer, file…"
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
              <th className="px-4 py-3 font-medium">Contract</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Terms</th>
              <th className="px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-faint">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-faint">
                  {rows.length === 0
                    ? "No contracts yet. Upload your first one."
                    : "No matches."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-line last:border-0 hover:bg-surface2"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => (c.path ? openFile(c) : openEdit(c))}
                      className="flex items-center gap-2 text-left font-medium text-content hover:text-brand"
                    >
                      <FileText size={16} className="shrink-0 text-faint" />
                      {c.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.customer?.company ?? "— unassigned —"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.payment_terms_days > 0
                      ? `Net ${c.payment_terms_days}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.path && (
                      <button
                        onClick={() => openFile(c)}
                        className="mr-3 text-brand hover:underline"
                      >
                        Open
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(c)}
                      className="mr-3 text-brand hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(c)}
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

      <ContractFormModal
        open={formOpen}
        editing={editing}
        customers={customers}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          toast("Contract saved", "success");
          void load();
        }}
      />
    </div>
  );
}

const blankItem = (): ContractItemInput => ({
  description: "",
  quantity: 1,
  unit_price: 0,
});

function ContractFormModal({
  open,
  editing,
  customers,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: ContractRow | null;
  customers: CustomerListRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ContractInput>({
    title: "",
    customer_id: null,
    payment_terms_days: 0,
    notes: null,
    business_profile_id: null,
  });
  const [items, setItems] = useState<ContractItemInput[]>([blankItem()]);
  const [file, setFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [suggested, setSuggested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    setSuggested(false);
    if (editing) {
      setExistingFileName(editing.file_name);
      (async () => {
        try {
          const { contract, lineItems } = await getContract(editing.id);
          setForm({
            title: contract.title,
            customer_id: contract.customer_id,
            payment_terms_days: contract.payment_terms_days,
            notes: contract.notes,
            business_profile_id: contract.business_profile_id,
          });
          setItems(
            lineItems.length
              ? lineItems.map((li) => ({
                  description: li.description,
                  quantity: Number(li.quantity),
                  unit_price: Number(li.unit_price),
                }))
              : [blankItem()],
          );
        } catch (e) {
          setError((e as Error).message);
        }
      })();
    } else {
      setForm({
        title: "",
        customer_id: null,
        payment_terms_days: 0,
        notes: null,
        business_profile_id: null,
      });
      setItems([blankItem()]);
      setExistingFileName(null);
    }
  }, [open, editing]);

  const set = <K extends keyof ContractInput>(k: K, v: ContractInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i: number, patch: Partial<ContractItemInput>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, blankItem()]);
  const removeItem = (i: number) =>
    setItems((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (!f) return;
    // Default the title to the file name (without extension) if empty.
    if (!form.title.trim()) {
      set("title", f.name.replace(/\.[^.]+$/, ""));
    }
    // Auto-suggest the customer from the file name when none is chosen yet.
    if (!form.customer_id) {
      const id = suggestCustomerId(
        f.name,
        customers.map((c) => ({
          id: c.id,
          company: c.company,
          display_name: c.display_name,
          primary_contact: c.primary_contact,
        })),
      );
      if (id) {
        set("customer_id", id);
        setSuggested(true);
      }
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Give the contract a title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: ContractInput = {
        title: form.title.trim(),
        customer_id: form.customer_id || null,
        payment_terms_days: Number(form.payment_terms_days) || 0,
        notes: form.notes?.trim() ? form.notes : null,
        business_profile_id: form.business_profile_id,
      };
      if (editing) await updateContract(editing.id, payload, file, items);
      else await createContract(payload, file, items);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0),
    0,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit contract" : "New contract"}
      width="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Title *">
          <TextInput
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Master services agreement"
          />
        </Field>

        {/* File */}
        <div>
          <span className="mb-1 block text-sm font-medium text-content">
            File
          </span>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={onPickFile}
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInput.current?.click()}
            >
              {file || existingFileName ? "Replace file" : "Choose file"}
            </Button>
            <span className="truncate text-sm text-muted">
              {file?.name ?? existingFileName ?? "PDF, image, or document (≤ 25 MB)"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Customer"
            hint={suggested ? "Auto-suggested from the file name — change if wrong." : undefined}
          >
            <select
              className={selectCls}
              value={form.customer_id ?? ""}
              onChange={(e) => {
                set("customer_id", e.target.value || null);
                setSuggested(false);
              }}
            >
              <option value="">— unassigned —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company}
                  {c.primary_contact ? ` — ${c.primary_contact}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment terms (days)" hint="0 = no due date">
            <TextInput
              type="number"
              min="0"
              value={form.payment_terms_days}
              onChange={(e) =>
                set("payment_terms_days", Number(e.target.value))
              }
            />
          </Field>
        </div>

        {/* Agreed services */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-content">
              Agreed services
            </span>
            <button
              type="button"
              onClick={addItem}
              className="text-sm font-medium text-brand hover:underline"
            >
              + Add line
            </button>
          </div>
          <p className="mb-2 text-xs text-faint">
            These pre-fill the line items on this customer's estimates &
            invoices.
          </p>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">
                      <TextInput
                        placeholder="Service…"
                        value={it.description}
                        onChange={(e) =>
                          setItem(i, { description: e.target.value })
                        }
                      />
                    </td>
                    <td className="w-20 px-2 py-2">
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
                    <td className="w-28 px-2 py-2">
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
                    <td className="w-10 px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-faint hover:text-red-400"
                        aria-label="Remove line"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between border-t border-line px-3 py-2 text-sm">
              <span className="text-muted">Total</span>
              <span className="font-medium text-content">{money(subtotal)}</span>
            </div>
          </div>
        </div>

        <Field label="Notes / terms">
          <TextArea
            rows={3}
            placeholder="Scope, terms, anything to copy onto estimates/invoices…"
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
            {busy ? "Saving…" : editing ? "Save changes" : "Create contract"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
