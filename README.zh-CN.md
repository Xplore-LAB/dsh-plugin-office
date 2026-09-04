# dsh-plugin-office

**[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的 AI 办公工具套件**：邮件合并、Word/PPT 生成、docx 模板注入、表格流水线，六个原生 Agent 工具。

```
office_mail_preview → office_mail_send   批量个性化邮件，两阶段确认 + 审计日志
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
```

`office_docgen` 与 `office_sheet` 零配置可用；邮件草稿模式（`.eml`）同样无需凭据，只有 SMTP 直发需要。

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

## 安全模型

- 邮件不可撤销 → 强制预览 → 人工确认 → `confirm:true`，收件人上限、逐封节流、审计日志落 `~/.dsh/office/mail/sent-log.jsonl`。
- 任何位置出现缺失 `{{字段}}` 即整体报错并指明字段名；文档绝不带原始占位符出仓。
- 文件输出默认拒绝覆盖，需显式 `overwrite:true`。
- 批量上限（`maxDocRows`、`maxSheetRows`）约束内存与影响半径。

## 路线图

- `office_inbox`：IMAP 收件分诊 / 摘要 / 回复草稿（默认只读）

## 相关仓库

- [word-mail-merge-batch-sender](https://github.com/Xplore-LAB/word-mail-merge-batch-sender)：邮件合并的 VBA/Outlook 初版，本插件是其 DSH 继任者
- [dsh-plugin-asmemory](https://github.com/Xplore-LAB/dsh-plugin-asmemory)：DSH 持久记忆插件

## 许可证

MIT

## 发展策略

阅读 [docs/STRATEGY.zh-CN.md](docs/STRATEGY.zh-CN.md)：邮件方向的深挖空间、巨头生态壁垒的结构性裂缝、以及本套件的目标人群（师生与不想受生态连累的办公人群）与路线图。
