import { useEffect, useState, type FormEvent } from "react";
import type { Customer } from "../lib/database.types";
import {
  createCustomer,
  updateCustomer,
  type CustomerInput,
} from "../lib/customers";
import Modal from "./Modal";
import { Button, Field, TextInput, TextArea } from "./ui";

export const emptyCustomer: CustomerInput = {
  display_name: "",
  company: null,
  email: null,
  phone: null,
  bill_line1: null,
  bill_line2: null,
  bill_city: null,
  bill_state: null,
  bill_postal: null,
  bill_country: null,
  notes: null,
  is_active: true,
};

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
  const [form, setForm] = useState<CustomerInput>(emptyCustomer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      const { id, owner_id, created_at, updated_at, ...rest } = editing;
      void id;
      void owner_id;
      void created_at;
      void updated_at;
      setForm(rest);
    } else {
      setForm(emptyCustomer);
    }
  }, [open, editing]);

  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const text = (key: keyof CustomerInput) =>
    (form[key] as string | null) ?? "";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Normalize empty strings to null so the DB stores clean data.
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) =>
        typeof v === "string" && v.trim() === "" ? [k, null] : [k, v],
      ),
    ) as CustomerInput;
    try {
      const saved = editing
        ? await updateCustomer(editing.id, payload)
        : await createCustomer(payload);
      onSaved(saved);
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
        <Field label="Name *">
          <TextInput
            required
            value={text("display_name")}
            onChange={(e) => set("display_name", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company">
            <TextInput
              value={text("company")}
              onChange={(e) => set("company", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={text("phone")}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Email">
          <TextInput
            type="email"
            value={text("email")}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Address line 1">
            <TextInput
              value={text("bill_line1")}
              onChange={(e) => set("bill_line1", e.target.value)}
            />
          </Field>
          <Field label="Address line 2">
            <TextInput
              value={text("bill_line2")}
              onChange={(e) => set("bill_line2", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="City">
            <TextInput
              value={text("bill_city")}
              onChange={(e) => set("bill_city", e.target.value)}
            />
          </Field>
          <Field label="State">
            <TextInput
              value={text("bill_state")}
              onChange={(e) => set("bill_state", e.target.value)}
            />
          </Field>
          <Field label="ZIP">
            <TextInput
              value={text("bill_postal")}
              onChange={(e) => set("bill_postal", e.target.value)}
            />
          </Field>
          <Field label="Country">
            <TextInput
              value={text("bill_country")}
              onChange={(e) => set("bill_country", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <TextArea
            rows={3}
            value={text("notes")}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

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
