// lib/archive.js — local search + IMAP-backed export / attachment download
// for office_archive_search / office_archive_export / office_archive_attach.
//
// Design contract (docs/MAIL-SCENARIOS.zh-CN.md §2.2):
//   * Search is purely local over the JSONL index — zero network access.
//   * Export (.eml) and attach (attachment download) re-fetch message
//     sources over IMAP with BODY.PEEK — read-only, no flag writes, no
//     deletes. Sources are written to disk only when the user asked for an
//     export; attachments only into the user-specified directory.
//   * Filenames are sanitized and deduped; nothing overwrites silently.
//   * The full text of a message is never persisted into the index; export
//     is the explicit opt-in to writing a copy to disk.

import fsp from "node:fs/promises";
import path from "node:path";
import imapflowPkg from "imapflow";
import mailparserPkg from "mailparser";
import { loadIndex, defaultIndexPath, classifyMessage } from "./inbox.js";
import { sanitizeFilename } from "./docgen.js";

const { ImapFlow } = imapflowPkg;
const { simpleParser } = mailparserPkg;

const DAY = 86_400_000;

/** Free-mail domains: a company ledger cannot be keyed by these. */
export const FREEMAIL_DOMAINS = new Set([
  "qq.com", "foxmail.com", "163.com", "126.com", "sina.com", "sohu.com",
  "gmail.com", "outlook.com", "hotmail.com", "live.com", "icloud.com",
  "yahoo.com"
]);

/**
 * Filter index entries locally. All criteria are optional and combine with
 * AND semantics. `untilDays` bounds the old edge of the window (messages
 * older than untilDays days ago are excluded); `sinceDays` bounds the new
 * edge. Category re-derives the deterministic classification per entry.
 */
export function filterIndex(entries, f = {}) {
  const from = String(f.from ?? "").trim().toLowerCase();
  const subject = String(f.subject ?? "").trim().toLowerCase();
  const sinceMs = f.sinceDays ? Date.now() - Math.max(1, f.sinceDays) * DAY : null;
  const untilMs = f.untilDays ? Date.now() - Math.max(0, f.untilDays) * DAY : null;
  const wantAttach = f.hasAttachment === true;
  const wantNoAttach = f.hasAttachment === false;
  const category = f.category ?? "";
  const out = [];
  for (const m of entries) {
    if (from) {
      const hay = `${m.from?.address ?? ""} ${m.from?.name ?? ""} ${m.fromDomain ?? ""}`.toLowerCase();
      if (!hay.includes(from)) continue;
    }
    if (subject && !String(m.subject ?? "").toLowerCase().includes(subject)) continue;
    const t = new Date(m.date ?? 0).getTime();
    if (sinceMs != null && t < sinceMs) continue;
    if (untilMs != null && t > untilMs) continue;
    const hasAttach = Array.isArray(m.attachments) && m.attachments.length > 0;
    if (wantAttach && !hasAttach) continue;
    if (wantNoAttach && hasAttach) continue;
    if (category) {
      const verdict = classifyMessage(m);
      if (verdict.category !== category) continue;
    }
    out.push(m);
  }
  return out;
}

/** Local search over the index: filter + cap + attach classification info. */
export async function searchIndex({ indexPath, filters = {}, limit = 50 }) {
  const all = await loadIndex(indexPath ?? defaultIndexPath());
  const matched = filterIndex(all, filters);
  const capped = matched.slice(0, Math.max(1, limit));
  const items = capped.map((m) => {
    const verdict = classifyMessage(m);
    return {
      uid: m.uid,
      mailbox: m.mailbox,
      date: m.date,
      from: m.from?.address ?? "",
      fromName: m.from?.name ?? "",
      subject: m.subject,
      snippet: m.snippet,
      attachments: (m.attachments ?? []).map((a) => a.filename).filter(Boolean),
      category: verdict.category,
      evidence: verdict.rules
    };
  });
  return { totalInIndex: all.length, matched: matched.length, returned: items.length, items };
}

/** Build a unique .eml filename for an index entry (date + from + subject). */
export function emlFilename(entry, used) {
  const date = String(entry.date ?? "").slice(0, 10) || "unknown-date";
  const from = sanitizeFilename(String(entry.from?.address ?? "unknown").split("@")[0] || "unknown");
  const subject = sanitizeFilename(String(entry.subject ?? "no-subject")).slice(0, 40).replace(/_+$/g, "");
  let base = `${date}_${from}_${subject || "nosubject"}`;
  let name = `${base}.eml`;
  let n = 2;
  while (used.has(name)) {
    name = `${base}_${n}.eml`;
    n++;
  }
  used.add(name);
  return name;
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export matched entries to .eml files by re-fetching their sources over
 * IMAP (read-only, BODY.PEEK). Writes `<outputDir>/*.eml` plus an
 * `index.csv` summary. Returns the file list and per-message results.
 */
export async function exportArchive({ settings, entries, outputDir, maxMessages = 200 }) {
  if (entries.length > maxMessages) {
    entries = entries.slice(0, maxMessages);
  }
  await fsp.mkdir(outputDir, { recursive: true });
  const used = new Set();
  const client = new ImapFlow({
    ...settings,
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000
  });
  await client.connect();
  const files = [];
  const skipped = [];
  try {
    const byMailbox = new Map();
    for (const e of entries) {
      const mb = e.mailbox ?? "INBOX";
      if (!byMailbox.has(mb)) byMailbox.set(mb, []);
      byMailbox.get(mb).push(e);
    }
    for (const [mailbox, list] of byMailbox) {
      const lock = await client.getMailboxLock(mailbox);
      try {
        for (const e of list) {
          try {
            const raw = await client.fetchOne(e.uid, { uid: true, source: true }, { uid: true });
            if (!raw || !raw.source) {
              skipped.push({ uid: e.uid, subject: e.subject, reason: "not found on server (deleted or moved?)" });
              continue;
            }
            const name = emlFilename(e, used);
            const file = path.join(outputDir, name);
            await fsp.writeFile(file, raw.source);
            files.push({ uid: e.uid, date: e.date, from: e.from?.address ?? "", subject: e.subject, file, bytes: raw.source.length });
          } catch (err) {
            skipped.push({ uid: e.uid, subject: e.subject, reason: String(err?.message ?? err) });
          }
        }
      } finally {
        lock.release();
      }
    }
  } finally {
    await client.close();
    await client.logout?.().catch(() => {});
  }
  const indexFile = path.join(outputDir, "index.csv");
  const header = "date,from,subject,file,bytes";
  const lines = files.map((f) => [f.date, f.from, f.subject, f.file, f.bytes].map(csvEscape).join(","));
  await fsp.writeFile(indexFile, [header, ...lines].join("\n") + "\n", "utf8");
  return { exported: files.length, files, skipped, indexFile, capped: entries.length };
}

/**
 * Download attachments of matched entries into `outputDir` (IMAP read-only).
 * Filenames are sanitized and deduped within the run; oversized attachments
 * are skipped and reported, never silently dropped.
 */
export async function attachArchive({ settings, entries, outputDir, maxMessages = 200, maxAttachmentBytes = 25 * 1024 * 1024, extensions = null }) {
  if (entries.length > maxMessages) {
    entries = entries.slice(0, maxMessages);
  }
  await fsp.mkdir(outputDir, { recursive: true });
  const used = new Set();
  const client = new ImapFlow({
    ...settings,
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000
  });
  await client.connect();
  const saved = [];
  const skipped = [];
  try {
    const byMailbox = new Map();
    for (const e of entries) {
      const mb = e.mailbox ?? "INBOX";
      if (!byMailbox.has(mb)) byMailbox.set(mb, []);
      byMailbox.get(mb).push(e);
    }
    for (const [mailbox, list] of byMailbox) {
      const lock = await client.getMailboxLock(mailbox);
      try {
        for (const e of list) {
          let parsed;
          try {
            const raw = await client.fetchOne(e.uid, { uid: true, source: true }, { uid: true });
            if (!raw || !raw.source) {
              skipped.push({ uid: e.uid, subject: e.subject, reason: "not found on server" });
              continue;
            }
            parsed = await simpleParser(raw.source);
          } catch (err) {
            skipped.push({ uid: e.uid, subject: e.subject, reason: String(err?.message ?? err) });
            continue;
          }
          const atts = parsed.attachments ?? [];
          if (atts.length === 0) {
            skipped.push({ uid: e.uid, subject: e.subject, reason: "no attachments" });
            continue;
          }
          for (const a of atts) {
            const fname = a.filename ?? "unnamed";
            const ext = path.extname(fname).replace(".", "").toLowerCase();
            if (extensions && extensions.length > 0 && !extensions.includes(ext)) {
              skipped.push({ uid: e.uid, subject: e.subject, filename: fname, reason: `extension .${ext || "?"} not in requested set` });
              continue;
            }
            if ((a.size ?? 0) > maxAttachmentBytes) {
              skipped.push({ uid: e.uid, subject: e.subject, filename: fname, reason: `too large (${a.size} bytes > cap ${maxAttachmentBytes})` });
              continue;
            }
            const safe = sanitizeFilename(fname) || "unnamed";
            let name = safe;
            let n = 2;
            while (used.has(name)) {
              const p = path.parse(safe);
              name = `${p.name}_${n}${p.ext}`;
              n++;
            }
            used.add(name);
            const file = path.join(outputDir, name);
            await fsp.writeFile(file, a.content);
            saved.push({ uid: e.uid, from: e.from?.address ?? "", subject: e.subject, filename: name, bytes: a.content?.length ?? a.size ?? 0, file });
          }
        }
      } finally {
        lock.release();
      }
    }
  } finally {
    await client.close();
    await client.logout?.().catch(() => {});
  }
  return { savedCount: saved.length, saved, skipped, capped: entries.length };
}
