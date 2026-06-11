// Brand/DBA filter shared across pages.
//   "all"     → no filter (every brand)
//   "primary" → the primary noalanPRO identity (business_profile_id IS NULL)
//   <id>      → a specific business_profiles row
export type BrandFilter = "all" | "primary" | string;

// Apply a brand filter to a query against a column holding business_profile_id
// (default "business_profile_id"; pass an embedded path like
// "invoice.business_profile_id" for joined queries). T is passed through
// untouched so the caller keeps full builder typing for any later chaining;
// the internal cast just reaches the eq/is methods (which return T).
export function applyBrand<T>(
  query: T,
  brand: BrandFilter,
  column = "business_profile_id",
): T {
  if (brand === "all") return query;
  const q = query as unknown as {
    eq: (c: string, v: string) => T;
    is: (c: string, v: null) => T;
  };
  return brand === "primary" ? q.is(column, null) : q.eq(column, brand);
}
