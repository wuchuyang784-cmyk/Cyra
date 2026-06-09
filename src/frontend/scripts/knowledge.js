const API_BASE = "http://127.0.0.1:8001";

const elements = {
  knowledgeStats: document.querySelector("#knowledgeStats"),
  knowledgeList: document.querySelector("#knowledgeList"),
  knowledgeUploadForm: document.querySelector("#knowledgeUploadForm"),
  knowledgeFileInput: document.querySelector("#knowledgeFileInput"),
  knowledgeUploadStatus: document.querySelector("#knowledgeUploadStatus"),
  knowledgeSearchInput: document.querySelector("#knowledgeSearchInput"),
  knowledgeEditorForm: document.querySelector("#knowledgeEditorForm"),
  knowledgeEditorId: document.querySelector("#knowledgeEditorId"),
  knowledgeTitleInput: document.querySelector("#knowledgeTitleInput"),
  knowledgeContentInput: document.querySelector("#knowledgeContentInput"),
  knowledgeDeleteButton: document.querySelector("#knowledgeDeleteButton"),
  knowledgeEditorStatus: document.querySelector("#knowledgeEditorStatus"),
};

let knowledgeItems = [];

elements.knowledgeUploadForm.addEventListener("submit", uploadKnowledgeFile);
elements.knowledgeEditorForm.addEventListener("submit", saveKnowledgeItem);
elements.knowledgeDeleteButton.addEventListener("click", deleteKnowledgeItem);
elements.knowledgeSearchInput.addEventListener("input", () => renderKnowledge(knowledgeItems));
loadKnowledge();

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function loadKnowledge() {
  const data = await getJson("/api/admin/knowledge");
  knowledgeItems = data.items || [];
  renderKnowledgeStats(knowledgeItems);
  renderKnowledge(knowledgeItems);
}

async function uploadKnowledgeFile(event) {
  event.preventDefault();
  const [file] = elements.knowledgeFileInput.files ?? [];
  if (!file) {
    setKnowledgeUploadStatus("请选择 .txt、.md 或 .docx 知识文件");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  setKnowledgeUploadStatus("正在上传并写入知识库...");

  try {
    const response = await fetch(`${API_BASE}/api/admin/knowledge/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    elements.knowledgeFileInput.value = "";
    setKnowledgeUploadStatus(`已入库 ${data.item?.chunks || 0} 个知识片段`);
    await loadKnowledge();
  } catch (error) {
    setKnowledgeUploadStatus("上传失败，请检查文件格式和后端服务");
  }
}

function setKnowledgeUploadStatus(message) {
  elements.knowledgeUploadStatus.textContent = message;
}

async function saveKnowledgeItem(event) {
  event.preventDefault();
  const itemId = elements.knowledgeEditorId.value;
  if (!itemId) {
    setKnowledgeEditorStatus("请先从列表中选择知识条目");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/admin/knowledge/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: elements.knowledgeTitleInput.value.trim(),
        content: elements.knowledgeContentInput.value.trim(),
      }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    setKnowledgeEditorStatus("已保存并更新检索索引");
    await loadKnowledge();
    selectKnowledgeItem(itemId);
  } catch (error) {
    setKnowledgeEditorStatus("保存失败，请检查后端服务");
  }
}

async function deleteKnowledgeItem() {
  const itemId = elements.knowledgeEditorId.value;
  if (!itemId) {
    setKnowledgeEditorStatus("请先从列表中选择知识条目");
    return;
  }
  const itemTitle = elements.knowledgeTitleInput.value || itemId;
  if (!confirm(`确认删除“${itemTitle}”？`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/admin/knowledge/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    clearKnowledgeEditor();
    setKnowledgeEditorStatus("已删除并更新检索索引");
    await loadKnowledge();
  } catch (error) {
    setKnowledgeEditorStatus("删除失败，请检查后端服务");
  }
}

function selectKnowledgeItem(itemId) {
  const item = knowledgeItems.find((entry) => entry.id === itemId);
  if (!item) return;
  elements.knowledgeEditorId.value = item.id;
  elements.knowledgeTitleInput.value = item.title || "";
  elements.knowledgeContentInput.value = item.content || "";
  setKnowledgeEditorStatus(`正在编辑：${item.type} · ${item.source}`);
  markSelectedItem(item.id);
}

function clearKnowledgeEditor() {
  elements.knowledgeEditorId.value = "";
  elements.knowledgeTitleInput.value = "";
  elements.knowledgeContentInput.value = "";
  markSelectedItem("");
}

function setKnowledgeEditorStatus(message) {
  elements.knowledgeEditorStatus.textContent = message;
}

function renderKnowledgeStats(items) {
  const typeCounts = items.reduce((counts, item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  }, {});
  const cards = [
    ["总条目", items.length, "全部可管理知识"],
    ["景点资料", typeCounts.spot || 0, "结构化景点"],
    ["上传知识", typeCounts.uploaded || 0, "人工补充资料"],
    ["指南片段", typeCounts.guide || 0, "官方导览内容"],
  ];
  elements.knowledgeStats.innerHTML = cards
    .map(
      ([label, value, note]) => `
        <article>
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${note}</small>
        </article>
      `,
    )
    .join("");
}

function renderKnowledge(items) {
  const query = elements.knowledgeSearchInput.value.trim().toLowerCase();
  const filtered = query
    ? items.filter((item) => `${item.title} ${item.source} ${item.content}`.toLowerCase().includes(query))
    : items;
  elements.knowledgeList.innerHTML = filtered
    .slice(0, 120)
    .map(
      (item) => `
        <article class="knowledge-item" data-id="${escapeAttribute(item.id)}">
          <div class="knowledge-item-head">
            <strong>${item.title}</strong>
            <span>${labelForType(item.type)}</span>
          </div>
          <small>${item.source}</small>
          <p>${truncate(item.content, 190)}</p>
          <button type="button" data-action="edit" data-id="${escapeAttribute(item.id)}">编辑</button>
        </article>
      `,
    )
    .join("");
  elements.knowledgeList.querySelectorAll("button[data-action='edit']").forEach((button) => {
    button.addEventListener("click", () => selectKnowledgeItem(button.dataset.id));
  });
  markSelectedItem(elements.knowledgeEditorId.value);
}

function markSelectedItem(itemId) {
  elements.knowledgeList.querySelectorAll(".knowledge-item").forEach((item) => {
    item.classList.toggle("selected", item.dataset.id === itemId);
  });
}

function labelForType(type) {
  return {
    spot: "景点",
    uploaded: "上传",
    guide: "指南",
  }[type] || type || "知识";
}

function truncate(text, limit) {
  const value = String(text || "").replace(/\s+/g, " ");
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function escapeAttribute(value) {
  return String(value || "").replace(/"/g, "&quot;");
}
