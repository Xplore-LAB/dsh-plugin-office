// Pure helpers: RFC4180 CSV parsing and {{field}} template rendering.
// Kept dependency-free and side-effect-free so they can be unit-tested in isolation.

/**
 * Parse CSV text (RFC4180: quoted fields, "" escape, comma delimiter, CRLF/LF rows)
 * into an array of row objects keyed by the (trimmed) header row.
 * A leading UTF-8 BOM is stripped. Blank lines are skipped.
 *
 * @param {string} text - raw CSV file content.
 * @returns {Record<string, string>[]} rows; empty array when the file has no data rows.
 */
export function parseCsv(text) {
  const s = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    if (line.length === 1 && line[0].trim() === "") continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (line[idx] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}

/** Placeholder token: {{ field }}, allowing letters, digits, `_`, `.`, `-`, and CJK. */
export const TOKEN_RE = /\{\{\s*([\w.\-\u4e00-\u9fa5]+)\s*\}\}/g;

/**
 * Render one template against one recipient row. Unresolvable tokens are left
 * verbatim in the output and reported in `missing` so the caller can decide
 * whether to fail the row.
 *
 * @param {string} tpl - template text with {{field}} placeholders.
 * @param {Record<string, unknown>} row - one recipient record.
 * @returns {{ text: string, missing: string[] }}
 */
export function renderTemplate(tpl, row) {
  const missing = [];
  const text = String(tpl ?? "").replace(TOKEN_RE, (whole, key) => {
    const v = row ? row[key] : undefined;
    if (v === undefined || v === null || String(v).trim() === "") {
      missing.push(key);
      return whole;
    }
    return String(v);
  });
  return { text, missing: [...new Set(missing)] };
}

/** Loose-but-practical email address check: one @, non-empty local and domain parts. */
export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}
