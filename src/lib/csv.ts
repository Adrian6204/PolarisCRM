/**
 * Minimal, dependency-free CSV (RFC 4180-ish): handles quoted fields, escaped
 * quotes (""), and commas/newlines inside quotes. Enough for spreadsheet
 * round-trips (Excel/Sheets/Numbers) without pulling in a parser dependency.
 */

/** Serialize a header + rows to a CSV string (CRLF line endings). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  return lines.join("\r\n");
}

/** Parse CSV text into an array of row objects keyed by the header row. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((cols) => cols.some((c) => c.trim() !== "")) // drop blank lines
    .map((cols) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (cols[i] ?? "").trim(); });
      return obj;
    });
}

/** Tokenize CSV into rows of raw cell strings, honoring quotes. */
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  // flush last field/row if any content remains
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
