import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import type { Customer, InvoiceSummary, Project } from "../lib/database.types";
import { getCustomer } from "../lib/customers";
import { supabase } from "../lib/supabase";
import { listProjectsForCustomer } from "../lib/projects";
import { money, formatDate } from "../lib/format";
import { Badge, Button } from "../components/ui";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [c, inv, proj] = await Promise.all([
          getCustomer(id),
          supabase
            .from("invoice_summary")
            .select("*")
            .eq("customer_id", id)
            .order("issue_date", { ascending: false }),
          listProjectsForCustomer(id),
        ]);
        setCustomer(c);
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
        <Button onClick={() => navigate("/invoices/new")}>+ New invoice</Button>
      </div>

      {/* Header */}
      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-content">
              {customer.display_name}
            </h1>
            {customer.company && (
              <p className="mt-1 text-sm text-muted">{customer.company}</p>
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
        <div className="overflow-hidden panel">
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

      <p className="mt-6 text-xs text-faint">
        Need to edit details?{" "}
        <Link to="/customers" className="text-brand hover:underline">
          Back to the customers list
        </Link>
        .
      </p>
    </div>
  );
}
