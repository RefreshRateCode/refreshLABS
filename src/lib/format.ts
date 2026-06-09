const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function money(n: number | null | undefined): string {
  return currency.format(Number(n ?? 0));
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  // d is a date string like "2026-06-09"; render without timezone shifts.
  const [y, m, day] = d.split("T")[0].split("-").map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
