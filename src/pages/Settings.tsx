import { useEffect, useState, type FormEvent } from "react";
import { getSettings, saveSettings, type Settings as S } from "../lib/settings";
import { Button, Field, TextInput } from "../components/ui";
import { useToast } from "../components/feedback";

export default function Settings() {
  const toast = useToast();
  const [form, setForm] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSettings().then(setForm);
  }, []);

  const set = <K extends keyof S>(k: K, v: S[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));
  const text = (k: keyof S) => (form?.[k] as string | null) ?? "";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      // Normalize empty strings to null for the optional fields.
      const payload: S = {
        ...form,
        business_line1: form.business_line1?.trim() || null,
        business_line2: form.business_line2?.trim() || null,
        business_city_state_zip: form.business_city_state_zip?.trim() || null,
        business_email: form.business_email?.trim() || null,
        business_phone: form.business_phone?.trim() || null,
        default_invoice_notes: form.default_invoice_notes?.trim() || null,
      };
      await saveSettings(payload);
      toast("Settings saved", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!form) return <p className="text-faint">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-content">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Business details appear on your invoices. Defaults speed up new
        invoices.
      </p>

      <form onSubmit={onSubmit} className="mt-6 max-w-2xl space-y-6">
        <section className="panel p-6">
          <h2 className="mb-4 font-semibold text-content">Business info</h2>
          <div className="space-y-4">
            <Field label="Business name">
              <TextInput
                value={text("business_name")}
                onChange={(e) => set("business_name", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Address line 1">
                <TextInput
                  value={text("business_line1")}
                  onChange={(e) => set("business_line1", e.target.value)}
                />
              </Field>
              <Field label="Address line 2">
                <TextInput
                  value={text("business_line2")}
                  onChange={(e) => set("business_line2", e.target.value)}
                />
              </Field>
            </div>
            <Field label="City, State ZIP">
              <TextInput
                value={text("business_city_state_zip")}
                onChange={(e) =>
                  set("business_city_state_zip", e.target.value)
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <TextInput
                  type="email"
                  value={text("business_email")}
                  onChange={(e) => set("business_email", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <TextInput
                  value={text("business_phone")}
                  onChange={(e) => set("business_phone", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="mb-4 font-semibold text-content">Invoice defaults</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Invoice number prefix" hint="e.g. INV-">
              <TextInput
                value={form.invoice_prefix}
                onChange={(e) => set("invoice_prefix", e.target.value)}
              />
            </Field>
            <Field label="Default tax rate (%)">
              <TextInput
                type="number"
                step="0.001"
                min="0"
                value={form.default_tax_rate}
                onChange={(e) =>
                  set("default_tax_rate", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Payment terms (days)" hint="0 = no due date">
              <TextInput
                type="number"
                min="0"
                value={form.default_payment_terms_days}
                onChange={(e) =>
                  set("default_payment_terms_days", Number(e.target.value))
                }
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Default invoice notes" hint="payment terms, thank-you, etc.">
              <TextInput
                value={form.default_invoice_notes ?? ""}
                onChange={(e) => set("default_invoice_notes", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
