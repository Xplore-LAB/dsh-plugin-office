// @local/dsh-plugin-office
// Native Cordis plugin for DeepSeek Harness (DSH) — an AI office toolkit.
//
// Registers four model-facing tools:
//   office_mail_preview — render a mail-merge batch against a recipient table
//                         (CSV/JSON path or inline array), resolve per-recipient
//                         attachments, persist it, return a previewId.
//   office_mail_send    — execute a previously previewed batch. Two-phase by
//                         design: requires a fresh previewId and confirm:true.
//                         mode "draft" writes .eml files (no SMTP needed);
//                         mode "send" delivers over SMTP with pacing + audit.
//   office_docgen       — generate .docx documents from structured content
//                         blocks (heading/paragraph/lists/table/pageBreak) with
//                         {{field}} variables; supports batch mode (one file
//                         per data row) for report letters etc.
//   office_sheet        — spreadsheet pipeline over .csv/.xlsx: inspect
//                         (columns/stats/samples), filter, aggregate
//                         (groupBy + sum/avg/min/max/count), split by column,
//                         with output back to .csv or .xlsx.
//
// Security posture: sending email is an external, irreversible action. The
// plugin refuses to send anything that has not passed through a preview, caps
// recipient/batch sizes via config, throttles per-message pacing, enforces a
// rolling-24h send cap, optionally restricts recipients to an allowlist of
// domains, and logs every delivered message to ~/.dsh/office/mail/sent-log.jsonl.
// Untrusted, data-driven paths (attachment columns, image paths rendered from
// spreadsheet rows) are confined to workDir — no arbitrary-file exfiltration.
// Values rendered into mail headers are stripped of CR/LF (header injection).
// Document and spreadsheet tools write only into user-specified paths and
// refuse to overwrite existing files unless overwrite=true. See SECURITY.md.

import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
import { parseCsv, renderTemplate, looksLikeEmail } from "./render.js";
import { generateDocx, sanitizeFilename } from "./docgen.js";
import { generatePptx } from "./pptgen.js";
import { injectDocx } from "./docx-inject.js";
import {
  readTable, writeTable, inspectColumns, applyFilter, aggregateTable, splitTable
} from "./sheet.js";

const name = "tool-office";
const inject = ["tools"];

const Config = z.object({
  smtpHost: z.string().default("").description("SMTP host, e.g. smtp.qq.com. Required for mode send."),
  smtpPort: z.number().default(465).description("SMTP port (465 implicit TLS, 587 STARTTLS)."),
  smtpSecure: z.boolean().default(true).description("Use implicit TLS (true for port 465)."),
  smtpUser: z.string().default("").description("SMTP username (usually the full email address)."),
  smtpPass: z.string().default("").description("SMTP password or authorization code. Prefer smtpPassEnv."),
  smtpPassEnv: z.string().default("DSH_SMTP_PASS").description("Env var that holds the password; takes precedence when smtpPass is empty."),
  fromAddress: z.string().default("").description("Envelope From address."),
  fromName: z.string().default("").description("Display name for the From header."),
  replyTo: z.string().default("").description("Optional Reply-To address."),
  maxRecipients: z.number().default(50).description("Hard cap on mail-merge recipients per batch."),
  sendIntervalMs: z.number().default(1500).description("Minimum pacing between two SMTP deliveries."),
  dailySendCap: z.number().default(200).description("Hard cap on messages delivered per rolling 24h window (from the audit log). Anti-abuse / anti-blacklist guard."),
  allowDomains: z.array(z.string()).default([]).description("Optional recipient-domain allowlist, e.g. [\"qq.com\",\"163.com\",\"edu.cn\"]. When non-empty, addresses on other domains are blocked at preview time. Empty = no restriction."),
  previewTtlMinutes: z.number().default(60).description("A preview older than this must be regenerated before sending."),
  maxDocRows: z.number().default(100).description("Hard cap on rows in one office_docgen batch."),
  maxSheetRows: z.number().default(20000).description("Hard cap on rows read by office_sheet.")
});

const EMAIL_RE_DESCRIPTION = "one non-empty local part, one @, one domain with a dot";

function dataDir() {
  return path.join(os.homedir(), ".dsh", "office", "mail");
}

function previewsDir() {
  return path.join(dataDir(), "previews");
}

function auditLogPath() {
  return path.join(dataDir(), "sent-log.jsonl");
}

function resolvePass(cfg) {
  if (cfg.smtpPass) return cfg.smtpPass;
  return process.env[cfg.smtpPassEnv] ?? "";
}

function requireSmtp(cfg) {
  const problems = [];
  if (!cfg.smtpHost) problems.push("smtpHost");
  if (!cfg.smtpUser) problems.push("smtpUser");
  if (!resolvePass(cfg)) problems.push(`smtpPass (or env ${cfg.smtpPassEnv})`);
  if (!cfg.fromAddress) problems.push("fromAddress");
  if (problems.length > 0) {
    throw new Error(`SMTP is not configured: missing ${problems.join(", ")}. Fill the tool-office config in cordis.patch.yml or switch to mode "draft".`);
  }
}

function fromHeader(cfg) {
  return cfg.fromName ? `"${cfg.fromName.replace(/["\\]/g, "")}" <${cfg.fromAddress}>` : cfg.fromAddress;
}

/**
 * Strip CR/LF (and tabs) from a value destined for a mail header. Template
 * values come from untrusted spreadsheet cells; a newline in a subject or a
 * display name would allow header injection (e.g. forged Bcc lines).
 */
function sanitizeHeader(value) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ");
}

/**
 * True when `p` (absolute, or relative to `base`) resolves to `base` or
 * somewhere inside it. Data-driven paths (attachment columns, image paths
 * rendered from a CSV row) must never escape the working directory —
 * otherwise a crafted spreadsheet cell could exfiltrate ~/.ssh/id_rsa and
 * friends as a mail attachment.
 */
function isInsideDir(base, p) {
  const b = path.resolve(base);
  const q = path.resolve(b, p);
  return q === b || q.startsWith(b + path.sep);
}

/**
 * Count messages actually delivered (mode=send, ok=true) in the rolling
 * 24h window before now, from the append-only audit log. Feeds dailySendCap.
 */
async function countRecentSends() {
  let text;
  try {
    text = await fsp.readFile(auditLogPath(), "utf8");
  } catch {
    return 0;
  }
  const cutoff = Date.now() - 24 * 3600_000;
  let n = 0;
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      const e = JSON.parse(s);
      if (e.mode === "send" && e.ok === true && new Date(e.ts).getTime() >= cutoff) n++;
    } catch {
      // skip a corrupt line rather than fail the guard
    }
  }
  return n;
}

/**
 * Load recipient rows from inline array or CSV/JSON file, then render and
 * validate every row. Shared by the preview tool (which persists the result)
 * and kept separate from send (which only re-reads persisted previews).
 */
async function buildRows(args, cfg) {
  const base = args.workDir && String(args.workDir).trim() !== "" ? args.workDir : process.cwd();
  let raw;
  if (args.recipientsFile) {
    const abs = path.resolve(base, args.recipientsFile);
    let text;
    try {
      text = await fsp.readFile(abs, "utf8");
    } catch (err) {
      throw new Error(`cannot read recipientsFile ${abs}: ${err.message}`);
    }
    if (abs.endsWith(".json")) {
      try {
        raw = JSON.parse(text);
      } catch (err) {
        throw new Error(`invalid JSON in ${abs}: ${err.message}`);
      }
    } else {
      raw = parseCsv(text);
    }
  } else if (Array.isArray(args.recipients)) {
    raw = args.recipients;
  } else {
    throw new Error('provide exactly one of "recipients" (inline array of objects) or "recipientsFile" (.csv/.json path)');
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("recipient list is empty");
  }
  if (raw.length > cfg.maxRecipients) {
    throw new Error(`recipient count ${raw.length} exceeds the configured cap of ${cfg.maxRecipients}; raise config maxRecipients if this is intentional`);
  }

  const emailColumn = args.emailColumn ?? "email";
  const seenEmails = new Set();
  const rows = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] ?? {};
    const problems = [];
    if (typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`recipient #${i + 1} is not an object`);
    }
    const email = String(row[emailColumn] ?? "").trim();
    if (!email) problems.push(`row ${i + 1}: empty "${emailColumn}"`);
    else if (!looksLikeEmail(email)) problems.push(`row ${i + 1}: "${email}" does not look like an address (${EMAIL_RE_DESCRIPTION})`);
    else if (cfg.allowDomains.length > 0 && !cfg.allowDomains.some((d) => email.toLowerCase().endsWith(`@${d.toLowerCase()}`))) {
      problems.push(`row ${i + 1}: "${email}" is not on a configured allowDomains entry (${cfg.allowDomains.join(", ")})`);
    } else if (seenEmails.has(email.toLowerCase())) {
      problems.push(`row ${i + 1}: duplicate address "${email}" (an earlier row already uses it)`);
    } else {
      seenEmails.add(email.toLowerCase());
    }

    const subject = renderTemplate(args.subjectTemplate, row);
    const body = renderTemplate(args.bodyTemplate, row);
    for (const k of subject.missing) problems.push(`row ${i + 1}: subject references missing field {{${k}}}`);
    for (const k of body.missing) problems.push(`row ${i + 1}: body references missing field {{${k}}}`);

    const attachmentSpecs = [];
    for (const rel of args.attachments ?? []) {
      attachmentSpecs.push({ source: "global", rel });
    }
    if (args.attachmentColumn) {
      const cell = String(row[args.attachmentColumn] ?? "").trim();
      for (const rel of cell.split(";").map((x) => x.trim()).filter(Boolean)) {
        attachmentSpecs.push({ source: "row", rel });
      }
    }
    const attachments = [];
    for (const spec of attachmentSpecs) {
      const abs = path.resolve(base, spec.rel);
      if (!isInsideDir(base, abs)) {
        problems.push(`row ${i + 1}: ${spec.source} attachment escapes workDir: "${spec.rel}" (resolves to ${abs}); attachments must live inside workDir`);
        continue;
      }
      let st;
      try {
        st = await fsp.stat(abs);
      } catch {
        problems.push(`row ${i + 1}: ${spec.source} attachment not found: ${abs}`);
        continue;
      }
      if (!st.isFile()) {
        problems.push(`row ${i + 1}: ${spec.source} attachment is not a file: ${abs}`);
        continue;
      }
      attachments.push(abs);
    }

    const displayName = args.nameColumn ? sanitizeHeader(row[args.nameColumn]) : "";
    rows.push({
      index: i + 1,
      email,
      to: displayName ? `${displayName} <${email}>` : email,
      subject: sanitizeHeader(subject.text),
      body: body.text,
      attachments,
      problems
    });
  }
  return rows;
}

async function persistPreview(args, cfg, rows) {
  const id = `pm_${crypto.randomBytes(6).toString("hex")}`;
  const record = {
    id,
    createdAt: Date.now(),
    bodyIsHtml: args.bodyIsHtml === true,
    replyTo: cfg.replyTo || "",
    rows
  };
  await fsp.mkdir(previewsDir(), { recursive: true });
  await fsp.writeFile(path.join(previewsDir(), `${id}.json`), JSON.stringify(record, null, 2), "utf8");
  return record;
}

async function loadPreview(previewId, cfg) {
  if (!/^pm_[0-9a-f]+$/.test(String(previewId ?? ""))) {
    throw new Error("previewId must look like pm_<hex>; run office_mail_preview first");
  }
  let text;
  try {
    text = await fsp.readFile(path.join(previewsDir(), `${previewId}.json`), "utf8");
  } catch {
    throw new Error(`no such preview: ${previewId}. Run office_mail_preview first.`);
  }
  const record = JSON.parse(text);
  const ageMs = Date.now() - record.createdAt;
  if (ageMs > cfg.previewTtlMinutes * 60_000) {
    throw new Error(`preview ${previewId} is older than ${cfg.previewTtlMinutes} minutes; regenerate it with office_mail_preview`);
  }
  return record;
}

function previewSample(row) {
  return {
    row: row.index,
    to: row.to,
    subject: row.subject,
    bodyPreview: row.body.length > 1200 ? `${row.body.slice(0, 1200)}…[truncated]` : row.body,
    attachments: row.attachments.map((p) => path.basename(p))
  };
}

function buildMail(record, cfg, row) {
  const mail = {
    from: fromHeader(cfg),
    to: row.to,
    subject: row.subject
  };
  if (record.replyTo) mail.replyTo = record.replyTo;
  if (record.bodyIsHtml) mail.html = row.body;
  else mail.text = row.body;
  if (row.attachments.length > 0) {
    mail.attachments = row.attachments.map((p) => ({ path: p, filename: path.basename(p) }));
  }
  return mail;
}

async function appendAudit(entries) {
  await fsp.mkdir(dataDir(), { recursive: true });
  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fsp.appendFile(auditLogPath(), lines, "utf8");
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    }, { once: true });
  });
}

/** Load batch data rows for office_docgen: inline array or CSV/JSON file. */
async function loadDocRows(args, base) {
  if (args.dataFile) {
    const abs = path.resolve(base, args.dataFile);
    let text;
    try {
      text = await fsp.readFile(abs, "utf8");
    } catch (err) {
      throw new Error(`cannot read dataFile ${abs}: ${err.message}`);
    }
    if (abs.endsWith(".json")) return JSON.parse(text);
    return parseCsv(text);
  }
  if (Array.isArray(args.data)) return args.data;
  return null;
}

function applyFn(ctx, config) {
  const cfg = config;

  // ------------------------------------------------------------------ mail --
  ctx.tools.register(defineTool({
    name: "office_mail_preview",
    description:
      "Render a mail-merge batch WITHOUT sending: apply {{field}} placeholders in a subject/body template to every recipient row, resolve per-recipient attachments, and persist the result. Always call this first and show the user the rendered samples and problems; office_mail_send only accepts the previewId this tool returns. Recipients come from an inline array or a CSV/JSON file whose first row (or array items) are objects with an email column. Cells referenced by {{field}} must be non-empty on every row; rows that fail validation are listed as problems and block sending until the preview is regenerated.",
    parameters: {
      subjectTemplate: {
        type: "string",
        required: true,
        description: "Subject line template. Use {{column}} placeholders, e.g. \"{{month}} payroll notice for {{name}}\"."
      },
      bodyTemplate: {
        type: "string",
        required: true,
        description: "Body template. Plain text by default; set bodyIsHtml for HTML."
      },
      bodyIsHtml: {
        type: "boolean",
        description: "Treat bodyTemplate as HTML instead of plain text. Default false."
      },
      recipients: {
        type: "array",
        description: "Inline recipient rows (objects keyed by column name). Exactly one of recipients / recipientsFile.",
        items: { type: "object", additionalProperties: true }
      },
      recipientsFile: {
        type: "string",
        description: "Path to a .csv (header row) or .json (array of objects) recipient table. Relative paths resolve against workDir."
      },
      workDir: {
        type: "string",
        description: "Base directory for resolving recipientsFile and attachment paths. Prefer absolute paths."
      },
      emailColumn: {
        type: "string",
        description: "Column holding the recipient address. Default \"email\"."
      },
      nameColumn: {
        type: "string",
        description: "Optional column holding a display name (rendered as \"Name <addr>\")."
      },
      attachmentColumn: {
        type: "string",
        description: "Optional column whose cell holds one attachment path, or several separated by \";\". Paths resolve against workDir and MUST stay inside it (paths escaping workDir are blocked as row problems)."
      },
      attachments: {
        type: "array",
        description: "Global attachment paths attached to every recipient. Resolve against workDir and must stay inside it.",
        items: { type: "string" }
      },
      maxSamples: {
        type: "integer",
        description: "How many rendered samples to return in full (default 3, max 10)."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          previewId: { type: "string" },
          total: { type: "integer" },
          valid: { type: "integer" },
          invalid: { type: "integer" },
          samples: { type: "array", items: { type: "object", additionalProperties: true } },
          problems: { type: "array", items: { type: "string" } },
          expiresInMinutes: { type: "integer" }
        }
      },
      render: (_args, value) => [{
        type: "text",
        text: `Mail-merge preview ${value.previewId}: ${value.valid}/${value.total} rows valid${value.invalid > 0 ? `, ${value.invalid} blocked: ${value.problems.slice(0, 5).join("; ")}` : ""}. Show the samples to the user, then call office_mail_send with this previewId.`
      }]
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const rows = await buildRows(args, cfg);
      const record = await persistPreview(args, cfg, rows);
      const valid = rows.filter((r) => r.problems.length === 0);
      const invalid = rows.filter((r) => r.problems.length > 0);
      const maxSamples = Math.min(Math.max(args.maxSamples ?? 3, 0), 10);
      return {
        previewId: record.id,
        total: rows.length,
        valid: valid.length,
        invalid: invalid.length,
        samples: valid.slice(0, maxSamples).map(previewSample),
        problems: invalid.flatMap((r) => r.problems),
        expiresInMinutes: cfg.previewTtlMinutes
      };
    },
    presentCall: (args) => ({
      card: "generic",
      title: "Preview mail-merge batch",
      kind: "other",
      rawInput: {
        recipientsFile: args.recipientsFile,
        recipients: Array.isArray(args.recipients) ? `${args.recipients.length} inline rows` : undefined,
        attachmentColumn: args.attachmentColumn
      }
    })
  }));

  ctx.tools.register(defineTool({
    name: "office_mail_send",
    description:
      "Execute a mail-merge batch that was previously rendered by office_mail_preview. Sending email is irreversible, so the workflow is enforced: (1) call office_mail_preview, (2) show the user the rendered samples and get explicit approval, (3) call this tool with the same previewId and confirm=true. mode \"draft\" (default) writes .eml files without any SMTP configuration; mode \"send\" delivers over the configured SMTP account with pacing. A preview expires after the configured TTL and must be regenerated.",
    parameters: {
      previewId: {
        type: "string",
        required: true,
        description: "The previewId returned by office_mail_preview."
      },
      mode: {
        type: "string",
        description: "\"draft\" writes .eml files (default, safe); \"send\" delivers over SMTP.",
        enum: ["draft", "send"]
      },
      confirm: {
        type: "boolean",
        required: true,
        description: "Must be true. Set it only after showing the user the preview and receiving explicit approval."
      },
      draftDir: {
        type: "string",
        description: "Directory for .eml output in draft mode. Default ~/.dsh/office/mail/drafts/<previewId>."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          mode: { type: "string" },
          total: { type: "integer" },
          ok: { type: "integer" },
          failed: { type: "integer" },
          draftDir: { type: "string" },
          results: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                row: { type: "integer" },
                to: { type: "string" },
                ok: { type: "boolean" },
                messageId: { type: "string" },
                eml: { type: "string" },
                error: { type: "string" }
              }
            }
          }
        }
      },
      render: (_args, value) => [{
        type: "text",
        text: value.mode === "draft"
          ? `Mail-merge draft: ${value.ok}/${value.total} .eml files written to ${value.draftDir}.`
          : `Mail-merge send: ${value.ok}/${value.total} delivered, ${value.failed} failed.`
      }]
    },
    isConcurrencySafe: () => false,
    timeoutMs: 15 * 60_000,
    async execute(args, exec) {
      if (args.confirm !== true) {
        throw new Error("refusing to run: confirm must be true. Show the user the office_mail_preview samples and get explicit approval first.");
      }
      const mode = args.mode ?? "draft";
      const record = await loadPreview(args.previewId, cfg);
      const blocked = record.rows.filter((r) => r.problems.length > 0);
      if (blocked.length > 0) {
        const issues = blocked.flatMap((r) => r.problems).slice(0, 10);
        throw new Error(`preview contains ${blocked.length} invalid row(s); sending is blocked. Fix the data or template and re-run office_mail_preview. First issues: ${issues.join("; ")}`);
      }

      const results = [];
      const audit = [];

      if (mode === "draft") {
        const draftDir = args.draftDir && String(args.draftDir).trim() !== ""
          ? args.draftDir
          : path.join(dataDir(), "drafts", record.id);
        await fsp.mkdir(draftDir, { recursive: true });
        const renderTransport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
        for (const row of record.rows) {
          const info = await renderTransport.sendMail(buildMail(record, cfg, row));
          const file = path.join(draftDir, `row-${String(row.index).padStart(3, "0")}-${row.email.replace(/[^\w.-]/g, "_")}.eml`);
          await fsp.writeFile(file, info.message, "utf8");
          results.push({ row: row.index, to: row.to, ok: true, eml: file });
          audit.push({ ts: new Date().toISOString(), previewId: record.id, mode, to: row.email, subject: row.subject, ok: true, eml: file });
        }
        await appendAudit(audit);
        const ok = results.filter((r) => r.ok).length;
        return { mode, total: results.length, ok, failed: results.length - ok, draftDir, results };
      }

      requireSmtp(cfg);
      const recentSends = await countRecentSends();
      if (recentSends + record.rows.length > cfg.dailySendCap) {
        throw new Error(`daily send cap: ${recentSends} message(s) already delivered in the last 24h and this batch adds ${record.rows.length}, exceeding the configured cap of ${cfg.dailySendCap}. Wait for the window to slide, or raise config dailySendCap deliberately.`);
      }
      const transport = nodemailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpSecure,
        auth: { user: cfg.smtpUser, pass: resolvePass(cfg) },
        connectionTimeout: 20_000,
        greetingTimeout: 15_000,
        socketTimeout: 60_000
      });
      for (let i = 0; i < record.rows.length; i++) {
        if (exec.signal?.aborted) {
          throw new Error(`aborted by the caller after ${i}/${record.rows.length} messages; the audit log records what already went out`);
        }
        const row = record.rows[i];
        if (i > 0) await sleep(cfg.sendIntervalMs, exec.signal);
        let entry;
        try {
          const info = await transport.sendMail(buildMail(record, cfg, row));
          entry = { row: row.index, to: row.to, ok: true, messageId: info.messageId };
          audit.push({ ts: new Date().toISOString(), previewId: record.id, mode, to: row.email, subject: row.subject, ok: true, messageId: info.messageId });
        } catch (err) {
          entry = { row: row.index, to: row.to, ok: false, error: String(err?.message ?? err) };
          audit.push({ ts: new Date().toISOString(), previewId: record.id, mode, to: row.email, subject: row.subject, ok: false, error: String(err?.message ?? err) });
        }
        results.push(entry);
      }
      transport.close();
      await appendAudit(audit);
      const ok = results.filter((r) => r.ok).length;
      return { mode, total: results.length, ok, failed: results.length - ok, results };
    },
    presentCall: (args) => ({
      card: "generic",
      title: args.mode === "send" ? "Send mail-merge batch" : "Write mail-merge drafts",
      kind: "other",
      rawInput: { previewId: args.previewId, mode: args.mode ?? "draft", confirm: args.confirm }
    })
  }));

  // ---------------------------------------------------------------- docgen --
  ctx.tools.register(defineTool({
    name: "office_docgen",
    description:
      "Generate Word (.docx) documents from structured content blocks with {{field}} variable rendering — the fastest way to turn a plan, a report outline, or per-person records into a real Word file. Blocks: heading (level 1-4), paragraph, bulletList, numberList, table (header + rows), pageBreak. Single mode: pass outputPath and optional variables. Batch mode: pass data/dataFile (CSV/JSON rows) plus outputDir and filenameTemplate to render one document per row (row fields are available as {{field}} alongside variables). All referenced fields must be non-empty, or the whole call fails with a precise error. Existing files are never overwritten unless overwrite=true.",
    parameters: {
      content: {
        type: "array",
        required: true,
        description: "Content blocks, in order. Each block: {type:\"heading\",level,text} | {type:\"paragraph\",text} | {type:\"bulletList\"|\"numberList\",items:[string]} | {type:\"table\",header:[string],rows:[[string]]} | {type:\"pageBreak\"}. Every text surface supports {{field}}.",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            type: { type: "string", enum: ["heading", "paragraph", "bulletList", "numberList", "table", "pageBreak"] },
            level: { type: "integer", description: "Heading level 1-4 (heading only)." },
            text: { type: "string" },
            items: { type: "array", items: { type: "string" } },
            header: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: "string" } } }
          }
        }
      },
      variables: {
        type: "object",
        additionalProperties: true,
        description: "Global variables available as {{field}} in every block."
      },
      outputPath: {
        type: "string",
        description: "Single mode: output .docx path (relative to workDir)."
      },
      dataFile: {
        type: "string",
        description: "Batch mode: .csv/.json file with one object per document (fields become {{field}} variables)."
      },
      data: {
        type: "array",
        description: "Batch mode: inline rows instead of dataFile.",
        items: { type: "object", additionalProperties: true }
      },
      outputDir: {
        type: "string",
        description: "Batch mode: directory for the generated files (relative to workDir)."
      },
      filenameTemplate: {
        type: "string",
        description: "Batch mode: per-file name template, e.g. \"offer_letter_{{name}}.docx\"."
      },
      workDir: {
        type: "string",
        description: "Base directory for resolving paths. Prefer absolute paths."
      },
      overwrite: {
        type: "boolean",
        description: "Allow overwriting existing files. Default false."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          mode: { type: "string" },
          files: { type: "array", items: { type: "string" } },
          count: { type: "integer" },
          outputDir: { type: "string" }
        }
      },
      render: (_args, value) => [{
        type: "text",
        text: `Generated ${value.count} .docx file(s): ${value.files.slice(0, 5).join(", ")}${value.count > 5 ? " …" : ""}.`
      }]
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const base = args.workDir && String(args.workDir).trim() !== "" ? args.workDir : process.cwd();
      const rows = await loadDocRows(args, base);
      const batch = rows !== null;
      if (batch) {
        if (!Array.isArray(rows) || rows.length === 0) throw new Error("batch data is empty");
        if (rows.length > cfg.maxDocRows) {
          throw new Error(`batch size ${rows.length} exceeds the configured cap of ${cfg.maxDocRows}; raise config maxDocRows if this is intentional`);
        }
        if (!args.outputDir || !args.filenameTemplate) {
          throw new Error('batch mode requires outputDir and filenameTemplate (e.g. "report_{{name}}.docx")');
        }
        const dir = path.resolve(base, args.outputDir);
        await fsp.mkdir(dir, { recursive: true });
        const files = [];
        for (let i = 0; i < rows.length; i++) {
          const vars = { ...(args.variables ?? {}), ...rows[i] };
          const nameRender = renderTemplate(args.filenameTemplate, rows[i]);
          if (nameRender.missing.length > 0) {
            throw new Error(`row ${i + 1}: filenameTemplate references missing field(s) ${nameRender.missing.map((k) => `{{${k}}}`).join(", ")}`);
          }
          const file = path.join(dir, sanitizeFilename(nameRender.text));
          if (!args.overwrite) {
            try {
              await fsp.access(file);
              throw new Error(`${file} already exists; pass overwrite=true to replace it`);
            } catch (err) {
              if (err.code !== "ENOENT") throw err;
            }
          }
          await generateDocx({ blocks: args.content, vars, outPath: file });
          files.push(file);
        }
        return { mode: "batch", count: files.length, files, outputDir: dir };
      }
      if (!args.outputPath) throw new Error('single mode requires outputPath (or use batch mode with data/dataFile + outputDir + filenameTemplate)');
      const file = path.resolve(base, args.outputPath);
      if (!file.toLowerCase().endsWith(".docx")) throw new Error("outputPath must end with .docx");
      if (!args.overwrite) {
        try {
          await fsp.access(file);
          throw new Error(`${file} already exists; pass overwrite=true to replace it`);
        } catch (err) {
          if (err.code !== "ENOENT") throw err;
        }
      }
      await fsp.mkdir(path.dirname(file), { recursive: true });
      await generateDocx({ blocks: args.content, vars: args.variables ?? {}, outPath: file });
      return { mode: "single", count: 1, files: [file], outputDir: path.dirname(file) };
    },
    presentCall: (args) => ({
      card: "generic",
      title: "Generate Word document(s)",
      kind: "other",
      rawInput: {
        blocks: Array.isArray(args.content) ? `${args.content.length} blocks` : undefined,
        batch: Boolean(args.data || args.dataFile),
        outputPath: args.outputPath ?? args.outputDir
      }
    })
  }));

  // ------------------------------------------------------------------ pptx --
  ctx.tools.register(defineTool({
    name: "office_pptx",
    description:
      "Generate PowerPoint (.pptx) decks from structured slide blocks with {{field}} variable rendering. Blocks: title (title + subtitle, a section/title slide), bullets (title + bullet items), content (title + paragraph), table (title + header + rows), image (title + imagePath + caption; local file path, must stay inside workDir). Single mode: pass outputPath and optional variables. Batch mode: pass data/dataFile (CSV/JSON rows) plus outputDir and filenameTemplate to render one deck per row. All referenced fields must be non-empty, or the whole call fails. Existing files are never overwritten unless overwrite=true.",
    parameters: {
      content: {
        type: "array",
        required: true,
        description: "Slide blocks, in order. Each block: {type:\"title\",title,subtitle} | {type:\"bullets\",title,items:[string]} | {type:\"content\",title,text} | {type:\"table\",title,header:[string],rows:[[string]]} | {type:\"image\",title,imagePath,caption}. Every text surface supports {{field}}.",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            type: { type: "string", enum: ["title", "bullets", "content", "table", "image"] },
            title: { type: "string" },
            subtitle: { type: "string" },
            text: { type: "string" },
            items: { type: "array", items: { type: "string" } },
            header: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: "string" } } },
            imagePath: { type: "string" },
            caption: { type: "string" }
          }
        }
      },
      variables: {
        type: "object",
        additionalProperties: true,
        description: "Global variables available as {{field}} in every block."
      },
      outputPath: {
        type: "string",
        description: "Single mode: output .pptx path (relative to workDir)."
      },
      dataFile: {
        type: "string",
        description: "Batch mode: .csv/.json file with one object per deck (fields become {{field}} variables)."
      },
      data: {
        type: "array",
        description: "Batch mode: inline rows instead of dataFile.",
        items: { type: "object", additionalProperties: true }
      },
      outputDir: {
        type: "string",
        description: "Batch mode: directory for the generated files (relative to workDir)."
      },
      filenameTemplate: {
        type: "string",
        description: "Batch mode: per-file name template, e.g. \"summary_{{name}}.pptx\"."
      },
      workDir: {
        type: "string",
        description: "Base directory for resolving paths. Prefer absolute paths."
      },
      overwrite: {
        type: "boolean",
        description: "Allow overwriting existing files. Default false."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          mode: { type: "string" },
          files: { type: "array", items: { type: "string" } },
          count: { type: "integer" },
          outputDir: { type: "string" }
        }
      },
      render: (_args, value) => [{
        type: "text",
        text: `Generated ${value.count} .pptx deck(s): ${value.files.slice(0, 5).join(", ")}${value.count > 5 ? " …" : ""}.`
      }]
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const base = args.workDir && String(args.workDir).trim() !== "" ? args.workDir : process.cwd();
      const rows = await loadDocRows(args, base);
      const batch = rows !== null;
      if (batch) {
        if (!Array.isArray(rows) || rows.length === 0) throw new Error("batch data is empty");
        if (rows.length > cfg.maxDocRows) {
          throw new Error(`batch size ${rows.length} exceeds the configured cap of ${cfg.maxDocRows}; raise config maxDocRows if this is intentional`);
        }
        if (!args.outputDir || !args.filenameTemplate) {
          throw new Error('batch mode requires outputDir and filenameTemplate (e.g. "summary_{{name}}.pptx")');
        }
        const dir = path.resolve(base, args.outputDir);
        await fsp.mkdir(dir, { recursive: true });
        const files = [];
        for (let i = 0; i < rows.length; i++) {
          const vars = { ...(args.variables ?? {}), ...rows[i] };
          const nameRender = renderTemplate(args.filenameTemplate, rows[i]);
          if (nameRender.missing.length > 0) {
            throw new Error(`row ${i + 1}: filenameTemplate references missing field(s) ${nameRender.missing.map((k) => `{{${k}}}`).join(", ")}`);
          }
          const file = path.join(dir, sanitizeFilename(nameRender.text));
          if (!args.overwrite) {
            try {
              await fsp.access(file);
              throw new Error(`${file} already exists; pass overwrite=true to replace it`);
            } catch (err) {
              if (err.code !== "ENOENT") throw err;
            }
          }
          await generatePptx({ blocks: args.content, vars, outPath: file, baseDir: base });
          files.push(file);
        }
        return { mode: "batch", count: files.length, files, outputDir: dir };
      }
      if (!args.outputPath) throw new Error('single mode requires outputPath (or use batch mode with data/dataFile + outputDir + filenameTemplate)');
      const file = path.resolve(base, args.outputPath);
      if (!file.toLowerCase().endsWith(".pptx")) throw new Error("outputPath must end with .pptx");
      if (!args.overwrite) {
        try {
          await fsp.access(file);
          throw new Error(`${file} already exists; pass overwrite=true to replace it`);
        } catch (err) {
          if (err.code !== "ENOENT") throw err;
        }
      }
      await fsp.mkdir(path.dirname(file), { recursive: true });
      await generatePptx({ blocks: args.content, vars: args.variables ?? {}, outPath: file, baseDir: base });
      return { mode: "single", count: 1, files: [file], outputDir: path.dirname(file) };
    },
    presentCall: (args) => ({
      card: "generic",
      title: "Generate PowerPoint deck(s)",
      kind: "other",
      rawInput: {
        slides: Array.isArray(args.content) ? `${args.content.length} slides` : undefined,
        batch: Boolean(args.data || args.dataFile),
        outputPath: args.outputPath ?? args.outputDir
      }
    })
  }));

  // ------------------------------------------------------------- template --
  ctx.tools.register(defineTool({
    name: "office_template",
    description:
      "Fill an existing .docx template: replace every {{field}} placeholder in the template body with provided values, handling placeholders that Word split across formatting runs. Every placeholder found in the template MUST be provided or the call fails (no half-rendered documents). Single mode: pass outputPath and variables. Batch mode: pass data/dataFile (CSV/JSON rows) plus outputDir and filenameTemplate to render one document per row (row fields merge with variables). Note: placeholders inside headers/footers are not processed in this version.",
    parameters: {
      templateFile: {
        type: "string",
        required: true,
        description: "Path to the .docx template (relative to workDir). Create it in Word by typing {{name}} in one go."
      },
      variables: {
        type: "object",
        additionalProperties: true,
        description: "Values for the template placeholders, single mode."
      },
      dataFile: {
        type: "string",
        description: "Batch mode: .csv/.json file with one object per document (fields become {{field}} values)."
      },
      data: {
        type: "array",
        description: "Batch mode: inline rows instead of dataFile.",
        items: { type: "object", additionalProperties: true }
      },
      outputPath: {
        type: "string",
        description: "Single mode: output .docx path (relative to workDir)."
      },
      outputDir: {
        type: "string",
        description: "Batch mode: directory for the generated files (relative to workDir)."
      },
      filenameTemplate: {
        type: "string",
        description: "Batch mode: per-file name template, e.g. \"contract_{{name}}.docx\"."
      },
      workDir: {
        type: "string",
        description: "Base directory for resolving paths. Prefer absolute paths."
      },
      overwrite: {
        type: "boolean",
        description: "Allow overwriting existing files. Default false."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          mode: { type: "string" },
          files: { type: "array", items: { type: "string" } },
          count: { type: "integer" },
          tokens: { type: "array", items: { type: "string" } },
          outputDir: { type: "string" }
        }
      },
      render: (_args, value) => [{
        type: "text",
        text: `Filled ${value.count} document(s) from template (${value.tokens.length} placeholder(s) each): ${value.files.slice(0, 5).join(", ")}${value.count > 5 ? " …" : ""}.`
      }]
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const base = args.workDir && String(args.workDir).trim() !== "" ? args.workDir : process.cwd();
      const templatePath = path.resolve(base, args.templateFile);
      try {
        await fsp.access(templatePath);
      } catch {
        throw new Error(`templateFile not found: ${templatePath}`);
      }
      const rows = await loadDocRows(args, base);
      const batch = rows !== null;
      const guard = async (file) => {
        if (!args.overwrite) {
          try {
            await fsp.access(file);
            throw new Error(`${file} already exists; pass overwrite=true to replace it`);
          } catch (err) {
            if (err.code !== "ENOENT") throw err;
          }
        }
      };

      if (batch) {
        if (!Array.isArray(rows) || rows.length === 0) throw new Error("batch data is empty");
        if (rows.length > cfg.maxDocRows) {
          throw new Error(`batch size ${rows.length} exceeds the configured cap of ${cfg.maxDocRows}; raise config maxDocRows if this is intentional`);
        }
        if (!args.outputDir || !args.filenameTemplate) {
          throw new Error('batch mode requires outputDir and filenameTemplate (e.g. "contract_{{name}}.docx")');
        }
        const dir = path.resolve(base, args.outputDir);
        await fsp.mkdir(dir, { recursive: true });
        const files = [];
        let tokens = [];
        for (let i = 0; i < rows.length; i++) {
          const vars = { ...(args.variables ?? {}), ...rows[i] };
          const nameRender = renderTemplate(args.filenameTemplate, rows[i]);
          if (nameRender.missing.length > 0) {
            throw new Error(`row ${i + 1}: filenameTemplate references missing field(s) ${nameRender.missing.map((k) => `{{${k}}}`).join(", ")}`);
          }
          const file = path.join(dir, sanitizeFilename(nameRender.text));
          await guard(file);
          const res = await injectDocx({ templatePath, outPath: file, vars });
          tokens = res.tokens;
          files.push(file);
        }
        return { mode: "batch", count: files.length, files, tokens, outputDir: dir };
      }

      if (!args.outputPath) throw new Error('single mode requires outputPath (or use batch mode with data/dataFile + outputDir + filenameTemplate)');
      const file = path.resolve(base, args.outputPath);
      if (!file.toLowerCase().endsWith(".docx")) throw new Error("outputPath must end with .docx");
      await guard(file);
      await fsp.mkdir(path.dirname(file), { recursive: true });
      const res = await injectDocx({ templatePath, outPath: file, vars: args.variables ?? {} });
      return { mode: "single", count: 1, files: [file], tokens: res.tokens, outputDir: path.dirname(file) };
    },
    presentCall: (args) => ({
      card: "generic",
      title: "Fill .docx template",
      kind: "other",
      rawInput: {
        templateFile: args.templateFile,
        batch: Boolean(args.data || args.dataFile),
        outputPath: args.outputPath ?? args.outputDir
      }
    })
  }));

  // ----------------------------------------------------------------- sheet --
  ctx.tools.register(defineTool({
    name: "office_sheet",
    description:
      "Spreadsheet pipeline for .csv and .xlsx files. Always inspect first to learn the columns and row count, then filter / aggregate / split. Actions: \"inspect\" (columns with fill ratio, inferred type, sample rows); \"filter\" (one predicate: column + op eq/ne/gt/gte/lt/lte/contains/notContains/empty/notEmpty + value, matched rows optionally written to outputPath); \"aggregate\" (groupBy columns + metrics sum/avg/min/max/count); \"split\" (one file per distinct value of a column, named <outputPrefix>_<value>.<ext>). Outputs are .csv or .xlsx depending on the outputPath extension. Without outputPath, filter/aggregate return row counts and samples only.",
    parameters: {
      file: {
        type: "string",
        required: true,
        description: "Input .csv or .xlsx path (relative to workDir)."
      },
      workDir: {
        type: "string",
        description: "Base directory for resolving file and output paths. Prefer absolute paths."
      },
      action: {
        type: "string",
        required: true,
        description: "One of inspect, filter, aggregate, split.",
        enum: ["inspect", "filter", "aggregate", "split"]
      },
      filter: {
        type: "object",
        additionalProperties: false,
        description: "Required for action=filter.",
        properties: {
          column: { type: "string" },
          op: { type: "string", enum: ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "notContains", "empty", "notEmpty"] },
          value: { type: "string", description: "Comparison value; numeric for gt/gte/lt/lte." }
        }
      },
      aggregate: {
        type: "object",
        additionalProperties: false,
        description: "Required for action=aggregate.",
        properties: {
          groupBy: { type: "array", items: { type: "string" } },
          metrics: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                column: { type: "string", description: "Metric column; omit for fn=count." },
                fn: { type: "string", enum: ["sum", "avg", "min", "max", "count"] }
              }
            }
          }
        }
      },
      splitBy: {
        type: "string",
        description: "Required for action=split: the column whose distinct values become files."
      },
      outputPath: {
        type: "string",
        description: "filter/aggregate output path (.csv/.xlsx by extension). Omit to preview only."
      },
      outputPrefix: {
        type: "string",
        description: "split mode base path without extension, e.g. out/region → out/region_<value>.csv (extension follows the input file)."
      },
      sampleRows: {
        type: "integer",
        description: "Sample rows to return (default 5, max 20)."
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {}
      },
      render: (_args, value) => [{
        type: "text",
        text: value.summary ?? "Spreadsheet operation done."
      }]
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const base = args.workDir && String(args.workDir).trim() !== "" ? args.workDir : process.cwd();
      const abs = path.resolve(base, args.file);
      let rows;
      try {
        rows = await readTable(abs);
      } catch (err) {
        throw new Error(`cannot read ${abs}: ${err.message}`);
      }
      if (rows.length > cfg.maxSheetRows) {
        throw new Error(`row count ${rows.length} exceeds the configured cap of ${cfg.maxSheetRows}; raise config maxSheetRows if this is intentional`);
      }
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const maxSamples = Math.min(Math.max(args.sampleRows ?? 5, 0), 20);
      const sample = (list) => list.slice(0, maxSamples);

      if (args.action === "inspect") {
        const stats = inspectColumns(columns, rows);
        return {
          summary: `${path.basename(abs)}: ${rows.length} rows, ${columns.length} columns (${stats.filter((c) => c.inferredType === "numeric").length} numeric).`,
          file: abs,
          rowCount: rows.length,
          columns: stats,
          sampleRows: sample(rows)
        };
      }

      if (args.action === "filter") {
        if (!args.filter || !args.filter.column || !args.filter.op) {
          throw new Error("action=filter requires filter: {column, op, value?}");
        }
        if (rows.length > 0 && !columns.includes(args.filter.column)) {
          throw new Error(`filter.column "${args.filter.column}" not found; columns are: ${columns.join(", ")}`);
        }
        const { keep, skipped } = applyFilter(rows, args.filter);
        let outputPath = null;
        if (args.outputPath) {
          outputPath = path.resolve(base, args.outputPath);
          await fsp.mkdir(path.dirname(outputPath), { recursive: true });
          await writeTable(outputPath, columns, keep);
        }
        return {
          summary: `Filter ${args.filter.column} ${args.filter.op} ${args.filter.value ?? ""}: ${keep.length}/${rows.length} rows matched${skipped > 0 ? `, ${skipped} skipped (non-numeric)` : ""}${outputPath ? ` → ${outputPath}` : " (preview only)"}.`,
          matched: keep.length,
          total: rows.length,
          skipped,
          outputPath,
          sampleRows: sample(keep)
        };
      }

      if (args.action === "aggregate") {
        if (!args.aggregate) throw new Error("action=aggregate requires aggregate: {groupBy, metrics}");
        for (const c of args.aggregate.groupBy ?? []) {
          if (rows.length > 0 && !columns.includes(c)) {
            throw new Error(`aggregate.groupBy column "${c}" not found; columns are: ${columns.join(", ")}`);
          }
        }
        const { header, rows: out, skipped } = aggregateTable(rows, args.aggregate);
        let outputPath = null;
        if (args.outputPath) {
          outputPath = path.resolve(base, args.outputPath);
          await fsp.mkdir(path.dirname(outputPath), { recursive: true });
          await writeTable(outputPath, header, out);
        }
        return {
          summary: `Aggregate by ${args.aggregate.groupBy.join(", ")}: ${out.length} group(s)${skipped > 0 ? `, ${skipped} non-numeric value(s) skipped` : ""}${outputPath ? ` → ${outputPath}` : " (preview only)"}.`,
          groups: out.length,
          skipped,
          outputPath,
          rows: out
        };
      }

      if (args.action === "split") {
        if (!args.splitBy) throw new Error("action=split requires splitBy (a column name)");
        if (rows.length > 0 && !columns.includes(args.splitBy)) {
          throw new Error(`splitBy column "${args.splitBy}" not found; columns are: ${columns.join(", ")}`);
        }
        if (!args.outputPrefix) throw new Error("action=split requires outputPrefix, e.g. out/region");
        const groups = splitTable(rows, args.splitBy);
        const ext = abs.toLowerCase().endsWith(".xlsx") ? ".xlsx" : ".csv";
        const prefix = path.resolve(base, args.outputPrefix);
        await fsp.mkdir(path.dirname(prefix), { recursive: true });
        const files = [];
        for (const g of groups) {
          const file = `${prefix}_${sanitizeFilename(g.value)}${ext}`;
          await writeTable(file, columns, g.rows);
          files.push({ value: g.value, rows: g.rows.length, file });
        }
        return {
          summary: `Split by ${args.splitBy}: ${files.length} file(s) under ${path.dirname(prefix)}.`,
          files
        };
      }

      throw new Error(`unknown action "${args.action}"`);
    },
    presentCall: (args) => ({
      card: "generic",
      title: `Spreadsheet ${args.action ?? ""}`.trim(),
      kind: "other",
      rawInput: { file: args.file, action: args.action }
    })
  }));
}

export { Config, applyFn as apply, inject, name };
