import { supabase } from "./supabase";
import { toCsv, downloadCsv } from "./csv";
import type { Customer, Bill } from "./database.types";

/* QuickBooks-friendly CSV exports. Column names mirror QuickBooks Online's
   import templates so files drop straight into QB's import flow. */

export async function exportCustomersCsv(): Promise<number> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("display_name", { ascending: true });
  if (error) throw error;
  const customers = (data ?? []) as Customer[];

  const headers = [
    "Name",
    "Company",
    "Email",
    "Phone",
    "Billing Street",
    "Billing City",
    "Billing State",
    "Billing ZIP",
    "Billing Country",
    "Notes",
  ];
  const rows = customers.map((c) => [
    c.display_name,
    c.company,
    c.email,
    c.phone,
    [c.bill_line1, c.bill_line2].filter(Boolean).join(", "),
    c.bill_city,
    c.bill_state,
    c.bill_postal,
    c.bill_country,
    c.notes,
  ]);
  downloadCsv("customers-quickbooks.csv", toCsv(headers, rows));
  return customers.length;
}

type InvoiceExportRow = {
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  customer: { display_name: string } | null;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    position: number;
  }[];
};

export async function exportInvoicesCsv(): Promise<number> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "invoice_number, issue_date, due_date, customer:customers(display_name), items:invoice_line_items(description, quantity, unit_price, amount, position)",
    )
    .order("issue_date", { ascending: true });
  if (error) throw error;
  const invoices = (data ?? []) as unknown as InvoiceExportRow[];

  // QBO invoice import: one row per line item, sharing InvoiceNo/Customer/dates.
  const headers = [
    "InvoiceNo",
    "Customer",
    "InvoiceDate",
    "DueDate",
    "ItemDescription",
    "ItemQuantity",
    "ItemRate",
    "ItemAmount",
  ];
  const rows: (string | number | null)[][] = [];
  for (const inv of invoices) {
    const items = [...(inv.items ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const base = [
      inv.invoice_number,
      inv.customer?.display_name ?? "",
      inv.issue_date,
      inv.due_date ?? "",
    ];
    if (items.length === 0) {
      rows.push([...base, "", "", "", ""]);
    } else {
      for (const it of items) {
        rows.push([
          ...base,
          it.description,
          Number(it.quantity),
          Number(it.unit_price),
          Number(it.amount),
        ]);
      }
    }
  }
  downloadCsv("invoices-quickbooks.csv", toCsv(headers, rows));
  return invoices.length;
}

type ExpenseExportRow = {
  expense_date: string;
  merchant: string;
  category: string | null;
  amount: number;
  payment_method: string | null;
  tax_deductible: boolean;
  tax_category: string | null;
  notes: string | null;
  customer: { display_name: string } | null;
  project: { name: string } | null;
};

export async function exportExpensesCsv(): Promise<number> {
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "expense_date, merchant, category, amount, payment_method, tax_deductible, tax_category, notes, customer:customers(display_name), project:projects(name)",
    )
    .order("expense_date", { ascending: true });
  if (error) throw error;
  const expenses = (data ?? []) as unknown as ExpenseExportRow[];

  const headers = [
    "Date",
    "Merchant",
    "Category",
    "Amount",
    "PaymentMethod",
    "Customer",
    "Project",
    "TaxDeductible",
    "TaxCategory",
    "Memo",
  ];
  const rows = expenses.map((e) => [
    e.expense_date,
    e.merchant,
    e.category,
    Number(e.amount),
    e.payment_method,
    e.customer?.display_name ?? "",
    e.project?.name ?? "",
    e.tax_deductible ? "Yes" : "No",
    e.tax_category,
    e.notes,
  ]);
  downloadCsv("expenses-quickbooks.csv", toCsv(headers, rows));
  return expenses.length;
}

export async function exportBillsCsv(): Promise<number> {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .order("bill_date", { ascending: true });
  if (error) throw error;
  const bills = (data ?? []) as Bill[];

  const headers = [
    "BillDate",
    "Vendor",
    "Category",
    "Amount",
    "DueDate",
    "Status",
    "PaidOn",
    "Memo",
  ];
  const rows = bills.map((b) => [
    b.bill_date,
    b.vendor,
    b.category,
    Number(b.amount),
    b.due_date,
    b.status,
    b.paid_on,
    b.notes,
  ]);
  downloadCsv("bills-quickbooks.csv", toCsv(headers, rows));
  return bills.length;
}
