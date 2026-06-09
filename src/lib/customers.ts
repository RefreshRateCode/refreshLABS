import { supabase } from "./supabase";
import type { Customer } from "./database.types";

// Fields the user can edit (owner_id, id, timestamps are managed by the DB).
export type CustomerInput = Pick<
  Customer,
  | "display_name"
  | "company"
  | "email"
  | "phone"
  | "bill_line1"
  | "bill_line2"
  | "bill_city"
  | "bill_state"
  | "bill_postal"
  | "bill_country"
  | "notes"
  | "is_active"
>;

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return data as Customer[];
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}
