import { supabase } from "./supabase";
import type { InvoiceStatus } from "./database.types";

export type RecentInvoice = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  total: number;
  balance_due: number;
  customer: { display_name: string } | null;
};

export type RecentPayment = {
  id: string;
  amount: number;
  paid_on: string;
  method: string | null;
  invoice: { invoice_number: string } | null;
};

export type DashboardData = {
  incomeThisMonth: number;
  outstanding: number;
  unpaidBills: number;
  overdueCount: number;
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
};

function firstOfThisMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

export async function getDashboard(): Promise<DashboardData> {
  const monthStart = firstOfThisMonth();

  const [paymentsRes, invoicesRes, billsRes, recentInvRes, recentPayRes] =
    await Promise.all([
      supabase.from("payments").select("amount, paid_on").gte("paid_on", monthStart),
      supabase.from("invoice_summary").select("status, balance_due"),
      supabase.from("bills").select("amount, status").eq("status", "unpaid"),
      supabase
        .from("invoice_summary")
        .select(
          "id, invoice_number, status, issue_date, total, balance_due, customer:customers(display_name)",
        )
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("payments")
        .select("id, amount, paid_on, method, invoice:invoices(invoice_number)")
        .order("paid_on", { ascending: false })
        .limit(5),
    ]);

  for (const r of [
    paymentsRes,
    invoicesRes,
    billsRes,
    recentInvRes,
    recentPayRes,
  ]) {
    if (r.error) throw r.error;
  }

  const incomeThisMonth = (paymentsRes.data ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );

  const invoices = (invoicesRes.data ?? []) as {
    status: InvoiceStatus;
    balance_due: number;
  }[];
  const outstanding = invoices
    .filter((i) => i.status !== "void")
    .reduce((s, i) => s + Number(i.balance_due), 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  const unpaidBills = (billsRes.data ?? []).reduce(
    (s, b) => s + Number(b.amount),
    0,
  );

  return {
    incomeThisMonth,
    outstanding,
    unpaidBills,
    overdueCount,
    recentInvoices: (recentInvRes.data ?? []) as unknown as RecentInvoice[],
    recentPayments: (recentPayRes.data ?? []) as unknown as RecentPayment[],
  };
}
