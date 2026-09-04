// Word (.docx) generation built on the `docx` library.
// Blocks are plain data so the model can compose them declaratively; every
// text surface runs through the shared {{field}} renderer first.

import fsp from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import { renderTemplate } from "./render.js";

const HEADING_LEVELS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4
};

/** Render one template string, throwing on any missing {{field}}. */
function mustRender(tpl, vars, where) {
  if (typeof tpl !== "string") {
    throw new Error(`${where}: expected a string`);
  }
  const { text, missing } = renderTemplate(tpl, vars);
  if (missing.length > 0) {
    throw new Error(`${where}: missing field(s) ${missing.map((k) => `{{${k}}}`).join(", ")}`);
  }
  return text;
}

function buildTable(header, rows, where) {
  if (!Array.isArray(header) || header.length === 0) {
    throw new Error(`${where}: table.header must be a non-empty array`);
  }
  if (!Array.isArray(rows)) {
    throw new Error(`${where}: table.rows must be an array of string arrays`);
  }
  const width = header.length;
  const mkCell = (text, isHeader) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: isHeader })] })],
    shading: isHeader ? { fill: "EFEFEF" } : undefined
  });
  const trs = [];
  trs.push(new TableRow({
    children: header.map((h) => mkCell(h, true)),
    tableHeader: true
  }));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) {
      throw new Error(`${where}: table.rows[${i}] must be an array`);
    }
    if (r.length > width) {
      throw new Error(`${where}: table.rows[${i}] has ${r.length} cells but the header has ${width}`);
    }
    const cells = [];
    for (let c = 0; c < width; c++) {
      cells.push(mkCell(String(r[c] ?? ""), false));
    }
    trs.push(new TableRow({ children: cells }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: trs
  });
}

function buildChildren(blocks, vars) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new Error('content must be a non-empty array of blocks');
  }
  const children = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i] ?? {};
    const where = `content[${i}] (${b.type ?? "missing type"})`;
    switch (b.type) {
      case "heading": {
        const level = HEADING_LEVELS[b.level ?? 1];
        if (!level) {
          throw new Error(`${where}: level must be 1..4`);
        }
        children.push(new Paragraph({
          heading: level,
          children: [new TextRun({ text: mustRender(b.text, vars, `${where}.text`), bold: true })]
        }));
        break;
      }
      case "paragraph": {
        children.push(new Paragraph({
          children: [new TextRun(mustRender(b.text, vars, `${where}.text`))],
          spacing: { after: 120 }
        }));
        break;
      }
      case "bulletList": {
        if (!Array.isArray(b.items) || b.items.length === 0) {
          throw new Error(`${where}: items must be a non-empty array`);
        }
        for (let j = 0; j < b.items.length; j++) {
          children.push(new Paragraph({
            children: [new TextRun(mustRender(b.items[j], vars, `${where}.items[${j}]`))],
            bullet: { level: 0 }
          }));
        }
        break;
      }
      case "numberList": {
        if (!Array.isArray(b.items) || b.items.length === 0) {
          throw new Error(`${where}: items must be a non-empty array`);
        }
        for (let j = 0; j < b.items.length; j++) {
          children.push(new Paragraph({
            children: [new TextRun(mustRender(b.items[j], vars, `${where}.items[${j}]`))],
            numbering: { reference: "office-numbered", level: 0 }
          }));
        }
        break;
      }
      case "table": {
        const header = b.header.map((h, j) => mustRender(h, vars, `${where}.header[${j}]`));
        const rows = b.rows.map((r, ri) => r.map((c, ci) => mustRender(String(c ?? ""), vars, `${where}.rows[${ri}][${ci}]`)));
        children.push(buildTable(header, rows, where));
        break;
      }
      case "pageBreak": {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      }
      default:
        throw new Error(`${where}: unknown block type "${b.type}" (supported: heading, paragraph, bulletList, numberList, table, pageBreak)`);
    }
  }
  return children;
}

/**
 * Generate one .docx file from content blocks.
 *
 * @param {{ blocks: object[], vars?: Record<string, unknown>, outPath: string }} spec
 */
export async function generateDocx({ blocks, vars, outPath }) {
  const children = buildChildren(blocks, vars ?? {});
  const doc = new Document({
    numbering: {
      config: [{
        reference: "office-numbered",
        levels: [{
          level: 0,
          format: "decimal",
          text: "%1.",
          alignment: AlignmentType.START
        }]
      }]
    },
    sections: [{ children }]
  });
  const buf = await Packer.toBuffer(doc);
  await fsp.writeFile(outPath, buf);
  return outPath;
}

/** Make a batch filename safe: strip path separators and risky characters. */
export function sanitizeFilename(name) {
  const cleaned = String(name ?? "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/\.+/g, ".")
    .replace(/^\.+/, "");
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error(`filename template rendered to an empty or unsafe name: "${name}"`);
  }
  return cleaned;
}

export { mustRender };
