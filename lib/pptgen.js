// PowerPoint (.pptx) generation built on pptxgenjs.
// Blocks mirror office_docgen's declarative style; every text surface runs
// through the shared {{field}} renderer first.

import fsp from "node:fs/promises";
import path from "node:path";
import pptxgen from "pptxgenjs";
import { renderTemplate } from "./render.js";

const COLORS = {
  title: "1F2937",
  body: "374151",
  muted: "6B7280",
  tableBorder: "D1D5DB",
  headerFill: "EFEFEF"
};

const SAFE_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg"]);

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

function addSlideTitle(slide, title) {
  slide.addText(title, {
    x: 0.6, y: 0.35, w: 8.8, h: 0.7,
    fontSize: 26, bold: true, color: COLORS.title
  });
}

/**
 * Generate one .pptx file from content blocks.
 *
 * @param {{ blocks: object[], vars?: Record<string, unknown>, outPath: string, baseDir: string }} spec
 */
export async function generatePptx({ blocks, vars, outPath, baseDir }) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new Error("content must be a non-empty array of blocks");
  }
  const v = vars ?? {};
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i] ?? {};
    const where = `content[${i}] (${b.type ?? "missing type"})`;
    const slide = pptx.addSlide();
    switch (b.type) {
      case "title": {
        const title = mustRender(b.title, v, `${where}.title`);
        slide.addText(title, {
          x: 0.6, y: 1.9, w: 8.8, h: 1.1,
          fontSize: 38, bold: true, color: COLORS.title, align: "center", valign: "middle"
        });
        if (b.subtitle !== undefined && b.subtitle !== "") {
          const subtitle = mustRender(b.subtitle, v, `${where}.subtitle`);
          slide.addText(subtitle, {
            x: 0.6, y: 3.1, w: 8.8, h: 0.6,
            fontSize: 18, color: COLORS.muted, align: "center"
          });
        }
        break;
      }
      case "bullets": {
        if (!Array.isArray(b.items) || b.items.length === 0) {
          throw new Error(`${where}: items must be a non-empty array`);
        }
        if (b.title) addSlideTitle(slide, mustRender(b.title, v, `${where}.title`));
        const items = b.items.map((item, j) => ({
          text: mustRender(item, v, `${where}.items[${j}]`),
          options: { bullet: true, breakLine: true, fontSize: 16, color: COLORS.body }
        }));
        slide.addText(items, { x: 0.9, y: 1.3, w: 8.2, h: 3.9, valign: "top" });
        break;
      }
      case "content": {
        if (b.title) addSlideTitle(slide, mustRender(b.title, v, `${where}.title`));
        slide.addText(mustRender(b.text, v, `${where}.text`), {
          x: 0.9, y: 1.4, w: 8.2, h: 3.6,
          fontSize: 16, color: COLORS.body, valign: "top"
        });
        break;
      }
      case "table": {
        if (!Array.isArray(b.header) || b.header.length === 0) {
          throw new Error(`${where}: table.header must be a non-empty array`);
        }
        if (!Array.isArray(b.rows)) {
          throw new Error(`${where}: table.rows must be an array of string arrays`);
        }
        if (b.title) addSlideTitle(slide, mustRender(b.title, v, `${where}.title`));
        const width = b.header.length;
        const head = b.header.map((h, j) => ({
          text: mustRender(h, v, `${where}.header[${j}]`),
          options: { bold: true, fill: { color: COLORS.headerFill } }
        }));
        const body = b.rows.map((r, ri) => {
          if (!Array.isArray(r)) throw new Error(`${where}: table.rows[${ri}] must be an array`);
          const cells = [];
          for (let c = 0; c < width; c++) {
            cells.push({ text: mustRender(String(r[c] ?? ""), v, `${where}.rows[${ri}][${c}]`) });
          }
          return cells;
        });
        slide.addTable([head, ...body], {
          x: 0.6, y: 1.4, w: 8.8,
          fontSize: 12, color: COLORS.body,
          border: { pt: 0.5, color: COLORS.tableBorder }
        });
        break;
      }
      case "image": {
        if (!b.imagePath) throw new Error(`${where}: imagePath is required`);
        const rel = mustRender(b.imagePath, v, `${where}.imagePath`);
        const abs = path.resolve(baseDir, rel);
        // imagePath may be rendered from an untrusted data row; confine it to
        // the working directory so a crafted cell cannot embed arbitrary local
        // files (e.g. screenshots, scanned documents) into an outbound deck.
        const rootDir = path.resolve(baseDir);
        if (abs !== rootDir && !abs.startsWith(rootDir + path.sep)) {
          throw new Error(`${where}: imagePath escapes workDir: "${rel}" (resolves to ${abs}); images must live inside workDir`);
        }
        const extension = path.extname(abs).toLowerCase();
        if (!SAFE_IMAGE_EXTENSIONS.has(extension)) {
          throw new Error(`${where}: unsupported image type "${extension || "none"}"; use PNG, JPEG, GIF, or SVG`);
        }
        let st;
        try {
          st = await fsp.stat(abs);
        } catch {
          throw new Error(`${where}: image not found: ${abs}`);
        }
        if (!st.isFile()) throw new Error(`${where}: image is not a file: ${abs}`);
        if (b.title) addSlideTitle(slide, mustRender(b.title, v, `${where}.title`));
        slide.addImage({ path: abs, x: 0.9, y: 1.2, sizing: { type: "contain", w: 8.2, h: 3.8 } });
        if (b.caption) {
          slide.addText(mustRender(b.caption, v, `${where}.caption`), {
            x: 0.6, y: 5.0, w: 8.8, h: 0.4,
            fontSize: 11, color: COLORS.muted, align: "center"
          });
        }
        break;
      }
      default:
        throw new Error(`${where}: unknown block type "${b.type}" (supported: title, bullets, content, table, image)`);
    }
  }

  await pptx.writeFile({ fileName: outPath });
  return outPath;
}
