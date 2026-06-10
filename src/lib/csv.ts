type Cell = string | number | null | undefined;

function escapeCell(v: Cell): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows]
    .map((r) => r.map(escapeCell).join(","))
    .join("\r\n");
}

export function downloadCsv(filename: string, content: string): void {
  // Prepend a BOM so Excel/QuickBooks read UTF-8 correctly.
  const blob = new Blob(["﻿" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
