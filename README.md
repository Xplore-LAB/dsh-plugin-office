<div align="center">

<img src="assets/brand/postbird-readme-hero-v3.png" alt="Postbird 信鸽" width="920" />

### 简洁通用的 AI 办公工具箱，让邮件与文档自动完成。

*A Simple and Universal AI Office Toolkit, Getting Email and Documents Done.*

[![GitHub stars](https://img.shields.io/github/stars/Xplore-LAB/postbird?style=flat&label=stars&color=gold)](https://github.com/Xplore-LAB/postbird/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Xplore-LAB/postbird?style=flat&label=forks&color=blue)](https://github.com/Xplore-LAB/postbird/network/members)
[![release](https://img.shields.io/badge/release-v1.3.0-1683c4)](https://github.com/Xplore-LAB/postbird/releases)
[![tests](https://img.shields.io/badge/tests-101%20passing-32b643)](tests/)
[![license](https://img.shields.io/badge/license-MIT-1683c4)](LICENSE)

[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-7e35d5)](https://github.com/deepseek-ai/deepseek-harness)
[![tools](https://img.shields.io/badge/tools-14-7e35d5)](#一句话完成六类办公闭环)
[![local first](https://img.shields.io/badge/data-local--first-1683c4)](#安全可控)
[![node](https://img.shields.io/badge/node-%3E%3D%2020-32b643)](package.json)

**简体中文** · [English](README.en.md)

</div>

---

## ⚡ 概览

**Postbird 是 DeepSeek Harness 的本地优先 AI 办公工具箱。** 它把邮件分诊、安全群发、资料归档、求职跟踪，以及 Word、PPT、表格生成接入同一个对话入口。你说清目标，Postbird 调用 14 个工具完成任务，并把过程与结果交给你检查。

> **你只需要：** 用自然语言描述任务，按需提供邮箱授权码或本地文件。
>
> **Postbird 会交付：** 可复核的处理结果，以及 `.eml`、`.csv`、`.xlsx`、`.docx`、`.pptx` 等真实文件。

QQ、163、126、Gmail、Outlook 等常见邮箱均可接入。收件默认只读，发件必须先预览再确认，索引和生成文件保留在你的电脑上。

### 我们的愿景

让每个人现有的邮箱和本地文件，直接获得一层可信、可控、可交付的 AI 办公能力。

1. **面向个人：** 一句话整理收件箱、跟踪求职进度、生成文档，把时间留给判断与创造。
2. **面向团队：** 把群发、归档、交接和批量制表沉淀为可复核、可重复执行的工作流。

## 🕊️ 一句话，完成六类办公闭环

| 你想完成的事 | 直接这样说 | Postbird 交付 |
| --- | --- | --- |
| 个性化邮件 | “给名单里的 20 位客户分别生成邀请邮件，先让我预览” | 草稿、预览、发送回执 |
| 收件箱分诊 | “整理今天的未读邮件，标出紧急事项和待办” | 摘要、优先级、行动清单 |
| 归档与交接 | “归档这个项目的往来邮件和附件” | `.eml` 原文、附件、可移交目录 |
| 求职跟踪 | “扫描近 30 天求职邮件，更新申请状态” | 结构化台账、进度统计 |
| 订阅与统计 | “找出长期未读订阅，并统计发件人分布” | 订阅清单、统计表、清理建议 |
| 文档与汇报 | “把销售 CSV 做成周报、Word 明细和汇报 PPT” | `.xlsx`、`.docx`、`.pptx` |

14 个工具在后台协作。你无需记工具名，也无需手工拼装工作流。

## ✨ 实际效果

<div align="center">
  <img src="assets/brand/postbird-readme-banner.png" alt="Postbird 从邮件与数据生成办公文件" width="920" />
</div>

一份 CSV 可以直接变成汇总表、逐人 Word 文档和汇报 PPT；一组邮件可以直接变成重点摘要、行动清单和可检索归档。

```text
你：把 example/employees.csv 做成部门汇总表、逐人 Word 文档和汇报 PPT。

Postbird：已处理 6 条记录，并生成：
✓ department-summary.xlsx
✓ 6 份 Word 文档
✓ demo-summary.pptx
```

无需邮箱即可在本机体验这条完整链路：

```bash
npm run demo
```

## 🔄 工作方式

```text
自然语言目标
    ↓
Postbird 规划并选择工具
    ↓
本地读取邮件或文件，生成可检查的结果
    ↓
涉及发送时先预览，得到确认后执行
```

## 🚀 三步开始

### 1. 安装

```bash
git clone https://github.com/Xplore-LAB/postbird.git
cd postbird
npm run setup
```

安装器会自动发现 DeepSeek Harness 配置、安装运行依赖并注册插件。存在多个配置时指定一个：

```bash
npm run setup -- --profile web
```

### 2. 检查

```bash
npm run doctor
```

自检会分别报告核心功能、收件能力和发件能力。文档、PPT、表格、草稿与本地分析无需邮箱凭据即可使用。

### 3. 开始对话

重启 DeepSeek Harness，然后直接描述目标：

```text
读取这份销售 CSV，按地区汇总，生成 Excel 和一份管理层汇报 PPT。
```

需要处理邮箱时，再按[中文使用指南](docs/GUIDE.zh-CN.md#邮箱接入可选)配置授权码。QQ、163、126、Gmail、Outlook 均提供预设，无需自行查找服务器地址。

## 🛡️ 安全可控

| 设计 | 默认行为 |
| --- | --- |
| 本地优先 | 邮件索引、附件和生成文件保留在本机 |
| 收件只读 | IMAP 操作默认 `readOnly` |
| 发送确认 | 先生成预览，只有明确确认才会发送 |
| 真实交付 | 邮件与办公文档写入可检查的标准文件 |
| 凭据隔离 | 授权码从环境变量读取，不写入代码仓库 |

更多说明见[安全策略](SECURITY.md)。

## 📚 继续探索

| 文档 | 内容 |
| --- | --- |
| [中文使用指南](docs/GUIDE.zh-CN.md) | 安装选项、邮箱接入、14 个工具、排障 |
| [English Guide](docs/GUIDE.en.md) | Complete English setup and usage guide |
| [产品介绍](docs/PRODUCT-INTRO.zh-CN.md) | 产品定位、能力边界与路线图 |
| [邮件场景](docs/MAIL-SCENARIOS.zh-CN.md) | 邮箱能力与典型工作流 |
| [竞品分析](docs/COMPETITORS.zh-CN.md) | 市场定位与差异化 |
| [推广策略](docs/STRATEGY.zh-CN.md) | 对外传播与增长策略 |

## 🙏 致谢

Postbird 的实现受益于 DeepSeek Harness 生态，以及 [Nodemailer](https://nodemailer.com/)、[ImapFlow](https://imapflow.com/)、[mailparser](https://nodemailer.com/extras/mailparser/)、[docx](https://docx.js.org/)、[PptxGenJS](https://gitbrent.github.io/PptxGenJS/) 和 [ExcelJS](https://github.com/exceljs/exceljs) 等优秀开源项目。

如果 Postbird 帮你节省了时间，欢迎点亮 ⭐，也欢迎提交 [Issue](https://github.com/Xplore-LAB/postbird/issues) 或 Pull Request。

## 📄 许可证

[MIT](LICENSE)
