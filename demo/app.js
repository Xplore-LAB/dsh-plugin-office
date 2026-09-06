const scenes = {
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
let activeScene = "triage";
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
  if (reset) welcome(key);
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
    eml: "From: project@example.com\nTo: team@example.com\nSubject: 项目确认\nDate: Tue, 18 Aug 2026 10:30:00 +0800\n\n这是 Postbird Live Demo 生成的虚构邮件样本。\n"
  };
  const names = { jobs: "postbird-job-tracker.csv", archive: "postbird-archive-index.csv", eml: "postbird-demo-message.eml" };
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
