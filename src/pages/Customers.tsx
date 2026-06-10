import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Customer } from "../lib/database.types";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type CustomerInput,
} from "../lib/customers";
import Modal from "../components/Modal";
import { Button, Field, TextInput, TextArea } from "../components/ui";
import { useToast, useConfirm } from "../components/feedback";

const empty: CustomerInput = {
  display_name: "",
  company: null,
  email: null,
  phone: null,
  bill_line1: null,
  bill_line2: null,
  bill_city: null,
  bill_state: null,
  bill_postal: null,
  bill_country: null,
  notes: null,
  is_active: true,
};

export default function Customers() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await listCustomers());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.display_name, c.company, c.email, c.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [customers, query]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setFormOpen(true);
  };

  const onDelete = async (c: Customer) => {
    const ok = await confirm({
      title: "Delete customer?",
      message: `${c.display_name} will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCustomer(c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      toast("Customer deleted", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-content">Customers</h1>
          <p className="mt-1 text-sm text-muted">
            {customers.length} {customers.length === 1 ? "customer" : "customers"}
          </p>
        </div>
        <Button onClick={openNew}>+ New customer</Button>
      </div>

      <div className="mt-5">
        <TextInput
          placeholder="Search name, company, email, phone…"
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

      <div className="mt-4 overflow-hidden panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
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
                  {customers.length === 0
                    ? "No customers yet. Add your first one."
                    : "No matches."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-line last:border-0 hover:bg-surface2"
                >
                  <td
                    className="cursor-pointer px-4 py-3 font-medium text-content hover:text-brand"
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    {c.display_name}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.company ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
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

      <CustomerFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setCustomers((prev) => {
            const exists = prev.some((c) => c.id === saved.id);
            const next = exists
              ? prev.map((c) => (c.id === saved.id ? saved : c))
              : [...prev, saved];
            return next.sort((a, b) =>
              a.display_name.localeCompare(b.display_name),
            );
          });
          setFormOpen(false);
        }}
      />
    </div>
  );
}

function CustomerFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const [form, setForm] = useState<CustomerInput>(empty);
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

  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const text = (key: keyof CustomerInput) =>
    (form[key] as string | null) ?? "";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Normalize empty strings to null so the DB stores clean data.
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) =>
        typeof v === "string" && v.trim() === "" ? [k, null] : [k, v],
      ),
    ) as CustomerInput;
    try {
      const saved = editing
        ? await updateCustomer(editing.id, payload)
        : await createCustomer(payload);
      onSaved(saved);
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
      title={editing ? "Edit customer" : "New customer"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name *">
          <TextInput
            required
            value={text("display_name")}
            onChange={(e) => set("display_name", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company">
            <TextInput
              value={text("company")}
              onChange={(e) => set("company", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={text("phone")}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Email">
          <TextInput
            type="email"
            value={text("email")}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Address line 1">
            <TextInput
              value={text("bill_line1")}
              onChange={(e) => set("bill_line1", e.target.value)}
            />
          </Field>
          <Field label="Address line 2">
            <TextInput
              value={text("bill_line2")}
              onChange={(e) => set("bill_line2", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Field label="City">
            <TextInput
              value={text("bill_city")}
              onChange={(e) => set("bill_city", e.target.value)}
            />
          </Field>
          <Field label="State">
            <TextInput
              value={text("bill_state")}
              onChange={(e) => set("bill_state", e.target.value)}
            />
          </Field>
          <Field label="ZIP">
            <TextInput
              value={text("bill_postal")}
              onChange={(e) => set("bill_postal", e.target.value)}
            />
          </Field>
          <Field label="Country">
            <TextInput
              value={text("bill_country")}
              onChange={(e) => set("bill_country", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <TextArea
            rows={3}
            value={text("notes")}
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
            {busy ? "Saving…" : editing ? "Save changes" : "Create customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
