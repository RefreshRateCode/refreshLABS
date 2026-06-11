import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import type {
  Customer,
  CustomerContact,
  CustomerFile,
  InvoiceSummary,
  Project,
} from "../lib/database.types";
import {
  getCustomer,
  listContacts,
  listCustomerFiles,
  uploadCustomerFile,
  getCustomerFileUrl,
  deleteCustomerFile,
} from "../lib/customers";
import { supabase } from "../lib/supabase";
import { listProjectsForCustomer } from "../lib/projects";
import { money, formatDate } from "../lib/format";
import { Badge, Button } from "../components/ui";
import CustomerFormModal from "../components/CustomerFormModal";
import { useToast, useConfirm } from "../components/feedback";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = ".pdf,image/*,.doc,.docx,.xls,.xlsx,.csv,.txt";

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [c, contactRows, fileRows, inv, proj] = await Promise.all([
          getCustomer(id),
          listContacts(id),
          listCustomerFiles(id),
          supabase
            .from("invoice_summary")
            .select("*")
            .eq("customer_id", id)
            .order("issue_date", { ascending: false }),
          listProjectsForCustomer(id),
        ]);
        setCustomer(c);
        setContacts(contactRows);
        setFiles(fileRows);
        if (inv.error) throw inv.error;
        setInvoices((inv.data as InvoiceSummary[]) ?? []);
        setProjects(proj);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file || !id) return;
    if (file.size > MAX_BYTES) {
      toast("File is larger than 25 MB.", "error");
      return;
    }
    setUploading(true);
    try {
      const saved = await uploadCustomerFile(id, file);
      setFiles((prev) => [saved, ...prev]);
      toast("File uploaded", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (f: CustomerFile) => {
    try {
      const url = await getCustomerFileUrl(f.path);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const removeFile = async (f: CustomerFile) => {
    const ok = await confirm({
      title: "Delete file?",
      message: `"${f.name}" will be permanently removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCustomerFile(f);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      toast("File deleted", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  if (loading) return <p className="text-faint">Loading…</p>;
  if (error)
    return (
      <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {error}
      </p>
    );
  if (!customer) return <p className="text-faint">Not found.</p>;

  const active = invoices.filter((i) => i.status !== "void");
  const billed = active.reduce((s, i) => s + Number(i.total), 0);
  const paid = active.reduce((s, i) => s + Number(i.amount_paid), 0);
  const outstanding = active.reduce((s, i) => s + Number(i.balance_due), 0);

  const addr = [
    customer.bill_line1,
    customer.bill_line2,
    [customer.bill_city, customer.bill_state, customer.bill_postal]
      .filter(Boolean)
      .join(", "),
    customer.bill_country,
  ].filter(Boolean);

  const primary =
    contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;

  const stats = [
    { label: "Total billed", value: money(billed) },
    { label: "Total paid", value: money(paid) },
    { label: "Outstanding", value: money(outstanding) },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="secondary" onClick={() => navigate("/customers")}>
          ← Customers
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setFormOpen(true)}>
            Edit
          </Button>
          <Button onClick={() => navigate("/invoices/new")}>
            + New invoice
          </Button>
        </div>
      </div>

      {/* Header — company first, primary contact next */}
      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-content">
              {customer.company}
            </h1>
            {primary && (
              <p className="mt-1 text-sm text-muted">
                {primary.name}
                {primary.role && (
                  <span className="text-faint"> · {primary.role}</span>
                )}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-muted">
            {customer.email && <div>{customer.email}</div>}
            {customer.phone && <div>{customer.phone}</div>}
            {addr.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
        {customer.notes && (
          <p className="mt-4 whitespace-pre-wrap border-t border-line pt-4 text-sm text-muted">
            {customer.notes}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="panel p-5">
            <div className="text-sm text-muted">{s.label}</div>
            <div className="accent-gradient mt-2 text-2xl font-semibold">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Contacts */}
      {contacts.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
            Contacts
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {contacts.map((c) => (
              <div key={c.id} className="panel p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-content">{c.name}</span>
                  {c.is_primary && <Badge status="primary" />}
                </div>
                {c.role && (
                  <div className="mt-0.5 text-xs text-faint">{c.role}</div>
                )}
                <div className="mt-2 space-y-0.5 text-sm text-muted">
                  {c.email && <div>{c.email}</div>}
                  {c.phone && <div>{c.phone}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
            Files
          </h2>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={onPickFile}
          />
          <Button
            variant="secondary"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} className="mr-1.5" />
            {uploading ? "Uploading…" : "Upload file"}
          </Button>
        </div>
        <div className="overflow-hidden panel">
          {files.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-faint">
              No files yet. Upload PDFs, images, or documents (up to 25 MB).
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface2"
                >
                  <FileText size={18} className="shrink-0 text-faint" />
                  <button
                    onClick={() => openFile(f)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-content hover:text-brand"
                    title={f.name}
                  >
                    {f.name}
                  </button>
                  <span className="shrink-0 text-xs text-faint">
                    {formatSize(f.size_bytes)}
                  </span>
                  <span className="shrink-0 text-xs text-faint">
                    {formatDate(f.created_at)}
                  </span>
                  <button
                    onClick={() => openFile(f)}
                    className="shrink-0 text-faint hover:text-brand"
                    aria-label="Download"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => removeFile(f)}
                    className="shrink-0 text-faint hover:text-red-400"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Projects */}
      {projects.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
            Projects
          </h2>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-content"
              >
                {p.name} <Badge status={p.status} />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
          Invoices
        </h2>
        <div className="overflow-x-auto panel">
          {invoices.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-faint">
              No invoices for this customer yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr
                    key={i.id}
                    onClick={() => navigate(`/invoices/${i.id}`)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface2"
                  >
                    <td className="px-4 py-3 font-medium text-content">
                      {i.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(i.issue_date)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={i.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {money(i.total)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-content">
                      {money(i.balance_due)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CustomerFormModal
        open={formOpen}
        editing={customer}
        onClose={() => setFormOpen(false)}
        onSaved={async (saved) => {
          setCustomer(saved);
          setFormOpen(false);
          toast("Customer saved", "success");
          if (id) setContacts(await listContacts(id));
        }}
      />
    </div>
  );
}
