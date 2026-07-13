const API_BASE = "http://127.0.0.1:8001";

const elements = {
  activeAvatarSummary: document.querySelector("#activeAvatarSummary"),
  uploadForm: document.querySelector("#avatarUploadForm"),
  fileInput: document.querySelector("#avatarFileInput"),
  uploadStatus: document.querySelector("#avatarUploadStatus"),
  refreshButton: document.querySelector("#avatarRefreshButton"),
  avatarList: document.querySelector("#avatarList"),
  editorForm: document.querySelector("#avatarEditorForm"),
  editorTitle: document.querySelector("#avatarEditorTitle"),
  editorStatus: document.querySelector("#avatarEditorStatus"),
  idInput: document.querySelector("#avatarIdInput"),
  nameInput: document.querySelector("#avatarNameInput"),
  roleInput: document.querySelector("#avatarRoleInput"),
  maxScaleInput: document.querySelector("#avatarMaxScaleInput"),
  stageWidthInput: document.querySelector("#avatarStageWidthInput"),
  stageHeightInput: document.querySelector("#avatarStageHeightInput"),
  anchorXInput: document.querySelector("#avatarAnchorXInput"),
  anchorYInput: document.querySelector("#avatarAnchorYInput"),
  offsetXInput: document.querySelector("#avatarOffsetXInput"),
  offsetYInput: document.querySelector("#avatarOffsetYInput"),
  activateButton: document.querySelector("#avatarActivateButton"),
  deleteButton: document.querySelector("#avatarDeleteButton"),
};

let manifest = { active_avatar_id: "mao_pro", avatars: [] };
let selectedAvatarId = "";

elements.uploadForm.addEventListener("submit", uploadAvatarPackage);
elements.refreshButton.addEventListener("click", loadAvatars);
elements.editorForm.addEventListener("submit", saveSelectedAvatar);
elements.activateButton.addEventListener("click", activateSelectedAvatar);
elements.deleteButton.addEventListener("click", deleteSelectedAvatar);

loadAvatars();

async function loadAvatars() {
  setEditorStatus("正在读取形象库...", true);
  try {
    manifest = await getJson("/api/admin/avatars");
    if (!selectedAvatarId || !manifest.avatars.some((avatar) => avatar.id === selectedAvatarId)) {
      selectedAvatarId = manifest.active_avatar_id || manifest.avatars[0]?.id || "";
    }
    renderActiveAvatar();
    renderAvatarList();
    renderEditor();
    setEditorStatus("形象库已更新", true);
  } catch (error) {
    setEditorStatus(error.message || "形象库读取失败", false);
  }
}

async function getJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return response.json();
}

async function readErrorMessage(response) {
  try {
    const data = await response.json();
    return data.detail || data.message || "请求失败";
  } catch {
    return response.text();
  }
}

function renderActiveAvatar() {
  const active = findAvatar(manifest.active_avatar_id);
  elements.activeAvatarSummary.replaceChildren();
  const label = document.createElement("p");
  label.textContent = "当前游客端启用形象";
  const title = document.createElement("strong");
  title.textContent = active?.name || "暂无形象";
  const note = document.createElement("span");
  note.textContent = active ? `${active.role || "未填写角色说明"} · ${active.id}` : "请先上传或启用一个形象";
  elements.activeAvatarSummary.append(label, title, note);
}

function renderAvatarList() {
  elements.avatarList.replaceChildren();
  if (!manifest.avatars.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "暂无可用形象";
    elements.avatarList.appendChild(empty);
    return;
  }
  manifest.avatars.forEach((avatar) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "avatar-item";
    item.classList.toggle("selected", avatar.id === selectedAvatarId);
    item.addEventListener("click", () => {
      selectedAvatarId = avatar.id;
      renderAvatarList();
      renderEditor();
    });

    const title = document.createElement("strong");
    title.textContent = avatar.name;
    const meta = document.createElement("span");
    meta.textContent = `${avatar.built_in ? "内置" : "自定义"} · ${avatar.id}`;
    const status = document.createElement("small");
    status.textContent = avatar.id === manifest.active_avatar_id ? "已启用" : avatar.role || "未启用";

    item.append(title, meta, status);
    elements.avatarList.appendChild(item);
  });
}

function renderEditor() {
  const avatar = findAvatar(selectedAvatarId);
  const disabled = !avatar;
  elements.editorTitle.textContent = avatar ? `编辑 ${avatar.name}` : "选中形象后编辑";
  elements.idInput.value = avatar?.id || "";
  elements.nameInput.value = avatar?.name || "";
  elements.roleInput.value = avatar?.role || "";
  elements.maxScaleInput.value = avatar?.maxScale ?? "";
  elements.stageWidthInput.value = avatar?.stageWidthRatio ?? "";
  elements.stageHeightInput.value = avatar?.stageHeightRatio ?? "";
  elements.anchorXInput.value = avatar?.anchorX ?? "";
  elements.anchorYInput.value = avatar?.anchorY ?? "";
  elements.offsetXInput.value = avatar?.offsetX ?? "";
  elements.offsetYInput.value = avatar?.offsetY ?? "";
  [
    elements.nameInput,
    elements.roleInput,
    elements.maxScaleInput,
    elements.stageWidthInput,
    elements.stageHeightInput,
    elements.anchorXInput,
    elements.anchorYInput,
    elements.offsetXInput,
    elements.offsetYInput,
    elements.activateButton,
  ].forEach((control) => {
    control.disabled = disabled;
  });
  elements.deleteButton.disabled = disabled || Boolean(avatar?.built_in);
}

async function uploadAvatarPackage(event) {
  event.preventDefault();
  const [file] = elements.fileInput.files ?? [];
  if (!file) {
    setUploadStatus("请选择 .zip 形象包", false);
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  setUploadStatus("正在上传形象包...", true);
  try {
    const data = await getJson("/api/admin/avatars/upload", {
      method: "POST",
      body: formData,
    });
    selectedAvatarId = data.avatar?.id || selectedAvatarId;
    elements.fileInput.value = "";
    setUploadStatus("形象包已入库，可检查参数后手动启用", true);
    await loadAvatars();
  } catch (error) {
    setUploadStatus(error.message || "上传失败", false);
  }
}

async function saveSelectedAvatar(event) {
  event.preventDefault();
  const avatar = findAvatar(selectedAvatarId);
  if (!avatar) return;
  setEditorStatus("正在保存显示参数...", true);
  try {
    await getJson(`/api/admin/avatars/${encodeURIComponent(avatar.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readEditorPayload()),
    });
    setEditorStatus("显示参数已保存", true);
    await loadAvatars();
  } catch (error) {
    setEditorStatus(error.message || "保存失败", false);
  }
}

async function activateSelectedAvatar() {
  const avatar = findAvatar(selectedAvatarId);
  if (!avatar) return;
  setEditorStatus("正在启用形象...", true);
  try {
    await getJson(`/api/admin/avatars/${encodeURIComponent(avatar.id)}/activate`, {
      method: "POST",
    });
    setEditorStatus("形象已启用，游客端刷新后生效", true);
    await loadAvatars();
  } catch (error) {
    setEditorStatus(error.message || "启用失败", false);
  }
}

async function deleteSelectedAvatar() {
  const avatar = findAvatar(selectedAvatarId);
  if (!avatar || avatar.built_in) return;
  setEditorStatus("正在删除自定义形象...", true);
  try {
    await getJson(`/api/admin/avatars/${encodeURIComponent(avatar.id)}`, {
      method: "DELETE",
    });
    selectedAvatarId = manifest.active_avatar_id;
    setEditorStatus("自定义形象已删除", true);
    await loadAvatars();
  } catch (error) {
    setEditorStatus(error.message || "删除失败", false);
  }
}

function readEditorPayload() {
  return {
    name: elements.nameInput.value.trim(),
    role: elements.roleInput.value.trim(),
    maxScale: readNumber(elements.maxScaleInput),
    stageWidthRatio: readNumber(elements.stageWidthInput),
    stageHeightRatio: readNumber(elements.stageHeightInput),
    anchorX: readNumber(elements.anchorXInput),
    anchorY: readNumber(elements.anchorYInput),
    offsetX: readNumber(elements.offsetXInput),
    offsetY: readNumber(elements.offsetYInput),
  };
}

function readNumber(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : null;
}

function findAvatar(avatarId) {
  return manifest.avatars.find((avatar) => avatar.id === avatarId) || null;
}

function setUploadStatus(message, ok) {
  elements.uploadStatus.textContent = message;
  elements.uploadStatus.dataset.state = ok ? "ok" : "error";
}

function setEditorStatus(message, ok) {
  elements.editorStatus.textContent = message;
  elements.editorStatus.dataset.state = ok ? "ok" : "error";
}
