import { useEffect, useState } from "react";
import { listBusinessProfiles } from "../lib/businessProfiles";
import type { BusinessProfile } from "../lib/database.types";
import { Field } from "./ui";

const selectCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

// "Issued by" / brand picker for editors. Renders nothing until at least one
// brand/DBA exists, so single-brand users never see it. null = primary identity.
export default function BrandSelect({
  value,
  onChange,
  label = "Issued by",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
}) {
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);

  useEffect(() => {
    let active = true;
    listBusinessProfiles().then((p) => active && setProfiles(p));
    return () => {
      active = false;
    };
  }, []);

  if (profiles.length === 0) return null;

  return (
    <Field label={label}>
      <select
        className={selectCls}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">noalanPRO (primary)</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
