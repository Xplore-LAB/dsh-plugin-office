# dsh-plugin-office

**An AI office toolkit for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness)** — mail merge, Word/PowerPoint generation, .docx template injection, and spreadsheet pipelines, exposed as six native agent tools.

```
office_mail_preview → office_mail_send   batch personalized email, two-phase and audited
office_docgen                           Word documents from structured blocks, batch mode
office_pptx                             decks from slide blocks (title/bullets/table/image)
office_template                          fill {{placeholders}} inside an existing .docx
office_sheet                            CSV/XLSX inspect · filter · aggregate · split
```

## Why

Most AI-office tooling targets GUI suites or file-level primitives. This plugin takes the opposite bet: **closed-loop, task-shaped tools** for terminal agents — a mail merge that cannot send unreviewed email, a document generator that fails loudly on missing data instead of shipping `{{placeholders}}`, a spreadsheet pipeline that always starts with `inspect` so the agent knows the columns before it filters.

| Tool | What the agent says | What happens |
|---|---|---|
| `office_mail_preview` | "render this template against recipients.csv" | every row rendered + validated, persisted, `previewId` returned |
| `office_mail_send` | "send preview pm_1a2b3c, confirmed" | `.eml` drafts (no SMTP) or paced SMTP delivery + JSONL audit log |
| `office_docgen` | "generate an offer letter per row of employees.csv" | one `.docx` per row, shared `{{field}}` engine, refuses silent overwrites |
| `office_pptx` | "make a 5-slide Q3 review deck" | one `.pptx` from slide blocks, batch mode included |
| `office_template` | "fill contract.docx for each row of clients.csv" | placeholders replaced inside the template, split-run safe |
| `office_sheet` | "aggregate salary by department to xlsx" | groupBy + sum/avg/min/max/count, `.csv`/`.xlsx` output |

## Install (local plugin mount)

```bash
# 1. copy into your DSH profile's @local namespace
cp -R dsh-plugin-office ~/.dsh/profiles/<profile>/node_modules/@local/dsh-plugin-office
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
```

`office_docgen` and `office_sheet` work with zero configuration. Mail draft mode (`.eml` files) also needs no credentials; only SMTP `mode:"send"` does.

## Quick examples

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

## Safety model

- Email is irreversible → mandatory preview → human approval → `confirm:true`, recipient cap, per-message pacing, JSONL audit log at `~/.dsh/office/mail/sent-log.jsonl`.
- Missing `{{field}}` anywhere is a hard error naming the field; documents never ship with raw placeholders.
- File outputs never overwrite unless `overwrite:true`.
- Batch caps (`maxDocRows`, `maxSheetRows`) bound memory and blast radius.

## Security

Sending real email and touching local files are consequential actions. The toolkit ships with guardrails: a two-phase preview-then-send workflow, recipient caps, a rolling-24h send cap, an optional recipient-domain allowlist, per-message pacing, CRLF header-injection sanitizing, and path confinement so untrusted spreadsheet cells can never attach files outside your working directory. Every delivered message lands in an append-only audit log. Credentials stay in environment variables, never in config files. Full threat model and vulnerability history: [SECURITY.md](SECURITY.md).

## Roadmap

- `office_inbox` — IMAP triage/summarize/reply-draft (read-only by default)

## Related

- [word-mail-merge-batch-sender](https://github.com/Xplore-LAB/word-mail-merge-batch-sender) — the original VBA/Outlook edition of the mail merge; this plugin is its DSH successor
- [dsh-plugin-asmemory](https://github.com/Xplore-LAB/dsh-plugin-asmemory) — persistent memory plugin for DSH

## License

MIT

## Strategy

Read [docs/STRATEGY.zh-CN.md](docs/STRATEGY.zh-CN.md) for the project strategy: why mail is still an open field, where the ecosystem moats of the big vendors crack, and who this toolkit serves (students, educators, and anyone who wants out of walled gardens).
