import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import type { Customer } from "../lib/database.types";
import {
  createCustomer,
  updateCustomer,
  getCustomer,
  listContacts,
  saveContacts,
  type CustomerInput,
  type ContactDraft,
} from "../lib/customers";
import Modal from "./Modal";
import BrandSelect from "./BrandSelect";
import { Button, Field, TextInput, TextArea } from "./ui";

// Customer-level fields (no email/phone — those live on contacts now).
type CoreInput = Omit<CustomerInput, "display_name">;

const emptyCore: CoreInput = {
  company: "",
  bill_line1: null,
  bill_line2: null,
  bill_city: null,
  bill_state: null,
  bill_postal: null,
  bill_country: null,
  notes: null,
  is_active: true,
  business_profile_id: null,
};

const emptyContact = (): ContactDraft => ({
  name: "",
  role: null,
  email: null,
  phone: null,
  is_primary: false,
});

export default function CustomerFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const [core, setCore] = useState<CoreInput>(emptyCore);
  const [contacts, setContacts] = useState<ContactDraft[]>([emptyContact()]);
  const [primary, setPrimary] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      const { company, bill_line1, bill_line2, bill_city, bill_state, bill_postal, bill_country, notes, is_active, business_profile_id } = editing;
      setCore({ company, bill_line1, bill_line2, bill_city, bill_state, bill_postal, bill_country, notes, is_active, business_profile_id });
      // Load existing contacts.
      (async () => {
        try {
          const existing = await listContacts(editing.id);
          if (existing.length > 0) {
            setContacts(
              existing.map((c) => ({
                id: c.id,
                name: c.name,
                role: c.role,
                email: c.email,
                phone: c.phone,
                is_primary: c.is_primary,
              })),
            );
            const pi = existing.findIndex((c) => c.is_primary);
            setPrimary(pi >= 0 ? pi : 0);
          } else {
            setContacts([emptyContact()]);
            setPrimary(0);
          }
        } catch (e) {
          setError((e as Error).message);
        }
      })();
    } else {
      setCore(emptyCore);
      setContacts([emptyContact()]);
      setPrimary(0);
    }
  }, [open, editing]);

  const setCoreField = <K extends keyof CoreInput>(key: K, value: CoreInput[K]) =>
    setCore((f) => ({ ...f, [key]: value }));

  const coreText = (key: keyof CoreInput) => (core[key] as string | null) ?? "";

  const setContact = (i: number, patch: Partial<ContactDraft>) =>
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const addContact = () => setContacts((cs) => [...cs, emptyContact()]);

  const removeContact = (i: number) =>
    setContacts((cs) => {
      const next = cs.filter((_, idx) => idx !== i);
      // Keep the primary pointer valid.
      setPrimary((p) => (i === p ? 0 : i < p ? p - 1 : p));
      return next.length ? next : [emptyContact()];
    });

  const blank = (v: string) => (v.trim() === "" ? null : v.trim());

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const company = core.company.trim();
    if (!company) {
      setError("Company is required.");
      return;
    }
    const cleaned = contacts
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        role: blank(c.role ?? ""),
        email: blank(c.email ?? ""),
        phone: blank(c.phone ?? ""),
      }))
      .filter((c) => c.name || c.email || c.phone);
    if (cleaned.length === 0 || !cleaned.some((c) => c.name)) {
      setError("Add at least one contact with a name.");
      return;
    }
    // Re-derive which cleaned contact is primary; default to the first.
    const primaryName = contacts[primary]?.name.trim();
    let primaryIdx = cleaned.findIndex((c) => c.name === primaryName);
    if (primaryIdx < 0) primaryIdx = 0;
    const drafts: ContactDraft[] = cleaned.map((c, i) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      email: c.email,
      phone: c.phone,
      is_primary: i === primaryIdx,
    }));

    const payload: CustomerInput = {
      display_name: company, // keep label in sync with company
      company,
      bill_line1: blank(coreText("bill_line1")),
      bill_line2: blank(coreText("bill_line2")),
      bill_city: blank(coreText("bill_city")),
      bill_state: blank(coreText("bill_state")),
      bill_postal: blank(coreText("bill_postal")),
      bill_country: blank(coreText("bill_country")),
      notes: blank(coreText("notes")),
      is_active: core.is_active,
      business_profile_id: core.business_profile_id,
    };

    setBusy(true);
    try {
      const base = editing
        ? await updateCustomer(editing.id, payload)
        : await createCustomer(payload);
      await saveContacts(base.id, drafts);
      // Re-fetch so the trigger-synced email/phone are reflected.
      const fresh = await getCustomer(base.id);
      onSaved(fresh);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit customer" : "New customer"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Company *">
          <TextInput
            required
            value={coreText("company")}
            onChange={(e) => setCoreField("company", e.target.value)}
            placeholder="Acme Corp."
          />
        </Field>

        {/* Contacts */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-content">Contacts *</span>
            <button
              type="button"
              onClick={addContact}
              className="text-sm font-medium text-brand hover:underline"
            >
              + Add contact
            </button>
          </div>
          <div className="space-y-3">
            {contacts.map((c, i) => (
              <div
                key={c.id ?? i}
                className="rounded-lg border border-line bg-surface2 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                    <input
                      type="radio"
                      name="primary-contact"
                      checked={primary === i}
                      onChange={() => setPrimary(i)}
                      className="accent-brand"
                    />
                    Primary contact
                  </label>
                  <button
                    type="button"
                    onClick={() => removeContact(i)}
                    className="text-faint hover:text-red-400"
                    aria-label="Remove contact"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name">
                    <TextInput
                      value={c.name}
                      onChange={(e) => setContact(i, { name: e.target.value })}
                      placeholder="Jane Doe"
                    />
                  </Field>
                  <Field label="Role">
                    <TextInput
                      value={c.role ?? ""}
                      onChange={(e) => setContact(i, { role: e.target.value })}
                      placeholder="Billing"
                    />
                  </Field>
                  <Field label="Email">
                    <TextInput
                      type="email"
                      value={c.email ?? ""}
                      onChange={(e) => setContact(i, { email: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone">
                    <TextInput
                      value={c.phone ?? ""}
                      onChange={(e) => setContact(i, { phone: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-faint">
            The primary contact's email & phone appear on invoices and exports.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Address line 1">
            <TextInput
              value={coreText("bill_line1")}
              onChange={(e) => setCoreField("bill_line1", e.target.value)}
            />
          </Field>
          <Field label="Address line 2">
            <TextInput
              value={coreText("bill_line2")}
              onChange={(e) => setCoreField("bill_line2", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="City">
            <TextInput
              value={coreText("bill_city")}
              onChange={(e) => setCoreField("bill_city", e.target.value)}
            />
          </Field>
          <Field label="State">
            <TextInput
              value={coreText("bill_state")}
              onChange={(e) => setCoreField("bill_state", e.target.value)}
            />
          </Field>
          <Field label="ZIP">
            <TextInput
              value={coreText("bill_postal")}
              onChange={(e) => setCoreField("bill_postal", e.target.value)}
            />
          </Field>
          <Field label="Country">
            <TextInput
              value={coreText("bill_country")}
              onChange={(e) => setCoreField("bill_country", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <TextArea
            rows={3}
            value={coreText("notes")}
            onChange={(e) => setCoreField("notes", e.target.value)}
          />
        </Field>

        <BrandSelect
          value={core.business_profile_id}
          onChange={(v) => setCoreField("business_profile_id", v)}
        />

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
