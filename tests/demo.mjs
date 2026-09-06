import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demo = path.join(root, "demo");
const html = await fsp.readFile(path.join(demo, "index.html"), "utf8");
const css = await fsp.readFile(path.join(demo, "styles.css"), "utf8");
const js = await fsp.readFile(path.join(demo, "app.js"), "utf8");

for (const id of ["chatStream", "promptInput", "resultContent", "runButton", "statusChip"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing interactive element ${id}`);
}

const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML ids must be unique");

for (const scene of ["triage", "mailmerge", "jobs", "analytics", "documents", "archive"]) {
  assert.match(js, new RegExp(`\\b${scene}:\\s*\\{`), `missing scene ${scene}`);
}

for (const asset of ["styles.css", "app.js", "../assets/brand/postbird-logo.png"]) {
  const resolved = path.resolve(demo, asset);
  await fsp.access(resolved);
}

for (const file of [
  "files/department-summary.xlsx",
  "files/demo-summary.pptx",
  "files/letters/notice_Alice.docx"
]) {
  const data = await fsp.readFile(path.join(demo, file));
  assert.ok(data.length > 1000, `${file} should contain a real Office document`);
  assert.equal(data.subarray(0, 2).toString("ascii"), "PK", `${file} should be an OOXML zip package`);
}

assert.match(css, /@media \(max-width: 720px\)/, "mobile layout is required");
assert.match(css, /prefers-reduced-motion/, "reduced-motion support is required");

console.log("Postbird Live Demo checks passed.");
