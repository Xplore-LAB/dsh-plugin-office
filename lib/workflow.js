// Local, deterministic workflow intelligence for daily briefs, action radar,
// and context-aware reply preparation. The functions operate only on the
// metadata/snippets already stored by office_inbox_fetch.

import { classifyMessage } from "./inbox.js";

const ACTION_PATTERNS = [
  { type: "reply", label: "回复确认", re: /请.{0,6}回复|需.{0,6}回复|回复确认|回执|rsvp|please reply|confirm(?:ation)?/i },
  { type: "submit", label: "提交材料", re: /提交|报送|上传|递交|submit|upload|send us/i },
  { type: "review", label: "审阅修改", re: /审阅|审核|修改|批注|反馈|review|revise|feedback/i },
  { type: "attend", label: "参加安排", re: /参加|出席|会议|答辩|面试|笔试|interview|meeting|defen[cs]e/i },
  { type: "pay", label: "完成缴费", re: /缴费|付款|支付|报销|payment|invoice/i },
  { type: "complete", label: "完成事项", re: /截止|务必|完成|办理|deadline|due\b|action required/i }
];

const URGENCY_PATTERNS = [
  { score: 30, label: "明确要求立即处理", re: /立即|尽快|紧急|务必|urgent|asap/i },
  { score: 24, label: "明确要求回复", re: /请.{0,6}回复|需.{0,6}回复|回复确认|回执|rsvp|please reply|confirm/i },
  { score: 16, label: "包含截止要求", re: /截止|deadline|due\b/i }
];

const WEEKDAYS = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

function startOfDay(date) {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(date) {
  const out = new Date(date);
  out.setHours(23, 59, 59, 999);
  return out;
}

function validDateParts(year, month, day) {
  const d = new Date(year, month - 1, day, 23, 59, 59, 999);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

/** Extract the nearest explicit or relative deadline from a message snippet. */
export function extractDeadline(text, now = new Date()) {
  const source = String(text ?? "");
  let match = source.match(/(20\d{2})[年\-\/.](\d{1,2})[月\-\/.](\d{1,2})日?/);
  if (match) {
    const date = validDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
    if (date) return { date: date.toISOString(), evidence: match[0], precision: "day" };
  }

  match = source.match(/(?<!\d)(\d{1,2})月(\d{1,2})日?/);
  if (match) {
    let year = now.getFullYear();
    let date = validDateParts(year, Number(match[1]), Number(match[2]));
    if (date && date.getTime() < startOfDay(now).getTime() - 180 * 86_400_000) {
      date = validDateParts(year + 1, Number(match[1]), Number(match[2]));
    }
    if (date) return { date: date.toISOString(), evidence: match[0], precision: "day" };
  }

  const relative = source.match(/今天|今日|明天|明日|后天/);
  if (relative) {
    const offset = /明天|明日/.test(relative[0]) ? 1 : relative[0] === "后天" ? 2 : 0;
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return { date: endOfDay(date).toISOString(), evidence: relative[0], precision: "day" };
  }

  match = source.match(/(?:本周|这周|下周)?(?:周|星期)([一二三四五六日天])/);
  if (match) {
    const target = WEEKDAYS[match[1]];
    let offset = (target - now.getDay() + 7) % 7;
    if (/下周/.test(match[0])) offset = offset === 0 ? 7 : offset + 7;
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return { date: endOfDay(date).toISOString(), evidence: match[0], precision: "day" };
  }

  match = source.match(/(?:by|due)\s+(today|tomorrow)/i);
  if (match) {
    const date = new Date(now);
    if (match[1].toLowerCase() === "tomorrow") date.setDate(date.getDate() + 1);
    return { date: endOfDay(date).toISOString(), evidence: match[0], precision: "day" };
  }
  return null;
}

function dueState(deadline, now) {
  if (!deadline) return "unscheduled";
  const due = new Date(deadline.date);
  if (due.getTime() < now.getTime()) return "overdue";
  if (startOfDay(due).getTime() === startOfDay(now).getTime()) return "today";
  return "upcoming";
}

function senderLabel(message) {
  return message.from?.name || message.from?.address || "未知发件人";
}

function actionForMessage(message, now) {
  const text = `${message.subject ?? ""}\n${message.snippet ?? ""}`;
  const verdict = classifyMessage(message);
  const actionMatch = ACTION_PATTERNS.find((entry) => entry.re.test(text));
  const deadline = extractDeadline(text, now);
  if (!actionMatch && !deadline && verdict.category !== "todo") return null;

  const state = dueState(deadline, now);
  let score = verdict.category === "todo" ? 35 : 12;
  const evidence = [...verdict.rules];
  for (const signal of URGENCY_PATTERNS) {
    if (signal.re.test(text)) {
      score += signal.score;
      evidence.push(signal.label);
    }
  }
  if (state === "overdue") { score += 40; evidence.push("截止时间已过"); }
  if (state === "today") { score += 34; evidence.push("今天到期"); }
  if (state === "upcoming") score += 18;
  if (message.seen === false) { score += 5; evidence.push("邮件尚未阅读"); }
  if ((message.attachments ?? []).length > 0) { score += 4; evidence.push("包含附件"); }

  return {
    id: message.messageId ?? `${message.mailbox ?? "INBOX"}#${message.uid}`,
    uid: message.uid,
    subject: message.subject ?? "",
    from: senderLabel(message),
    fromAddress: message.from?.address ?? "",
    receivedAt: message.date,
    action: actionMatch?.label ?? "检查并处理",
    actionType: actionMatch?.type ?? "follow_up",
    deadline: deadline?.date ?? null,
    deadlineEvidence: deadline?.evidence ?? null,
    state,
    priority: Math.min(score, 100),
    snippet: message.snippet ?? "",
    attachments: (message.attachments ?? []).map((a) => a.filename).filter(Boolean),
    evidence: [...new Set(evidence)]
  };
}

/** Turn indexed messages into a ranked, explainable action list. */
export function buildActionRadar(messages, { now = new Date(), horizonDays = 14, limit = 50 } = {}) {
  const horizon = now.getTime() + Math.max(horizonDays, 1) * 86_400_000;
  const actions = messages
    .map((message) => actionForMessage(message, now))
    .filter(Boolean)
    .filter((item) => !item.deadline || new Date(item.deadline).getTime() <= horizon || item.state === "overdue")
    .sort((a, b) => b.priority - a.priority || new Date(b.receivedAt ?? 0) - new Date(a.receivedAt ?? 0))
    .slice(0, Math.max(limit, 1));
  const counts = { overdue: 0, today: 0, upcoming: 0, unscheduled: 0 };
  for (const item of actions) counts[item.state]++;
  return { generatedAt: now.toISOString(), horizonDays, total: actions.length, counts, actions };
}

/** Build a concise morning brief with focus items and inbox health signals. */
export function buildDailyBrief(messages, { now = new Date(), horizonDays = 7, focusLimit = 5 } = {}) {
  const radar = buildActionRadar(messages, { now, horizonDays, limit: Math.max(focusLimit * 4, 20) });
  const triaged = { todo: 0, notice: 0, subscription: 0, personal: 0 };
  const unread = messages.filter((message) => message.seen === false).length;
  const attachmentMessages = messages.filter((message) => (message.attachments ?? []).length > 0).length;
  const review = [];
  for (const message of messages) {
    const verdict = classifyMessage(message);
    triaged[verdict.category]++;
    if (verdict.confidence !== "high") {
      review.push({
        uid: message.uid,
        subject: message.subject ?? "",
        from: senderLabel(message),
        confidence: verdict.confidence,
        evidence: verdict.rules
      });
    }
  }
  const focus = radar.actions.slice(0, Math.max(focusLimit, 1));
  return {
    generatedAt: now.toISOString(),
    totalMessages: messages.length,
    unread,
    attachmentMessages,
    categories: triaged,
    actionCounts: radar.counts,
    focus,
    needsReview: review.slice(0, 10),
    headline: focus.length === 0
      ? `已检查 ${messages.length} 封邮件，当前没有识别到明确待办。`
      : `已从 ${messages.length} 封邮件中找出 ${radar.total} 项行动，先处理优先级最高的 ${focus.length} 项。`,
    safety: "基于本地邮件索引生成，未改变邮件状态，也未发送任何邮件。"
  };
}

/** Normalize common reply/forward prefixes so indexed messages form threads. */
export function normalizeThreadSubject(subject) {
  let value = String(subject ?? "").trim();
  let previous;
  do {
    previous = value;
    value = value.replace(/^\s*(?:re|fw|fwd|回复|答复|转发)\s*[:：]\s*/i, "").trim();
  } while (value !== previous);
  return value.toLowerCase();
}

/** Find an indexed thread by UID, Message-ID, or subject substring. */
export function findThread(messages, { uid, messageId, subject } = {}) {
  let target = null;
  if (messageId) target = messages.find((message) => message.messageId === messageId);
  if (!target && uid != null) target = messages.find((message) => String(message.uid) === String(uid));
  if (!target && subject) {
    const needle = String(subject).trim().toLowerCase();
    target = messages.find((message) => String(message.subject ?? "").toLowerCase().includes(needle));
  }
  if (!target) throw new Error("target message or thread was not found in the local index");
  const key = normalizeThreadSubject(target.subject);
  const ids = new Set([target.messageId].filter(Boolean));
  const thread = messages.filter((message) => {
    if (normalizeThreadSubject(message.subject) === key) return true;
    const headers = message.headers ?? {};
    const refs = [headers.inReplyTo, ...(headers.references ?? [])].filter(Boolean).map(String);
    return refs.some((ref) => ids.has(ref));
  });
  for (const message of thread) if (message.messageId) ids.add(message.messageId);
  return thread.sort((a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0));
}

function sentenceList(text) {
  return String(text ?? "")
    .split(/(?<=[。！？!?])|\n+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 4 && sentence.length <= 500);
}

function uniqueSignals(thread, re, limit = 12) {
  const seen = new Set();
  const out = [];
  for (const message of thread) {
    for (const sentence of sentenceList(`${message.subject ?? ""}。${message.snippet ?? ""}`)) {
      if (!re.test(sentence)) continue;
      const key = sentence.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        text: sentence,
        citation: `mail:${message.messageId ?? `${message.mailbox ?? "INBOX"}#${message.uid}`}`,
        uid: message.uid,
        date: message.date,
        from: senderLabel(message)
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Summarize the inspectable structure and signals in one mail thread. */
export function summarizeThread(messages, target = {}) {
  const thread = findThread(messages, target);
  const participants = new Map();
  for (const message of thread) {
    const address = message.from?.address ?? "";
    const key = address.toLowerCase() || senderLabel(message);
    if (!participants.has(key)) participants.set(key, { name: message.from?.name ?? "", email: address, messages: 0 });
    participants.get(key).messages++;
  }
  const actions = buildActionRadar(thread, { horizonDays: 3650, limit: 30 }).actions
    .map((item) => ({ ...item, citation: `mail:${item.id}` }));
  const commitments = uniqueSignals(thread, /我会|我们会|将于|计划|承诺|预计|i will|we will|plan to|expect to/i);
  const questions = uniqueSignals(thread, /[？?]|请.{0,10}(?:确认|回复|说明)|需要.{0,10}(?:确认|回复)|please.{0,12}(?:confirm|reply|clarify)/i);
  const decisions = uniqueSignals(thread, /确认|决定|同意|批准|通过|拒绝|采用|confirmed|decided|approved|agreed|declined/i);
  return {
    threadKey: normalizeThreadSubject(thread[0]?.subject),
    subject: thread.at(-1)?.subject ?? "",
    messageCount: thread.length,
    contextSource: thread.some((message) => message.contextSource === "imap-full") ? "imap-full" : "local-index-snippets",
    participants: [...participants.values()],
    dateRange: { first: thread[0]?.date ?? null, last: thread.at(-1)?.date ?? null },
    attachments: thread.flatMap((message) => (message.attachments ?? []).map((attachment) => ({
      filename: attachment.filename,
      uid: message.uid,
      citation: `mail:${message.messageId ?? `${message.mailbox ?? "INBOX"}#${message.uid}`}`
    }))),
    actions,
    commitments,
    questions,
    decisions,
    timeline: thread.map((message) => ({
      uid: message.uid,
      date: message.date,
      from: senderLabel(message),
      subject: message.subject ?? "",
      text: message.snippet ?? "",
      citation: `mail:${message.messageId ?? `${message.mailbox ?? "INBOX"}#${message.uid}`}`,
      contextSource: message.contextSource ?? "local-index-snippet",
      bodyTruncated: Boolean(message.bodyTruncated)
    })),
    safety: "Every extracted signal includes a mail citation. Review the source before acting."
  };
}

/** Extract actions from one message, one thread, a subject search, or inline text. */
export function extractActions(messages, { uid, messageId, subject, text, now = new Date(), limit = 30 } = {}) {
  let selected;
  if (text && String(text).trim()) {
    selected = [{
      uid: 0,
      mailbox: "INLINE",
      messageId: "inline-input",
      date: now.toISOString(),
      from: { address: "", name: "inline text" },
      subject: subject ?? "",
      snippet: String(text),
      attachments: [],
      headers: {},
      seen: true
    }];
  } else {
    selected = findThread(messages, { uid, messageId, subject });
  }
  const radar = buildActionRadar(selected, { now, horizonDays: 3650, limit });
  return {
    ...radar,
    scope: text ? "inline-text" : selected.length > 1 ? "thread" : "message",
    actions: radar.actions.map((item) => ({ ...item, citation: `mail:${item.id}` })),
    sources: selected.map((message) => ({
      uid: message.uid,
      messageId: message.messageId,
      subject: message.subject ?? "",
      citation: `mail:${message.messageId ?? `${message.mailbox ?? "INBOX"}#${message.uid}`}`
    }))
  };
}

function isChinese(text) {
  return /[\u3400-\u9fff]/.test(String(text ?? ""));
}

function zhDraft(tone, subject, points) {
  const opening = tone === "warm" ? "您好，感谢您的来信。" : tone === "formal" ? "您好，感谢来信。" : "您好，邮件已收到。";
  const core = points.length > 0
    ? points.map((point) => `关于${point.replace(/[。.!！]+$/, "")}，我会按此推进。`).join("\n")
    : `关于“${subject}”，我已了解邮件中的安排，会按要求推进。`;
  const closing = tone === "warm" ? "如有补充，欢迎随时告知。谢谢！" : tone === "formal" ? "如有需要补充确认的事项，请告知。谢谢。" : "如有补充，请告知。";
  return `${opening}\n\n${core}\n\n${closing}`;
}

function enDraft(tone, subject, points) {
  const opening = tone === "warm" ? "Hello, thank you for reaching out." : tone === "formal" ? "Hello, thank you for your email." : "Hello, I received your email.";
  const core = points.length > 0
    ? points.map((point) => `Regarding ${point.replace(/[.!]+$/, "")}, I will proceed accordingly.`).join("\n")
    : `I have reviewed the details regarding “${subject}” and will proceed as requested.`;
  const closing = tone === "warm" ? "Please feel free to share any additional details. Thank you!" : tone === "formal" ? "Please let me know if any further confirmation is required. Thank you." : "Please let me know if anything else is needed.";
  return `${opening}\n\n${core}\n\n${closing}`;
}

/** Build a reviewable reply package from every indexed snippet in a thread. */
export function buildContextReply(messages, { uid, messageId, replyPoints = [], language = "auto" } = {}) {
  const target = messages.find((message) => messageId
    ? message.messageId === messageId
    : String(message.uid) === String(uid));
  if (!target) throw new Error("target message was not found in the local index");
  const threadKey = normalizeThreadSubject(target.subject);
  const thread = messages
    .filter((message) => normalizeThreadSubject(message.subject) === threadKey)
    .sort((a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0))
    .map((message) => ({
      uid: message.uid,
      messageId: message.messageId,
      date: message.date,
      from: senderLabel(message),
      fromAddress: message.from?.address ?? "",
      subject: message.subject ?? "",
      snippet: message.snippet ?? "",
      attachments: (message.attachments ?? []).map((a) => a.filename).filter(Boolean)
    }));
  const radar = buildActionRadar([target], { horizonDays: 3650, limit: 5 });
  const lang = language === "auto" ? (isChinese(`${target.subject}\n${target.snippet}`) ? "zh" : "en") : language;
  const cleanPoints = replyPoints.map((point) => String(point).trim()).filter(Boolean).slice(0, 8);
  const subject = target.subject?.trim() || threadKey || "邮件回复";
  const factory = lang === "zh" ? zhDraft : enDraft;
  const drafts = ["concise", "formal", "warm"].map((tone) => ({
    tone,
    subject: /^(re|回复|答复)\s*[:：]/i.test(subject) ? subject : `Re: ${subject}`,
    body: factory(tone, subject, cleanPoints)
  }));
  return {
    target: {
      uid: target.uid,
      messageId: target.messageId,
      to: target.from?.address ?? "",
      toName: target.from?.name ?? "",
      subject: target.subject ?? ""
    },
    threadKey,
    threadLength: thread.length,
    thread,
    actionSignals: radar.actions,
    drafts,
    requiresUserReview: true,
    nextStep: "Review or edit one draft, then pass it to office_mail_preview. Sending still requires office_mail_send with confirm:true.",
    safety: "This tool only prepares drafts from locally indexed snippets. It does not send mail."
  };
}

/** Prepare one chosen-tone reply while retaining the full evidence package. */
export function buildReplyDraft(messages, { tone = "formal", ...options } = {}) {
  const pack = buildContextReply(messages, options);
  const draft = pack.drafts.find((item) => item.tone === tone) ?? pack.drafts[0];
  return {
    ...pack,
    selectedTone: draft.tone,
    draft,
    sourceCitations: pack.thread.map((message) => `mail:${message.messageId ?? `${message.uid}`}`),
    nextStep: "Review or edit draft.body, then pass the recipient, subject, and body to office_mail_preview. Sending still requires confirm:true."
  };
}
