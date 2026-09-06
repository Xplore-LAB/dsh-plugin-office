// Local text extraction and evidence retrieval for common attachment formats.

import fsp from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import ExcelJSPkg from "exceljs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const ExcelJS = ExcelJSPkg;
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".tsv", ".json", ".xml", ".html", ".htm"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);

function isInside(base, file) {
  const root = path.resolve(base);
  const target = path.resolve(root, file);
  return target === root || target.startsWith(root + path.sep);
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_all, n) => String.fromCodePoint(Number(n)));
}

function xmlTexts(xml) {
  return [...String(xml).matchAll(/<(?:w:t|a:t)(?:\s[^>]*)?>([\s\S]*?)<\/(?:w:t|a:t)>/g)]
    .map((match) => decodeXml(match[1])).join(" ").replace(/\s+/g, " ").trim();
}

function textPassages(text, citationPrefix, maxChars = 900) {
  const lines = String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const out = [];
  let chunk = "";
  let start = 1;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (chunk && chunk.length + line.length + 1 > maxChars) {
      out.push({ citation: `${citationPrefix}:lines-${start}-${index}`, text: chunk });
      chunk = "";
      start = index + 1;
    }
    chunk += `${chunk ? "\n" : ""}${line}`;
  }
  if (chunk) out.push({ citation: `${citationPrefix}:lines-${start}-${lines.length}`, text: chunk });
  return out;
}

async function docxPassages(buffer, fileName) {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("DOCX is missing word/document.xml");
  const xml = await entry.async("string");
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
    .map((match) => xmlTexts(match[1])).filter(Boolean);
  return paragraphs.map((text, index) => ({ citation: `${fileName}:paragraph-${index + 1}`, text }));
}

async function pptxPassages(buffer, fileName) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
  const out = [];
  for (const name of entries) {
    const number = Number(name.match(/slide(\d+)/)?.[1]);
    const text = xmlTexts(await zip.file(name).async("string"));
    if (text) out.push({ citation: `${fileName}:slide-${number}`, text });
  }
  return out;
}

async function xlsxPassages(file, fileName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const out = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const value = cell.text || String(cell.value ?? "");
        if (value.trim()) cells.push(`${cell.address}=${value.trim()}`);
      });
      if (cells.length > 0) out.push({ citation: `${fileName}:${sheet.name}!${row.number}`, text: cells.join(" | ") });
    });
  });
  return out;
}

async function pdfPassages(buffer, fileName) {
  const loading = getDocument({ data: new Uint8Array(buffer), disableWorker: true, useSystemFonts: true });
  const pdf = await loading.promise;
  const out = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str ?? "").join(" ").replace(/\s+/g, " ").trim();
      if (text) out.push({ citation: `${fileName}:page-${pageNumber}`, text });
    }
  } finally {
    await pdf.destroy();
  }
  return out;
}

function queryTerms(query) {
  const value = String(query ?? "").toLowerCase();
  const words = value.match(/[a-z0-9_]{2,}|[\u3400-\u9fff]{2,}/g) ?? [];
  const terms = new Set(words);
  for (const word of words) {
    if (/^[\u3400-\u9fff]+$/.test(word) && word.length > 2) {
      for (let i = 0; i < word.length - 1; i++) terms.add(word.slice(i, i + 2));
    }
  }
  return [...terms];
}

function rankPassages(passages, query, limit) {
  const terms = queryTerms(query);
  return passages.map((passage, index) => {
    const lower = passage.text.toLowerCase();
    const score = terms.length === 0 ? 1 : terms.reduce((sum, term) => sum + (lower.includes(term) ? Math.max(2, term.length) : 0), 0);
    return { ...passage, score, sourceOrder: index };
  }).filter((passage) => terms.length === 0 || passage.score > 0)
    .sort((a, b) => b.score - a.score || a.sourceOrder - b.sourceOrder)
    .slice(0, limit).map(({ sourceOrder: _sourceOrder, ...passage }) => passage);
}

function pngSize(buffer) {
  if (buffer.length >= 24 && buffer.subarray(1, 4).toString("ascii") === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return {};
}

/** Extract query-relevant evidence from a local attachment. */
export async function inspectAttachment({ file, workDir, query = "", limit = 8, maxFileMb = 50 }) {
  const base = path.resolve(workDir || process.cwd());
  if (!isInside(base, file)) throw new Error(`attachment escapes workDir: ${file}`);
  const absolute = path.resolve(base, file);
  const stat = await fsp.stat(absolute);
  if (!stat.isFile()) throw new Error(`attachment is not a file: ${absolute}`);
  if (stat.size > Math.max(maxFileMb, 1) * 1024 * 1024) throw new Error(`attachment exceeds ${maxFileMb} MB: ${absolute}`);
  const extension = path.extname(absolute).toLowerCase();
  const fileName = path.basename(absolute);
  const buffer = await fsp.readFile(absolute);
  let passages = [];
  let format = extension.slice(1) || "unknown";
  let image = null;
  if (TEXT_EXTENSIONS.has(extension)) {
    const raw = buffer.toString("utf8");
    const text = extension === ".html" || extension === ".htm"
      ? raw.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")
      : raw;
    passages = textPassages(text, fileName);
  } else if (extension === ".docx") {
    passages = await docxPassages(buffer, fileName);
  } else if (extension === ".pptx") {
    passages = await pptxPassages(buffer, fileName);
  } else if (extension === ".xlsx") {
    passages = await xlsxPassages(absolute, fileName);
  } else if (extension === ".pdf") {
    passages = await pdfPassages(buffer, fileName);
  } else if (extension === ".svg") {
    const text = decodeXml(buffer.toString("utf8").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    passages = textPassages(text, fileName);
    format = "svg";
  } else if (IMAGE_EXTENSIONS.has(extension)) {
    image = { path: absolute, extension, bytes: stat.size, ...pngSize(buffer), needsVisionReview: true };
  } else {
    throw new Error(`unsupported attachment type ${extension || "(none)"}; supported: txt, md, csv, tsv, json, xml, html, pdf, docx, pptx, xlsx, svg, and raster-image handoff`);
  }
  const evidence = rankPassages(passages, query, Math.min(Math.max(limit, 1), 30));
  return {
    file: absolute,
    fileName,
    format,
    bytes: stat.size,
    query,
    extractedPassages: passages.length,
    evidence,
    image,
    needsVisionReview: Boolean(image),
    answerInstruction: image
      ? "Use a vision-capable local file reader to inspect this image, then cite the file path. OCR is not silently sent to a cloud service."
      : "Answer the user's question only from the evidence passages and cite each claim with its citation field.",
    safety: "The file was read locally inside workDir. No content was uploaded or modified."
  };
}
