const API_BASE = "http://127.0.0.1:8001";
const DASHBOARD_REFRESH_INTERVAL_MS = 5000;

const elements = {
  metricsGrid: document.querySelector("#metricsGrid"),
  reportBox: document.querySelector("#reportBox"),
  trendChart: document.querySelector("#trendChart"),
  frequentQuestionsPanel: document.querySelector("#frequentQuestionsPanel"),
  profileBox: document.querySelector("#profileBox"),
  refreshButton: document.querySelector("#refreshButton"),
};

elements.refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
window.setInterval(loadDashboard, DASHBOARD_REFRESH_INTERVAL_MS);

async function loadDashboard() {
  const [overview, report] = await Promise.all([
    getJson("/api/admin/analytics/overview"),
    getJson("/api/admin/analytics/report"),
  ]);
  renderMetrics(overview);
  renderReport(report, overview);
  renderTrendChart(overview, report, overview.frequent_questions || []);
  renderFrequentQuestions(overview.frequent_questions || []);
  renderProfile(overview);
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
    ["覆盖景区", overview.unique_attractions || "0", "用于行业对比分析"],
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

function renderReport(report, overview) {
  const focus = report.focus || [];
  const questions = overview.frequent_questions || [];
  const serviceVisits = focus.reduce((sum, item) => sum + item.visits, 0);
  const routeQuestion = questions.find((item) => item.category === "路线推荐");
  const hotQuestion = questions[0]?.question || "暂无游客提问";
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
    <div class="report-insights">
      <div>
        <span>本周服务人次</span>
        <strong>${serviceVisits.toLocaleString()}</strong>
        <small>灵山相关样本</small>
      </div>
      <div>
        <span>热门咨询</span>
        <strong>${hotQuestion}</strong>
        <small>${questions[0]?.count || 0} 次提问</small>
      </div>
      <div>
        <span>路线需求</span>
        <strong>${routeQuestion?.count || 0} 次</strong>
        <small>路线推荐类问题</small>
      </div>
      <div>
        <span>知识库覆盖</span>
        <strong>${overview.unique_attractions || 0}</strong>
        <small>可分析景区</small>
      </div>
    </div>
  `;
}

function renderTrendChart(overview, report, questions) {
  const focus = overview.focus_attractions || [];
  const avgStay = average(focus.map((item) => item.avg_stay_duration).filter(Boolean));
  const avgSat = average(focus.map((item) => item.avg_satisfaction).filter(Boolean));
  const questionHeat = questions.length
    ? average(questions.map((item) => item.count))
    : (report.feedback_count || 0);
  const series = [
    {
      label: "平均满意度",
      value: avgSat,
      max: 5,
      color: "var(--accent)",
    },
    {
      label: "平均停留时长",
      value: avgStay,
      max: 8,
      color: "var(--accent-2)",
    },
    {
      label: "问答热度",
      value: questionHeat,
      max: Math.max(questionHeat, 10),
      color: "#2563eb",
    },
  ];
  elements.trendChart.innerHTML = `
    <div class="trend-summary">
      ${series
        .map(
          (item) => `
            <div class="trend-card">
              <span>${item.label}</span>
              <strong>${item.label === "平均停留时长" ? `${item.value.toFixed(1)} 小时` : item.label === "平均满意度" ? item.value.toFixed(2) : `${Math.round(item.value)} 次`}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
    <svg viewBox="0 0 360 190" role="img" aria-label="运营趋势图">
      ${renderTrendPath(series[0], 20)}
      ${renderTrendPath(series[1], 70)}
      ${renderTrendPath(series[2], 120)}
      <line x1="18" y1="165" x2="342" y2="165"></line>
      <text x="18" y="182">周一</text>
      <text x="290" y="182">周日</text>
    </svg>
  `;
}

function renderTrendPath(series, yOffset) {
  const points = buildTrendPoints(series.value, series.max, yOffset);
  const line = points.map((point) => point.join(",")).join(" ");
  return `
    <polyline points="${line}" fill="none" stroke="${series.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${series.color}"></circle>`).join("")}
  `;
}

function buildTrendPoints(value, max, yOffset) {
  const normalized = Math.max(Math.min(value / max, 1), 0.18);
  const base = 165 - yOffset;
  return [
    [24, base + 18],
    [90, base + 10 + normalized * 10],
    [156, base + 18 - normalized * 6],
    [222, base + 8 + normalized * 14],
    [288, base + 18 - normalized * 8],
    [336, base + 12 + normalized * 4],
  ];
}

function renderFrequentQuestions(items) {
  if (!items.length) {
    elements.frequentQuestionsPanel.innerHTML = `<p class="empty-state">暂无游客提问</p>`;
    return;
  }
  elements.frequentQuestionsPanel.innerHTML = items
    .map(
      (item, index) => `
        <div class="rank-item">
          <span>${index + 1}</span>
          <div>
            <strong>${item.question}</strong>
            <small>${item.count} 次提问</small>
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

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
