import { supabase } from "./supabase";
import type { InvoiceStatus } from "./database.types";
import { isOverdue } from "./invoices";

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

export type RecentExpense = {
  id: string;
  expense_date: string;
  merchant: string;
  amount: number;
  category: string | null;
};

export type DashboardData = {
  incomeThisMonth: number;
  expensesThisMonth: number;
  outstanding: number;
  unpaidBills: number;
  overdueCount: number;
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
  recentExpenses: RecentExpense[];
};

function firstOfThisMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

export async function getDashboard(): Promise<DashboardData> {
  const monthStart = firstOfThisMonth();

  const [
    paymentsRes,
    invoicesRes,
    billsRes,
    expensesMonthRes,
    recentInvRes,
    recentPayRes,
    recentExpRes,
  ] = await Promise.all([
    supabase.from("payments").select("amount, paid_on").gte("paid_on", monthStart),
    supabase.from("invoice_summary").select("status, balance_due, due_date"),
    supabase.from("bills").select("amount, status").eq("status", "unpaid"),
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .gte("expense_date", monthStart),
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
    supabase
      .from("expenses")
      .select("id, expense_date, merchant, amount, category")
      .order("expense_date", { ascending: false })
      .limit(5),
  ]);

  for (const r of [
    paymentsRes,
    invoicesRes,
    billsRes,
    expensesMonthRes,
    recentInvRes,
    recentPayRes,
    recentExpRes,
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
    due_date: string | null;
  }[];
  const outstanding = invoices
    .filter((i) => i.status !== "void")
    .reduce((s, i) => s + Number(i.balance_due), 0);
  const overdueCount = invoices.filter(isOverdue).length;

  const unpaidBills = (billsRes.data ?? []).reduce(
    (s, b) => s + Number(b.amount),
    0,
  );

  const expensesThisMonth = (expensesMonthRes.data ?? []).reduce(
    (s, e) => s + Number(e.amount),
    0,
  );

  return {
    incomeThisMonth,
    expensesThisMonth,
    outstanding,
    unpaidBills,
    overdueCount,
    recentInvoices: (recentInvRes.data ?? []) as unknown as RecentInvoice[],
    recentPayments: (recentPayRes.data ?? []) as unknown as RecentPayment[],
    recentExpenses: (recentExpRes.data ?? []) as unknown as RecentExpense[],
  };
}
