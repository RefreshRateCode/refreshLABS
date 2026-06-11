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
  display_name: string; // kept in sync with `company` by the app
  company: string;
  email: string | null; // cache of the primary contact's email (DB trigger)
  phone: string | null; // cache of the primary contact's phone (DB trigger)
  bill_line1: string | null;
  bill_line2: string | null;
  bill_city: string | null;
  bill_state: string | null;
  bill_postal: string | null;
  bill_country: string | null;
  notes: string | null;
  is_active: boolean;
  business_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerContact {
  id: string;
  owner_id: string;
  customer_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerFile {
  id: string;
  owner_id: string;
  customer_id: string;
  path: string;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  customer_id: string | null;
  name: string;
  status: ProjectStatus;
  notes: string | null;
  business_profile_id: string | null;
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
  business_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

// A "doing business as" identity. Optional per estimate/invoice; falls back to
// the primary identity in app_settings.
export interface BusinessProfile {
  id: string;
  owner_id: string;
  name: string;
  line1: string | null;
  line2: string | null;
  city_state_zip: string | null;
  email: string | null;
  phone: string | null;
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
  business_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export type EstimateKind = "one_time" | "monthly";
export type EstimateStatus =
  | "needs_quote"
  | "in_progress"
  | "sent"
  | "awaiting_approval"
  | "accepted"
  | "declined"
  | "expired";

// Pipeline order + human labels, shared by the editor, list, and badges.
export const ESTIMATE_STATUSES: EstimateStatus[] = [
  "needs_quote",
  "in_progress",
  "sent",
  "awaiting_approval",
  "accepted",
  "declined",
  "expired",
];

export const ESTIMATE_STATUS_LABEL: Record<EstimateStatus, string> = {
  needs_quote: "Needs quote",
  in_progress: "Quote in progress",
  sent: "Sent",
  awaiting_approval: "Awaiting approval",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

// Stages that count as "open" (still in play, not won/lost/expired).
export const ESTIMATE_OPEN_STATUSES: EstimateStatus[] = [
  "needs_quote",
  "in_progress",
  "sent",
  "awaiting_approval",
];

export interface ServicePreset {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  unit: string;
  default_qty: number;
  default_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Estimate {
  id: string;
  owner_id: string;
  customer_id: string | null;
  title: string;
  kind: EstimateKind;
  status: EstimateStatus;
  tax_rate: number;
  discount_pct: number;
  notes: string | null;
  converted_invoice_id: string | null;
  business_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstimateLineItem {
  id: string;
  owner_id: string;
  estimate_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number; // per-line discount %
  amount: number; // generated: quantity * unit_price * (1 - discount_pct/100)
  position: number;
  created_at: string;
}

export interface EstimateSummary {
  id: string;
  owner_id: string;
  customer_id: string | null;
  business_profile_id: string | null;
  title: string;
  kind: EstimateKind;
  status: EstimateStatus;
  tax_rate: number;
  discount_pct: number;
  notes: string | null;
  converted_invoice_id: string | null;
  created_at: string;
  subtotal: number;
  discount_amount: number;
  net: number;
  tax_amount: number;
  total: number;
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
  business_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  owner_id: string;
  customer_id: string | null;
  title: string;
  path: string | null;
  file_name: string | null;
  mime: string | null;
  size_bytes: number | null;
  payment_terms_days: number;
  notes: string | null;
  business_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractLineItem {
  id: string;
  owner_id: string;
  contract_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number; // generated: quantity * unit_price
  position: number;
  created_at: string;
}

// Read-only view: live computed invoice figures.
export interface InvoiceSummary {
  id: string;
  owner_id: string;
  customer_id: string;
  project_id: string | null;
  business_profile_id: string | null;
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
