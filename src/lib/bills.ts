import { supabase } from "./supabase";
import type { Bill } from "./database.types";
import { applyBrand, type BrandFilter } from "./brand";

export type BillInput = Pick<
  Bill,
  | "vendor"
  | "category"
  | "amount"
  | "bill_date"
  | "due_date"
  | "status"
  | "paid_on"
  | "notes"
  | "business_profile_id"
>;

export async function listBills(brand: BrandFilter = "all"): Promise<Bill[]> {
  const { data, error } = await applyBrand(
    supabase.from("bills").select("*"),
    brand,
  ).order("bill_date", { ascending: false });
  if (error) throw error;
  return data as Bill[];
}

export async function createBill(input: BillInput): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Bill;
}

export async function updateBill(
  id: string,
  input: BillInput,
): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Bill;
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from("bills").delete().eq("id", id);
  if (error) throw error;
}
