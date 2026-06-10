import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { ServicePreset } from "../lib/database.types";
import { listEstimates, type EstimateListRow } from "../lib/estimates";
import {
  listPresets,
  createPreset,
  updatePreset,
  deletePreset,
  type PresetInput,
} from "../lib/presets";
import { money } from "../lib/format";
import Modal from "../components/Modal";
import { Badge, Button, Field, TextInput, TextArea } from "../components/ui";
import { useToast, useConfirm } from "../components/feedback";

const UNITS = ["hour", "item", "flat", "month"];
const selectCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export default function Estimator() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<EstimateListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [presetsOpen, setPresetsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listEstimates());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mrr = rows
    .filter((r) => r.kind === "monthly" && r.status === "accepted")
    .reduce((s, r) => s + Number(r.total), 0);
  const pipeline = rows
    .filter(
      (r) =>
        r.kind === "one_time" &&
        (r.status === "draft" || r.status === "sent") &&
        !r.converted_invoice_id,
    )
    .reduce((s, r) => s + Number(r.total), 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.title, r.customer?.display_name, r.status, r.kind]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-content">Estimator</h1>
          <p className="mt-1 text-sm text-muted">
            Plan pricing and monthly plans.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPresetsOpen(true)}>
            Presets
          </Button>
          <Button onClick={() => navigate("/estimator/new")}>
            + New estimate
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="panel p-5">
          <div className="text-sm text-muted">Monthly recurring (MRR)</div>
          <div className="accent-gradient mt-2 text-3xl font-semibold">
            {loading ? "…" : `${money(mrr)}/mo`}
          </div>
          <div className="mt-1 text-xs text-faint">accepted monthly plans</div>
        </div>
        <div className="panel p-5">
          <div className="text-sm text-muted">One-time pipeline</div>
          <div className="accent-gradient mt-2 text-3xl font-semibold">
            {loading ? "…" : money(pipeline)}
          </div>
          <div className="mt-1 text-xs text-faint">open quotes not yet won</div>
        </div>
      </div>

      <div className="mt-6">
        <TextInput
          placeholder="Search title, customer, status…"
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
              <th className="px-4 py-3 font-medium">Estimate</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-faint">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-faint">
                  {rows.length === 0
                    ? "No estimates yet. Create your first one."
                    : "No matches."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/estimator/${r.id}`)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-surface2"
                >
                  <td className="px-4 py-3 font-medium text-content">
                    {r.title}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {r.customer?.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={r.kind} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-content">
                    {money(r.total)}
                    {r.kind === "monthly" && (
                      <span className="text-faint">/mo</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PresetsModal open={presetsOpen} onClose={() => setPresetsOpen(false)} />
    </div>
  );
}

function PresetsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [presets, setPresets] = useState<ServicePreset[]>([]);
  const [editing, setEditing] = useState<ServicePreset | null>(null);
  const blank: PresetInput = {
    name: "",
    description: null,
    unit: "hour",
    default_qty: 1,
    default_rate: 0,
  };
  const [form, setForm] = useState<PresetInput>(blank);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setPresets(await listPresets());
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setEditing(null);
      setForm(blank);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof PresetInput>(k: K, v: PresetInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const edit = (p: ServicePreset) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description,
      unit: p.unit,
      default_qty: p.default_qty,
      default_rate: p.default_rate,
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: PresetInput = {
        ...form,
        description: form.description?.trim() ? form.description : null,
      };
      if (editing) await updatePreset(editing.id, payload);
      else await createPreset(payload);
      toast("Preset saved", "success");
      setEditing(null);
      setForm(blank);
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (p: ServicePreset) => {
    const ok = await confirm({
      title: "Delete preset?",
      message: `"${p.name}" will be removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePreset(p.id);
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Service presets" width="max-w-2xl">
      <p className="mb-4 text-sm text-muted">
        Reusable line items you can drop into any estimate.
      </p>

      <div className="mb-5 overflow-hidden rounded-lg border border-line">
        {presets.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-faint">
            No presets yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {presets.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-medium text-content">{p.name}</div>
                    <div className="text-xs text-faint">
                      {money(p.default_rate)} / {p.unit}
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

      <form onSubmit={onSubmit} className="space-y-3 border-t border-line pt-4">
        <div className="text-sm font-medium text-content">
          {editing ? "Edit preset" : "Add preset"}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *">
            <TextInput
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Unit">
            <select
              className={selectCls}
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default qty">
            <TextInput
              type="number"
              step="0.01"
              value={form.default_qty}
              onChange={(e) => set("default_qty", Number(e.target.value))}
            />
          </Field>
          <Field label="Default rate">
            <TextInput
              type="number"
              step="0.01"
              value={form.default_rate}
              onChange={(e) => set("default_rate", Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Description">
          <TextArea
            rows={2}
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-3">
          {editing && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setForm(blank);
              }}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add preset"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
