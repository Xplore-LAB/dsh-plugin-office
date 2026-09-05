<div align="center">

<img src="assets/brand/postbird-logo.png" alt="Postbird: a blue carrier pigeon holding a sealed envelope" width="144">

# Postbird

**A carrier pigeon for your email and documents. It runs the errand; you stay in charge.**

<sub><b>Postbird for DeepSeek Harness</b> — an independent open-source project, not affiliated with, endorsed by, or connected to Mailbird (Contenga International) or Postbird (Mailstreet, Belgium).</sub>

[![Release](https://img.shields.io/github/v/release/Xplore-LAB/postbird)](https://github.com/Xplore-LAB/postbird/releases)
[![Tests](https://img.shields.io/badge/tests-100%20passing-brightgreen)](#under-the-hood)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-8a2be2)](https://github.com/deepseek-ai/deepseek-harness)

[简体中文](README.md) · English · [产品介绍（通俗版）](docs/PRODUCT-INTRO.zh-CN.md) · [Naming & trademarks](docs/BRAND.zh-CN.md)

</div>

---

A carrier pigeon delivers the letter. It does not open it, answer it, or throw it away. **Postbird for DeepSeek Harness** (package name `dsh-plugin-office`) is a native plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) that turns your terminal agent into an office assistant: mail merge, inbox triage, archiving, mail statistics, a job-application ledger, a subscription cleanup advisor, plus Word / PowerPoint / spreadsheet generation. Fourteen tools, one chat window.

<p align="center">
  <img src="assets/brand/postbird-readme-banner.png" alt="From a plain-language request to Postbird handling email and documents locally" width="100%">
</p>

## What can it do?

You describe the task in plain language; the agent picks the right tool and shows its work.

### Send 40 personalized emails without the copy-paste grind

> "Here's `recipients.csv`. Send each person the payroll notice with their own attachment. Show me a preview first."

Every row is rendered and validated, you approve what you see, then delivery runs over paced SMTP with a full audit log. QQ / 163 / 126 / Gmail / Outlook accounts all work — the accounts free-mail users already have. The Outlook Word-Excel mail-merge dance is not required.

### An inbox that triages itself

> "What actually needs my attention from the last three days?"

A read-only IMAP pull (nothing is ever marked as read), then a deterministic sort into **todo / notice / subscription / personal**. Every verdict carries its evidence — "subject contains interview, deadline Sep 6" — so misfiles are visible and correctable, and low-confidence items are flagged for a second look instead of guessed at.

### Package a whole term of mail for the next committee

> "Export everything from the club inbox this semester, attachments included."

Matched messages export as `.eml` plus an `index.csv`, with batch attachment harvesting (every résumé PDF from a sign-up inbox in one command), deduped filenames, and size caps. Built for handovers, bulk document collection, and "I need that one attachment from March."

### A job tracker that writes itself

> "Where do my applications stand?"

The ledger auto-detects signals in your mail and merges them **forward-only**: applied → written-test → interview → offer. A late rejection never overwrites a recorded offer. Freemail recruiting mail is set aside for you to attribute manually. Exports a CSV you can slice with the bundled spreadsheet tools.

### Find out who is flooding your inbox

> "Which subscriptions should I kill?"

A per-sender frequency ranking with each sender's unsubscribe link when they provided one. Advice only — it never unsubscribes, deletes, or moves anything for you.

### Plus the document side

Word documents from structured blocks, PPT decks from slide blocks, `{{placeholder}}` filling inside existing `.docx` templates, and a CSV/XLSX pipeline (inspect / filter / aggregate / split) that always looks at the columns before it touches your data.

## What it looks like

```text
You    : pull the last 20 inbox messages and tell me what needs action today
Agent  : Fetched 20 messages. 3 need action:
         · Tencent HR (Sep 4)   interview invitation, reply by Sep 6   [todo]
         · jwc@zju.edu.cn (Sep 3)  course registration window opens   [notice]
         · 17 others classified notice/subscription/personal, no deadlines.

You    : where do my job applications stand?
Agent  : Scanned the index — ledger now has 11 companies:
         3 interviews (Tencent, ByteDance, Alibaba), 6 written-tests,
         2 no reply for 14+ days. Exported track.csv.

You    : aggregate that CSV by status into a table
Agent  : track.csv → status counts: interview 3, written-test 6, applied 2.
         Wrote summary.xlsx.
```

## The 14 tools

| Tool | What you say | What happens |
|---|---|---|
| `office_mail_preview` | "render this template against recipients.csv" | every row rendered + validated, persisted, `previewId` returned |
| `office_mail_send` | "send preview pm_1a2b3c, confirmed" | `.eml` drafts (no SMTP) or paced SMTP delivery + JSONL audit log |
| `office_inbox_fetch` | "pull the last 20 inbox messages" | read-only IMAP (PEEK, no `\Seen`), metadata + snippet indexed to JSONL |
| `office_inbox_triage` | "triage what came in overnight" | deterministic buckets (todo/notice/subscription/personal) with per-message evidence |
| `office_archive_search` | "find offer mails with attachments" | local index search by sender/subject/window/attachment/category, zero network |
| `office_archive_export` | "package this term's org mail" | matched messages re-fetched read-only, written as `.eml` + `index.csv` |
| `office_archive_attach` | "collect all résumé PDFs from the sign-up mails" | attachments saved into workDir, deduped filenames, size/extension caps |
| `office_stats_overview` | "how much mail did I get this term" | monthly trend, top contacts, category mix from local index + audit log |
| `office_stats_track` | "where do my job applications stand" | auto ledger applied→written-test→interview→offer (forward-only) + manual fixes + CSV |
| `office_inbox_clean` | "which subscriptions should I kill" | per-sender frequency table with List-Unsubscribe URLs; advice only, never acts |
| `office_docgen` | "generate an offer letter per row of employees.csv" | one `.docx` per row, shared `{{field}}` engine, refuses silent overwrites |
| `office_pptx` | "make a 5-slide Q3 review deck" | one `.pptx` from slide blocks, batch mode included |
| `office_template` | "fill contract.docx for each row of clients.csv" | placeholders replaced inside the template, split-run safe |
| `office_sheet` | "aggregate salary by department to xlsx" | groupBy + sum/avg/min/max/count, `.csv`/`.xlsx` output |

## Who it's for

Students and educators, club and org leaders, job seekers in application season, and anyone whose "office suite" is a free mailbox. Especially if you care where your mail and documents actually live.

| | Webmail built-ins | Copilot-style assistants | Postbird for DSH |
|---|---|---|---|
| Cost | free | monthly subscription | free (MIT), you only pay your model usage |
| Mailboxes | the vendor's own | tied to the vendor's ecosystem | QQ / 163 / 126 / Gmail / Outlook, one setup each |
| Your data | provider's servers | vendor cloud | your machine, nothing uploaded |
| Hackable | no | limited | fully — it's open source |

No claim of "safer than the big vendors" — the honest statement is that the threat surface is different and every part of it is under your control: [SECURITY.md](SECURITY.md).

## Safety model

- **Sending is two-phase.** Nothing leaves without a preview you approved with `confirm:true`. Recipient caps, per-message pacing, domain allowlist, append-only audit log.
- **Receiving is strictly read-only.** Bodies fetched with PEEK (never marks `\Seen`), no flag writes, no deletes; the local index keeps metadata plus a 300-character snippet only.
- **Cleanup is advice-only.** It never unsubscribes, deletes, moves, or sends anything.
- **Files stay in bounds.** Exports and attachment downloads are confined to your working directory with explicit caps; untrusted spreadsheet cells can never reach files outside it.
- **Failures are loud.** A missing `{{field}}` is a hard error naming the field; documents never ship with raw placeholders; outputs never silently overwrite.
- **Credentials stay out of files.** SMTP and IMAP secrets come from environment variables only.

## Install

```bash
# 1. clone the repository into your DSH profile's @local namespace
# The repository is postbird; the Cordis package stays @local/dsh-plugin-office.
git clone https://github.com/Xplore-LAB/postbird.git
cp -R postbird ~/.dsh/profiles/<profile>/node_modules/@local/dsh-plugin-office
cd ~/.dsh/profiles/<profile>/node_modules/@local/dsh-plugin-office
npm install --omit=dev
rm -rf node_modules/@deepseek-ai node_modules/@standard-schema   # keep single runtime instances

# 2. register in ~/.dsh/profiles/<profile>/cordis.patch.yml
- insert:
    - id: tool-office
      name: '@local/dsh-plugin-office'
      config:
        smtpHost: smtp.qq.com      # required only for mode "send"
        smtpUser: ''
        smtpPassEnv: DSH_SMTP_PASS
        fromAddress: ''
        maxRecipients: 50
        maxDocRows: 100
        maxSheetRows: 20000
        maxArchiveMessages: 200    # office_archive_export / _attach cap
        maxAttachmentMb: 25        # per-attachment cap for _attach
        imapUser: 'me@qq.com'      # required only for office_inbox_fetch
        imapPassEnv: DSH_IMAP_PASS # QQ/163/126 need an authorization code, not the password
```

**Zero-config subset**: documents, spreadsheets, decks, archive search, stats, and mail drafts (`.eml`) work with no credentials at all. Only real SMTP sending and IMAP fetching need authorization codes.

<details>
<summary><b>All tool-call examples</b> (JSON args the agent composes for you)</summary>

**Batch letters from a CSV** (data columns become `{{field}}` variables):

```json
{
  "content": [
    { "type": "heading", "level": 1, "text": "Performance letter for {{name}}" },
    { "type": "paragraph", "text": "Dear {{name}}, your salary is {{salary}}." },
    { "type": "table", "header": ["Item", "Score"], "rows": [["Salary", "{{salary}}"]] }
  ],
  "dataFile": "employees.csv",
  "outputDir": "letters",
  "filenameTemplate": "letter_{{name}}.docx"
}
```

**Spreadsheet pipeline** — inspect first, then act:

```json
{ "file": "employees.csv", "action": "inspect" }
{ "file": "employees.csv", "action": "filter",
  "filter": { "column": "salary", "op": "gt", "value": "16000" },
  "outputPath": "high_paid.csv" }
{ "file": "employees.csv", "action": "aggregate",
  "aggregate": { "groupBy": ["department"], "metrics": [{"column": "salary", "fn": "sum"}] },
  "outputPath": "by_dept.xlsx" }
{ "file": "employees.csv", "action": "split",
  "splitBy": "department", "outputPrefix": "out/dept" }
```

**Mail merge** — preview, show the human, then send:

```json
{ "subjectTemplate": "{{month}} payroll notice for {{name}}",
  "bodyTemplate": "Hi {{name}}, ...",
  "recipientsFile": "recipients.csv", "attachmentColumn": "attachment" }
{ "previewId": "pm_…", "mode": "send", "confirm": true }
```

**Inbox triage** — fetch read-only, then bucket:

```json
{ "limit": 20, "daysBack": 1 }
{ "sinceHours": 24 }
```

**Archive & attachments** — search locally, then harvest:

```json
{ "from": "zju.edu.cn", "category": "todo", "hasAttachment": true }
{ "from": "signup@", "outputDir": "exports", "workDir": "/path/to/work" }
{ "extensions": ["pdf"], "outputDir": "resumes", "workDir": "/path/to/work" }
```

**Job ledger** — auto-scan, correct, export:

```json
{ "action": "scan" }
{ "action": "update", "company": "tencent", "status": "offer", "note": "SP, Nov start" }
{ "action": "export", "outputPath": "track.csv", "workDir": "/path/to/work" }
```

</details>

## FAQ

<details>
<summary><b>Does it cost anything?</b></summary>

The plugin is MIT-licensed and free. You only pay for whatever DSH model usage you already have. No subscription, no cloud tier, no telemetry.
</details>

<details>
<summary><b>Does it work with QQ / 163 / 126 mail?</b></summary>

Yes. These providers expose full SMTP and IMAP to free accounts — you just need an authorization code (generated in the mailbox settings, distinct from your login password). Host presets are auto-derived from your address.
</details>

<details>
<summary><b>Can it send or delete something without my approval?</b></summary>

No. Sending requires an explicit preview → approval → `confirm:true` sequence. The IMAP side is read-only by construction. The cleanup advisor produces a report and nothing else. These are design constraints, not configuration defaults.
</details>

<details>
<summary><b>Where does my mail content go?</b></summary>

Into a local JSONL index under `~/.dsh/office/mail/` — message metadata plus a 300-character snippet. Full text and attachments hit disk only when you explicitly export or harvest them. Nothing is uploaded anywhere.
</details>

<details>
<summary><b>Why not just use Office / Copilot / my webmail?</b></summary>

If those fit your life, keep them. This toolkit exists for the people they skip: free-mailbox users outside the paid ecosystem, and anyone who wants the automation to be inspectable and local. Read the full positioning in [docs/STRATEGY.zh-CN.md](docs/STRATEGY.zh-CN.md).
</details>

## Under the hood

Built as a native Cordis plugin (`defineTool`, no MCP hop). SMTP via nodemailer, IMAP via ImapFlow + mailparser (all Postal Systems lineage, MIT). Documents via docx / pptxgenjs / exceljs. 100 end-to-end tests cover every tool plus the security guardrails (path-escape, CRLF injection, overwrite refusal, forward-only ledger). Full threat model and vulnerability history: [SECURITY.md](SECURITY.md).

## Roadmap

The mail lifecycle is covered end to end (write / send / receive / archive / analyze / clean). Next candidates, driven by real usage:

- Reply drafts & follow-up reminders
- Scheduled morning triage via DSH automation tasks

## Related

- [word-mail-merge-batch-sender](https://github.com/Xplore-LAB/word-mail-merge-batch-sender) — the original VBA/Outlook edition of the mail merge; this plugin is its DSH successor
- [dsh-plugin-asmemory](https://github.com/Xplore-LAB/dsh-plugin-asmemory) — persistent memory plugin for DSH

Further reading: [STRATEGY](docs/STRATEGY.zh-CN.md) (why mail is still an open field and where the big vendors' moats crack) · [scenario map](docs/MAIL-SCENARIOS.zh-CN.md) (all six lifecycle segments) · [product intro in plain Chinese](docs/PRODUCT-INTRO.zh-CN.md) · [naming & trademark notes](docs/BRAND.zh-CN.md).

## License

Code is MIT. No trademark claim is made over the name Postbird; run your own clearance search before shipping it commercially.
