<div align="center">

<img src="assets/brand/postbird-logo.png" alt="Postbird 信鸽：一只叼着密封信封的蓝色信鸽" width="144">

# Postbird 信鸽

**AI 替你跑邮件和文档这趟腿。跑腿而已，做主的还是你。**

[![Release](https://img.shields.io/github/v/release/Xplore-LAB/postbird)](https://github.com/Xplore-LAB/postbird/releases)
[![Tests](https://img.shields.io/badge/tests-100%20passing-brightgreen)](#底层实现)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-8a2be2)](https://github.com/deepseek-ai/deepseek-harness)

简体中文 · [English](README.en.md) · [产品介绍](docs/PRODUCT-INTRO.zh-CN.md) · [竞品对比](docs/COMPETITORS.zh-CN.md)

</div>

---

信鸽只负责把信送到，不替你拆信、不替你回信、更不会替你把信扔了。这是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的办公插件（包名 `dsh-plugin-office`），十四个工具：群发邮件、整理收件箱、归档交接、求职台账、Word / PPT / 表格。QQ、163、Gmail 都能用，不挑邮箱、不收订阅费、不上传数据。

<p align="center">
  <img src="assets/brand/postbird-readme-banner.png" alt="从一句话到信鸽处理，再到邮件和文档留在本地电脑的 Postbird 工作流程" width="100%">
</p>

```text
你 ：拉一下最近三天的收件，哪些真需要我处理？
AI ：只读拉取 61 封（没标记已读）。要办的 3 封：
     · 腾讯 HR（今天 10:42）  面试邀请，9 月 6 日前回复确认
     · 教务处（昨天 16:20）   选课窗口明天 9:00 开启
     · 招商银行（今天 09:15） 网银登录验证码
     其余：通知 12 · 订阅 41 · 私信 5。有 2 封拿不准，要复核吗？

你 ：顺便看看我投的公司到哪一步了。
AI ：台账 11 家：面试中 3（腾讯 9/6 二面、字节、阿里）、
     笔试 4、已投未回 4（其中 2 家超 14 天）。
     拼多多 HR 用的个人 QQ 邮箱，认不出公司，要归到拼多多吗？

你 ：归过去，导出一份表。
AI ：已更新并写入 track.csv（12 行）。
```

## 三步装上

```bash
# 1. 克隆仓库，放进 DSH profile 的 @local 目录
# 仓库名是 postbird，插件包名仍是 @local/dsh-plugin-office
git clone https://github.com/Xplore-LAB/postbird.git
cp -R postbird ~/.dsh/profiles/<profile>/node_modules/@local/dsh-plugin-office
cd ~/.dsh/profiles/<profile>/node_modules/@local/dsh-plugin-office
npm install --omit=dev
rm -rf node_modules/@deepseek-ai node_modules/@standard-schema   # 保持运行时单实例
```

```yaml
# 2. 在 ~/.dsh/profiles/<profile>/cordis.patch.yml 里注册
- insert:
    - id: tool-office
      name: '@local/dsh-plugin-office'
      config:
        imapUser: 'me@qq.com'       # 想收邮件才填
        imapPassEnv: DSH_IMAP_PASS  # QQ/163/126 填授权码，不是登录密码
```

```bash
# 3. 密码只走环境变量，不落配置文件
export DSH_IMAP_PASS='你的授权码'
```

**先不填密码也能用**：文档、PPT、表格、归档检索、统计、邮件草稿，十个工具零配置直接跑。只有真发信（SMTP）和真收信（IMAP）需要授权码，服务器地址按你的邮箱后缀自动认（qq / foxmail / 163 / 126 / gmail / outlook / hotmail / live）。

完整配置项见下方[折叠区](#完整配置项)。

## 六件它替你干的事

**给 40 个人各发一封不同的信。**「按 `members.csv` 发中秋通知，称呼用『昵称』列，附件用『附件』列，先给我看预览。」逐行渲染、你点头才发、1.5 秒一封节流、发完留台账。Word 模板加 Excel 名单加 Outlook 合并那套三件套，可以扔了。

**收件箱自己分好堆。**「哪些真需要我处理？」只读拉取（绝不标已读），分成**要办的 / 通知 / 订阅 / 私信**四堆，每条附判定理由（「主题含面试」），拿不准的单独列出等你复核，绝不瞎猜。

**一学期的邮件打包交给下一届。**「全导出来，附件也要。」按发件人、时间段、有无附件筛选，产出 `.eml` 加一份 `index.csv` 清单，附件批量收齐、重名自动加序号。换届交接、收报名简历、「三月那个附件在哪」的考古，都走这条。

**求职台账自己长出来。**「我投的公司到哪一步了？」从邮件识别笔试、面试、offer、拒信，按公司归并，进度**只前进不后退**（迟到的拒信盖不掉已记录的 offer）。HR 用个人邮箱发的信认不出公司，单独放着等你归位。导出 CSV 接着统计。

**看看谁在轰炸你的邮箱。**「哪些订阅值得退？」按发件人排频率榜，带退订链接的直接列出来。**只出主意**，退订、删除、移动一概不代劳。

**顺手的文档四件套。** 按 CSV 每行生成一份 Word 通知书；做一份带表格和图片的 PPT；往现成 `.docx` 模板里填 `{{占位符}}`；表格查看、筛选、汇总、拆分（先摸清列结构再动手）。

## 十四个工具

| 工具 | 你说什么 | 实际发生什么 |
|---|---|---|
| `office_mail_preview` | "用这个模板渲染 recipients.csv" | 逐行渲染 + 校验，存好，返回 `previewId` |
| `office_mail_send` | "发送预览 pm_1a2b3c，确认" | 草稿模式写 `.eml`（无需 SMTP），或节流投递 + JSONL 台账 |
| `office_inbox_fetch` | "拉取最近 20 封收件" | 只读 IMAP（PEEK，不置已读），元数据 + 摘要落本地索引 |
| `office_inbox_triage` | "分诊昨晚收到的邮件" | 确定性规则分四桶，每条附判定理由 |
| `office_archive_search` | "找带附件的 offer 邮件" | 本地索引检索：发件人 / 主题 / 时间 / 附件 / 分类，零网络 |
| `office_archive_export` | "把这届社团的邮件打包交接" | 匹配邮件只读重取，落 `.eml` + `index.csv` |
| `office_archive_attach` | "把报名邮件里的简历都收下来" | 附件存进工作目录，文件名去重，大小 / 类型上限 |
| `office_stats_overview` | "这学期我收发了多少邮件" | 月度趋势、常用联系人、分类构成，纯本地统计 |
| `office_stats_track` | "我的求职进展到哪一步了" | 自动台账 已投→笔试→面试→offer（只前进）+ 手动修正 + CSV |
| `office_inbox_clean` | "哪些订阅值得退掉" | 按发件人排频率榜 + 退订链接；只出建议，绝不代劳 |
| `office_docgen` | "按 employees.csv 每行生成一份通知书" | 每行一份 `.docx`，`{{字段}}` 引擎，拒绝静默覆盖 |
| `office_pptx` | "做一份 5 页的季度汇报" | 幻灯块生成 `.pptx`，支持批量 |
| `office_template` | "按 clients.csv 每行填充合同模板" | 模板内占位符替换，跨 run 拆分安全 |
| `office_sheet` | "按部门汇总工资输出 xlsx" | groupBy + sum/avg/min/max/count，输出 `.csv` / `.xlsx` |

## 为什么是它

主流 AI 办公工具有两道墙：**订阅费**（Superhuman $30/月、Fyxer $22.5/月）和**邮箱生态**（Shortwave 只支持 Gmail，开源标杆 inbox-zero 靠 OAuth 锁死 Gmail 和 Microsoft，QQ / 163 用户整个被排除在外）。

| | 网页版邮箱 | Copilot 类 | MCP 邮件服务器 | Postbird |
|---|---|---|---|---|
| 花费 | 免费 | 按月订阅 | 免费 | 免费（MIT） |
| 邮箱 | 只有自家 | 绑死生态 | 通吃 | 通吃，QQ/163 一视同仁 |
| 数据在哪 | 服务商 | 厂商云端 | 本地 | 本地，零上传 |
| 危险操作 | 手动 | 厂商说了算 | `delete_email` 直给模型 | **没有删除工具**，发信强制两阶段 |
| 场景 | 通用 | 通用 | 通用原语 | 求职台账、换届归档等成套闭环 |

一句话：**「免费邮箱 + 数据本地 + 场景开箱即用」这个交集，现在没别人站着。** 详细版图见[竞品对比](docs/COMPETITORS.zh-CN.md)。

诚实的短板也摆出来：没有预写回复（对手标配）、没有实时监听、单账户、只能在 DSH 里用。

## 信鸽不做的事

送信的鸟不该替主人做主，这套工具的护栏就是照这条画的。

<p align="center">
  <img src="assets/brand/postbird-safety-boundary.svg" alt="Postbird 的四条安全边界：发信前确认、收件只读、不提供删除、数据留在本地" width="900">
</p>

- **发信必须过两道门。** 没有预览 + `confirm:true`，一封都发不出去。收件人上限、逐封节流、域名白名单、只追加台账。
- **收信严格只读。** 正文用 PEEK 拉取（绝不标已读），不改旗标、不删信，本地只存元数据加 300 字摘要。
- **清理只出主意。** 退订、删除、移动，一概不代劳。Postbird **没有任何删除邮件的工具**，想删也删不了。
- **文件不出界。** 导出和附件下载锁死工作目录，带显式上限；表格里的恶意单元格没法把目录外的文件当附件发出去。
- **出错就大声报。** 缺 `{{字段}}` 直接报错并指名字段，绝不带着占位符出仓；输出绝不悄悄覆盖。
- **密码不落盘。** SMTP 和 IMAP 凭据只从环境变量读。

不宣称「比大厂更安全」，准确的说法是威胁面不同，而且每一块都握在你自己手里。完整威胁模型见 [SECURITY.md](SECURITY.md)。

<details id="完整配置项">
<summary><b>完整配置项</b></summary>

```yaml
config:
  smtpHost: smtp.qq.com        # 仅真发信需要
  smtpUser: ''
  smtpPassEnv: DSH_SMTP_PASS
  fromAddress: ''
  maxRecipients: 50            # 单批收件人上限
  sendIntervalMs: 1500         # 逐封节流
  maxDocRows: 100              # 单批文档生成上限
  maxSheetRows: 20000          # 单次读表上限
  maxArchiveMessages: 200      # 归档导出 / 附件收取上限
  maxAttachmentMb: 25          # 单附件大小上限
  imapUser: 'me@qq.com'        # 仅收信需要
  imapPassEnv: DSH_IMAP_PASS
  imapHost: ''                 # 留空则按邮箱后缀自动推导
```

</details>

<details>
<summary><b>工具调用示例</b>（AI 会替你组装，人不用写）</summary>

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

**邮件合并**，预览、确认、再发送：

```json
{ "subjectTemplate": "{{month}} 工资条通知 - {{name}}",
  "bodyTemplate": "{{name}} 您好，……",
  "recipientsFile": "recipients.csv", "attachmentColumn": "attachment" }
{ "previewId": "pm_…", "mode": "send", "confirm": true }
```

**收件与归档**：

```json
{ "limit": 20, "daysBack": 1 }
{ "sinceHours": 24 }
{ "from": "zju.edu.cn", "category": "todo", "hasAttachment": true }
{ "extensions": ["pdf"], "outputDir": "resumes", "workDir": "/path/to/work" }
```

**求职台账**，自动扫描、手动修正、导出：

```json
{ "action": "scan" }
{ "action": "update", "company": "tencent", "status": "offer", "note": "SP，11 月入职" }
{ "action": "export", "outputPath": "track.csv", "workDir": "/path/to/work" }
```

</details>

<details>
<summary><b>常见问题</b></summary>

**要花钱吗？** 插件 MIT 协议免费，只花你本来就在花的 DSH 模型用量。没有订阅、没有云端付费档、没有遥测。

**QQ / 163 / 126 能用吗？** 能。这些邮箱对免费用户开放完整 SMTP 和 IMAP，去邮箱设置里生成一个授权码即可（和登录密码不是一回事）。服务器地址自动推导，不用手填。

**它会不会不经我同意就发信、删信？** 不会。发信必须走「预览 → 你点头 → `confirm:true`」；收件侧设计上就是只读；订阅清理只输出报告。Postbird 里根本没有删除邮件的工具，改配置也绕不过去。

**我的邮件存到哪了？** 本机 `~/.dsh/office/mail/` 下的 JSONL 索引，只有元数据和 300 字摘要。全文和附件只在你明确导出时才落盘，不上传任何地方。

**为什么不直接用 Copilot 或网页版邮箱？** 它们够用就继续用。Postbird 是给被它们跳过的人准备的：付费生态之外的免费邮箱用户，以及想让过程看得见、数据留本地的人。完整分析见 [STRATEGY.zh-CN.md](docs/STRATEGY.zh-CN.md)。

**为什么叫信鸽？** 信鸽只管把信送到，不拆、不回、不扔。这套工具的边界跟这只鸟一样：跑腿全包，做主权归你。

</details>

## 底层实现

原生 Cordis 插件（`defineTool`，无 MCP 中转）。SMTP 走 nodemailer，IMAP 走 ImapFlow + mailparser（同属 Postal Systems 血统，MIT）。文档走 docx / pptxgenjs / exceljs。100 项端到端测试覆盖全部工具和安全护栏：路径逃逸、邮件头注入、覆盖拒绝、台账只前进。

## 路线图

邮件的六个环节（写 / 发 / 收 / 归档 / 分析 / 清理）已全部覆盖。下一步看真实使用反馈：回复草稿与跟进提醒、结合 DSH 定时任务的每早自动分诊。

## 相关

[word-mail-merge-batch-sender](https://github.com/Xplore-LAB/word-mail-merge-batch-sender)（邮件合并的 VBA/Outlook 初版，Postbird 是它的继任者） · [dsh-plugin-asmemory](https://github.com/Xplore-LAB/dsh-plugin-asmemory)（DSH 持久记忆插件）

延伸阅读：[产品介绍](docs/PRODUCT-INTRO.zh-CN.md)（对话实录版） · [竞品对比](docs/COMPETITORS.zh-CN.md) · [发展策略](docs/STRATEGY.zh-CN.md) · [场景全景地图](docs/MAIL-SCENARIOS.zh-CN.md)

## 许可证

MIT
