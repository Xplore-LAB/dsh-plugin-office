// lib/stats.js — local analytics over the shared JSONL data layer for
// office_stats_overview / office_stats_track.
//
// Design contract (docs/MAIL-SCENARIOS.zh-CN.md §2.3):
//   * Purely local: reads the receive index and the send audit log; zero
//     network requests. Open/click tracking is out of scope on purpose.
//   * The job ledger (求职台账) follows the triage philosophy: deterministic
//     keyword/domain detection produces candidate transitions with evidence;
//     company attribution for freemail senders is left to the agent, which
//     can merge/correct via manual update entries.
//   * Auto-detected transitions only ever move a company forward through
//     applied → written-test → interview → offer; anything else (rejected,
//     backtracking) requires an explicit manual update.

import fsp from "node:fs/promises";
import path from "node:path";
import { loadIndex, classifyMessage } from "./inbox.js";
import { FREEMAIL_DOMAINS } from "./archive.js";

const DAY = 86_400_000;

export const TRACK_STATUSES = ["applied", "written-test", "interview", "offer", "rejected"];
const STATUS_RANK = { applied: 1, "written-test": 2, interview: 3, offer: 4, rejected: 99 };

/** Signal keywords per status, checked against subject + snippet. */
const TRACK_SIGNALS = [
  { status: "offer", re: /\boffer\b|录用|录取|入职通知|三方协议/i },
  { status: "interview", re: /面试|interview/i },
  { status: "written-test", re: /笔试|测评|在线考试|written test|assessment/i },
  { status: "applied", re: /已收到(您的)?(简历|申请)|简历已投递|thank you for (your )?apply|application (has been )?received/i },
  { status: "rejected", re: /未通过|很遗憾|未进入|岗位已招满|not move forward|regret|position has been filled/i }
];

/** Known recruiting / notification sender shapes that carry a real company. */
function companyOf(entry) {
  const domain = String(entry.fromDomain ?? "").toLowerCase();
  if (!domain || FREEMAIL_DOMAINS.has(domain)) return null;
  const parts = domain.split(".");
  const core = parts.length >= 2 ? parts[parts.length - 2] : domain;
  return core || null;
}

async function readJsonl(file) {
  let text;
  try {
    text = await fsp.readFile(file, "utf8");
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch {
      // skip a corrupt line rather than fail the stats
    }
  }
  return out;
}

function monthKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Receive/send overview: totals, monthly trend, top senders and recipients,
 * subscription share — all within `monthsBack` months, all local.
 */
export async function statsOverview({ indexPath, sentLogPath, monthsBack = 6 }) {
  const windowMs = Math.max(1, monthsBack) * 31 * DAY;
  const cutoff = Date.now() - windowMs;
  const received = (await loadIndex(indexPath)).filter((m) => new Date(m.date ?? 0).getTime() >= cutoff);
  const sentAll = await readJsonl(sentLogPath);
  const sent = sentAll.filter((e) => new Date(e.ts ?? 0).getTime() >= cutoff);

  const byMonth = new Map();
  const bump = (key, field) => {
    if (!key) return;
    const cur = byMonth.get(key) ?? { month: key, received: 0, sent: 0, sendFailed: 0 };
    cur[field]++;
    byMonth.set(key, cur);
  };
  const senderCounts = new Map();
  const recipCounts = new Map();
  const categoryCounts = { todo: 0, notice: 0, subscription: 0, personal: 0 };

  for (const m of received) {
    bump(monthKey(m.date), "received");
    const addr = String(m.from?.address ?? "").toLowerCase();
    if (addr) {
      const cur = senderCounts.get(addr) ?? { from: addr, name: m.from?.name ?? "", count: 0, lastSubject: m.subject ?? "" };
      cur.count++;
      cur.lastSubject = m.subject ?? cur.lastSubject;
      senderCounts.set(addr, cur);
    }
    categoryCounts[classifyMessage(m).category]++;
  }
  for (const e of sent) {
    if (e.ok === true) bump(monthKey(e.ts), "sent");
    else bump(monthKey(e.ts), "sendFailed");
    const to = String(e.to ?? "").toLowerCase();
    if (to && e.ok === true) {
      const cur = recipCounts.get(to) ?? { to, count: 0, lastSubject: e.subject ?? "" };
      cur.count++;
      cur.lastSubject = e.subject ?? cur.lastSubject;
      recipCounts.set(to, cur);
    }
  }

  const top = (map, n) => [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);
  const months = [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  const subscriptionShare = received.length > 0 ? +(categoryCounts.subscription / received.length).toFixed(3) : 0;

  return {
    windowMonths: monthsBack,
    receivedCount: received.length,
    sentCount: sent.filter((e) => e.ok === true).length,
    sendFailedCount: sent.filter((e) => e.ok !== true).length,
    categoryCounts,
    subscriptionShare,
    byMonth: months,
    topSenders: top(senderCounts, 10),
    topRecipients: top(recipCounts, 10)
  };
}

/** Default ledger path: <office home>/mail/job-track.json. */
export function defaultLedgerPath(homeFn) {
  return path.join(homeFn(), "job-track.json");
}

/**
 * Detect job-track signals from index entries. Returns one candidate per
 * message (the strongest signal wins), with the company derived from the
 * sender domain when possible; freemail senders yield company=null and are
 * meant for the agent to attribute.
 */
export function detectTrackSignals(entries) {
  const out = [];
  for (const m of entries) {
    const verdict = classifyMessage(m);
    if (verdict.category !== "todo" && verdict.category !== "personal") continue;
    const text = `${m.subject ?? ""}\n${m.snippet ?? ""}`;
    let signal = null;
    for (const s of TRACK_SIGNALS) {
      if (s.re.test(text)) {
        signal = s;
        break;
      }
    }
    if (!signal) continue;
    out.push({
      company: companyOf(m),
      status: signal.status,
      date: m.date,
      messageId: m.messageId ?? `${m.mailbox ?? "INBOX"}#${m.uid}`,
      from: m.from?.address ?? "",
      subject: m.subject,
      evidence: `keyword signal for "${signal.status}" in subject/snippet`
    });
  }
  return out;
}

function ledgerEmpty() {
  return { companies: {}, updatedAt: null };
}

async function readLedger(file) {
  try {
    const obj = JSON.parse(await fsp.readFile(file, "utf8"));
    if (obj && typeof obj === "object" && obj.companies) return obj;
  } catch {
    // missing or corrupt -> fresh ledger
  }
  return ledgerEmpty();
}

async function writeLedger(file, ledger) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  ledger.updatedAt = new Date().toISOString();
  await fsp.writeFile(file, JSON.stringify(ledger, null, 2), "utf8");
  return ledger;
}

function applySignal(ledger, sig) {
  const key = sig.company;
  if (!key) return { attributed: false };
  const cur = ledger.companies[key] ?? {
    company: key,
    status: "applied",
    firstSeen: sig.date,
    lastSeen: sig.date,
    events: [],
    note: ""
  };
  const already = cur.events.some((e) => e.messageId === sig.messageId);
  if (!already) {
    cur.events.push({ date: sig.date, status: sig.status, messageId: sig.messageId, subject: sig.subject, source: "auto" });
  }
  // Forward-only auto progression: a later-stage signal upgrades the status;
  // rejected lands unless an offer is already recorded; nothing downgrades.
  if (sig.status === "rejected") {
    if (cur.status !== "offer") cur.status = "rejected";
  } else if (STATUS_RANK[sig.status] >= STATUS_RANK[cur.status]) {
    cur.status = sig.status;
  }
  cur.lastSeen = sig.date > cur.lastSeen ? sig.date : cur.lastSeen;
  cur.firstSeen = sig.date < cur.firstSeen ? sig.date : cur.firstSeen;
  ledger.companies[key] = cur;
  return { attributed: true, alreadySeen: already };
}

/**
 * Scan the index for job-application signals and merge them into the ledger
 * (auto transitions are forward-only). Unattributed signals (freemail
 * senders) are returned for the agent to review and merge via action=update.
 */
export async function scanLedger({ indexPath, ledgerPath }) {
  const ledger = await readLedger(ledgerPath);
  const entries = await loadIndex(indexPath);
  const signals = detectTrackSignals(entries);
  const unattributed = [];
  let merged = 0;
  for (const sig of signals) {
    if (!sig.company) {
      unattributed.push(sig);
      continue;
    }
    const res = applySignal(ledger, sig);
    if (!res.alreadySeen) merged++;
  }
  await writeLedger(ledgerPath, ledger);
  const companies = Object.values(ledger.companies).sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
  return {
    scanned: entries.length,
    signals: signals.length,
    merged,
    unattributed,
    companies,
    ledgerPath
  };
}

/** Read the ledger without touching it. */
export async function listLedger({ ledgerPath }) {
  const ledger = await readLedger(ledgerPath);
  const companies = Object.values(ledger.companies).sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
  return { companies, updatedAt: ledger.updatedAt, ledgerPath };
}

/**
 * Manual ledger update: create or correct a company entry. Unlike auto
 * signals this may set any status (including rejected or backtracking) and
 * survives future auto scans (auto never downgrades an explicit entry's
 * status unless it progresses forward).
 */
export async function updateLedger({ ledgerPath, company, status, note, date }) {
  if (!company) throw new Error("action=update requires company");
  if (status && !TRACK_STATUSES.includes(status)) {
    throw new Error(`status must be one of ${TRACK_STATUSES.join(", ")}`);
  }
  const ledger = await readLedger(ledgerPath);
  const key = String(company).trim().toLowerCase();
  const now = date ?? new Date().toISOString();
  const cur = ledger.companies[key] ?? { company: key, status: "applied", firstSeen: now, lastSeen: now, events: [], note: "" };
  if (status) {
    cur.status = status;
    cur.events.push({ date: now, status, messageId: null, subject: note ?? "manual update", source: "manual" });
  }
  if (note !== undefined) cur.note = note ?? "";
  cur.lastSeen = now;
  ledger.companies[key] = cur;
  await writeLedger(ledgerPath, ledger);
  return { company: cur.company, status: cur.status, note: cur.note, events: cur.events.length, ledgerPath };
}
