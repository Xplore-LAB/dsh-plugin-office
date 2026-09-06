<div align="center">

<img src="assets/brand/postbird-readme-hero-v2.png" alt="Postbird carrying information across email, documents, and spreadsheets" width="1000">

# Postbird

**Give email and documents to one conversation. Keep your data and decisions in your hands.**

*Local-first AI office toolkit for DeepSeek Harness*

<p>
  <a href="https://github.com/Xplore-LAB/postbird/releases"><img src="https://img.shields.io/github/v/release/Xplore-LAB/postbird" alt="Release"></a>
  <a href="#under-the-hood"><img src="https://img.shields.io/badge/tests-100%20passing-brightgreen" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/platform-DeepSeek%20Harness-8a2be2" alt="Platform"></a>
  <a href="#the-14-tools"><img src="https://img.shields.io/badge/tools-14-blueviolet" alt="Tools"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D%2020-brightgreen" alt="Node"></a>
</p>

[简体中文](README.md) | English

</div>

---

## ⚡ Overview

**Postbird is a local-first AI office plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).** It brings inbox triage, safe mail merge, archive handovers, job-application tracking, and Word / PowerPoint / spreadsheet generation into one conversation. You describe the outcome, Postbird coordinates fourteen focused tools, and you inspect the work.

> **You provide:** a plain-language request, plus mailbox credentials or local files when the task needs them.
>
> **Postbird delivers:** reviewable results and real `.eml`, `.csv`, `.xlsx`, `.docx`, and `.pptx` files.

Connect QQ, 163, 126, Gmail, or Outlook. Inbox access is read-only by default, every delivery requires a preview and explicit confirmation, and indexes and generated files stay on your machine.

### Our vision

Postbird gives the mailboxes and local files people already use a trustworthy, controllable, and deliverable AI office layer.

1. **For individuals:** organize an inbox, track job applications, and generate documents with one request, leaving more time for judgment and creative work.
2. **For teams:** turn mail merge, archiving, handovers, and spreadsheet processing into reviewable workflows that can be repeated and shared.

From one message to a full batch of documents, Postbird keeps routine work moving while every critical decision stays in your hands.

![From a plain-language request to Postbird handling email and documents locally](assets/brand/postbird-readme-banner.png)

## 🔄 From request to deliverable

1. **Describe the outcome.** Ask for the messages that need a reply, a personalized mail merge, or a document generated from a spreadsheet.
2. **Read the context.** Postbird inspects local files or fetches authorized mail through read-only IMAP.
3. **Run with guardrails.** Analysis runs directly; outgoing mail always pauses for preview and approval.
4. **Deliver the work.** Summaries appear in the conversation while documents, mail, spreadsheets, and ledgers are written to the local workspace.

## What can it do?

You describe the task in plain language; the agent picks the right tool and shows its work.

### Send 40 personalized emails without the copy-paste grind

> "Here's `recipients.csv`. Send each person the payroll notice with their own attachment. Show me a preview first."

Every row is rendered and validated, you approve what you see, then delivery runs over paced SMTP with a full audit log. QQ / 163 / 126 / Gmail / Outlook accounts all work, including the accounts free-mail users already have. The Outlook Word-Excel mail-merge dance is optional.

### An inbox that triages itself

> "What actually needs my attention from the last three days?"

A read-only IMAP pull (nothing is ever marked as read), then a deterministic sort into **todo / notice / subscription / personal**. Every verdict carries its evidence, such as "subject contains interview, deadline Sep 6," so misfiles are visible and correctable, and low-confidence items are flagged for a second look instead of guessed at.

### Package a whole term of mail for the next committee

> "Export everything from the club inbox this semester, attachments included."

Matched messages export as `.eml` plus an `index.csv`, with batch attachment harvesting (every résumé PDF from a sign-up inbox in one command), deduped filenames, and size caps. Built for handovers, bulk document collection, and "I need that one attachment from March."

### A job tracker that writes itself

> "Where do my applications stand?"

The ledger auto-detects signals in your mail and merges them **forward-only**: applied → written-test → interview → offer. A late rejection never overwrites a recorded offer. Freemail recruiting mail is set aside for you to attribute manually. Exports a CSV you can slice with the bundled spreadsheet tools.

### Find out who is flooding your inbox

> "Which subscriptions should I kill?"

A per-sender frequency ranking with each sender's unsubscribe link when they provided one. It provides advice only and never unsubscribes, deletes, or moves anything for you.

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
Agent  : Scanned the index. The ledger now has 11 companies:
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

| If you are | Copy this into the chat |
|---|---|
| A student drowning in notices | Pull the last three days of mail and pick out the ones that need a reply |
| Applying for jobs this season | Scan my inbox, build a ledger of every company I applied to, export CSV |
| Handing a club to the next committee | Export every mail with attachments from this term, save the files into handover/ |
| HR or admin sending pay slips | Send pay slips from employees.csv, use the name column as the greeting, show me a preview first |
| A teacher with a roster | Fill notice.docx once per row of roster.csv |
| A developer cleaning data | Show me the structure of data.csv, keep rows where salary > 16000, save as xlsx |

| | Webmail built-ins | Copilot-style assistants | Postbird for DSH |
|---|---|---|---|
| Cost | free | monthly subscription | free (MIT), you only pay your model usage |
| Mailboxes | the vendor's own | tied to the vendor's ecosystem | QQ / 163 / 126 / Gmail / Outlook, one setup each |
| Your data | provider's servers | vendor cloud | your machine, nothing uploaded |
| Hackable | no | limited | fully open source |

The threat surface is different from the big vendors, and every part of it is under your control. See [SECURITY.md](SECURITY.md).

## Safety model

- **Sending is two-phase.** Nothing leaves without a preview you approved with `confirm:true`. Recipient caps, per-message pacing, domain allowlist, append-only audit log.
- **Receiving is strictly read-only.** Bodies fetched with PEEK (never marks `\Seen`), no flag writes, no deletes; the local index keeps metadata plus a 300-character snippet only.
- **Cleanup is advice-only.** It never unsubscribes, deletes, moves, or sends anything.
- **Files stay in bounds.** Exports and attachment downloads are confined to your working directory with explicit caps; untrusted spreadsheet cells can never reach files outside it.
- **Failures are loud.** A missing `{{field}}` is a hard error naming the field; documents never ship with raw placeholders; outputs never silently overwrite.
- **Credentials stay out of files.** SMTP and IMAP secrets come from environment variables only.

## Where data lands, and how to remove it

```text
~/.dsh/office/mail/
├── index.jsonl         mail index: date, sender, subject, 300-char snippet, attachment names, triage evidence
├── sent-log.jsonl      delivery ledger, append-only
├── job-track.json      job-application ledger
├── previews/           mail-merge preview snapshots
└── drafts/<id>/        .eml files produced in draft mode
```

Only `index.jsonl` holds a snippet. Full bodies and attachments touch disk solely when you explicitly export them, into your working directory. Wipe the index with `rm -rf ~/.dsh/office/mail`. Uninstall by deleting `node_modules/@local/dsh-plugin-office` and removing the `tool-office` block from `cordis.patch.yml`.

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

### Smoke test before you configure anything

Point DSH at the repository's `example/` directory and just ask:

```text
you: what columns does example/employees.csv have, and what types are they?
you: aggregate salary and bonus by department, write by_dept.xlsx
you: generate one pay notice per row of example/employees.csv, title it "Pay notice for {{name}}", output to letters/
```

No credentials, no network, no mailbox. Real output, a few seconds later:

```text
employees.csv: 6 rows, 4 columns (2 numeric).
Aggregate by department: 3 group(s) → by_dept.xlsx
  Engineering   salary 75000   bonus 8700
  HR            salary 14000   bonus 1000
  Sales         salary 32000   bonus 3300
office_docgen: 6 files → letters/notice_Alice.docx … letters/notice_Frank.docx
```

Once files land on disk the plugin is mounted correctly, and configuring SMTP / IMAP becomes worth your time.

### Full configuration

All defaults are listed below. Override only what you need.

```yaml
config:
  # Sending (needed only for real delivery; draft mode needs none of it)
  smtpHost: smtp.qq.com        # empty = drafts only
  smtpPort: 465                # 465 implicit TLS, 587 STARTTLS
  smtpSecure: true
  smtpUser: ''
  smtpPassEnv: DSH_SMTP_PASS   # QQ/163/126: authorization code, not the login password
  fromAddress: ''
  fromName: ''
  replyTo: ''
  maxRecipients: 50            # per-batch cap
  sendIntervalMs: 1500         # minimum pacing between two deliveries
  dailySendCap: 200            # rolling 24h delivery cap, anti-blacklist guard
  allowDomains: []             # empty = no limit; ["edu.cn"] blocks other domains at preview
  previewTtlMinutes: 60        # a stale preview must be regenerated

  # Documents and spreadsheets
  maxDocRows: 100
  maxSheetRows: 20000

  # Receiving (office_inbox_* only)
  imapUser: 'me@qq.com'
  imapPassEnv: DSH_IMAP_PASS
  imapHost: ''                 # empty = derive from the address domain
  imapPort: 993
  imapMailbox: INBOX
  maxInboxFetch: 200
  inboxSnippetChars: 300
  maxArchiveMessages: 200
  maxAttachmentMb: 25          # larger attachments are skipped and reported
```

Set `DSH_OFFICE_HOME=/tmp/office-test` to relocate the entire data directory while debugging.

## Tool-call examples

These are the JSON arguments the agent composes for you.

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

**Spreadsheet pipeline:** inspect first, then act.

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

**Mail merge:** preview, show the human, then send.

```json
{ "subjectTemplate": "{{month}} payroll notice for {{name}}",
  "bodyTemplate": "Hi {{name}}, ...",
  "recipientsFile": "recipients.csv", "attachmentColumn": "attachment" }
{ "previewId": "pm_…", "mode": "send", "confirm": true }
```

**Inbox triage:** fetch read-only, then bucket.

```json
{ "limit": 20, "daysBack": 1 }
{ "sinceHours": 24 }
```

**Archive and attachments:** search locally, then harvest.

```json
{ "from": "zju.edu.cn", "category": "todo", "hasAttachment": true }
{ "from": "signup@", "outputDir": "exports", "workDir": "/path/to/work" }
{ "extensions": ["pdf"], "outputDir": "resumes", "workDir": "/path/to/work" }
```

**Job ledger:** auto-scan, correct, export.

```json
{ "action": "scan" }
{ "action": "update", "company": "tencent", "status": "offer", "note": "SP, Nov start" }
{ "action": "export", "outputPath": "track.csv", "workDir": "/path/to/work" }
```

## FAQ

### Does it cost anything?

The plugin is MIT-licensed and free. You only pay for whatever DSH model usage you already have. No subscription, no cloud tier, no telemetry.
### Does it work with QQ / 163 / 126 mail?

Yes. These providers expose full SMTP and IMAP to free accounts. You only need an authorization code generated in the mailbox settings, which is distinct from your login password. Host presets are auto-derived from your address.
### Can it send or delete something without my approval?

No. Sending requires an explicit preview → approval → `confirm:true` sequence. The IMAP side is read-only by construction. The cleanup advisor produces a report and nothing else. These are design constraints, not configuration defaults.
### Where does my mail content go?

Into a local JSONL index under `~/.dsh/office/mail/`, containing message metadata plus a 300-character snippet. Full text and attachments hit disk only when you explicitly export or harvest them. Nothing is uploaded anywhere.
### Why use Postbird alongside Office, Copilot, or webmail?

If those fit your life, keep them. This toolkit exists for the people they skip: free-mailbox users outside the paid ecosystem, and anyone who wants the automation to be inspectable and local. Read the full positioning in [docs/STRATEGY.zh-CN.md](docs/STRATEGY.zh-CN.md).
## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| DSH fails to boot with a schemastery / dsh-tools error | a second copy of the runtime got installed inside the plugin | delete `node_modules/@deepseek-ai` and `node_modules/@standard-schema` |
| Sending fails with `535 Login Fail` | you used the login password | enable the SMTP service in your mailbox settings and generate an authorization code for `DSH_SMTP_PASS` |
| IMAP will not connect or authenticate | the IMAP service is off, or the wrong secret | enable IMAP separately and put the authorization code in `DSH_IMAP_PASS` |
| "Preview expired" | previews time out after 60 minutes | regenerate the preview, or raise `previewTtlMinutes` |
| `escapes workDir` on an attachment | attachments must live inside the working directory | move the file into your workDir and reference it relatively |
| Batch size rejected | `maxRecipients` is 50 and `maxDocRows` is 100 | split the batch, or raise the config |
| A large sheet will not load | `maxSheetRows` caps reads at 20000 | `inspect` first, then `filter` before `aggregate` |
| No tools appear at all | indentation or profile name in `cordis.patch.yml` | check the `- insert:` indentation and the `id` / `name` spelling, and that `<profile>` is right |

## Under the hood

Built as a native Cordis plugin (`defineTool`, no MCP hop). SMTP via nodemailer, IMAP via ImapFlow + mailparser (all Postal Systems lineage, MIT). Documents via docx / pptxgenjs / exceljs. 100 end-to-end tests cover every tool plus the security guardrails (path-escape, CRLF injection, overwrite refusal, forward-only ledger). Full threat model and vulnerability history: [SECURITY.md](SECURITY.md).

## For developers

```text
lib/index.js          registration, schema, and sending guardrails for all 14 tools
lib/inbox.js          IMAP fetch, local index, deterministic triage
lib/archive.js        archive search, .eml export, attachment harvest
lib/stats.js          mail statistics and the job ledger
lib/clean.js          subscription frequency table and unsubscribe advice
lib/docgen.js         one .docx per data row
lib/pptxgen.js        slide-block .pptx generation
lib/sheet.js          inspect / filter / aggregate / split
lib/docx-inject.js    placeholder injection with run-split-safe writes
lib/render.js         variable rendering and validation
tests/e2e.mjs         100 end-to-end assertions
```

Run the suite from the mounted plugin directory (Node >= 20):

```bash
cp tests/e2e.mjs ~/.dsh/profiles/web/node_modules/@local/dsh-plugin-office/
cd ~/.dsh/profiles/web/node_modules/@local/dsh-plugin-office && node e2e.mjs
```

The suite points `DSH_OFFICE_HOME` at a temp directory, so your real mail data is untouched.

Three schema rules bite when you add a tool, and they only surface on a real boot (`--dump-config`, or the web service returning 200); static checks will not catch them:

1. object-typed `items` must set `additionalProperties: true`
2. never put `additionalProperties: false` inside array `items`
3. `additionalProperties` accepts a boolean only

After changes, boot DSH once with `--dump-config` and confirm all 14 tools load with no errors in the log.

## Roadmap

The mail lifecycle is covered end to end (write / send / receive / archive / analyze / clean). Next candidates, driven by real usage:

- Reply drafts & follow-up reminders
- Scheduled morning triage via DSH automation tasks

Release notes for each version: [Releases](https://github.com/Xplore-LAB/postbird/releases).

## Related

- [word-mail-merge-batch-sender](https://github.com/Xplore-LAB/word-mail-merge-batch-sender): the original VBA/Outlook edition of the mail merge; this plugin is its DSH successor
- [dsh-plugin-asmemory](https://github.com/Xplore-LAB/dsh-plugin-asmemory): persistent memory plugin for DSH

Further reading: [STRATEGY](docs/STRATEGY.zh-CN.md) (why mail is still an open field and where the big vendors' moats crack) · [scenario map](docs/MAIL-SCENARIOS.zh-CN.md) (all six lifecycle segments) · [product intro in plain Chinese](docs/PRODUCT-INTRO.zh-CN.md).

## License

This project is open source under the [MIT License](LICENSE).
