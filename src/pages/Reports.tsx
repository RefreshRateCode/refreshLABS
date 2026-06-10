import { useEffect, useMemo, useState } from "react";
import { getReport, type ReportData } from "../lib/reports";
import { money } from "../lib/format";
import { TextInput } from "../components/ui";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function presetRange(preset: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const today = iso(now);
  switch (preset) {
    case "month":
      return { start: iso(new Date(y, now.getMonth(), 1)), end: today };
    case "quarter": {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      return { start: iso(new Date(y, qStart, 1)), end: today };
    }
    case "year":
      return { start: iso(new Date(y, 0, 1)), end: today };
    case "all":
    default:
      return { start: "2000-01-01", end: "2999-12-31" };
  }
}

const PRESETS = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

export default function Reports() {
  const [preset, setPreset] = useState("year");
  const [range, setRange] = useState(() => presetRange("year"));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getReport(range.start, range.end)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const choose = (key: string) => {
    setPreset(key);
    setRange(presetRange(key));
  };

  const cards = useMemo(
    () => [
      { label: "Income", value: money(data?.income) },
      { label: "Expenses", value: money(data?.expenses) },
      { label: "Net profit", value: money(data?.net) },
    ],
    [data],
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-content">Reports</h1>
      <p className="mt-1 text-sm text-muted">
        Profit &amp; loss and tax-time summaries.
      </p>

      {/* Range selector */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => choose(p.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              preset === p.key
                ? "bg-brand/15 text-brand"
                : "text-muted hover:bg-surface2 hover:text-content"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="mx-1 text-faint">|</span>
        <TextInput
          type="date"
          value={range.start === "2000-01-01" ? "" : range.start}
          onChange={(e) => {
            setPreset("custom");
            setRange((r) => ({ ...r, start: e.target.value || "2000-01-01" }));
          }}
          className="w-auto"
        />
        <span className="text-faint">→</span>
        <TextInput
          type="date"
          value={range.end === "2999-12-31" ? "" : range.end}
          onChange={(e) => {
            setPreset("custom");
            setRange((r) => ({ ...r, end: e.target.value || "2999-12-31" }));
          }}
          className="w-auto"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* P&L cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="panel p-5">
            <div className="text-sm text-muted">{c.label}</div>
            <div className="accent-gradient mt-2 text-3xl font-semibold">
              {loading ? "…" : c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Breakdown
          title="Income by customer"
          rows={(data?.incomeByCustomer ?? []).map((r) => ({
            label: r.name,
            amount: r.amount,
          }))}
          empty="No income in this range."
          loading={loading}
        />
        <Breakdown
          title="Tax-deductible by category"
          rows={(data?.deductibleByCategory ?? []).map((r) => ({
            label: r.category,
            amount: r.amount,
          }))}
          empty="No deductible expenses in this range."
          loading={loading}
          footer={
            data
              ? { label: "Total deductible", amount: data.deductibleTotal }
              : undefined
          }
        />
        <Breakdown
          title="Expenses by category"
          rows={(data?.expensesByCategory ?? []).map((r) => ({
            label: r.category,
            amount: r.amount,
          }))}
          empty="No expenses in this range."
          loading={loading}
        />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  empty,
  loading,
  footer,
}: {
  title: string;
  rows: { label: string; amount: number }[];
  empty: string;
  loading: boolean;
  footer?: { label: string; amount: number };
}) {
  return (
    <div className="overflow-x-auto panel">
      <div className="border-b border-line px-5 py-3">
        <h2 className="font-semibold text-content">{title}</h2>
      </div>
      {loading ? (
        <div className="px-5 py-8 text-center text-sm text-faint">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-faint">{empty}</div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-0">
                <td className="px-5 py-2.5 text-muted">{r.label}</td>
                <td className="px-5 py-2.5 text-right font-medium text-content">
                  {money(r.amount)}
                </td>
              </tr>
            ))}
            {footer && (
              <tr className="bg-surface2">
                <td className="px-5 py-2.5 font-semibold text-content">
                  {footer.label}
                </td>
                <td className="px-5 py-2.5 text-right font-semibold text-content">
                  {money(footer.amount)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
