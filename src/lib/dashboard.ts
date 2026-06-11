import { supabase } from "./supabase";
import {
  ESTIMATE_OPEN_STATUSES,
  type EstimateKind,
  type EstimateStatus,
  type InvoiceStatus,
} from "./database.types";
import { isOverdue } from "./invoices";
import { applyBrand, type BrandFilter } from "./brand";

// Does a record's business_profile_id satisfy the active brand filter?
function matchesBrand(
  bp: string | null | undefined,
  brand: BrandFilter,
): boolean {
  if (brand === "all") return true;
  if (brand === "primary") return bp == null;
  return bp === brand;
}

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

export type RecentEstimate = {
  id: string;
  title: string;
  kind: EstimateKind;
  status: EstimateStatus;
  total: number;
  customer: { display_name: string } | null;
};

export type RecentContract = {
  id: string;
  title: string;
  created_at: string;
  customer: { company: string } | null;
};

export type DashboardData = {
  incomeThisMonth: number;
  expensesThisMonth: number;
  outstanding: number;
  unpaidBills: number;
  overdueCount: number;
  openPipeline: number;
  openEstimateCount: number;
  contractsCount: number;
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
  recentExpenses: RecentExpense[];
  recentEstimates: RecentEstimate[];
  recentContracts: RecentContract[];
};

function firstOfThisMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

export async function getDashboard(
  brand: BrandFilter = "all",
): Promise<DashboardData> {
  const monthStart = firstOfThisMonth();

  const [
    paymentsRes,
    invoicesRes,
    billsRes,
    expensesMonthRes,
    estimatesRes,
    recentInvRes,
    recentPayRes,
    recentExpRes,
    recentEstRes,
  ] = await Promise.all([
    // Payments aren't branded directly — carry the invoice's brand and filter
    // in JS (below) so income respects the active brand.
    supabase
      .from("payments")
      .select("amount, paid_on, invoices(business_profile_id)")
      .gte("paid_on", monthStart),
    applyBrand(
      supabase.from("invoice_summary").select("status, balance_due, due_date"),
      brand,
    ),
    applyBrand(
      supabase.from("bills").select("amount, status").eq("status", "unpaid"),
      brand,
    ),
    applyBrand(
      supabase
        .from("expenses")
        .select("amount, expense_date")
        .gte("expense_date", monthStart),
      brand,
    ),
    applyBrand(
      supabase
        .from("estimate_summary")
        .select("status, total, converted_invoice_id"),
      brand,
    ),
    applyBrand(
      supabase
        .from("invoice_summary")
        .select(
          "id, invoice_number, status, issue_date, total, balance_due, customer:customers(display_name)",
        ),
      brand,
    )
      .order("created_at", { ascending: false })
      .limit(5),
    // Recent payments: over-fetch, then brand-filter via the invoice in JS.
    supabase
      .from("payments")
      .select(
        "id, amount, paid_on, method, invoice:invoices(invoice_number, business_profile_id)",
      )
      .order("paid_on", { ascending: false })
      .limit(50),
    applyBrand(
      supabase
        .from("expenses")
        .select("id, expense_date, merchant, amount, category"),
      brand,
    )
      .order("expense_date", { ascending: false })
      .limit(5),
    applyBrand(
      supabase
        .from("estimate_summary")
        .select("id, title, kind, status, total, customer:customers(display_name)"),
      brand,
    )
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  for (const r of [
    paymentsRes,
    invoicesRes,
    billsRes,
    expensesMonthRes,
    estimatesRes,
    recentInvRes,
    recentPayRes,
    recentExpRes,
    recentEstRes,
  ]) {
    if (r.error) throw r.error;
  }

  // Contracts are a newer table; tolerate it not being migrated yet.
  let contractsCount = 0;
  let recentContracts: RecentContract[] = [];
  try {
    const [cntRes, recentConRes] = await Promise.all([
      applyBrand(
        supabase.from("contracts").select("id", { count: "exact", head: true }),
        brand,
      ),
      applyBrand(
        supabase
          .from("contracts")
          .select("id, title, created_at, customer:customers(company)"),
        brand,
      )
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    if (!cntRes.error) contractsCount = cntRes.count ?? 0;
    if (!recentConRes.error)
      recentContracts = (recentConRes.data ?? []) as unknown as RecentContract[];
  } catch {
    /* contracts table not migrated yet — leave defaults */
  }

  const incomeThisMonth = (
    (paymentsRes.data ?? []) as unknown as {
      amount: number;
      invoices: { business_profile_id: string | null } | null;
    }[]
  )
    .filter((p) => matchesBrand(p.invoices?.business_profile_id, brand))
    .reduce((s, p) => s + Number(p.amount), 0);

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

  // Open estimate pipeline: value still in play (not won/lost/expired/converted).
  const estimates = (estimatesRes.data ?? []) as {
    status: EstimateStatus;
    total: number;
    converted_invoice_id: string | null;
  }[];
  const openEstimates = estimates.filter(
    (e) =>
      ESTIMATE_OPEN_STATUSES.includes(e.status) && !e.converted_invoice_id,
  );
  const openPipeline = openEstimates.reduce((s, e) => s + Number(e.total), 0);

  return {
    incomeThisMonth,
    expensesThisMonth,
    outstanding,
    unpaidBills,
    overdueCount,
    openPipeline,
    openEstimateCount: openEstimates.length,
    contractsCount,
    recentInvoices: (recentInvRes.data ?? []) as unknown as RecentInvoice[],
    recentPayments: (
      (recentPayRes.data ?? []) as unknown as (RecentPayment & {
        invoice: { business_profile_id: string | null } | null;
      })[]
    )
      .filter((p) => matchesBrand(p.invoice?.business_profile_id, brand))
      .slice(0, 5) as RecentPayment[],
    recentExpenses: (recentExpRes.data ?? []) as unknown as RecentExpense[],
    recentEstimates: (recentEstRes.data ?? []) as unknown as RecentEstimate[],
    recentContracts,
  };
}
