import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listInvoices, type InvoiceListRow } from "../lib/invoices";
import { money, formatDate } from "../lib/format";
import { Badge, Button, TextInput } from "../components/ui";

export default function Invoices() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<InvoiceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setRows(await listInvoices());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.invoice_number, r.customer?.display_name, r.status]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const outstanding = rows
    .filter((r) => r.status !== "void")
    .reduce((sum, r) => sum + Number(r.balance_due), 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-content">Invoices</h1>
          <p className="mt-1 text-sm text-muted">
            {money(outstanding)} outstanding across {rows.length}{" "}
            {rows.length === 1 ? "invoice" : "invoices"}
          </p>
        </div>
        <Button onClick={() => navigate("/invoices/new")}>+ New invoice</Button>
      </div>

      <div className="mt-5">
        <TextInput
          placeholder="Search number, customer, status…"
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

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Issued</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
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
                  {rows.length === 0
                    ? "No invoices yet. Create your first one."
                    : "No matches."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/invoices/${r.id}`)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-surface2"
                >
                  <td className="px-4 py-3 font-medium text-content">
                    {r.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {r.customer?.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(r.issue_date)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-content">
                    {money(r.total)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-content">
                    {money(r.balance_due)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
