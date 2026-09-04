# dsh-plugin-office

**An AI office toolkit for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness)** — mail merge, Word document generation, and spreadsheet pipelines, exposed as four native agent tools.

```
office_mail_preview → office_mail_send   batch personalized email, two-phase and audited
office_docgen                           Word documents from structured blocks, batch mode
office_sheet                            CSV/XLSX inspect · filter · aggregate · split
```

## Why

Most AI-office tooling targets GUI suites or file-level primitives. This plugin takes the opposite bet: **closed-loop, task-shaped tools** for terminal agents — a mail merge that cannot send unreviewed email, a document generator that fails loudly on missing data instead of shipping `{{placeholders}}`, a spreadsheet pipeline that always starts with `inspect` so the agent knows the columns before it filters.

| Tool | What the agent says | What happens |
|---|---|---|
| `office_mail_preview` | "render this template against recipients.csv" | every row rendered + validated, persisted, `previewId` returned |
| `office_mail_send` | "send preview pm_1a2b3c, confirmed" | `.eml` drafts (no SMTP) or paced SMTP delivery + JSONL audit log |
| `office_docgen` | "generate an offer letter per row of employees.csv" | one `.docx` per row, shared `{{field}}` engine, refuses silent overwrites |
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

## Roadmap

- `office_pptx` — deck generation (pptxgenjs)
- `office_inbox` — IMAP triage/summarize/reply-draft (read-only by default)
- `.docx` template injection (replace placeholders inside an existing template file)

## Related

- [word-mail-merge-batch-sender](https://github.com/Xplore-LAB/word-mail-merge-batch-sender) — the original VBA/Outlook edition of the mail merge; this plugin is its DSH successor
- [dsh-plugin-asmemory](https://github.com/Xplore-LAB/dsh-plugin-asmemory) — persistent memory plugin for DSH

## License

MIT
