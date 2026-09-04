// Spreadsheet pipeline: read .csv / .xlsx into row objects, then inspect,
// filter, aggregate, or split. Deterministic structured results only.

import fsp from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { parseCsv } from "./render.js";

/** Normalize one ExcelJS cell value to a string. */
function cellText(v) {
  if (v == null) return "";
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  }
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text ?? "").join("");
    if (v.result !== undefined) return cellText(v.result);
    if (v.text !== undefined) return String(v.text);
    if (v.error) return "";
    return String(v);
  }
  return String(v);
}

/** Lenient numeric coercion: strips thousands separators / currency marks. */
function toNum(v) {
  const s = String(v ?? "").replace(/[,\s¥$€]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Read a .csv or .xlsx file into an array of row objects keyed by the header.
 * @param {string} abs absolute path to the file.
 * @returns {Promise<Record<string, string>[]>}
 */
export async function readTable(abs) {
  const lower = abs.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = await fsp.readFile(abs, "utf8");
    return parseCsv(text);
  }
  if (lower.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(abs);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const rows = [];
    let header = null;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const count = Math.max(ws.columnCount, 1) + 1;
      const vals = [];
      for (let i = 1; i < count; i++) vals.push(cellText(row.values[i]));
      if (!header) {
        header = vals.map((v, i) => (v.trim() !== "" ? v.trim() : `col${i + 1}`));
        return;
      }
      const obj = {};
      header.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      rows.push(obj);
    });
    return rows;
  }
  throw new Error("only .csv and .xlsx files are supported");
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Write a table to .csv or .xlsx (chosen by the output extension). */
export async function writeTable(abs, header, rows) {
  const lower = abs.toLowerCase();
  if (lower.endsWith(".csv")) {
    const lines = [header.map(csvEscape).join(",")];
    for (const r of rows) {
      lines.push(header.map((h) => csvEscape(r[h] ?? "")).join(","));
    }
    await fsp.writeFile(abs, lines.join("\n") + "\n", "utf8");
    return;
  }
  if (lower.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(header);
    for (const r of rows) ws.addRow(header.map((h) => r[h] ?? ""));
    await wb.xlsx.writeFile(abs);
    return;
  }
  throw new Error("outputPath must end with .csv or .xlsx");
}

/** Column-level stats used by inspect: fill ratio and numeric ratio. */
export function inspectColumns(header, rows) {
  return header.map((h) => {
    let filled = 0;
    let numeric = 0;
    for (const r of rows) {
      const v = String(r[h] ?? "");
      if (v.trim() !== "") {
        filled++;
        if (toNum(v) !== null) numeric++;
      }
    }
    const filledNonEmpty = filled || 1;
    return {
      column: h,
      filled,
      numericRatio: Math.round((numeric / filledNonEmpty) * 100) / 100,
      inferredType: filled === 0 ? "empty" : numeric / filledNonEmpty >= 0.8 ? "numeric" : "text"
    };
  });
}

const FILTER_OPS = new Set(["eq", "ne", "gt", "gte", "lt", "lte", "contains", "notContains", "empty", "notEmpty"]);

/**
 * Apply one filter predicate. Returns { keep, skipped } where skipped counts
 * rows that could not be evaluated numerically for a numeric op.
 */
export function applyFilter(rows, { column, op, value }) {
  if (!FILTER_OPS.has(op)) {
    throw new Error(`filter.op must be one of ${[...FILTER_OPS].join(", ")} (got "${op}")`);
  }
  const keep = [];
  let skipped = 0;
  const target = String(value ?? "");
  for (const r of rows) {
    const v = String(r[column] ?? "");
    if (op === "empty") { if (v.trim() === "") keep.push(r); continue; }
    if (op === "notEmpty") { if (v.trim() !== "") keep.push(r); continue; }
    if (op === "contains") { if (v.includes(target)) keep.push(r); continue; }
    if (op === "notContains") { if (!v.includes(target)) keep.push(r); continue; }
    if (op === "eq" || op === "ne") {
      const matches = v === target || toNum(v) !== null && toNum(target) !== null && toNum(v) === toNum(target);
      if (op === "eq" ? matches : !matches) keep.push(r);
      continue;
    }
    const a = toNum(v);
    const b = toNum(target);
    if (a === null || b === null) { skipped++; continue; }
    let ok = false;
    if (op === "gt") ok = a > b;
    else if (op === "gte") ok = a >= b;
    else if (op === "lt") ok = a < b;
    else if (op === "lte") ok = a <= b;
    if (ok) keep.push(r);
  }
  return { keep, skipped };
}

const AGG_FNS = new Set(["sum", "avg", "min", "max", "count"]);

function round(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Group rows by one or more columns and compute metrics.
 * metric: { column, fn }. fn=count counts rows (column may be omitted);
 * sum/avg/min/max operate on numeric values and report nonNumeric skips.
 * @returns {{ header: string[], rows: Record<string, string>[], skipped: number }}
 */
export function aggregateTable(rows, { groupBy, metrics }) {
  if (!Array.isArray(groupBy) || groupBy.length === 0) {
    throw new Error("aggregate.groupBy must be a non-empty array of column names");
  }
  if (!Array.isArray(metrics) || metrics.length === 0) {
    throw new Error("aggregate.metrics must be a non-empty array of {column, fn}");
  }
  for (const m of metrics) {
    if (!AGG_FNS.has(m.fn)) {
      throw new Error(`aggregate.metrics[].fn must be one of ${[...AGG_FNS].join(", ")} (got "${m.fn}")`);
    }
    if (m.fn !== "count" && !m.column) {
      throw new Error(`aggregate.metrics[].column is required for fn "${m.fn}"`);
    }
  }
  const groups = new Map();
  for (const r of rows) {
    const key = groupBy.map((c) => String(r[c] ?? "")).join("\u0001");
    if (!groups.has(key)) groups.set(key, { key, row: r, items: [] });
    groups.get(key).items.push(r);
  }
  const header = [
    ...groupBy,
    ...metrics.map((m) => (m.fn === "count" ? "count" : `${m.fn}_${m.column}`))
  ];
  let skipped = 0;
  const out = [];
  for (const g of groups.values()) {
    const rec = {};
    groupBy.forEach((c) => { rec[c] = String(g.row[c] ?? ""); });
    for (const m of metrics) {
      if (m.fn === "count") {
        rec["count"] = String(g.items.length);
        continue;
      }
      let acc = null;
      let used = 0;
      let bad = 0;
      for (const item of g.items) {
        const n = toNum(item[m.column]);
        if (n === null) { bad++; continue; }
        if (acc === null) acc = n;
        else if (m.fn === "sum" || m.fn === "avg") acc += n;
        else if (m.fn === "min") acc = Math.min(acc, n);
        else if (m.fn === "max") acc = Math.max(acc, n);
        used++;
      }
      skipped += bad;
      if (acc === null) {
        rec[`${m.fn}_${m.column}`] = "";
      } else if (m.fn === "avg") {
        rec[`${m.fn}_${m.column}`] = String(round(acc / used));
      } else {
        rec[`${m.fn}_${m.column}`] = String(round(acc));
      }
    }
    out.push(rec);
  }
  out.sort((a, b) => groupBy.map((c) => String(a[c]).localeCompare(String(b[c]), undefined, { numeric: true })).reduce((p, q) => p || q, 0));
  return { header, rows: out, skipped };
}

/** Split rows by the distinct values of one column; returns [{ value, rows }]. */
export function splitTable(rows, column) {
  const groups = new Map();
  for (const r of rows) {
    const v = String(r[column] ?? "").trim();
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(r);
  }
  return [...groups.entries()]
    .map(([value, items]) => ({ value, rows: items }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}

export { toNum };
