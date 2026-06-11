import { useEffect, useState, type FormEvent } from "react";
import { getSettings, saveSettings, type Settings as S } from "../lib/settings";
import type { BusinessProfile } from "../lib/database.types";
import {
  listBusinessProfiles,
  createBusinessProfile,
  updateBusinessProfile,
  deleteBusinessProfile,
  type BusinessProfileInput,
} from "../lib/businessProfiles";
import { Button, Field, TextInput } from "../components/ui";
import { useToast, useConfirm } from "../components/feedback";

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

      <BusinessProfilesSection />
    </div>
  );
}

const emptyProfile: BusinessProfileInput = {
  name: "",
  line1: null,
  line2: null,
  city_state_zip: null,
  email: null,
  phone: null,
};

// Additional DBAs ("doing business as") you can issue estimates/invoices under.
// The primary identity above is used when a document has no DBA selected.
function BusinessProfilesSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [editing, setEditing] = useState<BusinessProfile | null>(null);
  const [form, setForm] = useState<BusinessProfileInput>(emptyProfile);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setProfiles(await listBusinessProfiles());
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof BusinessProfileInput>(
    k: K,
    v: BusinessProfileInput[K],
  ) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof BusinessProfileInput) =>
    (form[k] as string | null) ?? "";

  const reset = () => {
    setEditing(null);
    setForm(emptyProfile);
  };

  const edit = (p: BusinessProfile) => {
    setEditing(p);
    setForm({
      name: p.name,
      line1: p.line1,
      line2: p.line2,
      city_state_zip: p.city_state_zip,
      email: p.email,
      phone: p.phone,
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast("Give the DBA a name.", "error");
      return;
    }
    setBusy(true);
    try {
      const blank = (v: string | null) => (v && v.trim() ? v.trim() : null);
      const payload: BusinessProfileInput = {
        name: form.name.trim(),
        line1: blank(form.line1),
        line2: blank(form.line2),
        city_state_zip: blank(form.city_state_zip),
        email: blank(form.email),
        phone: blank(form.phone),
      };
      if (editing) await updateBusinessProfile(editing.id, payload);
      else await createBusinessProfile(payload);
      toast("DBA saved", "success");
      reset();
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (p: BusinessProfile) => {
    const ok = await confirm({
      title: "Delete DBA?",
      message: `"${p.name}" will be removed. Documents issued under it fall back to the primary identity.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBusinessProfile(p.id);
      if (editing?.id === p.id) reset();
      await load();
      toast("DBA deleted", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <section className="panel mt-6 max-w-2xl p-6">
      <h2 className="font-semibold text-content">Brands &amp; DBAs</h2>
      <p className="mt-1 text-sm text-muted">
        Additional names under the noalanPRO umbrella — legal DBAs or brands for
        merch, apps, and other ventures. Tag any record with one, and the global
        brand switcher filters the whole app to it. On invoices, estimates, and
        contracts the chosen brand also prints on the PDF.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-line">
        {profiles.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-faint">
            No additional DBAs yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-medium text-content">{p.name}</div>
                    <div className="text-xs text-faint">
                      {[p.city_state_zip, p.email, p.phone]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => edit(p)}
                      className="mr-3 text-brand hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(p)}
                      className="text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4 border-t border-line pt-4">
        <div className="text-sm font-medium text-content">
          {editing ? "Edit DBA" : "Add DBA"}
        </div>
        <Field label="Name *">
          <TextInput
            value={text("name")}
            onChange={(e) => set("name", e.target.value)}
            placeholder="noalanPRO Gaming"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Address line 1">
            <TextInput
              value={text("line1")}
              onChange={(e) => set("line1", e.target.value)}
            />
          </Field>
          <Field label="Address line 2">
            <TextInput
              value={text("line2")}
              onChange={(e) => set("line2", e.target.value)}
            />
          </Field>
        </div>
        <Field label="City, State ZIP">
          <TextInput
            value={text("city_state_zip")}
            onChange={(e) => set("city_state_zip", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <TextInput
              type="email"
              value={text("email")}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={text("phone")}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-3">
          {editing && (
            <Button type="button" variant="secondary" onClick={reset}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add DBA"}
          </Button>
        </div>
      </form>
    </section>
  );
}
