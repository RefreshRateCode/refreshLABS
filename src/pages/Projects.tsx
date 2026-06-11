import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Customer, Project, ProjectStatus } from "../lib/database.types";
import { listCustomers } from "../lib/customers";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  type ProjectInput,
  type ProjectRow,
} from "../lib/projects";
import Modal from "../components/Modal";
import BrandSelect from "../components/BrandSelect";
import { Badge, Button, Field, TextInput, TextArea } from "../components/ui";
import { useToast, useConfirm } from "../components/feedback";
import { useBrand } from "../brand/BrandContext";

const STATUSES: ProjectStatus[] = ["active", "on_hold", "done", "cancelled"];
const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  done: "Done",
  cancelled: "Cancelled",
};
const selectCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

const empty: ProjectInput = {
  customer_id: null,
  name: "",
  status: "active",
  notes: null,
  business_profile_id: null,
};

export default function Projects() {
  const toast = useToast();
  const confirm = useConfirm();
  const { brand } = useBrand();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([listProjects(brand), listCustomers(brand)]);
      setRows(p);
      setCustomers(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.customer?.display_name, STATUS_LABEL[r.status]]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const onDelete = async (p: ProjectRow) => {
    const ok = await confirm({
      title: "Delete project?",
      message: `"${p.name}" will be removed. Invoices linked to it are kept.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProject(p.id);
      setRows((prev) => prev.filter((x) => x.id !== p.id));
      toast("Project deleted", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-content">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} {rows.length === 1 ? "project" : "projects"}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          + New project
        </Button>
      </div>

      <div className="mt-5">
        <TextInput
          placeholder="Search name, customer, status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-faint">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-faint">
                  {rows.length === 0
                    ? "No projects yet. Add one to group your work."
                    : "No matches."}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-line last:border-0 hover:bg-surface2"
                >
                  <td
                    className="cursor-pointer px-4 py-3 font-medium text-content"
                    onClick={() => {
                      setEditing(p);
                      setFormOpen(true);
                    }}
                  >
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {p.customer?.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditing(p);
                        setFormOpen(true);
                      }}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <ProjectFormModal
        open={formOpen}
        editing={editing}
        customers={customers}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
          toast("Project saved", "success");
        }}
      />
    </div>
  );
}

function ProjectFormModal({
  open,
  editing,
  customers,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Project | null;
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProjectInput>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setForm({
        customer_id: editing.customer_id,
        name: editing.name,
        status: editing.status,
        notes: editing.notes,
        business_profile_id: editing.business_profile_id,
      });
    } else {
      setForm(empty);
    }
  }, [open, editing]);

  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: ProjectInput = {
        ...form,
        notes: form.notes?.trim() ? form.notes : null,
      };
      if (editing) await updateProject(editing.id, payload);
      else await createProject(payload);
      onSaved();
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
      title={editing ? "Edit project" : "New project"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name *">
          <TextInput
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer">
            <select
              className={selectCls}
              value={form.customer_id ?? ""}
              onChange={(e) => set("customer_id", e.target.value || null)}
            >
              <option value="">— none —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={selectCls}
              value={form.status}
              onChange={(e) => set("status", e.target.value as ProjectStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <TextArea
            rows={3}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        <BrandSelect
          value={form.business_profile_id}
          onChange={(v) => set("business_profile_id", v)}
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
            {busy ? "Saving…" : editing ? "Save changes" : "Create project"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
