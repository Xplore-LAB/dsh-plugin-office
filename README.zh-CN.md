# dsh-plugin-office

> 用大白话指挥 AI 干办公活：写邮件、发通知、整理收件箱、管求职进度。数据全程留在本机。
> 不想看技术细节？直接读 [通俗产品介绍](docs/PRODUCT-INTRO.zh-CN.md)。

**[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的 AI 办公工具套件**：邮件合并、只读 IMAP 收件分诊、归档检索/导出/附件收取、邮件统计与求职台账、订阅清理建议、Word/PPT 生成、docx 模板注入、表格流水线，十四个原生 Agent 工具。

```
office_mail_preview → office_mail_send   批量个性化邮件，两阶段确认 + 审计日志
office_inbox_fetch → office_inbox_triage 只读 IMAP 拉取 → 待办/通知/订阅/私信四桶分诊
office_archive_search / _export / _attach 本地索引检索 · .eml 导出 · 附件批量收取
office_stats_overview / office_stats_track 往来总览 · 求职台账（CSV 导出）
office_inbox_clean                       订阅清理建议：只出清单，绝不代为操作
office_docgen                           结构化内容块生成 Word，支持批量模式
office_pptx                             幻灯块生成 PPT（标题/列表/表格/图片）
office_template                          既有 .docx 模板内替换 {{占位符}}
office_sheet                            CSV/XLSX 查看 · 筛选 · 聚合 · 拆分
```

## 定位

AI 办公工具大多面向 GUI 套件或文件级操作原语。本插件走另一条路：为终端 Agent 提供**场景级闭环工具**。邮件合并工具不允许发送任何未经预览的邮件；文档生成器遇到缺失数据会带字段名报错，绝不产出带 `{{占位符}}` 的成品；表格流水线永远从 `inspect` 开始，Agent 先摸清列结构再动手。

| 工具 | Agent 说什么 | 实际发生什么 |
|---|---|---|
| `office_mail_preview` | "用这个模板渲染 recipients.csv" | 逐行渲染 + 校验，持久化，返回 `previewId` |
| `office_mail_send` | "发送预览 pm_1a2b3c，已确认" | 草稿模式写 `.eml`（无需 SMTP），或 SMTP 节流投递 + JSONL 审计 |
| `office_docgen` | "按 employees.csv 每行生成一份通知书" | 每行一份 `.docx`，共用 `{{字段}}` 渲染引擎，拒绝静默覆盖 |
| `office_pptx` | "做一份 5 页的 Q3 汇报 PPT" | 幻灯块生成 `.pptx`，同样支持批量 |
| `office_template` | "按 clients.csv 每行填充合同模板" | 模板内占位符替换，跨 run 拆分安全 |
| `office_sheet` | "按部门汇总工资输出 xlsx" | groupBy + sum/avg/min/max/count，输出 `.csv`/`.xlsx` |
| `office_inbox_fetch` | "拉取最近 20 封收件" | 只读 IMAP（PEEK，不置已读），元数据 + 摘要落 JSONL 索引 |
| `office_inbox_triage` | "分诊昨晚收到的邮件" | 确定性规则分四桶（待办/通知/订阅/私信），每条附判定证据 |
| `office_archive_search` | "找带附件的 offer 邮件" | 本地索引检索：发件人/主题/时间窗/附件/分类，零网络 |
| `office_archive_export` | "把这届社团的邮件打包交接" | 匹配邮件只读重取，落 `.eml` + `index.csv` |
| `office_archive_attach` | "把报名邮件里的简历都收下来" | 附件落 workDir 内目录，文件名去重，大小/扩展名上限 |
| `office_stats_overview` | "这学期我收发了多少邮件" | 月度趋势、常用联系人、分类构成，纯本地统计 |
| `office_stats_track` | "我的求职进展到哪一步了" | 自动台账 已投→笔试→面试→offer（只前进）+ 手动修正 + CSV |
| `office_inbox_clean` | "哪些订阅值得退订" | 按发件人频率排序 + List-Unsubscribe 链接；只出建议 |

## 安装（本地插件挂载）

```bash
# 1. 复制进 DSH profile 的 @local 命名空间
cp -R dsh-plugin-office ~/.dsh/profiles/<profile>/node_modules/@local/dsh-plugin-office
cd ~/.dsh/profiles/<profile>/node_modules/@local/dsh-plugin-office
npm install --omit=dev
rm -rf node_modules/@deepseek-ai node_modules/@standard-schema   # 保持运行时单实例

# 2. 在 ~/.dsh/profiles/<profile>/cordis.patch.yml 注册
- insert:
    - id: tool-office
      name: '@local/dsh-plugin-office'
      config:
        smtpHost: smtp.qq.com      # 仅 mode "send" 需要
        smtpUser: ''
        smtpPassEnv: DSH_SMTP_PASS
        fromAddress: ''
        maxRecipients: 50
        maxDocRows: 100
        maxSheetRows: 20000
        maxArchiveMessages: 200    # office_archive_export / _attach 上限
        maxAttachmentMb: 25        # _attach 单附件上限
        imapUser: 'me@qq.com'      # 仅 office_inbox_fetch 需要
        imapPassEnv: DSH_IMAP_PASS # QQ/163/126 需要授权码，非登录密码
```

`office_docgen` 与 `office_sheet` 零配置可用；邮件草稿模式（`.eml`）同样无需凭据，只有 SMTP 直发需要。收件工具方面，`imapHost` 会按 `imapUser` 的邮箱域自动推导（qq/foxmail/163/126/gmail/outlook/hotmail/live 预设），其他邮箱需显式配置 `imapHost`。

## 快速示例

**CSV 批量生成信函**（数据列自动成为 `{{字段}}` 变量）：

```json
{
  "content": [
    { "type": "heading", "level": 1, "text": "{{name}} 的绩效通知" },
    { "type": "paragraph", "text": "尊敬的 {{name}}，您的薪资为 {{salary}}。" },
    { "type": "table", "header": ["项目", "数值"], "rows": [["薪资", "{{salary}}"]] }
  ],
  "dataFile": "employees.csv",
  "outputDir": "letters",
  "filenameTemplate": "letter_{{name}}.docx"
}
```

**表格流水线**：先 inspect 再操作：

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

**邮件合并**：预览、给用户确认、再发送：

```json
{ "subjectTemplate": "{{month}} 工资条通知 - {{name}}",
  "bodyTemplate": "{{name}} 您好，……",
  "recipientsFile": "recipients.csv", "attachmentColumn": "attachment" }
{ "previewId": "pm_…", "mode": "send", "confirm": true }
```

**收件分诊**：先只读拉取，再分桶：

```json
{ "limit": 20, "daysBack": 1 }
{ "sinceHours": 24 }
```

**归档与附件**：先本地检索，再批量收取：

```json
{ "from": "zju.edu.cn", "category": "todo", "hasAttachment": true }
{ "from": "signup@", "outputDir": "exports", "workDir": "/path/to/work" }
{ "extensions": ["pdf"], "outputDir": "resumes", "workDir": "/path/to/work" }
```

**求职台账**：自动扫描、手动修正、导出：

```json
{ "action": "scan" }
{ "action": "update", "company": "tencent", "status": "offer", "note": "SP，11 月入职" }
{ "action": "export", "outputPath": "track.csv", "workDir": "/path/to/work" }
```

## 安全模型

- 邮件不可撤销 → 强制预览 → 人工确认 → `confirm:true`，收件人上限、逐封节流、审计日志落 `~/.dsh/office/mail/sent-log.jsonl`。
- IMAP 严格只读 → 正文以 PEEK 方式拉取（绝不置已读），不改旗标、不删信，本地索引只存元数据与短摘要（`~/.dsh/office/mail/index.jsonl`）。
- 归档写入（`.eml` 导出、附件下载）限定在 workDir 内目录，文件名清洗去重，并有显式上限（`maxArchiveMessages`、`maxAttachmentMb`）。
- 求职台账自动归并只前进（已投 → 笔试 → 面试 → offer），绝不自动降级；其余变化必须走手动 `update`。
- 订阅清理建议只输出清单：绝不代为退订、删除、移动或发送任何东西。
- 任何位置出现缺失 `{{字段}}` 即整体报错并指明字段名；文档绝不带原始占位符出仓。
- 文件输出默认拒绝覆盖，需显式 `overwrite:true`。
- 批量上限（`maxDocRows`、`maxSheetRows`、`maxInboxFetch`、`maxArchiveMessages`）约束内存与影响半径。

## 安全

发送真实邮件、读写本机文件都是需要护栏的操作。套件内置：两阶段预览确认、收件人上限、24 小时滚动发送上限、可选收件域名白名单、逐封节流、邮件头注入清洗、路径边界（不可信表格单元格永远无法把工作目录之外的文件作为附件外发）；每封已投递邮件记入只追加的审计日志；凭据只走环境变量，不落配置文件。完整威胁模型与漏洞史见 [SECURITY.md](SECURITY.md)。

## 路线图

邮件六大生命周期环节（写/发/收/归档/分析/清理）已全部覆盖。下一步候选方向，视真实使用反馈推进：

- 回复草稿与跟进提醒（依赖收件侧数据积累成熟）
- 结合 DSH 定时任务的每早自动分诊

## 相关仓库

- [word-mail-merge-batch-sender](https://github.com/Xplore-LAB/word-mail-merge-batch-sender)：邮件合并的 VBA/Outlook 初版，本插件是其 DSH 继任者
- [dsh-plugin-asmemory](https://github.com/Xplore-LAB/dsh-plugin-asmemory)：DSH 持久记忆插件

## 许可证

MIT

## 发展策略

阅读 [docs/STRATEGY.zh-CN.md](docs/STRATEGY.zh-CN.md)：邮件方向的深挖空间、巨头生态壁垒的结构性裂缝、以及本套件的目标人群（师生与不想受生态连累的办公人群）与路线图。

阅读 [docs/MAIL-SCENARIOS.zh-CN.md](docs/MAIL-SCENARIOS.zh-CN.md)：邮件六大生命周期环节的场景全景地图（师生个人 + 学生组织双线），收件分诊、归档检索、数据分析三个新环节的 v1.2~v1.5 工具规划。
