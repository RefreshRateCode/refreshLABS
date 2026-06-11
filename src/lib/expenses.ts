import { supabase } from "./supabase";
import type { Expense } from "./database.types";
import { applyBrand, type BrandFilter } from "./brand";

export type ExpenseInput = {
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
};

export type ExpenseRow = Expense & {
  customer: { display_name: string } | null;
  project: { name: string } | null;
};

export async function listExpenses(
  brand: BrandFilter = "all",
): Promise<ExpenseRow[]> {
  const { data, error } = await applyBrand(
    supabase
      .from("expenses")
      .select("*, customer:customers(display_name), project:projects(name)"),
    brand,
  ).order("expense_date", { ascending: false });
  if (error) throw error;
  return data as unknown as ExpenseRow[];
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

/* ---- Receipts (Supabase Storage, private 'receipts' bucket) ---- */

// Upload a receipt under "<uid>/<timestamp>-<name>" and return its storage path.
export async function uploadReceipt(file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function getReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteReceipt(path: string): Promise<void> {
  await supabase.storage.from("receipts").remove([path]);
}
