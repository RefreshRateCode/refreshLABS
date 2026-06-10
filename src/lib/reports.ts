import { supabase } from "./supabase";

export type ReportData = {
  income: number;
  expenses: number;
  net: number;
  incomeByCustomer: { name: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
  deductibleByCategory: { category: string; amount: number }[];
  deductibleTotal: number;
};

type PaymentRow = {
  amount: number;
  customer: { display_name: string } | null;
};
type ExpenseRow = {
  amount: number;
  category: string | null;
  tax_deductible: boolean;
  tax_category: string | null;
};

function sumBy(map: Map<string, number>): { name: string; amount: number }[] {
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getReport(
  start: string,
  end: string,
): Promise<ReportData> {
  const [paysRes, expsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, customer:customers(display_name)")
      .gte("paid_on", start)
      .lte("paid_on", end),
    supabase
      .from("expenses")
      .select("amount, category, tax_deductible, tax_category")
      .gte("expense_date", start)
      .lte("expense_date", end),
  ]);
  if (paysRes.error) throw paysRes.error;
  if (expsRes.error) throw expsRes.error;

  const payments = (paysRes.data ?? []) as unknown as PaymentRow[];
  const expenses = (expsRes.data ?? []) as ExpenseRow[];

  const income = payments.reduce((s, p) => s + Number(p.amount), 0);
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const byCustomer = new Map<string, number>();
  for (const p of payments) {
    const k = p.customer?.display_name ?? "Unassigned";
    byCustomer.set(k, (byCustomer.get(k) ?? 0) + Number(p.amount));
  }

  const byCategory = new Map<string, number>();
  const deductible = new Map<string, number>();
  let deductibleTotal = 0;
  for (const e of expenses) {
    const cat = e.category ?? "Uncategorized";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(e.amount));
    if (e.tax_deductible) {
      const tc = e.tax_category ?? cat;
      deductible.set(tc, (deductible.get(tc) ?? 0) + Number(e.amount));
      deductibleTotal += Number(e.amount);
    }
  }

  return {
    income,
    expenses: expenseTotal,
    net: income - expenseTotal,
    incomeByCustomer: sumBy(byCustomer),
    expensesByCategory: sumBy(byCategory).map((r) => ({
      category: r.name,
      amount: r.amount,
    })),
    deductibleByCategory: sumBy(deductible).map((r) => ({
      category: r.name,
      amount: r.amount,
    })),
    deductibleTotal,
  };
}
