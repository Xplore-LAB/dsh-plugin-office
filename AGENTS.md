# Postbird Repository Guide

## Project

Postbird is a local-first AI inbox and office toolkit for DeepSeek Harness. It turns indexed email and local files into reviewable actions, replies, archives, spreadsheets, Word documents, and presentations.

## Verify

Run `npm test` before committing. The suite covers every registered tool, the CLI, security boundaries, and the static Live Demo.

## Stack

The project uses Node.js 20 or newer with ES modules. Model-facing tools use `@deepseek-ai/dsh-tools`; email uses ImapFlow, MailParser, and Nodemailer; Office files use ExcelJS, docx, and PptxGenJS.

## Layout and conventions

1. Register every model-facing tool in `lib/index.js`.
2. Keep deterministic, reusable logic in a focused module under `lib/`.
3. Keep inbox reads read-only and use IMAP PEEK operations.
4. Keep outbound mail behind preview plus explicit confirmation.
5. Keep data-driven paths inside `workDir`.
6. Add end-to-end coverage in `tests/e2e.mjs` for every new tool.
7. Keep `README.md`, `README.en.md`, guides, package version, tool counts, test counts, and `demo/` aligned with shipped behavior.

## Current state

Version 1.4.0 exposes 17 tools. The flagship inbox workflows are `office_daily_brief`, `office_action_radar`, and `office_context_reply`. GitHub Pages serves the browser-only simulated Demo from `demo/`.
