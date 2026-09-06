const scenes = {
  roleUndergrad: {
    prompt: "帮我看看这周有哪些必须完成的事情。",
    intro: "我会把教务、学院、辅导员和任课教师的通知汇成一张本周行动清单，并保留每项结论的邮件依据。",
    steps: [
      ["office_inbox_triage", "区分教务通知、课程邮件与普通订阅"],
      ["office_action_extract", "提取作业、考试、申请与回复要求"],
      ["office_attachment_ask", "核对附件中的提交格式与缺失材料"],
      ["office_daily_brief", "生成本周必做清单与日历建议"]
    ],
    reply: "这周有 4 项必须完成。数据库作业周三截止，六级信息周五确认，奖学金材料还缺成绩单，王老师的实验安排需要回复。",
    render: () => renderCampus("undergrad")
  },
  roleGraduate: {
    prompt: "导师最近让我修改了什么，帮我整理并起草回复。",
    intro: "我会读完整邮件线程，对照附件版本，提取导师的修改要求与汇报节点，再生成一封有依据的正式回复。",
    steps: [
      ["office_thread_summary", "还原 6 封往来邮件与历史承诺"],
      ["office_attachment_ask", "定位批注中的段落和图表要求"],
      ["office_action_extract", "生成论文修改清单与截止日期"],
      ["office_reply_draft", "结合上下文准备正式回复"],
      ["office_mail_preview", "展示收件人、正文与附件预览"]
    ],
    reply: "导师新增了 3 项要求。我已整理为论文修改计划，标注下次汇报日期，并准备好正式回复。每一项都能回到原邮件或附件位置。",
    render: () => renderCampus("graduate")
  },
  roleCounselor: {
    prompt: "统计奖学金材料提交情况，提醒还缺材料的学生。",
    intro: "我会对照学生名单和邮件附件，区分已齐、缺件和未交，生成个性化提醒与可导出的汇总表。",
    steps: [
      ["office_collection_track", "核对 86 名学生和 4 项必需材料"],
      ["office_attachment_ask", "读取申请表与证明文件的关键字段"],
      ["office_reply_draft", "为缺件学生生成个性化提醒"],
      ["office_mail_preview", "展示完整收件人与发送内容"],
      ["office_sheet", "导出 Excel 汇总和留档清单"]
    ],
    reply: "86 名学生中 68 人材料齐全，11 人缺件，7 人尚未提交。我已逐人列出缺失项并生成提醒预览，发送仍需你确认。",
    render: () => renderCampus("counselor")
  },
  roleAdmin: {
    prompt: "整理本次培训报名邮件，生成名单、缺失材料提醒和汇报。",
    intro: "我会汇总报名邮件，检查字段、重复记录和附件，再一次生成名单、提醒、Word 汇报和 PPT 概览。",
    steps: [
      ["office_collection_track", "汇总 128 封报名邮件并核对名单"],
      ["office_attachment_ask", "抽取部门、联系方式和报名项目"],
      ["office_sheet", "生成去重后的 Excel 报名表"],
      ["office_docgen", "生成 Word 情况汇报"],
      ["office_pptx", "生成会议用 PPT 概览"]
    ],
    reply: "报名材料已整理。发现 3 条重复报名和 9 人字段缺失，Excel 名单、提醒草稿、Word 汇报与 PPT 概览均已准备。",
    render: () => renderCampus("admin")
  },
  roleTeacher: {
    prompt: "汇总数据库课程的学生邮件，告诉我需要处理什么。",
    intro: "我会把作业、补交、请假和重复问题汇总成班级状态，准备分类回复，并整理课程归档。",
    steps: [
      ["office_archive_search", "定位数据库课程相关邮件"],
      ["office_action_extract", "识别补交、请假和待确认事项"],
      ["office_collection_track", "核对作业提交与缺交学生"],
      ["office_reply_draft", "为不同问题生成回复草稿"],
      ["office_archive_attach", "归档课程邮件和作业附件"]
    ],
    reply: "需要处理 13 项：3 位学生申请补交，2 封请假待确认，8 个重复问题可以统一回复。12 份新作业已进入提交表。",
    render: () => renderCampus("teacher")
  },
  roleProfessor: {
    prompt: "帮我处理最近三天的重要邮件，只保留需要我决策的事情。",
    intro: "我会过滤宣传与普通通知，汇总学术线程，只留下需要判断、审批或委派的事项。",
    steps: [
      ["office_daily_brief", "筛出最近三天的高价值邮件"],
      ["office_thread_summary", "还原合作、投稿与学生邮件上下文"],
      ["office_action_extract", "提取需要决策、审批和委派的事项"],
      ["office_reply_draft", "为需要回复的邮件准备草稿"]
    ],
    reply: "今天需要你决策 5 件事：两篇论文修改、一项合作邀请、一份学生实验方案和一个基金节点。其余事项已整理为可委派清单。",
    render: () => renderCampus("professor")
  },
  daily: {
    prompt: "帮我开始今天的工作，告诉我最需要处理什么。",
    intro: "我会读取本地索引，把邮件分类、截止时间和等待回复事项合并成一份今日行动简报。",
    steps: [
      ["office_inbox_triage", "理解 61 封邮件的类型与依据"],
      ["office_action_radar", "提取截止时间与待回复事项"],
      ["office_daily_brief", "生成今天最重要的 5 件事"]
    ],
    reply: "早上好。今天有 2 项截止、1 封需要回复、1 份材料待补充。我已经按紧急程度排好顺序，每项都附有原邮件依据。",
    render: renderDaily
  },
  radar: {
    prompt: "找出最近两周所有截止事项、等待回复和需要催办的邮件。",
    intro: "我会从主题和摘要中提取行动、负责人和明确时间，并将逾期、今日和未来事项分开。",
    steps: [
      ["office_archive_search", "筛选最近两周的邮件"],
      ["office_action_radar", "识别行动、截止时间与状态"],
      ["evidence_guard", "为每项结果保留判断依据"]
    ],
    reply: "行动雷达发现 12 项工作：2 项已经逾期，3 项今天到期，5 项即将到期，2 项等待补充时间。",
    render: renderRadar
  },
  reply: {
    prompt: "结合导师关于论文修改的邮件线程，帮我准备回复。",
    intro: "我会合并同一主题的往来邮件，找出导师的修改要求和历史承诺，再准备三种可编辑回复。",
    steps: [
      ["office_thread_summary", "定位并整理 6 封邮件上下文"],
      ["office_attachment_ask", "核对附件中的具体修改位置"],
      ["office_context_reply", "结合上下文准备三种可编辑回复"],
      ["office_mail_preview", "准备发送前安全预览"]
    ],
    reply: "已读完 6 封往来邮件。导师提出 3 项修改要求，我准备了简洁、正式和友好三种回复，选择后仍需你确认。",
    render: renderReply
  },
  triage: {
    prompt: "拉一下最近三天的收件，哪些真需要我处理？",
    intro: "我会只读拉取邮件，按待办、通知、订阅和私信分类，并把低置信度项目留给你复核。",
    steps: [
      ["office_inbox_fetch", "只读获取 61 封邮件"],
      ["office_inbox_triage", "分类并生成判断依据"],
      ["office_stats_overview", "汇总趋势与联系人"]
    ],
    reply: "处理完成。61 封邮件中有 3 封需要你行动，2 封建议人工复核。收件过程保持只读，没有改变邮件状态。",
    render: renderTriage
  },
  mailmerge: {
    prompt: "按客户名单生成 24 封活动邀请，称呼和权益各不相同，先让我预览。",
    intro: "我会校验名单、渲染每封邮件、检查重复地址和附件路径，然后生成一份待确认预览。",
    steps: [
      ["office_sheet", "检查名单列与 24 条数据"],
      ["office_mail_preview", "渲染 24 封个性化邮件"],
      ["safety_guard", "检查收件人与发送上限"]
    ],
    reply: "预览已生成。24 个地址全部有效，主题和称呼已逐行替换。请检查右侧样本，确认后可模拟发送。",
    render: renderMailmerge
  },
  jobs: {
    prompt: "看看我投的公司都到哪一步了，把求职进度整理成台账。",
    intro: "我会从本地邮件索引识别公司和招聘阶段，合并重复消息，并保留需要你归属的项目。",
    steps: [
      ["office_archive_search", "找到 37 封招聘相关邮件"],
      ["office_stats_track", "识别公司与阶段变化"],
      ["office_sheet", "生成可继续编辑的台账"]
    ],
    reply: "求职台账已更新：11 家公司，3 家进入面试，1 家收到 offer。发现 1 封个人邮箱来信，等待你确认公司归属。",
    render: renderJobs
  },
  analytics: {
    prompt: "分析这个月的邮件趋势，找出占用收件箱最多的订阅来源。",
    intro: "我会读取本地索引，统计收发趋势、常用联系人和订阅占比，并提取可用的退订入口。",
    steps: [
      ["office_stats_overview", "统计 486 封邮件的趋势"],
      ["office_inbox_clean", "识别 23 个高频订阅来源"],
      ["privacy_guard", "确认全程只读本地索引"]
    ],
    reply: "分析完成。订阅邮件占本月收件量的 42%，前三个来源贡献了 119 封。右侧已列出频率和清理建议。",
    render: renderAnalytics
  },
  documents: {
    prompt: "把员工 CSV 做成部门汇总表、逐人 Word 通知和管理层汇报 PPT。",
    intro: "我会先识别表格结构，再进行部门汇总，并用同一份数据生成 Word 与 PowerPoint。",
    steps: [
      ["office_sheet", "读取 6 行 4 列并按部门汇总"],
      ["office_docgen", "生成 6 份个性化 Word"],
      ["office_pptx", "生成管理层汇报 PPT"]
    ],
    reply: "全部完成。已经生成 1 份 Excel 汇总、6 份 Word 通知和 1 份 PowerPoint，文件均可下载检查。",
    render: renderDocuments
  },
  archive: {
    prompt: "把这个项目近半年的邮件和附件全部归档，方便交接给下一位负责人。",
    intro: "我会先从本地索引确认范围，再以只读方式导出原始邮件、附件与检索清单。",
    steps: [
      ["office_archive_search", "匹配 128 封项目邮件"],
      ["office_archive_export", "导出原始邮件与索引"],
      ["office_archive_attach", "收取并去重 46 个附件"]
    ],
    reply: "交接包已准备好：128 封原始邮件、46 个附件和 1 份 CSV 索引。重复文件已自动编号，目录结构可以直接移交。",
    render: renderArchive
  }
};

const chatStream = document.querySelector("#chatStream");
const promptInput = document.querySelector("#promptInput");
const resultContent = document.querySelector("#resultContent");
const runButton = document.querySelector("#runButton");
const resetButton = document.querySelector("#resetButton");
const statusChip = document.querySelector("#statusChip");
const toast = document.querySelector("#toast");
let activeScene = "roleGraduate";
let running = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function welcome(sceneKey) {
  const scene = scenes[sceneKey];
  chatStream.innerHTML = `
    <div class="welcome">
      <div class="welcome-mark">✦</div>
      <h3>准备好了</h3>
      <p>这个体验会模拟真实工具协作。选择场景，也可以修改下面这句话。</p>
      <div class="prompt-preview">“${escapeHtml(scene.prompt)}”</div>
    </div>`;
  promptInput.value = scene.prompt;
  resultContent.innerHTML = `<div class="result-empty"><div><span>◌</span><p>运行场景后<br>结果将在这里实时出现</p></div></div>`;
  statusChip.textContent = "等待指令";
  statusChip.className = "status-chip";
}

function message(role, text) {
  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.innerHTML = role === "user"
    ? `<div class="bubble">${escapeHtml(text)}</div><div class="avatar">你</div>`
    : `<div class="avatar">P</div><div class="bubble">${escapeHtml(text)}</div>`;
  chatStream.appendChild(item);
  chatStream.scrollTop = chatStream.scrollHeight;
}

function toolRunner(steps) {
  const node = document.createElement("div");
  node.className = "tool-runner";
  node.innerHTML = `
    <div class="tool-title"><b>执行计划</b><span>本地工作流</span></div>
    ${steps.map(([name, detail], index) => `<div class="tool-step" data-step="${index}"><i></i><span><b>${name}</b> · ${detail}</span></div>`).join("")}`;
  chatStream.appendChild(node);
  chatStream.scrollTop = chatStream.scrollHeight;
  return node;
}

async function run() {
  if (running) return;
  const customPrompt = promptInput.value.trim();
  if (!customPrompt) {
    showToast("先写一句你想完成的事");
    promptInput.focus();
    return;
  }
  running = true;
  runButton.disabled = true;
  statusChip.textContent = "正在执行";
  statusChip.className = "status-chip running";
  chatStream.innerHTML = "";
  resultContent.innerHTML = `<div class="result-empty"><div><span>◌</span><p>Postbird 正在整理结果…</p></div></div>`;

  const detected = detectScene(customPrompt);
  if (detected !== activeScene) selectScene(detected, false);
  const scene = scenes[detected];
  message("user", customPrompt);
  await wait(420);
  message("assistant", scene.intro);
  await wait(520);
  const runner = toolRunner(scene.steps);
  const stepNodes = runner.querySelectorAll(".tool-step");
  for (let index = 0; index < stepNodes.length; index += 1) {
    stepNodes[index].classList.add("active");
    await wait(620);
    stepNodes[index].classList.remove("active");
    stepNodes[index].classList.add("done");
  }
  await wait(260);
  message("assistant", scene.reply);
  scene.render();
  statusChip.textContent = "已完成";
  statusChip.className = "status-chip done";
  running = false;
  runButton.disabled = false;
}

function detectScene(prompt) {
  if (/本周|这周/.test(prompt) && /必须|完成|通知/.test(prompt)) return "roleUndergrad";
  if (/导师|论文修改|审稿意见/.test(prompt)) return "roleGraduate";
  if (/奖学金|学生.*材料|缺材料/.test(prompt)) return "roleCounselor";
  if (/培训报名|报名邮件|行政汇报/.test(prompt)) return "roleAdmin";
  if (/数据库课程|课程.*学生邮件|作业提交/.test(prompt)) return "roleTeacher";
  if (/只保留.*决策|合作邀请|实验方案审批/.test(prompt)) return "roleProfessor";
  if (/今天|今日|开始.*工作|每日|简报/.test(prompt)) return "daily";
  if (/截止|行动|待办|催办|等待回复|逾期/.test(prompt)) return "radar";
  if (/回复|线程|上下文|导师|教授/.test(prompt)) return "reply";
  if (/求职|面试|公司|offer|申请/.test(prompt)) return "jobs";
  if (/群发|邀请|收件人|发送|邮件合并/.test(prompt)) return "mailmerge";
  if (/归档|交接|附件|导出/.test(prompt)) return "archive";
  if (/订阅|统计|趋势|发件人|退订/.test(prompt)) return "analytics";
  if (/word|ppt|powerpoint|excel|csv|文档|表格|汇报/i.test(prompt)) return "documents";
  return "triage";
}

function selectScene(key, reset = true) {
  activeScene = key;
  document.querySelectorAll(".scenario").forEach(button => button.classList.toggle("active", button.dataset.scene === key));
  document.querySelectorAll(".identity").forEach(button => button.classList.toggle("active", button.dataset.scene === key));
  if (reset) welcome(key);
}

const campusResults = {
  undergrad: {
    label: "本科生 · 本周校园行动",
    title: "4 件事必须完成",
    score: "7天",
    metrics: [["2", "课程事项", "todo"], ["1", "申请缺件", "notice"], ["1", "等待回复", "clean"]],
    group: "已按截止时间排序",
    items: [
      ["数据库课程作业", "课程助教 · 周三 23:59", "代码、报告、演示视频，来自通知邮件和附件第 2 页", "urgent"],
      ["确认六级考试信息", "教务处 · 周五 17:00", "确认考场与证件信息，来源 mail:jwc-204", "urgent"],
      ["补交奖学金成绩单", "学院学生办 · 周五", "当前缺少 1 项材料，申请表已收到", ""],
      ["回复实验安排", "王老师 · 等待确认", "已准备简洁、正式、友好三种回复", ""]
    ],
    note: "每项结论都保留原邮件和附件位置，可以一键复核。"
  },
  graduate: {
    label: "研究生 · 导师线程已整理",
    title: "3 项论文修改",
    score: "6封",
    metrics: [["3", "修改要求", "todo"], ["2", "附件版本", "notice"], ["1", "回复草稿", "clean"]],
    group: "修改计划与依据",
    items: [
      ["补充第二章样本选择依据", "王教授 · 邮件 4/6", "批注位置：comments.docx 第 12 段", "urgent"],
      ["重新生成实验图 3", "王教授 · 邮件 6/6", "统一坐标范围并注明置信区间", ""],
      ["周五前发送新版", "线程中的明确承诺", "来源 mail:prof-thread-06，可查看上下文", "urgent"]
    ],
    note: "正式回复已准备，收件人、正文和附件会在发送前完整预览。"
  },
  counselor: {
    label: "辅导员 · 奖学金材料追踪",
    title: "86 名学生已核对",
    score: "79%",
    metrics: [["68", "材料齐全", "clean"], ["11", "材料缺失", "todo"], ["7", "尚未提交", "notice"]],
    group: "优先催办名单",
    items: [
      ["陈雨 · 缺成绩单", "已收到申请表和证明", "依据：mail:student-042 · 2 个附件", "urgent"],
      ["赵一 · 缺签字页", "申请表第 3 页未签字", "依据：申请表.pdf 第 3 页", "urgent"],
      ["7 名学生尚未提交", "名单已与邮箱逐一核对", "个性化提醒已生成，等待发送确认", ""]
    ],
    note: "人工更正会被保留，重新扫描邮件时不会覆盖确认结果。",
    download: "scholarship"
  },
  admin: {
    label: "行政老师 · 培训报名汇总",
    title: "128 封邮件已整理",
    score: "4份",
    metrics: [["116", "有效报名", "clean"], ["9", "字段缺失", "todo"], ["3", "重复记录", "notice"]],
    group: "一次完成的交付",
    items: [
      ["培训报名名单.xlsx", "116 条有效记录", "姓名、部门、联系方式和报名项目已统一", ""],
      ["缺失材料提醒", "9 份个性化草稿", "收件人与缺失字段可逐项预览", "urgent"],
      ["情况汇报.docx 与概览.pptx", "可直接用于会议", "关键数字均可追溯到邮件和附件", ""]
    ],
    note: "邮件、附件、表格、文档和汇报已经形成一个可交接成果包。",
    download: "training"
  },
  teacher: {
    label: "教学老师 · 数据库课程邮箱",
    title: "13 项需要处理",
    score: "48人",
    metrics: [["12", "新作业", "clean"], ["3", "申请补交", "todo"], ["2", "请假待确认", "notice"]],
    group: "班级状态与下一步",
    items: [
      ["3 位学生申请补交", "原因和历史记录已汇总", "可分别生成同意、补充说明、拒绝草稿", "urgent"],
      ["8 个重复问题", "集中在截止时间与文件格式", "已生成一封统一回复草稿", ""],
      ["作业提交表已更新", "12 个附件归入学生目录", "缺交名单和邮件依据可导出", ""]
    ],
    note: "教师直接看到待处理事项与班级状态，无需逐封翻阅。"
  },
  professor: {
    label: "教授 · 三日决策简报",
    title: "只需判断 5 件事",
    score: "优先",
    metrics: [["2", "论文节点", "todo"], ["1", "合作邀请", "notice"], ["2", "审批与基金", "clean"]],
    group: "需要你的判断",
    items: [
      ["论文修改时间冲突", "本周需确认两篇论文", "线程摘要已合并作者承诺和审稿要求", "urgent"],
      ["跨校合作邀请", "方向匹配度较高", "已提取资源投入、产出与时间要求", ""],
      ["学生实验方案审批", "等待 2 天", "关键风险和可委派事项已列出", "urgent"],
      ["基金材料节点", "周五 17:00", "缺预算说明，回复草稿已准备", ""]
    ],
    note: "普通通知和宣传邮件已归纳，可委派事项另存为课题组任务清单。"
  }
};

function renderCampus(key) {
  const data = campusResults[key];
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>${data.label}</label><strong>${data.title}</strong></div><div class="score">${data.score}</div></div></div>
    <div class="metric-grid">${data.metrics.map(([value, label, type]) => `<div class="metric ${type}"><strong>${value}</strong><span>${label}</span></div>`).join("")}</div>
    <div class="result-group-title"><span>${data.group}</span><span>均含依据</span></div>
    ${data.items.map(([title, sender, detail, type]) => mailItem(title, sender, detail, type)).join("")}
    <div class="confirm-box"><p>${data.note}</p>${data.download ? `<button class="confirm-button campus-download" data-file="${data.download}">↓ 下载模拟汇总表</button>` : ""}</div>`;
  bindDownloads();
}

function renderDaily() {
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>9 月 7 日 · 今日行动简报</label><strong>先做 5 件事</strong></div><div class="score">92</div></div></div>
    <div class="metric-grid"><div class="metric todo"><strong>2</strong><span>今天到期</span></div><div class="metric notice"><strong>1</strong><span>需要回复</span></div><div class="metric clean"><strong>4h</strong><span>预计找回</span></div></div>
    <div class="result-group-title"><span>现在先处理</span><span>按优先级</span></div>
    ${mailItem("确认论文修改计划", "王教授 · 11:30 前", "回复完成时间，并确认第二章修改范围", "urgent")}
    ${mailItem("补交奖学金成绩单", "学院学生办 · 今天 17:00", "附件要求 PDF，小于 10 MB", "urgent")}
    ${mailItem("数据库课程作业", "课程助教 · 周三", "提交代码、报告和演示视频", "")}
    <div class="result-group-title"><span>可以稍后看</span><span>56 封</span></div>
    <div class="result-item success"><span class="dot"></span><div><b>18 封通知已归纳，38 封订阅已折叠</b><p>所有邮件保持原状态，需要时可查看依据</p></div></div>`;
}

function renderRadar() {
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>行动雷达 · 最近 14 天</label><strong>12 项行动</strong></div><div class="donut"><span>83%</span></div></div></div>
    <div class="metric-grid"><div class="metric todo"><strong>2</strong><span>已经逾期</span></div><div class="metric notice"><strong>3</strong><span>今天到期</span></div><div class="metric clean"><strong>5</strong><span>未来 7 天</span></div></div>
    <div class="result-group-title"><span>需要立即处理</span><span>含依据</span></div>
    ${radarItem("催收 7 名学生奖学金材料", "辅导员", "逾期 1 天", "原邮件：9 月 6 日截止", "urgent")}
    ${radarItem("回复论文第二章修改计划", "你", "今天 11:30", "关键词：请回复确认", "urgent")}
    ${radarItem("确认教学研讨会参会名单", "行政办公室", "今天 17:00", "邮件附件：报名名单.xlsx", "")}
    <div class="confirm-box"><p>雷达只提取和排序行动，不会自动回复、催办或改变邮件状态。</p></div>`;
}

function radarItem(title, owner, due, evidence, type) {
  return `<div class="result-item ${type}"><span class="dot"></span><div><b>${title}</b><p>负责人：${owner} · ${due}<br>${evidence}</p><span class="confidence">查看原邮件依据</span></div><time>›</time></div>`;
}

function renderReply() {
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>论文修改意见 · 线程摘要</label><strong>6 封邮件</strong></div><div class="score">3</div></div></div>
    <div class="result-group-title"><span>识别到的要求</span><span>来自原邮件</span></div>
    ${mailItem("修改第二章研究方法", "王教授 · 邮件 4/6", "补充样本选择依据", "urgent")}
    ${mailItem("重新生成实验图 3", "王教授 · 邮件 6/6", "统一坐标范围并注明置信区间", "")}
    ${mailItem("周五前发回新版", "王教授 · 邮件 6/6", "已识别为明确截止时间", "")}
    <div class="result-group-title"><span>选择回复风格</span><span>可继续编辑</span></div>
    <div class="tone-picker" role="group" aria-label="回复风格">
      <button class="tone active" data-tone="简洁">简洁</button><button class="tone" data-tone="正式">正式</button><button class="tone" data-tone="友好">友好</button>
    </div>
    <div class="reply-draft" id="replyDraft"><b>王老师您好，</b><p>修改意见已收到。我会补充第二章样本选择依据，重新生成实验图 3，并于周五前发送新版。</p><p>如有其他要求，请您告知。谢谢！</p></div>
    <div class="confirm-box"><p>当前为浏览器模拟。真实使用时会展示收件人、主题、正文和附件，得到明确确认后才能发送。</p><button class="confirm-button" id="confirmReply">确认并生成发送预览</button></div>`;
  document.querySelectorAll(".tone").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".tone").forEach(item => item.classList.toggle("active", item === button));
    showToast(`已切换为${button.dataset.tone}回复，可继续编辑`);
  }));
  document.querySelector("#confirmReply").addEventListener("click", event => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "✓ 安全预览已生成，尚未发送";
    showToast("已生成预览，没有真实邮件发出");
  });
}

function renderTriage() {
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>收件箱已整理</label><strong>61 封</strong></div><div class="score">95%</div></div></div>
    <div class="metric-grid"><div class="metric todo"><strong>3</strong><span>需要行动</span></div><div class="metric notice"><strong>18</strong><span>通知消息</span></div><div class="metric clean"><strong>40</strong><span>无需处理</span></div></div>
    <div class="result-group-title"><span>需要你处理</span><span>按优先级</span></div>
    ${mailItem("面试时间确认", "腾讯招聘 · 今天 09:42", "请在今天 18:00 前选择面试时间", "urgent")}
    ${mailItem("课程项目最终提交", "软件工程助教 · 昨天 21:06", "截止周五，需要上传演示视频", "urgent")}
    ${mailItem("银行卡异常登录提醒", "招商银行 · 昨天 18:31", "新设备登录，请确认是否本人操作", "urgent")}
    <div class="result-group-title"><span>待你复核</span><span>2 项</span></div>
    ${mailItem("Re: 论文修改意见", "王教授 · 今天 10:14", "个人邮件，分类置信度 72%", "")}`;
}

function mailItem(title, sender, detail, type) {
  return `<div class="result-item ${type}"><span class="dot"></span><div><b>${title}</b><p>${sender}<br>${detail}</p><span class="confidence">含判断依据</span></div><time>›</time></div>`;
}

function renderMailmerge() {
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>邮件预览 PM_A82F</label><strong>24 / 24</strong></div><div class="score">100%</div></div></div>
    <div class="metric-grid"><div class="metric clean"><strong>24</strong><span>有效地址</span></div><div class="metric notice"><strong>0</strong><span>重复地址</span></div><div class="metric"><strong>3</strong><span>预览样本</span></div></div>
    <div class="result-group-title"><span>个性化样本</span><span>1 / 24</span></div>
    <div class="result-item"><span class="dot"></span><div><b>林晓，你的 Postbird 内测权益已开启</b><p>Hi 林晓，感谢你参加上海站活动。你的专属权益为 Pro 体验 30 天…</p><span class="confidence">to: linxiao@example.com</span></div></div>
    <div class="confirm-box"><p>这是模拟环境。点击后会展示发送进度，不会连接邮箱或联系任何收件人。</p><button class="confirm-button" id="confirmSend">确认模拟发送 24 封</button><div class="progress-track"><div class="progress-fill" id="sendProgress"></div></div><p id="sendCaption">等待你的明确确认</p></div>`;
  document.querySelector("#confirmSend").addEventListener("click", simulateSend);
}

async function simulateSend() {
  const button = document.querySelector("#confirmSend");
  const fill = document.querySelector("#sendProgress");
  const caption = document.querySelector("#sendCaption");
  button.disabled = true;
  button.textContent = "正在模拟发送…";
  for (const value of [18, 39, 63, 82, 100]) {
    fill.style.width = `${value}%`;
    caption.textContent = `已完成 ${Math.round(24 * value / 100)} / 24`;
    await wait(230);
  }
  button.textContent = "✓ 24 封全部模拟送达";
  caption.textContent = "发送台账已生成 · 0 个失败";
  showToast("模拟发送完成，没有真实邮件发出");
}

function renderJobs() {
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>求职申请台账</label><strong>11 家公司</strong></div><div class="score">+4</div></div></div>
    <div class="pipeline"><div class="stage"><strong>4</strong><span>已投</span></div><div class="stage"><strong>3</strong><span>笔试</span></div><div class="stage"><strong>3</strong><span>面试</span></div><div class="stage"><strong>1</strong><span>Offer</span></div></div>
    <div class="result-group-title"><span>最近进展</span><span>自动更新</span></div>
    ${jobItem("字节跳动", "二面通过 · 等待 HR 沟通", "面试", "success")}
    ${jobItem("腾讯", "技术一面 · 9 月 10 日 14:00", "面试", "")}
    ${jobItem("阿里云", "在线笔试已完成", "笔试", "")}
    ${jobItem("米哈游", "意向书已收到", "Offer", "success")}
    <button class="download" style="width:100%;margin-top:10px" data-file="jobs">↓ 下载演示台账 CSV</button>`;
  bindDownloads();
}

function renderAnalytics() {
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>本月邮件洞察</label><strong>486 封</strong></div><div class="donut" aria-label="订阅邮件占比 42%"><span>42%</span></div></div></div>
    <div class="chart" aria-label="近六周邮件趋势"><span class="bar" style="height:46%"></span><span class="bar" style="height:63%"></span><span class="bar" style="height:54%"></span><span class="bar" style="height:86%"></span><span class="bar" style="height:70%"></span><span class="bar" style="height:94%"></span></div>
    <div class="result-group-title"><span>高频订阅来源</span><span>预计每月</span></div>
    ${subscriptionItem("GitHub Notifications", "58 封 · 14 天未打开", "58")}
    ${subscriptionItem("Product Weekly", "34 封 · 含退订入口", "34")}
    ${subscriptionItem("Design Digest", "27 封 · 阅读率 7%", "27")}
    <div class="confirm-box"><p>Postbird 只提供清理建议和退订入口，不会自动删除邮件或访问退订链接。</p></div>`;
}

function subscriptionItem(name, detail, count) {
  return `<div class="result-item"><span class="dot"></span><div><b>${name}</b><p>${detail}</p><span class="confidence">建议复核</span></div><time>${count}</time></div>`;
}

function jobItem(company, detail, status, type) {
  return `<div class="result-item ${type}"><span class="dot"></span><div><b>${company}</b><p>${detail}</p><span class="confidence">${status}</span></div><time>›</time></div>`;
}

function renderDocuments() {
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>办公文件已生成</label><strong>8 个文件</strong></div><div class="score">✓</div></div></div>
    <div class="chart" aria-label="部门薪资示例图"><span class="bar" style="height:72%"></span><span class="bar" style="height:48%"></span><span class="bar" style="height:88%"></span><span class="bar" style="height:56%"></span><span class="bar" style="height:100%"></span><span class="bar" style="height:64%"></span></div>
    <div class="result-group-title"><span>可交付文件</span><span>真实格式</span></div>
    ${fileCard("department-summary.xlsx", "3 个部门 · 6 条记录", "xlsx", "xlsx")}
    ${fileCard("demo-summary.pptx", "2 页 · 管理层摘要", "pptx", "pptx")}
    ${fileCard("notice_Alice.docx", "个性化通知样本", "docx", "docx")}
    <div class="result-item success"><span class="dot"></span><div><b>另外 5 份 Word 已就绪</b><p>每行数据对应一份独立文件</p></div></div>`;
  bindDownloads();
}

function fileCard(name, meta, type, file) {
  return `<div class="file-card"><span class="file-icon ${type}">${type.toUpperCase()}</span><div><b>${name}</b><small>${meta}</small></div><button class="download" data-file="${file}" title="下载 ${name}">↓</button></div>`;
}

function renderArchive() {
  resultContent.innerHTML = `
    <div class="result-hero"><div class="result-hero-top"><div><label>交接包已完成</label><strong>175 项</strong></div><div class="score">✓</div></div></div>
    <div class="metric-grid"><div class="metric notice"><strong>128</strong><span>原始邮件</span></div><div class="metric clean"><strong>46</strong><span>附件</span></div><div class="metric"><strong>1</strong><span>检索索引</span></div></div>
    <div class="result-group-title"><span>目录预览</span><span>handover/</span></div>
    ${fileCard("index.csv", "发件人、主题、时间、附件", "xlsx", "archive")}
    ${fileCard("2026-08-18_项目确认.eml", "原始邮件 · 42 KB", "eml", "eml")}
    <div class="result-item"><span class="dot"></span><div><b>attachments/</b><p>46 个附件 · 重名文件已安全编号</p></div><time>›</time></div>
    <div class="result-item success"><span class="dot"></span><div><b>完整性检查通过</b><p>128 封邮件均已写入索引</p></div></div>`;
  bindDownloads();
}

function bindDownloads() {
  document.querySelectorAll("[data-file]").forEach(button => button.addEventListener("click", () => download(button.dataset.file)));
}

function download(type) {
  const realFiles = {
    xlsx: "files/department-summary.xlsx",
    pptx: "files/demo-summary.pptx",
    docx: "files/letters/notice_Alice.docx"
  };
  if (realFiles[type]) {
    const link = document.createElement("a");
    link.href = realFiles[type];
    link.download = realFiles[type].split("/").pop();
    link.click();
    showToast("正在下载真实示例文件");
    return;
  }
  const contents = {
    jobs: "company,status,last_update,next_action\n字节跳动,interview,二面通过,等待HR沟通\n腾讯,interview,技术一面,准备项目复盘\n阿里云,written-test,在线笔试完成,等待结果\n米哈游,offer,意向书已收到,确认入职时间\n",
    archive: "date,from,subject,attachments\n2026-08-18,project@example.com,项目确认,project-plan.pdf\n2026-08-21,client@example.com,Re: 交付时间,\n",
    eml: "From: project@example.com\nTo: team@example.com\nSubject: 项目确认\nDate: Tue, 18 Aug 2026 10:30:00 +0800\n\n这是 Postbird Live Demo 生成的虚构邮件样本。\n",
    scholarship: "姓名,邮箱,状态,已收材料,缺失材料,依据\n陈雨,chenyu@example.edu,partial,申请表;证明,成绩单,mail:student-042\n赵一,zhaoyi@example.edu,partial,申请表,签字页,申请表.pdf第3页\n李明,liming@example.edu,complete,申请表;成绩单;证明,,mail:student-018\n",
    training: "姓名,部门,联系方式,报名项目,状态,缺失字段\n周敏,教务处,13800000001,教学管理培训,complete,\n陈宁,信息学院,,数据治理培训,partial,联系方式\n"
  };
  const names = {
    jobs: "postbird-job-tracker.csv",
    archive: "postbird-archive-index.csv",
    eml: "postbird-demo-message.eml",
    scholarship: "postbird-scholarship-collection.csv",
    training: "postbird-training-registration.csv"
  };
  const blob = new Blob([contents[type]], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = names[type];
  link.click();
  URL.revokeObjectURL(url);
  showToast("示例文件已生成并下载");
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

document.querySelectorAll(".scenario").forEach(button => button.addEventListener("click", () => selectScene(button.dataset.scene)));
document.querySelectorAll(".identity").forEach(button => button.addEventListener("click", () => selectScene(button.dataset.scene)));
runButton.addEventListener("click", run);
resetButton.addEventListener("click", () => welcome(activeScene));
promptInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    run();
  }
});
document.querySelector("#heroCta").addEventListener("click", () => document.querySelector("#demo").scrollIntoView({ behavior: "smooth" }));

welcome(activeScene);
