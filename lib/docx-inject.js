// .docx template injection: replace {{key}} placeholders inside an existing
// Word template file, handling the classic "Word split the placeholder across
// multiple runs" problem with a run-merge rewrite. Built on jszip.

import fsp from "node:fs/promises";
import JSZip from "jszip";
import { TOKEN_RE } from "./render.js";

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** All <w:t> runs in the document XML, in order. */
function scanRuns(xml) {
  const re = /(<w:t[^>]*>)([^<]*)(<\/w:t>)/g;
  const runs = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    runs.push({ open: m[1], text: m[2], close: m[3], start: m.index, end: m.index + m[0].length });
  }
  return runs;
}

function unescapeText(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Collect every {{token}} present in the template's visible text.
 * Returns unique keys in order of first appearance.
 */
export function collectTokens(xml) {
  const runs = scanRuns(xml);
  const fullText = runs.map((r) => unescapeText(r.text)).join("");
  const keys = [];
  for (const m of fullText.matchAll(TOKEN_RE)) {
    if (!keys.includes(m[1])) keys.push(m[1]);
  }
  return keys;
}

/**
 * Replace every occurrence of {{key}} (escaped and unescaped variants in XML)
 * with the value. Handles placeholders split across runs by merging the
 * covered runs into the first one, preserving its formatting.
 */
function replaceToken(xml, key, escapedValue) {
  // Pass 1: whole placeholder inside one run's text (the common case).
  const direct = `{{${key}}}`;
  if (xml.includes(direct)) {
    return xml.split(direct).join(escapedValue);
  }
  // Pass 2: placeholder split across runs. Work on the concatenated text and
  // map each occurrence back onto the run range that covers it.
  const runs = scanRuns(xml);
  if (runs.length === 0) return xml;
  const fullText = runs.map((r) => r.text).join("");
  const edits = [];
  let idx = fullText.indexOf(direct);
  while (idx !== -1) {
    const tokEnd = idx + direct.length;
    let first = -1;
    let last = -1;
    let before = "";
    let after = "";
    let cum = 0;
    for (let i = 0; i < runs.length; i++) {
      const rs = cum;
      const re = rs + runs[i].text.length;
      cum = re;
      if (re <= idx || rs >= tokEnd) continue;
      if (first === -1) {
        first = i;
        before = runs[i].text.slice(0, idx - rs);
      }
      last = i;
      after = runs[i].text.slice(Math.max(0, tokEnd - rs));
    }
    if (first !== -1) {
      edits.push({ first, last, newText: before + escapedValue + after });
    }
    idx = fullText.indexOf(direct, tokEnd);
  }
  if (edits.length === 0) return xml;
  for (const e of edits) {
    runs[e.first].newText = e.newText;
    for (let i = e.first + 1; i <= e.last; i++) runs[i].newText = "";
  }
  let out = "";
  let pos = 0;
  for (const r of runs) {
    if (r.newText === undefined) continue;
    out += xml.slice(pos, r.start) + r.open + r.newText + r.close;
    pos = r.end;
  }
  out += xml.slice(pos);
  return out;
}

/**
 * Inject variables into a .docx template and write the result.
 * Every {{token}} found in the template body must be covered by vars,
 * otherwise the whole call fails (no half-rendered documents).
 *
 * @param {{ templatePath: string, outPath: string, vars: Record<string, unknown> }} spec
 * @returns {Promise<{ tokens: string[], outPath: string }>}
 */
export async function injectDocx({ templatePath, outPath, vars }) {
  const buf = await fsp.readFile(templatePath);
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(`${templatePath} is not a valid .docx (word/document.xml missing)`);
  }
  let xml = await docFile.async("string");

  const tokens = collectTokens(xml);
  const missing = tokens.filter((k) => {
    const v = vars[k];
    return v === undefined || v === null || String(v).trim() === "";
  });
  if (missing.length > 0) {
    throw new Error(`template references field(s) not provided: ${missing.map((k) => `{{${k}}}`).join(", ")}`);
  }

  for (const key of tokens) {
    xml = replaceToken(xml, key, escapeXml(vars[key]));
  }

  const leftovers = collectTokens(xml);
  if (leftovers.length > 0) {
    throw new Error(`could not replace ${leftovers.map((k) => `{{${k}}}`).join(", ")}; the placeholder(s) are likely split in a way the injector cannot merge. Re-type each placeholder in Word in one go.`);
  }

  zip.file("word/document.xml", xml);
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fsp.writeFile(outPath, out);
  return { tokens, outPath };
}
