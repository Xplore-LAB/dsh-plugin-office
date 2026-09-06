<div align="center">

<img src="assets/brand/postbird-readme-hero-v3.png" alt="Postbird" width="920" />

### Turn every inbox into clear actions, thoughtful replies, and finished work.

*简洁通用的 AI 办公工具箱，让邮件与文档自动完成。*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Try%20Postbird-55e5d5?style=for-the-badge&logo=github&logoColor=071426)](https://xplore-lab.github.io/postbird/demo/)

[![GitHub stars](https://img.shields.io/github/stars/Xplore-LAB/postbird?style=flat&label=stars&color=gold)](https://github.com/Xplore-LAB/postbird/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Xplore-LAB/postbird?style=flat&label=forks&color=blue)](https://github.com/Xplore-LAB/postbird/network/members)
[![release](https://img.shields.io/badge/release-v1.4.0-1683c4)](https://github.com/Xplore-LAB/postbird/releases)
[![tests](https://img.shields.io/badge/tests-112%20passing-32b643)](tests/)
[![license](https://img.shields.io/badge/license-MIT-1683c4)](LICENSE)

[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-7e35d5)](https://github.com/deepseek-ai/deepseek-harness)
[![tools](https://img.shields.io/badge/tools-17-7e35d5)](#three-flagship-workflows-in-one-minute)
[![local first](https://img.shields.io/badge/data-local--first-1683c4)](#safe-by-default)
[![node](https://img.shields.io/badge/node-%3E%3D%2020-32b643)](package.json)

[简体中文](README.md) · **English**

</div>

---

## ⚡ Overview

**Postbird is a local-first AI inbox and office assistant for DeepSeek Harness.** It finds what matters today, identifies deadlines and replies that need attention, prepares replies from thread context, and turns inbox information into Word, PowerPoint, spreadsheets, and handover-ready archives.

> **You only need to:** Describe the task in natural language and provide mailbox credentials or local files when required.
>
> **Postbird will return:** A daily brief, ranked actions, context-aware replies, and real `.eml`, `.csv`, `.xlsx`, `.docx`, and `.pptx` files.

Connect QQ Mail, 163, 126, Gmail, Outlook, and other standard mailboxes. Inbox access is read-only by default, outbound messages require preview and confirmation, and indexes and generated files remain on your computer.

## ✨ Three Flagship Workflows in One Minute

Open the [Postbird Live Demo](https://xplore-lab.github.io/postbird/demo/) and try:

| Workflow | Say this | Get this |
| --- | --- | --- |
| Daily Brief | “Help me start today. What needs my attention?” | Top priorities, deadlines, replies, and supporting evidence |
| Action Radar | “Find every deadline, follow-up, and overdue request” | Ranked actions with owners, dates, states, and evidence |
| Context Reply | “Use this thread to prepare my reply” | Thread context, requirements, and three editable drafts |

Every decision is explainable. Sending always requires preview and explicit confirmation.

### Our Vision

Give every existing mailbox and local file collection a trustworthy, controllable, and deliverable AI office layer.

1. **For individuals:** Triage inboxes, track job applications, and create documents with one request, leaving more time for judgment and creative work.
2. **For teams:** Turn mail merge, archiving, handover, and batch reporting into reviewable and repeatable workflows.

## 🕊️ Nine Office Workflows, One Conversation

| What you need | Say this | Postbird delivers |
| --- | --- | --- |
| Daily brief | “Help me start today and show me what matters.” | Focus list, deadlines, and replies requiring attention |
| Action radar | “Find deadlines, follow-ups, and overdue requests.” | Ranked actions, owners, states, and evidence |
| Context reply | “Use this thread to prepare a reply.” | Thread context, action requirements, and three drafts |
| Personalized email | “Create individual invitations for these 20 customers and show me a preview first.” | Drafts, previews, delivery receipts |
| Inbox triage | “Summarize today’s unread mail and highlight urgent actions.” | Summaries, priorities, action items |
| Archive and handover | “Archive all messages and attachments for this project.” | Original `.eml` files, attachments, handover folder |
| Job tracking | “Scan the last 30 days of recruiting mail and update my application status.” | Structured tracker and progress statistics |
| Subscription analytics | “Find neglected newsletters and count messages by sender.” | Subscription list, statistics, cleanup suggestions |
| Documents and reports | “Turn this sales CSV into a weekly report, Word details, and an executive deck.” | `.xlsx`, `.docx`, `.pptx` |

The 17 tools work together behind the scenes. You do not need to memorize tool names or assemble workflows by hand.

## ✨ See the Result

> **Try it without installing:** [Open the Postbird Live Demo](https://xplore-lab.github.io/postbird/demo/) and experience Daily Brief, Action Radar, and Context Reply in one minute.

<div align="center">
  <img src="assets/brand/postbird-readme-banner.png" alt="Postbird turns email and data into office files" width="920" />
</div>

One CSV can become a summary workbook, individual Word files, and a presentation. A group of messages can become a prioritized digest, an action list, and a searchable archive.

```text
You: Turn example/employees.csv into a department summary,
individual Word files, and a presentation.

Postbird: Processed 6 records and generated:
✓ department-summary.xlsx
✓ 6 Word documents
✓ demo-summary.pptx
```

Try the complete local workflow without a mailbox:

```bash
npm run demo
```

## 🔄 How It Works

```text
Natural-language goal
    ↓
Postbird plans and selects tools
    ↓
Mail or files are processed locally into reviewable results
    ↓
Outbound mail is previewed and sent only after confirmation
```

## 🚀 Start in Three Steps

### 1. Install

```bash
git clone https://github.com/Xplore-LAB/postbird.git
cd postbird
npm run setup
```

The installer discovers your DeepSeek Harness profile, installs runtime dependencies, and registers the plugin. If you have multiple profiles, select one:

```bash
npm run setup -- --profile web
```

### 2. Check

```bash
npm run doctor
```

The doctor reports core, inbox, and outbound readiness separately. Documents, presentations, spreadsheets, drafts, and local analysis work without mailbox credentials.

### 3. Start a Conversation

Restart DeepSeek Harness and describe the outcome you want:

```text
Read this sales CSV, summarize it by region, and create an Excel workbook
plus an executive PowerPoint deck.
```

When you need mailbox workflows, follow the optional [mail setup guide](docs/GUIDE.en.md#optional-mailbox-setup). Presets for QQ Mail, 163, 126, Gmail, and Outlook remove the need to look up server addresses.

## 🛡️ Safe by Default

| Design | Default behavior |
| --- | --- |
| Local first | Mail indexes, attachments, and generated files stay on your computer |
| Read-only inbox | IMAP opens with `readOnly` enabled |
| Confirm before send | Postbird previews first and sends only after explicit confirmation |
| Real deliverables | Mail and office documents are written to inspectable standard files |
| Isolated credentials | App passwords come from environment variables and stay out of the repository |

See the [security policy](SECURITY.md) for details.

## 📚 Explore More

| Document | What it covers |
| --- | --- |
| [中文使用指南](docs/GUIDE.zh-CN.md) | 中文安装、配置、工具与排障说明 |
| [English Guide](docs/GUIDE.en.md) | Setup options, mailbox access, all 17 tools, troubleshooting |
| [Product Introduction](docs/PRODUCT-INTRO.zh-CN.md) | Positioning, boundaries, and roadmap in Chinese |
| [Mail Scenarios](docs/MAIL-SCENARIOS.zh-CN.md) | Mail capabilities and workflow examples in Chinese |
| [Competitive Analysis](docs/COMPETITORS.zh-CN.md) | Market positioning and differentiation in Chinese |
| [Promotion Strategy](docs/STRATEGY.zh-CN.md) | Messaging and growth strategy in Chinese |

## 🙏 Acknowledgements

Postbird is built on the DeepSeek Harness ecosystem and excellent open-source projects including [Nodemailer](https://nodemailer.com/), [ImapFlow](https://imapflow.com/), [mailparser](https://nodemailer.com/extras/mailparser/), [docx](https://docx.js.org/), [PptxGenJS](https://gitbrent.github.io/PptxGenJS/), and [ExcelJS](https://github.com/exceljs/exceljs).

If Postbird saves you time, consider giving the project a ⭐. Issues and pull requests are always welcome.

## 📄 License

[MIT](LICENSE)
