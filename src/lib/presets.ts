import { supabase } from "./supabase";
import type { ServicePreset } from "./database.types";

export type PresetInput = Pick<
  ServicePreset,
  "name" | "description" | "unit" | "default_qty" | "default_rate"
>;

export async function listPresets(): Promise<ServicePreset[]> {
  const { data, error } = await supabase
    .from("service_presets")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as ServicePreset[];
}

export async function createPreset(input: PresetInput): Promise<ServicePreset> {
  const { data, error } = await supabase
    .from("service_presets")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as ServicePreset;
}

export async function updatePreset(
  id: string,
  input: PresetInput,
): Promise<ServicePreset> {
  const { data, error } = await supabase
    .from("service_presets")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ServicePreset;
}

export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabase.from("service_presets").delete().eq("id", id);
  if (error) throw error;
}
