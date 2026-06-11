import { supabase } from "./supabase";
import type { Project, ProjectStatus } from "./database.types";
import { applyBrand, type BrandFilter } from "./brand";

export type ProjectInput = {
  customer_id: string | null;
  name: string;
  status: ProjectStatus;
  notes: string | null;
  business_profile_id: string | null;
};

export type ProjectRow = Project & {
  customer: { display_name: string } | null;
};

export async function listProjects(
  brand: BrandFilter = "all",
): Promise<ProjectRow[]> {
  const { data, error } = await applyBrand(
    supabase.from("projects").select("*, customer:customers(display_name)"),
    brand,
  ).order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProjectRow[];
}

export async function listProjectsForCustomer(
  customerId: string,
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Project[];
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
