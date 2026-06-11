import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard, type DashboardData } from "../lib/dashboard";
import { ESTIMATE_STATUS_LABEL } from "../lib/database.types";
import { money, formatDate } from "../lib/format";
import { Badge } from "../components/ui";
import { useBrand } from "../brand/BrandContext";

export default function Dashboard() {
  const { brand } = useBrand();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        setData(await getDashboard(brand));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [brand]);

  const cards = [
    {
      label: "Income this month",
      value: money(data?.incomeThisMonth),
      hint: "payments received",
    },
    {
      label: "Expenses this month",
      value: money(data?.expensesThisMonth),
      hint: "money spent",
    },
    {
      label: "Net this month",
      value: money(
        data ? data.incomeThisMonth - data.expensesThisMonth : 0,
      ),
      hint: "income − expenses",
    },
    {
      label: "Outstanding",
      value: money(data?.outstanding),
      hint:
        data && data.overdueCount > 0
          ? `${data.overdueCount} overdue`
          : "unpaid invoices",
    },
    {
      label: "Unpaid bills",
      value: money(data?.unpaidBills),
      hint: "bills to pay",
    },
    {
      label: "Open pipeline",
      value: money(data?.openPipeline),
      hint:
        data && data.openEstimateCount > 0
          ? `${data.openEstimateCount} open estimate${
              data.openEstimateCount === 1 ? "" : "s"
            }`
          : "estimates in play",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-content">Dashboard</h1>
      <p className="mt-2 text-sm text-muted">Your workspace at a glance.</p>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="panel panel-hover p-5">
            <div className="text-sm text-muted">{c.label}</div>
            <div className="accent-gradient mt-2 text-3xl font-semibold">
              {loading ? "…" : c.value}
            </div>
            <div className="mt-1 text-xs text-faint">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent invoices */}
        <div className="overflow-x-auto panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-semibold text-content">Recent invoices</h2>
            <Link to="/invoices" className="text-xs text-brand hover:underline">
              View all
            </Link>
          </div>
          {!loading && data && data.recentInvoices.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-faint">
              No invoices yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {(data?.recentInvoices ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        to={`/invoices/${r.id}`}
                        className="font-medium text-content hover:text-brand"
                      >
                        {r.invoice_number}
                      </Link>
                      <div className="text-xs text-faint">
                        {r.customer?.display_name ?? "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge status={r.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-content">
                      {money(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent expenses */}
        <div className="overflow-x-auto panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-semibold text-content">Recent expenses</h2>
            <Link to="/expenses" className="text-xs text-brand hover:underline">
              View all
            </Link>
          </div>
          {!loading && data && data.recentExpenses.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-faint">
              No expenses yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {(data?.recentExpenses ?? []).map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium text-content">
                        {e.merchant}
                      </div>
                      <div className="text-xs text-faint">
                        {e.category ?? "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {formatDate(e.expense_date)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-content">
                      {money(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent payments */}
        <div className="overflow-x-auto panel">
          <div className="border-b border-line px-5 py-3">
            <h2 className="font-semibold text-content">Recent payments</h2>
          </div>
          {!loading && data && data.recentPayments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-faint">
              No payments yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {(data?.recentPayments ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-muted">
                      {formatDate(p.paid_on)}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {p.invoice?.invoice_number ?? "—"}
                      {p.method ? (
                        <span className="capitalize text-faint"> · {p.method}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-content">
                      {money(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent estimates */}
        <div className="overflow-x-auto panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-semibold text-content">Recent estimates</h2>
            <Link to="/estimator" className="text-xs text-brand hover:underline">
              View all
            </Link>
          </div>
          {!loading && data && data.recentEstimates.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-faint">
              No estimates yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {(data?.recentEstimates ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        to={`/estimator/${r.id}`}
                        className="font-medium text-content hover:text-brand"
                      >
                        {r.title}
                      </Link>
                      <div className="text-xs text-faint">
                        {r.customer?.display_name ?? "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        status={r.status}
                        label={ESTIMATE_STATUS_LABEL[r.status]}
                      />
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-content">
                      {money(r.total)}
                      {r.kind === "monthly" && (
                        <span className="text-faint">/mo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent contracts */}
        <div className="overflow-x-auto panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-semibold text-content">Recent contracts</h2>
            <Link to="/contracts" className="text-xs text-brand hover:underline">
              View all
            </Link>
          </div>
          {!loading && data && data.recentContracts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-faint">
              No contracts yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {(data?.recentContracts ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        to="/contracts"
                        className="font-medium text-content hover:text-brand"
                      >
                        {c.title}
                      </Link>
                      <div className="text-xs text-faint">
                        {c.customer?.company ?? "— unassigned —"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-muted">
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
