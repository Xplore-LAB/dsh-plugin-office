// lib/clean.js — subscription cleanup advisor for office_inbox_clean.
//
// Design contract (docs/MAIL-SCENARIOS.zh-CN.md §2.1 / §四):
//   * Output-only. This tool NEVER unsubscribes, deletes, moves, or sends
//     anything — silent bulk cleanup is on the permanent "do not do" list.
//   * It aggregates subscription-classified mail into a per-sender advice
//     list, ranked by frequency, with the List-Unsubscribe URL when the
//     sender provided one (fetched from the index metadata, no re-fetch).
//   * The agent presents the list; the human picks what to act on.

import { loadIndex, classifyMessage } from "./inbox.js";

const DAY = 86_400_000;

/**
 * Build the unsubscribe advice list from index entries.
 * `minCount` filters one-off bulk mail (a single newsletter a quarter is
 * rarely worth acting on); senders below the threshold are summarized in
 * `belowThreshold` counts only.
 */
export function cleanAdvice({ entries, minCount = 3, limit = 20, daysBack = 90 }) {
  const cutoff = Date.now() - Math.max(1, daysBack) * DAY;
  const senders = new Map();
  let totalSubscription = 0;
  for (const m of entries) {
    if (new Date(m.date ?? 0).getTime() < cutoff) continue;
    const verdict = classifyMessage(m);
    if (verdict.category !== "subscription") continue;
    totalSubscription++;
    const key = String(m.from?.address ?? "unknown").toLowerCase();
    const h = m.headers ?? {};
    const url = String(h.listUnsubscribeUrl ?? "").trim();
    const cur = senders.get(key) ?? {
      sender: key,
      domain: m.fromDomain ?? "",
      name: m.from?.name ?? "",
      count: 0,
      firstDate: m.date,
      lastDate: m.date,
      subjects: [],
      unsubscribeUrl: "",
      hasUnsubscribeHeader: false
    };
    cur.count++;
    if (m.date > cur.lastDate) cur.lastDate = m.date;
    if (m.date < cur.firstDate) cur.firstDate = m.date;
    if (cur.subjects.length < 3 && m.subject) cur.subjects.push(m.subject);
    if (url && !cur.unsubscribeUrl) cur.unsubscribeUrl = url;
    if (h.listUnsubscribe) cur.hasUnsubscribeHeader = true;
    senders.set(key, cur);
  }

  const all = [...senders.values()].sort((a, b) => b.count - a.count);
  const actionable = all.filter((s) => s.count >= minCount).slice(0, Math.max(1, limit));
  const belowThreshold = all.filter((s) => s.count < minCount);

  const perMonth = daysBack > 0 ? +(totalSubscription / (daysBack / 30)).toFixed(1) : 0;
  const items = actionable.map((s) => ({
    sender: s.sender,
    name: s.name,
    count: s.count,
    firstDate: s.firstDate,
    lastDate: s.lastDate,
    exampleSubjects: s.subjects,
    unsubscribe: s.unsubscribeUrl
      ? { available: true, url: s.unsubscribeUrl }
      : { available: false, url: "" },
    advice: s.unsubscribeUrl
      ? `High-frequency bulk sender (${s.count} in ${daysBack}d). List-Unsubscribe header present — open one of its mails, or use the header URL, to unsubscribe. The plugin will not send the request itself.`
      : `High-frequency bulk sender (${s.count} in ${daysBack}d) without a List-Unsubscribe header. Check the mail footer for an unsubscribe entry, or set a filter for this sender in the mailbox client.`
  }));

  return {
    windowDays: daysBack,
    totalSubscriptionMail: totalSubscription,
    distinctSenders: all.length,
    actionableSenders: items.length,
    estimatedMailPerMonth: perMonth,
    items,
    belowThresholdCount: belowThreshold.length,
    belowThresholdSenders: belowThreshold.map((s) => `${s.sender} (${s.count})`)
  };
}

/** Convenience: load the index and build advice in one call. */
export async function buildAdvice({ indexPath, minCount, limit, daysBack }) {
  const entries = await loadIndex(indexPath);
  return cleanAdvice({ entries, minCount, limit, daysBack });
}
