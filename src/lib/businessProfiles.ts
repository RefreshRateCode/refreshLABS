import { supabase } from "./supabase";
import type { BusinessProfile } from "./database.types";
import { getSettings } from "./settings";

export type BusinessProfileInput = {
  name: string;
  line1: string | null;
  line2: string | null;
  city_state_zip: string | null;
  email: string | null;
  phone: string | null;
};

// The business identity printed on a document's PDF.
export type BusinessIdentity = {
  name: string;
  line1: string | null;
  line2: string | null;
  city_state_zip: string | null;
  email: string | null;
  phone: string | null;
};

export async function listBusinessProfiles(): Promise<BusinessProfile[]> {
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as BusinessProfile[];
}

export async function createBusinessProfile(
  input: BusinessProfileInput,
): Promise<BusinessProfile> {
  const { data, error } = await supabase
    .from("business_profiles")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as BusinessProfile;
}

export async function updateBusinessProfile(
  id: string,
  input: BusinessProfileInput,
): Promise<BusinessProfile> {
  const { data, error } = await supabase
    .from("business_profiles")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as BusinessProfile;
}

export async function deleteBusinessProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from("business_profiles")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Resolve the identity for a document: the chosen DBA profile, or the primary
// business identity from app_settings when no profile is set / found.
export async function resolveBusinessIdentity(
  profileId: string | null | undefined,
): Promise<BusinessIdentity> {
  if (profileId) {
    const { data } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();
    if (data) {
      const p = data as BusinessProfile;
      return {
        name: p.name,
        line1: p.line1,
        line2: p.line2,
        city_state_zip: p.city_state_zip,
        email: p.email,
        phone: p.phone,
      };
    }
  }
  const s = await getSettings();
  return {
    name: s.business_name,
    line1: s.business_line1,
    line2: s.business_line2,
    city_state_zip: s.business_city_state_zip,
    email: s.business_email,
    phone: s.business_phone,
  };
}
