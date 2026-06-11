import { supabase } from "./supabase";
import type { Contract, ContractLineItem } from "./database.types";
import { applyBrand, type BrandFilter } from "./brand";

export type ContractInput = {
  title: string;
  customer_id: string | null;
  payment_terms_days: number;
  notes: string | null;
  business_profile_id: string | null;
};

export type ContractItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type ContractRow = Contract & {
  customer: { company: string; display_name: string } | null;
};

export async function listContracts(
  brand: BrandFilter = "all",
): Promise<ContractRow[]> {
  const { data, error } = await applyBrand(
    supabase
      .from("contracts")
      .select("*, customer:customers(company, display_name)"),
    brand,
  ).order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ContractRow[];
}

export async function listContractsForCustomer(
  customerId: string,
): Promise<Contract[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Contract[];
}

export async function getContract(id: string): Promise<{
  contract: Contract;
  lineItems: ContractLineItem[];
}> {
  const { data: contract, error: e1 } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .single();
  if (e1) throw e1;
  const { data: lineItems, error: e2 } = await supabase
    .from("contract_line_items")
    .select("*")
    .eq("contract_id", id)
    .order("position", { ascending: true });
  if (e2) throw e2;
  return {
    contract: contract as Contract,
    lineItems: lineItems as ContractLineItem[],
  };
}

async function uploadContractFile(file: File): Promise<{
  path: string;
  file_name: string;
  mime: string | null;
  size_bytes: number;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("contracts")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return { path, file_name: file.name, mime: file.type || null, size_bytes: file.size };
}

async function replaceLineItems(contractId: string, items: ContractItemInput[]) {
  const { error: delErr } = await supabase
    .from("contract_line_items")
    .delete()
    .eq("contract_id", contractId);
  if (delErr) throw delErr;
  const rows = items
    .filter((it) => it.description.trim() !== "" || it.unit_price || it.quantity)
    .map((it, i) => ({
      contract_id: contractId,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      position: i,
    }));
  if (rows.length) {
    const { error } = await supabase.from("contract_line_items").insert(rows);
    if (error) throw error;
  }
}

export async function createContract(
  input: ContractInput,
  file: File | null,
  items: ContractItemInput[],
): Promise<Contract> {
  const fileMeta = file ? await uploadContractFile(file) : null;
  const { data, error } = await supabase
    .from("contracts")
    .insert({ ...input, ...(fileMeta ?? {}) })
    .select("*")
    .single();
  if (error) {
    if (fileMeta) await supabase.storage.from("contracts").remove([fileMeta.path]);
    throw error;
  }
  const contract = data as Contract;
  await replaceLineItems(contract.id, items);
  return contract;
}

export async function updateContract(
  id: string,
  input: ContractInput,
  file: File | null,
  items: ContractItemInput[],
): Promise<Contract> {
  // If a new file is uploaded, swap it in and drop the old object.
  let fileMeta: Awaited<ReturnType<typeof uploadContractFile>> | null = null;
  let oldPath: string | null = null;
  if (file) {
    const { data: existing } = await supabase
      .from("contracts")
      .select("path")
      .eq("id", id)
      .single();
    oldPath = (existing as { path: string | null } | null)?.path ?? null;
    fileMeta = await uploadContractFile(file);
  }

  const { data, error } = await supabase
    .from("contracts")
    .update({ ...input, ...(fileMeta ?? {}) })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    if (fileMeta) await supabase.storage.from("contracts").remove([fileMeta.path]);
    throw error;
  }
  if (oldPath && fileMeta) {
    await supabase.storage.from("contracts").remove([oldPath]);
  }
  await replaceLineItems(id, items);
  return data as Contract;
}

export async function deleteContract(c: Contract): Promise<void> {
  const { error } = await supabase.from("contracts").delete().eq("id", c.id);
  if (error) throw error;
  if (c.path) await supabase.storage.from("contracts").remove([c.path]);
}

export async function getContractUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("contracts")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

// Best-guess customer for an uploaded contract, by matching the file name
// against customer company / contact / display names. Returns an id or null.
type Candidate = {
  id: string;
  company: string;
  display_name: string;
  primary_contact?: string | null;
};
export function suggestCustomerId(
  fileName: string,
  customers: Candidate[],
): string | null {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const base = norm(fileName.replace(/\.[^.]+$/, ""));
  const fileTokens = new Set(base.split(" ").filter((t) => t.length > 2));

  let best: string | null = null;
  let bestScore = 0;
  for (const c of customers) {
    const names = [c.company, c.primary_contact, c.display_name].filter(
      Boolean,
    ) as string[];
    let score = 0;
    for (const n of names) {
      const nn = norm(n);
      if (nn && base.includes(nn)) score += 3; // full name appears in filename
      for (const t of nn.split(" ").filter((x) => x.length > 2)) {
        if (fileTokens.has(t)) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = c.id;
    }
  }
  return bestScore > 0 ? best : null;
}
