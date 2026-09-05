# Postbird 品牌与命名规范

本文档记录 Postbird 的四层身份、命名撞车排查结果，以及对外使用时的硬规则。改动品牌相关文案前先读它。

## 一、四层身份

| 层级 | 值 | 能否改动 | 说明 |
| --- | --- | --- | --- |
| 产品名 | Postbird 信鸽 | 可 | 对外一律带限定语，见第二节硬规则 1 |
| 仓库名 | `Xplore-LAB/postbird` | 已定 | 2026-09-05 由 `dsh-plugin-office` 改名而来 |
| 运行时包名 | `@local/dsh-plugin-office` | 不动 | Cordis 挂载配置依赖它，改名会使已装用户失效 |
| npm 包名 | 未发布 | 未定 | 若发布须用 `postbird-dsh` 或 `@xplore-lab/postbird`，禁止裸名 `postbird` |

## 二、撞车排查（2026-09-06）

| 已有名称 | 主体 | 是什么 | 冲突程度 | 处置 |
| --- | --- | --- | --- | --- |
| Mailbird | Contenga International | Windows / macOS 桌面邮件客户端，2012 年起，官网称 440 万用户，统一收件箱 + 30 余款应用集成 | 高 | 命名结构同构（邮件语义词 + bird），领域高度重叠。加限定语与免责声明切割 |
| Postbird（postbird.be） | Mailstreet，比利时 Hasselt | 实体信件打印装封投递 SaaS，带 API，11 至 50 人 | 中 | 完全同名，同属邮件邮寄类目。加限定语与免责声明，且产品不做商业邮寄方向 |
| `postbird`（npm） | 未占用 | 空 | 低 | 仍禁止发裸名，避免日后与上面两家撞车 |

Mailbird 运营十余年且为商业产品，第 9 类与第 42 类商标大概率已注册；本结论未在 USPTO 或 EUIPO 做正式检索，属推断。若未来商业化或发行 npm 包，先做正式商标检索再定。

## 三、硬规则

1. **首次出现必须带限定语。** 文档标题、README 首屏、对外介绍统一写作 Postbird for DeepSeek Harness（中文可写「Postbird for DSH」）。单独一个 Postbird 只在已交代过上下文的正文里出现。
2. **免责声明常驻。** README 中英文首屏各一行，指向本文件的链接保留在导航行。
3. **不碰一级域名。** 不注册 `postbird.com` / `postbird.dev` / `postbird.io`。社交与发布账号一律用 `postbird-dsh` 这类带后缀的形式。
4. **视觉保持独立。** 品牌色与 Logo 走信鸽插画路线，不向 Mailbird 的扁平 UI 图标风格靠拢。
5. **不做实体邮寄。** 产品边界锁在电子邮件的读写与统计，避开 postbird.be 所在的纸质信件类目。

## 四、写法规范

| 场景 | 写法 |
| --- | --- |
| 英文正文 | `Postbird`（首字母大写，其余小写，单字连写） |
| 中文正文 | `Postbird 信鸽` 或 `Postbird for DSH` |
| 错误写法 | `PostBird`（会被读成两个单词）、`postbird` 作句首、`Post Bird` |
| 命令行与包名 | 全小写 `postbird` 仅出现在目录名与 git clone 地址里 |

## 五、免责声明模板

中文：

> Postbird for DeepSeek Harness 是独立开源项目，与 Mailbird（Contenga International）、Postbird（Mailstreet，比利时）无任何隶属、背书或合作关系。

英文：

> Postbird for DeepSeek Harness is an independent open-source project. It is not affiliated with, endorsed by, or connected to Mailbird (Contenga International) or Postbird (Mailstreet, Belgium).
