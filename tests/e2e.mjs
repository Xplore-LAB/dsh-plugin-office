// End-to-end tests for @local/dsh-plugin-office (all four tools).
// Run from inside the mounted plugin directory:
//   cp tests/e2e.mjs <profile>/node_modules/@local/dsh-plugin-office/ && node e2e.mjs
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const MOUNT = path.join(os.homedir(), ".dsh/profiles/web/node_modules/@local/dsh-plugin-office");
const PLUGIN = path.join(MOUNT, "lib/index.js");
const requireFromPlugin = createRequire(pathToFileURL(path.join(MOUNT, "package.json")).href);
const ExcelJS = requireFromPlugin("exceljs");
const { apply, Config } = await import(pathToFileURL(PLUGIN).href);

const tools = [];
apply({ tools: { register: (t) => tools.push(t) } }, Config({}));
const byName = (n) => {
  const t = tools.find((t) => t.name === n);
  if (!t) throw new Error(`tool not registered: ${n}`);
  return t;
};
const mailPreview = byName("office_mail_preview");
const mailSend = byName("office_mail_send");
const docgen = byName("office_docgen");
const sheet = byName("office_sheet");
const exec = { signal: undefined };
let passed = 0;
const ok = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`); console.log(`PASS: ${msg}`); passed++; };

const base = path.join(os.tmpdir(), "officetest");
await fsp.rm(base, { recursive: true, force: true });
await fsp.mkdir(base, { recursive: true });

// fixtures
await fsp.writeFile(path.join(base, "recipients.csv"),
  "name,email,month,score\nAlice,alice@example.com,September,95\nBob,bob@example.com,September,88\nCarol,carol@example.com,September,76\n", "utf8");
await fsp.writeFile(path.join(base, "employees.csv"),
  "name,department,salary,bonus\nAlice,Engineering,25000,3000\nBob,Engineering,22000,2200\nCarol,Sales,15000,1800\nDave,Sales,17000,1500\nEve,HR,14000,1000\nFrank,Engineering,28000,3500\n", "utf8");

// ── 1. mail regression: preview → draft ──────────────────────────────────
const r1 = await mailPreview.execute({
  subjectTemplate: "{{month}} report for {{name}}",
  bodyTemplate: "Hi {{name}},\n\nYour {{month}} score is {{score}}.",
  recipientsFile: "recipients.csv",
  workDir: base
}, exec);
ok(r1.valid === 3 && r1.invalid === 0, `mail preview 3/3 valid (${r1.previewId})`);
ok(r1.samples[0].subject === "September report for Alice", "mail preview rendered subject");
const r2 = await mailSend.execute({ previewId: r1.previewId, mode: "draft", confirm: true }, exec);
ok(r2.ok === 3 && r2.total === 3, "mail draft wrote 3 .eml files");

// ── 2. docgen single mode ────────────────────────────────────────────────
const blocks = [
  { type: "heading", level: 1, text: "{{title}}" },
  { type: "paragraph", text: "Prepared for {{name}} on {{date}}." },
  { type: "bulletList", items: ["First point about {{name}}", "Second point"] },
  { type: "numberList", items: ["Step one", "Step two"] },
  { type: "table", header: ["Item", "Score"], rows: [["Alpha", "95"], ["Beta", "88"]] },
  { type: "pageBreak" },
  { type: "heading", level: 2, text: "Appendix" },
  { type: "paragraph", text: "End of document." }
];
const r3 = await docgen.execute({
  content: blocks,
  variables: { title: "Quarterly Review", name: "Alice", date: "2026-09-04" },
  outputPath: "reports/single.docx",
  workDir: base
}, exec);
ok(r3.count === 1, "docgen single mode wrote 1 file");
const singlePath = r3.files[0];
const st3 = await fsp.stat(singlePath);
ok(st3.size > 4000, `docx has reasonable size (${st3.size}B)`);
const xml3 = execFileSync("unzip", ["-p", singlePath, "word/document.xml"]).toString();
ok(xml3.includes("Quarterly Review"), "docx contains rendered heading");
ok(xml3.includes("Prepared for Alice"), "docx contains rendered paragraph");
ok(xml3.includes("Alpha"), "docx contains table cell");
ok(!xml3.includes("{{"), "docx has no unrendered placeholders");

// refuse overwrite
let refused = false;
try {
  await docgen.execute({ content: blocks, variables: { title: "x", name: "y", date: "z" }, outputPath: "reports/single.docx", workDir: base }, exec);
} catch (e) { refused = /already exists/.test(e.message); }
ok(refused, "docgen refuses to overwrite without overwrite=true");

// missing variable is a hard error with a precise message
let missingErr = false;
try {
  await docgen.execute({ content: [{ type: "paragraph", text: "Dear {{nickname}}," }], outputPath: "reports/bad.docx", workDir: base }, exec);
} catch (e) { missingErr = /\{\{nickname\}\}/.test(e.message); }
ok(missingErr, "docgen reports missing {{field}} precisely");

// ── 3. docgen batch mode ─────────────────────────────────────────────────
const r4 = await docgen.execute({
  content: [
    { type: "heading", level: 1, text: "Performance letter for {{name}}" },
    { type: "paragraph", text: "Dear {{name}}, your salary is {{salary}}." }
  ],
  dataFile: "employees.csv",
  outputDir: "letters",
  filenameTemplate: "letter_{{name}}.docx",
  workDir: base
}, exec);
ok(r4.count === 6, `docgen batch wrote 6 files (got ${r4.count})`);
const xml4 = execFileSync("unzip", ["-p", path.join(r4.outputDir, "letter_Frank.docx"), "word/document.xml"]).toString();
ok(xml4.includes("your salary is 28000"), "batch docx rendered row data");

// ── 4. sheet inspect ─────────────────────────────────────────────────────
const r5 = await sheet.execute({ file: "employees.csv", action: "inspect", workDir: base }, exec);
ok(r5.rowCount === 6, `sheet inspect rowCount=6 (got ${r5.rowCount})`);
const salaryCol = r5.columns.find((c) => c.column === "salary");
ok(salaryCol.inferredType === "numeric", "sheet inspect infers salary as numeric");
ok(r5.sampleRows.length === 5, "sheet inspect returns sample rows");

// ── 5. sheet filter → csv output, read back ──────────────────────────────
const r6 = await sheet.execute({
  file: "employees.csv", action: "filter", workDir: base,
  filter: { column: "department", op: "eq", value: "Engineering" },
  outputPath: "filtered/eng.csv"
}, exec);
ok(r6.matched === 3, `sheet filter matched 3 (got ${r6.matched})`);
const r6b = await sheet.execute({ file: "filtered/eng.csv", action: "inspect", workDir: base }, exec);
ok(r6b.rowCount === 3, "filtered csv reads back with 3 rows");
const r6c = await sheet.execute({
  file: "employees.csv", action: "filter", workDir: base,
  filter: { column: "salary", op: "gt", value: "16000" },
  outputPath: "filtered/high.csv"
}, exec);
ok(r6c.matched === 4, `numeric gt matched 4 (got ${r6c.matched})`);

// ── 6. sheet aggregate → xlsx output, read back ──────────────────────────
const r7 = await sheet.execute({
  file: "employees.csv", action: "aggregate", workDir: base,
  aggregate: {
    groupBy: ["department"],
    metrics: [
      { fn: "count" },
      { column: "salary", fn: "sum" },
      { column: "bonus", fn: "avg" }
    ]
  },
  outputPath: "agg/departments.xlsx"
}, exec);
ok(r7.groups === 3, `aggregate produced 3 groups (got ${r7.groups})`);
const eng = r7.rows.find((r) => r.department === "Engineering");
ok(eng.count === "3", "Engineering count=3");
ok(eng.sum_salary === "75000", `Engineering sum_salary=75000 (got ${eng.sum_salary})`);
ok(eng.avg_bonus === "2900", `Engineering avg_bonus=2900 (got ${eng.avg_bonus})`);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.join(base, "agg/departments.xlsx"));
ok(wb.worksheets[0].rowCount === 4, "xlsx aggregate reads back with header+3 rows");

// ── 7. sheet split ───────────────────────────────────────────────────────
const r8 = await sheet.execute({
  file: "employees.csv", action: "split", workDir: base,
  splitBy: "department", outputPrefix: "split/dept"
}, exec);
ok(r8.files.length === 3, `split wrote 3 files (got ${r8.files.length})`);
const r8b = await sheet.execute({ file: "split/dept_Sales.csv", action: "inspect", workDir: base }, exec);
ok(r8b.rowCount === 2, "split Sales file has 2 rows");

// ── 8. unknown column is a precise error ────────────────────────────────
let colErr = false;
try {
  await sheet.execute({ file: "employees.csv", action: "filter", workDir: base, filter: { column: "typo", op: "eq", value: "x" } }, exec);
} catch (e) { colErr = /not found/.test(e.message); }
ok(colErr, "sheet filter rejects unknown column");

console.log(`\nAll ${passed} checks passed.`);
await fsp.rm(path.join(os.homedir(), ".dsh/office/mail/previews"), { recursive: true, force: true }).catch(() => {});
await fsp.rm(path.join(os.homedir(), ".dsh/office/mail/drafts"), { recursive: true, force: true }).catch(() => {});
await fsp.rm(path.join(os.homedir(), ".dsh/office/mail/sent-log.jsonl"), { force: true }).catch(() => {});
