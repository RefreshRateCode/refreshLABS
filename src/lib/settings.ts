import { supabase } from "./supabase";

export type Settings = {
  business_name: string;
  business_line1: string | null;
  business_line2: string | null;
  business_city_state_zip: string | null;
  business_email: string | null;
  business_phone: string | null;
  invoice_prefix: string;
  default_tax_rate: number;
};

export const DEFAULT_SETTINGS: Settings = {
  business_name: "noalanPRO",
  business_line1: null,
  business_line2: null,
  business_city_state_zip: null,
  business_email: "joshnoalan@gmail.com",
  business_phone: null,
  invoice_prefix: "INV-",
  default_tax_rate: 0,
};

// Returns the user's settings, or sensible defaults if none saved yet (or if
// the settings table hasn't been migrated). Never throws — callers can rely
// on always getting a usable object.
export async function getSettings(): Promise<Settings> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_SETTINGS };
    return {
      business_name: data.business_name ?? DEFAULT_SETTINGS.business_name,
      business_line1: data.business_line1,
      business_line2: data.business_line2,
      business_city_state_zip: data.business_city_state_zip,
      business_email: data.business_email,
      business_phone: data.business_phone,
      invoice_prefix: data.invoice_prefix ?? "INV-",
      default_tax_rate: Number(data.default_tax_rate ?? 0),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("app_settings")
    .upsert({ owner_id: user.id, ...s }, { onConflict: "owner_id" });
  if (error) throw error;
}
