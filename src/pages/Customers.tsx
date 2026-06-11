import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import type { Customer } from "../lib/database.types";
import { exportCustomersCsv } from "../lib/quickbooks";
import {
  listCustomers,
  deleteCustomer,
  type CustomerListRow,
} from "../lib/customers";
import CustomerFormModal from "../components/CustomerFormModal";
import { Button, TextInput } from "../components/ui";
import { useToast, useConfirm } from "../components/feedback";

export default function Customers() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerListRow[]>([]);
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
      [c.company, c.primary_contact, c.email, c.phone]
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
            {customers.length}{" "}
            {customers.length === 1 ? "customer" : "customers"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const n = await exportCustomersCsv();
                toast(`Exported ${n} customers for QuickBooks`, "success");
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }}
          >
            <Download size={16} className="mr-1.5" /> Export
          </Button>
          <Button onClick={openNew}>+ New customer</Button>
        </div>
      </div>

      <div className="mt-5">
        <TextInput
          placeholder="Search company, contact, email, phone…"
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
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Contact</th>
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
                    {c.company}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.primary_contact ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.phone ?? "—"}</td>
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
        onSaved={() => {
          setFormOpen(false);
          toast("Customer saved", "success");
          void load();
        }}
      />
    </div>
  );
}
