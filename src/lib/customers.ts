import { supabase } from "./supabase";
import type {
  Customer,
  CustomerContact,
  CustomerFile,
} from "./database.types";
import { applyBrand, type BrandFilter } from "./brand";

// Fields the user can edit directly. owner_id/id/timestamps are DB-managed;
// email/phone are mirrored from the primary contact by a DB trigger, and
// display_name is kept equal to `company` by the form.
export type CustomerInput = Pick<
  Customer,
  | "display_name"
  | "company"
  | "bill_line1"
  | "bill_line2"
  | "bill_city"
  | "bill_state"
  | "bill_postal"
  | "bill_country"
  | "notes"
  | "is_active"
  | "business_profile_id"
>;

export async function getCustomer(id: string): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Customer;
}

export type CustomerListRow = Customer & { primary_contact: string | null };

export async function listCustomers(
  brand: BrandFilter = "all",
): Promise<CustomerListRow[]> {
  const { data, error } = await applyBrand(
    supabase
      .from("customers")
      .select("*, contacts:customer_contacts(name,is_primary,position)"),
    brand,
  ).order("company", { ascending: true });
  if (error) throw error;
  type Raw = Customer & {
    contacts: { name: string; is_primary: boolean; position: number }[] | null;
  };
  return (data as unknown as Raw[]).map(({ contacts, ...c }) => {
    const list = contacts ?? [];
    const primary =
      list.find((x) => x.is_primary) ??
      [...list].sort((a, b) => a.position - b.position)[0];
    return { ...c, primary_contact: primary?.name ?? null };
  });
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

/* ---- Contacts ---- */

export type ContactDraft = {
  id?: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

export async function listContacts(
  customerId: string,
): Promise<CustomerContact[]> {
  const { data, error } = await supabase
    .from("customer_contacts")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as CustomerContact[];
}

// Replace a customer's contacts with the given list. Done as delete-then-insert
// in one go: contacts aren't referenced by other rows, so this keeps the form
// simple and avoids the "two primaries" window the unique index would reject.
export async function saveContacts(
  customerId: string,
  contacts: ContactDraft[],
): Promise<CustomerContact[]> {
  const { error: delErr } = await supabase
    .from("customer_contacts")
    .delete()
    .eq("customer_id", customerId);
  if (delErr) throw delErr;

  if (contacts.length === 0) {
    // No contacts left -> trigger clears the cached email/phone via the delete.
    return [];
  }

  const rows = contacts.map((c, i) => ({
    customer_id: customerId,
    name: c.name,
    role: c.role,
    email: c.email,
    phone: c.phone,
    is_primary: c.is_primary,
    position: i,
  }));

  const { data, error } = await supabase
    .from("customer_contacts")
    .insert(rows)
    .select("*");
  if (error) throw error;
  return data as CustomerContact[];
}

/* ---- Files (Supabase Storage, private 'customer-files' bucket) ---- */

export async function listCustomerFiles(
  customerId: string,
): Promise<CustomerFile[]> {
  const { data, error } = await supabase
    .from("customer_files")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as CustomerFile[];
}

// Upload bytes under "<uid>/<customerId>/<timestamp>-<name>" and record metadata.
export async function uploadCustomerFile(
  customerId: string,
  file: File,
): Promise<CustomerFile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${customerId}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage
    .from("customer-files")
    .upload(path, file, { upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("customer_files")
    .insert({
      customer_id: customerId,
      path,
      name: file.name,
      mime: file.type || null,
      size_bytes: file.size,
    })
    .select("*")
    .single();
  if (error) {
    // Roll back the orphaned object so storage and metadata stay consistent.
    await supabase.storage.from("customer-files").remove([path]);
    throw error;
  }
  return data as CustomerFile;
}

export async function getCustomerFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("customer-files")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteCustomerFile(f: CustomerFile): Promise<void> {
  const { error } = await supabase
    .from("customer_files")
    .delete()
    .eq("id", f.id);
  if (error) throw error;
  await supabase.storage.from("customer-files").remove([f.path]);
}
