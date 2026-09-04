<div align="center">

# dsh-plugin-office

**用大白话指挥 AI 干办公活。你的数据，全程不出自己的电脑。**

[![Release](https://img.shields.io/github/v/release/Xplore-LAB/dsh-plugin-office)](https://github.com/Xplore-LAB/dsh-plugin-office/releases)
[![Tests](https://img.shields.io/badge/tests-100%20passing-brightgreen)](#底层实现)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-8a2be2)](https://github.com/deepseek-ai/deepseek-harness)

简体中文 · [English](README.en.md) · [产品介绍（更通俗的版本）](docs/PRODUCT-INTRO.zh-CN.md)

</div>

---

一个跑在 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness)里的办公插件：你用聊天的方式提要求，AI 替你发邮件、整理收件箱、归档、管求职进度，顺手还能写 Word、做 PPT、算表格。十四个工具，一个聊天窗口全搞定。

## 它能干什么？

你只管用大白话描述任务，AI 自己挑工具、自己干活，还把过程摆给你看。

### 40 封个性化邮件，告别复制粘贴

> 「这是 `recipients.csv`。给每个人发工资条通知，附件用各自的。先给我看预览。」

每一行都先渲染、先检查，你看过点头之后才真正发出去。发送走 SMTP，有节奏控制、有完整台账。QQ / 163 / 126 / Gmail / Outlook 邮箱都能用，免费邮箱一视同仁。Outlook 里那套「Word 邮件合并 + Excel」的老舞步，可以彻底忘了。

### 收件箱自己会分诊

> 「最近三天，哪些邮件真需要我处理？」

先只读拉一遍收件（绝不给你标记已读），然后按规则分成四堆：**要办的、通知、订阅、私信**。每条判定都附理由，比如「主题含面试，截止 9 月 6 日」，分错了你一眼能看出来；拿不准的单独标出来让你复核，绝不瞎猜。

### 一学期的邮件，打包交给下一届

> 「把社团邮箱这学期的邮件全导出来，附件也要。」

匹配到的邮件导出成 `.eml` 加一份 `index.csv`，附件一键批量收齐（报名邮箱里的简历 PDF 一条命令全拿下），文件名自动去重，大小有上限。换届交接、批量收材料、以及「三月份那个附件在哪」这类考古需求，都吃这碗饭。

### 求职进度自己长出来的台账

> 「我投的那些公司，现在都什么状态了？」

它自动从邮件里识别线索，往台账里归并，方向只前进：已投 → 笔试 → 面试 → offer。迟到的拒信不会覆盖已经记录的 offer。免费邮箱发来的招聘信会先放到一边，等你亲手归到对应公司。随时导出 CSV，用套件自带的表格工具接着统计。

### 看看是谁在轰炸你的邮箱

> 「哪些订阅值得退掉？」

按发件人排出频率榜，谁发得最勤一目了然；对方邮件里带了退订链接的，直接给你列出来。只出主意，绝不动手：退订、删除、移动，一概不代劳。

### 顺手的文档能力

结构化内容块生成 Word、幻灯块生成 PPT、往现成的 `.docx` 模板里填 `{{占位符}}`、CSV/XLSX 流水线（先摸清列结构再动手：查看 / 筛选 / 汇总 / 拆分）。

## 长什么样

```text
你    ：拉一下最近 20 封收件，告诉我今天要处理什么
AI    ：拉取了 20 封，3 封需要处理：
       · 腾讯 HR（9月4日）  面试邀请，9月6日前回复     [要办的]
       · 教务处（9月3日）   选课窗口明天开启           [通知]
       · 其余 17 封分为通知/订阅/私信，无截止事项。

你    ：我的求职进展到哪一步了？
AI    ：扫描完索引，台账现有 11 家公司：
       3 家面试中（腾讯、字节、阿里），6 家笔试，
       2 家已 14 天无回复。已导出 track.csv。

你    ：把这份 CSV 按状态汇总成表
AI    ：track.csv → 状态统计：面试 3、笔试 6、已投 2。
       已写入 summary.xlsx。
```

## 十四个工具

| 工具 | 你说什么 | 实际发生什么 |
|---|---|---|
| `office_mail_preview` | "用这个模板渲染 recipients.csv" | 逐行渲染 + 校验，存好，返回 `previewId` |
| `office_mail_send` | "发送预览 pm_1a2b3c，确认" | 草稿模式写 `.eml`（无需 SMTP），或节流投递 + JSONL 台账 |
| `office_inbox_fetch` | "拉取最近 20 封收件" | 只读 IMAP（PEEK，不置已读），元数据 + 摘要落本地索引 |
| `office_inbox_triage` | "分诊昨晚收到的邮件" | 确定性规则分四桶（要办/通知/订阅/私信），每条附判定理由 |
| `office_archive_search` | "找带附件的 offer 邮件" | 本地索引检索：发件人/主题/时间/附件/分类，零网络 |
| `office_archive_export` | "把这届社团的邮件打包交接" | 匹配邮件只读重取，落 `.eml` + `index.csv` |
| `office_archive_attach` | "把报名邮件里的简历都收下来" | 附件存进工作目录，文件名去重，大小/类型上限 |
| `office_stats_overview` | "这学期我收发了多少邮件" | 月度趋势、常用联系人、分类构成，纯本地统计 |
| `office_stats_track` | "我的求职进展到哪一步了" | 自动台账 已投→笔试→面试→offer（只前进）+ 手动修正 + CSV |
| `office_inbox_clean` | "哪些订阅值得退掉" | 按发件人排频率榜 + 退订链接；只出建议，绝不代劳 |
| `office_docgen` | "按 employees.csv 每行生成一份通知书" | 每行一份 `.docx`，共用 `{{字段}}` 引擎，拒绝静默覆盖 |
| `office_pptx` | "做一份 5 页的 Q3 汇报 PPT" | 幻灯块生成 `.pptx`，同样支持批量 |
| `office_template` | "按 clients.csv 每行填充合同模板" | 模板内占位符替换，跨 run 拆分安全 |
| `office_sheet` | "按部门汇总工资输出 xlsx" | groupBy + sum/avg/min/max/count，输出 `.csv`/`.xlsx` |

## 给谁用

学生和老师、社团和组织负责人、找工作季节的求职者，以及所有「办公软件就是一个免费邮箱」的人。尤其适合在意自己的邮件和文档到底存在哪的人。

| | 网页版邮箱自带功能 | Copilot 类助手 | dsh-plugin-office |
|---|---|---|---|
| 花费 | 免费 | 按月订阅 | 免费（MIT），只花你本来就在花的模型用量 |
| 邮箱 | 只有自家 | 绑死厂商生态 | QQ / 163 / 126 / Gmail / Outlook，各配一次 |
| 数据在哪 | 服务商服务器 | 厂商云端 | 自己电脑，不上传任何东西 |
| 能不能改 | 不能 | 有限 | 完全开源，随便改 |

不宣称「比大厂更安全」，诚实的说法是：威胁面不同，而且每一块都握在你自己手里。详见 [SECURITY.md](SECURITY.md)。

## 安全模型（人话版）

- **发信必须过两道门。** 没有你预览点头 + `confirm:true`，一封都发不出去。收件人上限、逐封节流、域名白名单、只追加的台账，全都有。
- **收信严格只读。** 正文用 PEEK 方式拉（绝不标记已读），不改旗标、不删信；本地索引只存元数据和 300 字摘要。
- **清理只出主意。** 退订、删除、移动、发送，一概不代劳。
- **文件不出界。** 导出和附件下载锁死在工作目录里，带显式上限；不可信的表格单元格永远没法把目录之外的文件当附件发出去。
- **出错就大声报。** 缺 `{{字段}}` 直接报错并指明字段名，文档绝不带原始占位符出仓；输出绝不悄悄覆盖。
- **密码不落盘。** SMTP 和 IMAP 的凭据只从环境变量读。

## 安装

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

**零配置就能用的部分**：文档、表格、PPT、归档检索、统计、邮件草稿（`.eml`），全都不需要任何凭据。只有 SMTP 真发信和 IMAP 收信需要授权码。收件工具的 `imapHost` 会按你的邮箱地址自动推导（qq/foxmail/163/126/gmail/outlook/hotmail/live 预设），其他邮箱需显式配置 `imapHost`。

<details>
<summary><b>全部工具调用示例</b>（AI 会替你组装这些 JSON，人不用写）</summary>

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

**表格流水线**，先 inspect 再操作：

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

**邮件合并**，预览、给用户确认、再发送：

```json
{ "subjectTemplate": "{{month}} 工资条通知 - {{name}}",
  "bodyTemplate": "{{name}} 您好，……",
  "recipientsFile": "recipients.csv", "attachmentColumn": "attachment" }
{ "previewId": "pm_…", "mode": "send", "confirm": true }
```

**收件分诊**，先只读拉取，再分桶：

```json
{ "limit": 20, "daysBack": 1 }
{ "sinceHours": 24 }
```

**归档与附件**，先本地检索，再批量收取：

```json
{ "from": "zju.edu.cn", "category": "todo", "hasAttachment": true }
{ "from": "signup@", "outputDir": "exports", "workDir": "/path/to/work" }
{ "extensions": ["pdf"], "outputDir": "resumes", "workDir": "/path/to/work" }
```

**求职台账**，自动扫描、手动修正、导出：

```json
{ "action": "scan" }
{ "action": "update", "company": "tencent", "status": "offer", "note": "SP，11 月入职" }
{ "action": "export", "outputPath": "track.csv", "workDir": "/path/to/work" }
```

</details>

## 常见问题

<details>
<summary><b>要花钱吗？</b></summary>

插件 MIT 协议，免费。只花你本来就在花的 DSH 模型用量，没有订阅、没有云端付费档、没有遥测。
</details>

<details>
<summary><b>QQ / 163 / 126 邮箱能用吗？</b></summary>

能。这些邮箱对免费用户开放完整的 SMTP 和 IMAP，只需要在邮箱设置里生成一个授权码（和登录密码不同）。服务器地址按你的邮箱地址自动推导，不用手填。
</details>

<details>
<summary><b>它会不会不经我同意就发信、删信？</b></summary>

不会。发信必须走「预览 → 你点头 → `confirm:true`」三步；收件侧从设计上就是只读的；订阅清理只输出一份报告。这些是设计约束，改配置也绕不过去。
</details>

<details>
<summary><b>我的邮件内容存到哪了？</b></summary>

存在本机 `~/.dsh/office/mail/` 下的 JSONL 索引里，只有元数据和 300 字摘要。全文和附件只有你明确导出或收取时才落盘，不上传任何地方。
</details>

<details>
<summary><b>为什么不直接用 Office / Copilot / 网页版邮箱？</b></summary>

它们够用就继续用。这套工具是给被它们跳过的人准备的：付费生态之外的免费邮箱用户，以及想让自动化过程看得见、数据留在本地的人。完整定位分析见 [docs/STRATEGY.zh-CN.md](docs/STRATEGY.zh-CN.md)。
</details>

## 底层实现

原生 Cordis 插件（`defineTool`，无 MCP 中转）。SMTP 走 nodemailer，IMAP 走 ImapFlow + mailparser（同属 Postal Systems 血统，MIT）。文档走 docx / pptxgenjs / exceljs。100 项端到端测试覆盖全部工具和安全护栏（路径逃逸、头注入、覆盖拒绝、台账只前进）。完整威胁模型与漏洞史：[SECURITY.md](SECURITY.md)。

## 路线图

邮件六大生命周期环节（写 / 发 / 收 / 归档 / 分析 / 清理）已全部覆盖。下一步候选，看真实使用反馈：

- 回复草稿与跟进提醒
- 结合 DSH 定时任务的每早自动分诊

## 相关

- [word-mail-merge-batch-sender](https://github.com/Xplore-LAB/word-mail-merge-batch-sender)：邮件合并的 VBA/Outlook 初版，本插件是其 DSH 继任者
- [dsh-plugin-asmemory](https://github.com/Xplore-LAB/dsh-plugin-asmemory)：DSH 持久记忆插件

延伸阅读：[发展策略](docs/STRATEGY.zh-CN.md)（邮件方向还有多大空间、巨头的壁垒裂在哪） · [场景全景地图](docs/MAIL-SCENARIOS.zh-CN.md)（六大环节的完整场景拆解） · [产品介绍](docs/PRODUCT-INTRO.zh-CN.md)（更通俗的版本）

## 许可证

MIT
