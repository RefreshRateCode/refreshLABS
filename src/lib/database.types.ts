// Hand-maintained types mirroring supabase/migrations/0001_init.sql.
// Keep in sync when the schema changes (or later swap for
// `supabase gen types typescript` output).

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partial"
  | "paid"
  | "overdue"
  | "void";
export type ProjectStatus = "active" | "on_hold" | "done" | "cancelled";
export type BillStatus = "unpaid" | "paid";

export interface Customer {
  id: string;
  owner_id: string;
  display_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  bill_line1: string | null;
  bill_line2: string | null;
  bill_city: string | null;
  bill_state: string | null;
  bill_postal: string | null;
  bill_country: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  customer_id: string | null;
  name: string;
  status: ProjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  owner_id: string;
  customer_id: string;
  project_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  tax_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  owner_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number; // generated: quantity * unit_price
  position: number;
  created_at: string;
}

export interface Payment {
  id: string;
  owner_id: string;
  invoice_id: string;
  customer_id: string | null;
  amount: number;
  paid_on: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface Bill {
  id: string;
  owner_id: string;
  vendor: string;
  category: string | null;
  amount: number;
  bill_date: string;
  due_date: string | null;
  status: BillStatus;
  paid_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  owner_id: string;
  expense_date: string;
  merchant: string;
  category: string | null;
  amount: number;
  payment_method: string | null;
  customer_id: string | null;
  project_id: string | null;
  tax_deductible: boolean;
  tax_category: string | null;
  receipt_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Read-only view: live computed invoice figures.
export interface InvoiceSummary {
  id: string;
  owner_id: string;
  customer_id: string;
  project_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  tax_rate: number;
  notes: string | null;
  created_at: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
}
