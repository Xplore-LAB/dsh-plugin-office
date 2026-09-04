// lib/inbox.js — read-only IMAP fetching and deterministic triage for
// office_inbox_fetch / office_inbox_triage.
//
// Design contract (docs/MAIL-SCENARIOS.zh-CN.md §2.1):
//   * IMAP is strictly read-only: bodies are fetched with BODY.PEEK (ImapFlow
//     never sets \Seen unless explicitly asked), no flag writes, no deletes.
//   * Credentials come from config imapPass or the env var named by
//     imapPassEnv (default DSH_IMAP_PASS) — never persisted by this plugin.
//   * Only metadata + a short text snippet is indexed locally (JSONL); full
//     bodies are fetched on demand and discarded. No full-text index.
//   * Triage is deterministic-rules-first (bulk headers, sender shape,
//     keywords) and emits evidence for every classification; semantic
//     refinement is the agent's job, not the plugin's.

import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import imapflowPkg from "imapflow";
import mailparserPkg from "mailparser";

const { ImapFlow } = imapflowPkg;
const { simpleParser } = mailparserPkg;

/** Provider presets: email domain → IMAP host (all implicit TLS on 993). */
const IMAP_PRESETS = {
  "qq.com": "imap.qq.com",
  "foxmail.com": "imap.qq.com",
  "163.com": "imap.163.com",
  "126.com": "imap.126.com",
  "gmail.com": "imap.gmail.com",
  "outlook.com": "outlook.office365.com",
  "hotmail.com": "outlook.office365.com",
  "live.com": "outlook.office365.com"
};

/**
 * Domains whose mail is bulk/notification by nature (code-hosting and
 * community digests). Kept deliberately small: a false "subscription" label
 * on a real service mail is costly, the no-reply local-part rule plus bulk
 * headers carry most of the weight.
 */
const BULK_DOMAINS = new Set([
  "github.com", "gitlab.com", "zhihu.com", "bilibili.com", "juejin.cn",
  "csdn.net", "substack.com", "mailchimp.com", "sendgrid.net",
  "list-manage.com", "medium.com", "feedly.com"
]);

/** No-reply-ish local parts: machine mail, not a person. */
const NOREPLY_LOCAL_RE = /^(no[-_.]?reply|donotreply|notifications?|mailer|newsletter|postmaster|system)/i;

/** Time-sensitive → the reader must act. */
const TODO_KEYWORDS = [
  "截止", "deadline", "ddl", "面试", "interview", "笔试", "offer",
  "录取", "请回复", "需回复", "务必", "限时", "rsvp", "确认参加",
  "缴费", "回执", "验证码", "verification code", "行动起来"
];

/** Informational → read and know, no action expected. */
const NOTICE_KEYWORDS = [
  "通知", "公告", "notice", "announcement", "安排", "提醒", "reminder",
  "须知", "讲座", "活动", "日程", "vacation", "维护", "停机"
];

const CATEGORIES = ["todo", "notice", "subscription", "personal"];

function domainOf(address) {
  return String(address ?? "").toLowerCase().split("@")[1] ?? "";
}

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"");
}

/**
 * Resolve IMAP connection settings: explicit config wins; otherwise the
 * host is derived from the configured user's email domain via the presets.
 * Throws with an actionable message when neither is possible.
 */
export function resolveImap(cfg) {
  const user = cfg.imapUser ?? "";
  const pass = cfg.imapPass || process.env[cfg.imapPassEnv ?? "DSH_IMAP_PASS"] || "";
  if (!user || !pass) {
    throw new Error(
      `IMAP is not configured: missing imapUser / imapPass (or env ${cfg.imapPassEnv ?? "DSH_IMAP_PASS"}). ` +
      "Note: QQ / 163 / 126 mailboxes need an IMAP authorization code (授权码), not the login password."
    );
  }
  let host = cfg.imapHost ?? "";
  if (!host) {
    const domain = domainOf(user);
    host = IMAP_PRESETS[domain] ?? "";
    if (!host) {
      throw new Error(
        `no IMAP preset for "${domain}"; set imapHost explicitly in the tool-office config ` +
        `(presets available: ${Object.keys(IMAP_PRESETS).join(", ")})`
      );
    }
  }
  return { host, port: cfg.imapPort || 993, secure: true, user, pass };
}

/**
 * Pull the newest `limit` messages newer than `daysBack` days from one
 * mailbox, over IMAP, read-only. Returns index-ready summaries; attachments
 * are listed but their content is discarded.
 */
export async function fetchInbox({ settings, mailbox = "INBOX", limit = 20, daysBack = 7, snippetChars = 300 }) {
  const client = new ImapFlow({
    ...settings,
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const since = new Date(Date.now() - Math.max(1, daysBack) * 86_400_000);
      let uids = await client.search({ since }, { uid: true });
      if (!uids || uids.length === 0) return [];
      uids = [...uids].sort((a, b) => a - b).slice(-Math.max(1, limit));
      const out = [];
      for (const uid of uids) {
        const raw = await client.fetchOne(
          uid,
          { uid: true, source: true, flags: true },
          { uid: true }
        );
        if (!raw || !raw.source) continue;
        const parsed = await simpleParser(raw.source);
        const fromEntry = parsed.from?.value?.[0] ?? {};
        const text = parsed.text && parsed.text.trim() !== ""
          ? parsed.text
          : stripHtml(parsed.html);
        const headers = parsed.headers ?? new Map();
        const get = (k) => {
          const v = headers.get(k);
          return v == null ? "" : String(v);
        };
        out.push({
          uid,
          mailbox,
          messageId: parsed.messageId ?? `${mailbox}#${uid}`,
          date: (parsed.date ?? new Date()).toISOString(),
          from: {
            address: fromEntry.address ?? "",
            name: fromEntry.name ?? ""
          },
          fromDomain: domainOf(fromEntry.address),
          subject: parsed.subject ?? "",
          snippet: text.replace(/\s+/g, " ").trim().slice(0, Math.max(50, snippetChars)),
          attachments: (parsed.attachments ?? []).map((a) => ({
            filename: a.filename ?? "unnamed",
            size: a.size ?? 0,
            contentType: a.contentType ?? ""
          })),
          headers: {
            listUnsubscribe: get("list-unsubscribe") !== "",
            listUnsubscribeUrl: get("list-unsubscribe").slice(0, 300),
            precedence: get("precedence"),
            autoSubmitted: get("auto-submitted"),
            listId: get("list-id")
          },
          seen: Boolean(raw.flags?.includes("\\Seen")),
          fetchedAt: new Date().toISOString()
        });
      }
      return out;
    } finally {
      lock.release();
    }
  } finally {
    await client.close();
    await client.logout?.().catch(() => {});
  }
}

/** Default index path: <office home>/mail/index.jsonl (shared with sent-log). */
export function defaultIndexPath() {
  const home = process.env.DSH_OFFICE_HOME ?? path.join(os.homedir(), ".dsh", "office");
  return path.join(home, "mail", "index.jsonl");
}

async function readIndexLines(file) {
  let text;
  try {
    text = await fsp.readFile(file, "utf8");
  } catch {
    return [];
  }
  const lines = [];
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      lines.push(JSON.parse(s));
    } catch {
      // skip a corrupt line rather than fail the whole index
    }
  }
  return lines;
}

/**
 * Append summaries to the JSONL index, skipping messages already indexed
 * (matched by messageId, falling back to mailbox#uid). Returns counts.
 */
export async function appendIndex(entries, file) {
  const existing = await readIndexLines(file);
  const seenKeys = new Set(existing.map((e) => e.messageId ?? `${e.mailbox}#${e.uid}`));
  const fresh = entries.filter((e) => {
    const key = e.messageId ?? `${e.mailbox}#${e.uid}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  if (fresh.length > 0) {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.appendFile(file, fresh.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  }
  return { appended: fresh.length, skippedDuplicates: entries.length - fresh.length };
}

/** Load the index, newest first. */
export async function loadIndex(file) {
  const lines = await readIndexLines(file);
  return lines.sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0));
}

/**
 * Deterministic triage of one indexed message. Two layers per the design:
 * bulk headers / sender shape first, then time-sensitive keywords, then
 * notice keywords; everything else is personal. Every verdict carries its
 * evidence so the agent can override it semantically.
 */
export function classifyMessage(m) {
  const rules = [];
  const h = m.headers ?? {};
  const subject = String(m.subject ?? "");
  const text = `${subject}\n${m.snippet ?? ""}`.toLowerCase();

  const bulkHeader = h.listUnsubscribe
    || /^(bulk|junk|list)$/i.test(h.precedence ?? "")
    || /^auto/i.test(h.autoSubmitted ?? "")
    || String(h.listId ?? "") !== "";
  const noReply = NOREPLY_LOCAL_RE.test(String(m.from?.address ?? "").split("@")[0] ?? "");
  const bulkDomain = BULK_DOMAINS.has(String(m.fromDomain ?? ""));
  if (bulkHeader) rules.push("bulk header (list-unsubscribe / precedence / auto-submitted / list-id)");
  if (noReply) rules.push(`no-reply sender local part (${m.from?.address})`);
  if (bulkDomain) rules.push(`known bulk domain (${m.fromDomain})`);
  if (rules.length > 0) return { category: "subscription", confidence: "high", rules };

  const todoHit = TODO_KEYWORDS.find((k) => text.includes(k));
  if (todoHit) {
    rules.push(`time-sensitive keyword: "${todoHit}"`);
    return { category: "todo", confidence: "high", rules };
  }

  // A reply inside a thread the user participated in is 1:1 mail, even from
  // an institutional domain (e.g. a professor's "Re: 论文修改意见").
  if (/^(re|回复|答复|fwd)/i.test(subject.trim())) {
    rules.push("reply / thread continuation");
    return { category: "personal", confidence: "medium", rules };
  }

  const noticeHit = NOTICE_KEYWORDS.find((k) => text.includes(k));
  const eduSender = String(m.fromDomain ?? "").endsWith(".edu.cn");
  if (noticeHit) rules.push(`notice keyword: "${noticeHit}"`);
  if (eduSender) rules.push("sender on .edu.cn");
  if (rules.length > 0) return { category: "notice", confidence: rules.length > 1 ? "high" : "medium", rules };

  return { category: "personal", confidence: "low", rules: ["no rule matched (default)"] };
}

/**
 * Triage a list of indexed messages: classify each, aggregate category
 * buckets, build the subscription-sender frequency table (groundwork for
 * the v1.5 clean-up advisor), and flag low-confidence items for semantic
 * review by the agent.
 */
export function triageMessages(messages) {
  const buckets = { todo: [], notice: [], subscription: [], personal: [] };
  const needsReview = [];
  const subSenders = new Map();
  for (const m of messages) {
    const verdict = classifyMessage(m);
    const item = {
      uid: m.uid,
      date: m.date,
      from: m.from?.address ?? "",
      fromName: m.from?.name ?? "",
      subject: m.subject,
      snippet: m.snippet,
      attachments: (m.attachments ?? []).map((a) => a.filename).filter(Boolean),
      seen: m.seen,
      category: verdict.category,
      confidence: verdict.confidence,
      evidence: verdict.rules
    };
    buckets[verdict.category].push(item);
    if (verdict.confidence !== "high") needsReview.push(item);
    if (verdict.category === "subscription") {
      const key = m.from?.address ?? "unknown";
      const cur = subSenders.get(key) ?? { from: key, domain: m.fromDomain, count: 0, lastSubject: "", lastDate: "" };
      cur.count++;
      cur.lastSubject = m.subject;
      cur.lastDate = m.date;
      subSenders.set(key, cur);
    }
  }
  return {
    counts: Object.fromEntries(CATEGORIES.map((c) => [c, buckets[c].length])),
    buckets,
    subscriptionSenders: [...subSenders.values()].sort((a, b) => b.count - a.count),
    needsReview
  };
}
