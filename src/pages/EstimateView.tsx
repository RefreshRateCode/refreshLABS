import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  ESTIMATE_STATUS_LABEL,
  type Customer,
  type Estimate,
  type EstimateLineItem,
  type EstimateSummary,
} from "../lib/database.types";
import {
  getEstimate,
  deleteEstimate,
  convertToInvoice,
} from "../lib/estimates";
import { generateEstimatePdf } from "../lib/estimatePdf";
import { money } from "../lib/format";
import { Badge, Button } from "../components/ui";
import { useToast, useConfirm } from "../components/feedback";

export default function EstimateView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [items, setItems] = useState<EstimateLineItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [summary, setSummary] = useState<EstimateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const { estimate, lineItems } = await getEstimate(id);
      setEstimate(estimate);
      setItems(lineItems);
      const [{ data: sum }, custRes] = await Promise.all([
        supabase.from("estimate_summary").select("*").eq("id", id).single(),
        estimate.customer_id
          ? supabase
              .from("customers")
              .select("*")
              .eq("id", estimate.customer_id)
              .single()
          : Promise.resolve({ data: null }),
      ]);
      setSummary((sum as EstimateSummary) ?? null);
      setCustomer((custRes.data as Customer) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onDelete = async () => {
    if (!estimate) return;
    const ok = await confirm({
      title: "Delete estimate?",
      message: `"${estimate.title}" will be permanently removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEstimate(estimate.id);
      toast("Estimate deleted", "success");
      navigate("/estimator");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const onConvert = async () => {
    if (!estimate) return;
    const ok = await confirm({
      title: "Convert to invoice?",
      message:
        estimate.kind === "monthly"
          ? "Creates a draft invoice for one month of this plan."
          : "Creates a draft invoice from this estimate.",
      confirmLabel: "Convert",
    });
    if (!ok) return;
    setConverting(true);
    try {
      const invoiceId = await convertToInvoice(estimate.id);
      toast("Invoice created", "success");
      navigate(`/invoices/${invoiceId}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <p className="text-faint">Loading…</p>;
  if (error)
    return (
      <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {error}
      </p>
    );
  if (!estimate) return <p className="text-faint">Not found.</p>;

  const perMonth = estimate.kind === "monthly";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="secondary" onClick={() => navigate("/estimator")}>
          ← Estimator
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/estimator/${estimate.id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              generateEstimatePdf({ estimate, items, customer, summary })
            }
          >
            PDF
          </Button>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
          {estimate.converted_invoice_id ? (
            <Button
              onClick={() =>
                navigate(`/invoices/${estimate.converted_invoice_id}`)
              }
            >
              View invoice
            </Button>
          ) : (
            <Button onClick={onConvert} disabled={converting}>
              {converting ? "Converting…" : "Convert to invoice"}
            </Button>
          )}
        </div>
      </div>

      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-content">
              {estimate.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {customer?.display_name ?? "No customer"}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge
              status={estimate.kind}
              label={estimate.kind === "one_time" ? "One-time" : "Monthly"}
            />
            <Badge
              status={estimate.status}
              label={ESTIMATE_STATUS_LABEL[estimate.status]}
            />
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit</th>
              <th className="py-2 text-right font-medium">Disc</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-line last:border-0">
                <td className="py-2 text-content">{it.description}</td>
                <td className="py-2 text-right text-muted">
                  {Number(it.quantity)}
                </td>
                <td className="py-2 text-right text-muted">
                  {money(it.unit_price)}
                </td>
                <td className="py-2 text-right text-muted">
                  {Number(it.discount_pct) > 0 ? `${Number(it.discount_pct)}%` : "—"}
                </td>
                <td className="py-2 text-right text-content">
                  {money(it.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 text-sm">
            <Row label="Subtotal" value={money(summary?.subtotal)} />
            {Number(summary?.discount_amount) > 0 && (
              <Row
                label={`Discount (${estimate.discount_pct}%)`}
                value={`- ${money(summary?.discount_amount)}`}
              />
            )}
            <Row
              label={`Tax (${estimate.tax_rate}%)`}
              value={money(summary?.tax_amount)}
            />
            <div className="mt-1 border-t border-line pt-1">
              <Row
                label={perMonth ? "Total / month" : "Total"}
                value={money(summary?.total)}
                bold
              />
            </div>
          </div>
        </div>

        {estimate.notes && (
          <div className="mt-6 border-t border-line pt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-faint">
              Notes
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
              {estimate.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between py-1">
      <span className={bold ? "font-semibold text-content" : "text-muted"}>
        {label}
      </span>
      <span className={bold ? "font-semibold text-content" : "text-content"}>
        {value}
      </span>
    </div>
  );
}
