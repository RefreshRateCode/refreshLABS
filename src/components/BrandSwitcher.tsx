import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { useBrand } from "../brand/BrandContext";
import { listBusinessProfiles } from "../lib/businessProfiles";
import type { BusinessProfile } from "../lib/database.types";

// Global brand/DBA filter. Hidden until at least one brand exists, so single-
// brand users never see it. Scopes invoices, estimates, and expenses.
export default function BrandSwitcher() {
  const { brand, setBrand } = useBrand();
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);

  useEffect(() => {
    let active = true;
    listBusinessProfiles().then((p) => active && setProfiles(p));
    return () => {
      active = false;
    };
  }, []);

  // Selected brand no longer exists (deleted) → fall back to "all".
  useEffect(() => {
    if (
      brand !== "all" &&
      brand !== "primary" &&
      profiles.length > 0 &&
      !profiles.some((p) => p.id === brand)
    ) {
      setBrand("all");
    }
  }, [brand, profiles, setBrand]);

  if (profiles.length === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
      <Building2 size={15} className="text-faint" />
      <select
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        className="rounded-md border border-line bg-surface2 px-2 py-1.5 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        aria-label="Filter by brand"
      >
        <option value="all">All brands</option>
        <option value="primary">noalanPRO (primary)</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
