const API_BASE = "http://127.0.0.1:8001";

const elements = {
  metricsGrid: document.querySelector("#metricsGrid"),
  reportBox: document.querySelector("#reportBox"),
  topAttractions: document.querySelector("#topAttractions"),
  profileBox: document.querySelector("#profileBox"),
  knowledgeList: document.querySelector("#knowledgeList"),
  refreshButton: document.querySelector("#refreshButton"),
};

elements.refreshButton.addEventListener("click", loadDashboard);
loadDashboard();

async function loadDashboard() {
  const [overview, report, knowledge] = await Promise.all([
    getJson("/api/admin/analytics/overview"),
    getJson("/api/admin/analytics/report"),
    getJson("/api/admin/knowledge"),
  ]);
  renderMetrics(overview);
  renderReport(report);
  renderTopAttractions(overview.top_attractions || []);
  renderProfile(overview);
  renderKnowledge(knowledge.items || []);
}

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function renderMetrics(overview) {
  const focus = overview.focus_attractions || [];
  const focusVisits = focus.reduce((sum, item) => sum + item.visits, 0);
  const avgSat = average(focus.map((item) => item.avg_satisfaction).filter(Boolean));
  const avgStay = average(focus.map((item) => item.avg_stay_duration).filter(Boolean));
  const cards = [
    ["行为样本", overview.total_records?.toLocaleString() || "0", "官方 Excel 全量记录"],
    ["覆盖景区", overview.unique_attractions || "0", "可用于行业对比"],
    ["灵山相关访问", focusVisits.toLocaleString(), "灵山胜境、灵山大佛、拈花湾"],
    ["平均满意度", avgSat.toFixed(2), "5 分制"],
    ["平均停留时长", `${avgStay.toFixed(1)} 小时`, "灵山相关样本"],
  ];
  elements.metricsGrid.innerHTML = cards
    .map(
      ([label, value, note]) => `
        <article class="metric-card">
          <p>${label}</p>
          <strong>${value}</strong>
          <span>${note}</span>
        </article>
      `,
    )
    .join("");
}

function renderReport(report) {
  const focus = report.focus || [];
  elements.reportBox.innerHTML = `
    <p class="summary">${report.summary || ""}</p>
    <div class="focus-grid">
      ${focus
        .map(
          (item) => `
            <div>
              <span>${item.name}</span>
              <strong>${item.avg_satisfaction}</strong>
              <small>${item.visits} 条样本 · 人均消费 ${item.avg_total_cost}</small>
            </div>
          `,
        )
        .join("")}
    </div>
    <h3>服务建议</h3>
    <ul>${(report.suggestions || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    <p class="summary">当前游客端实时反馈 ${report.feedback_count || 0} 条。</p>
  `;
}

function renderTopAttractions(items) {
  elements.topAttractions.innerHTML = items
    .map(
      (item, index) => `
        <div class="rank-item">
          <span>${index + 1}</span>
          <div>
            <strong>${item.name}</strong>
            <small>${item.visits} 条 · 满意度 ${item.avg_satisfaction}</small>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderProfile(overview) {
  const data = [...(overview.age_distribution || []), ...(overview.gender_distribution || [])];
  const max = Math.max(...data.map((item) => item.value), 1);
  elements.profileBox.innerHTML = data
    .map(
      (item) => `
        <div class="bar-row">
          <span>${item.name}</span>
          <div><i style="width:${Math.max((item.value / max) * 100, 4)}%"></i></div>
          <strong>${item.value}</strong>
        </div>
      `,
    )
    .join("");
}

function renderKnowledge(items) {
  elements.knowledgeList.innerHTML = items
    .slice(0, 32)
    .map(
      (item) => `
        <article class="knowledge-item">
          <div>
            <strong>${item.title}</strong>
            <span>${item.type} · ${item.source}</span>
          </div>
          <p>${truncate(item.content, 150)}</p>
        </article>
      `,
    )
    .join("");
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function truncate(text, limit) {
  const value = String(text || "").replace(/\s+/g, " ");
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}
