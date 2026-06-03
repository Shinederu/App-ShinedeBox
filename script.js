const apiBase = String(window.__SHINEDEBOX_API_BASE__ || "https://api.shinederu.ch/box").replace(/\/+$/, "");
const authApiBase = String(window.__SHINEDEBOX_AUTH_API_BASE__ || "https://api.shinederu.ch/auth").replace(/\/+$/, "");
const autoRefreshMs = 15000;

const state = {
  auth: null,
  files: [],
  stats: null,
  selectedFileId: null,
  shares: [],
  uploadXhr: null,
  refreshTimer: null,
};

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setHidden(element, hidden) {
  if (element) {
    element.classList.toggle("hidden", Boolean(hidden));
  }
}

function showToast(message, kind = "info") {
  const container = qs("#toast-container");
  if (!container) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => toast.remove(), 3600);
}

function showNotice(message, kind = "info") {
  const notice = qs("#notice");
  if (!notice) {
    return;
  }

  notice.className = `notice ${kind}`;
  notice.textContent = message;
  setHidden(notice, false);

  window.setTimeout(() => setHidden(notice, true), 4200);
}

function bytesFmt(value) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let size = Number(value) || 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function dateFmt(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("fr-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getExtension(name) {
  const index = String(name || "").lastIndexOf(".");
  return index >= 0 ? String(name).slice(index + 1).toUpperCase().slice(0, 8) : "FILE";
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok || (body && typeof body === "object" && body.success === false)) {
    const message = body && typeof body === "object" ? body.error || body.message : body;
    const error = new Error(message || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function authFetch(path, options = {}) {
  const response = await fetch(`${authApiBase}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok || (body && typeof body === "object" && body.success === false)) {
    const message = body && typeof body === "object" ? body.error || body.message : body;
    const error = new Error(message || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

function setView(name) {
  setHidden(qs("#share-view"), name !== "share");
  setHidden(qs("#login-view"), name !== "login");
  setHidden(qs("#access-view"), name !== "access");
  setHidden(qs("#box-view"), name !== "box");
  setHidden(qs("#session-actions"), name !== "box" && name !== "access");
}

function startAutoRefresh() {
  stopAutoRefresh();
  state.refreshTimer = window.setInterval(() => {
    if (!state.auth?.is_admin || document.visibilityState === "hidden" || state.uploadXhr) {
      return;
    }
    void refreshFiles({ silent: true });
  }, autoRefreshMs);
}

function stopAutoRefresh() {
  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
}

async function refreshStatus() {
  try {
    const auth = await apiFetch("/auth.php?action=status");
    state.auth = auth;

    if (!auth.authenticated) {
      stopAutoRefresh();
      setView("login");
      return;
    }

    qs("#session-name").textContent = auth.user?.username || "Session";
    qs("#session-role").textContent = auth.is_admin ? "Box admin" : "Sans acces Box";

    if (!auth.is_admin) {
      stopAutoRefresh();
      setView("access");
      return;
    }

    setView("box");
    startAutoRefresh();
    await refreshFiles({ silent: true });
  } catch (error) {
    stopAutoRefresh();
    setView("login");
    showNotice(`Erreur de verification de session: ${error.message}`, "error");
  }
}

async function login(event) {
  event.preventDefault();
  const username = qs("#login-username").value.trim();
  const password = qs("#login-password").value;

  if (!username || !password) {
    showNotice("Identifiant et mot de passe requis.", "error");
    return;
  }

  try {
    await authFetch("/?action=login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ action: "login", username, password }).toString(),
    });
    qs("#login-password").value = "";
    showToast("Session ouverte", "success");
    await refreshStatus();
  } catch (error) {
    showNotice(`Connexion refusee: ${error.message}`, "error");
  }
}

async function logout() {
  try {
    await authFetch("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ action: "logout" }).toString(),
    });
    await apiFetch("/auth.php?action=logout");
  } catch (_) {
    // Best effort logout.
  } finally {
    state.files = [];
    state.selectedFileId = null;
    state.auth = null;
    stopAutoRefresh();
    renderFiles();
    setView("login");
  }
}

async function refreshFiles({ silent = false } = {}) {
  try {
    const data = await apiFetch("/list.php");
    state.files = Array.isArray(data.files) ? data.files : [];
    state.stats = data.stats || null;
    if (state.selectedFileId && !state.files.some((file) => file.id === state.selectedFileId)) {
      state.selectedFileId = null;
      state.shares = [];
    }
    renderMetrics();
    renderFiles();
    renderDetail();
  } catch (error) {
    if (!silent) {
      showNotice(`Lecture impossible: ${error.message}`, "error");
    }
    if (error.status === 401 || error.status === 403) {
      await refreshStatus();
    }
  }
}

function renderMetrics() {
  const stats = state.stats || {};
  qs("#metric-files").textContent = String(stats.file_count ?? state.files.length);
  qs("#metric-size").textContent = bytesFmt(stats.total_size || 0);
  qs("#metric-shares").textContent = String(stats.active_share_count || 0);
  qs("#metric-downloads").textContent = String(stats.total_downloads || 0);
}

function filteredFiles() {
  const search = qs("#search-input").value.trim().toLowerCase();
  const sort = qs("#sort-select").value;
  let files = state.files.slice();

  if (search) {
    files = files.filter((file) => String(file.name || "").toLowerCase().includes(search));
  }

  files.sort((left, right) => {
    switch (sort) {
      case "oldest":
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      case "name_asc":
        return String(left.name).localeCompare(String(right.name), "fr", { sensitivity: "base" });
      case "name_desc":
        return String(right.name).localeCompare(String(left.name), "fr", { sensitivity: "base" });
      case "size_desc":
        return (right.size || 0) - (left.size || 0);
      case "newest":
      default:
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    }
  });

  return files;
}

function renderFiles() {
  const body = qs("#file-table-body");
  const empty = qs("#empty-state");
  if (!body) {
    return;
  }

  const files = filteredFiles();
  body.innerHTML = "";
  setHidden(empty, files.length !== 0);

  for (const file of files) {
    const row = document.createElement("tr");
    row.className = file.id === state.selectedFileId ? "is-selected" : "";
    row.innerHTML = `
      <td>
        <button class="file-name-button" type="button" data-select="${file.id}">
          <span class="file-ext">${getExtension(file.name)}</span>
          <span>${escapeHtml(file.name)}</span>
        </button>
      </td>
      <td>${bytesFmt(file.size)}</td>
      <td>${file.active_share_count || 0}</td>
      <td>${dateFmt(file.created_at)}</td>
      <td class="row-actions">
        <a href="${file.download_url}" target="_blank" rel="noopener noreferrer">Telecharger</a>
        <button type="button" data-share="${file.id}">Partager</button>
      </td>
    `;
    body.appendChild(row);
  }

  qsa("[data-select]").forEach((button) => {
    button.addEventListener("click", () => selectFile(Number(button.dataset.select)));
  });
  qsa("[data-share]").forEach((button) => {
    button.addEventListener("click", () => {
      selectFile(Number(button.dataset.share));
      qs("#share-days").focus();
    });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function selectFile(id) {
  state.selectedFileId = id;
  state.shares = [];
  renderFiles();
  renderDetail();
  await loadShares();
}

function selectedFile() {
  return state.files.find((file) => file.id === state.selectedFileId) || null;
}

function renderDetail() {
  const file = selectedFile();
  qs("#detail-title").textContent = file ? file.name : "Aucun fichier";
  qs("#detail-size").textContent = file ? bytesFmt(file.size) : "-";
  qs("#detail-type").textContent = file ? file.mime_type || file.extension || "-" : "-";
  qs("#detail-created").textContent = file ? dateFmt(file.created_at) : "-";
  qs("#detail-downloads").textContent = file ? String(file.download_count || 0) : "-";
  setHidden(qs("#detail-actions"), !file);
  setHidden(qs("#share-manager"), !file);
  if (file) {
    qs("#download-link").href = file.download_url;
  }
  renderShares();
}

async function loadShares() {
  const file = selectedFile();
  if (!file) {
    state.shares = [];
    renderShares();
    return;
  }

  try {
    const data = await apiFetch(`/share.php?id=${encodeURIComponent(file.id)}`);
    state.shares = Array.isArray(data.shares) ? data.shares : [];
    renderShares();
  } catch (error) {
    showToast(`Lecture des partages impossible: ${error.message}`, "error");
  }
}

function renderShares() {
  const list = qs("#share-list");
  if (!list) {
    return;
  }
  list.innerHTML = "";

  if (!selectedFile()) {
    return;
  }

  if (!state.shares.length) {
    list.innerHTML = '<li class="muted">Aucun lien public.</li>';
    return;
  }

  for (const share of state.shares) {
    const item = document.createElement("li");
    item.className = share.is_usable ? "" : "is-disabled";
    item.innerHTML = `
      <div>
        <strong>${share.is_usable ? "Actif" : "Inactif"}</strong>
        <span>${share.expires_at ? `Expire ${dateFmt(share.expires_at)}` : "Sans expiration"} - ${share.download_count} telechargement(s)</span>
      </div>
      <div class="share-actions">
        <button type="button" data-copy-share="${share.token}">Copier</button>
        <button class="danger-button" type="button" data-revoke-share="${share.token}">Revoquer</button>
      </div>
    `;
    list.appendChild(item);
  }

  qsa("[data-copy-share]").forEach((button) => {
    button.addEventListener("click", async () => {
      const share = state.shares.find((entry) => entry.token === button.dataset.copyShare);
      if (!share) {
        return;
      }
      await copyText(share.share_url);
    });
  });
  qsa("[data-revoke-share]").forEach((button) => {
    button.addEventListener("click", () => revokeShare(button.dataset.revokeShare));
  });
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast("Lien copie", "success");
  } catch (_) {
    showNotice(value, "info");
  }
}

async function createShare(event) {
  event.preventDefault();
  const file = selectedFile();
  if (!file) {
    return;
  }

  try {
    const data = await apiFetch("/share.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_id: file.id,
        expires_days: qs("#share-days").value.trim(),
        max_downloads: qs("#share-max").value.trim(),
      }),
    });
    qs("#share-days").value = "";
    qs("#share-max").value = "";
    state.shares.unshift(data.share);
    renderShares();
    await copyText(data.share.share_url);
    await refreshFiles({ silent: true });
  } catch (error) {
    showToast(`Creation impossible: ${error.message}`, "error");
  }
}

async function revokeShare(token) {
  try {
    await apiFetch("/share.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "revoke", token }),
    });
    await loadShares();
    await refreshFiles({ silent: true });
    showToast("Lien revoque", "success");
  } catch (error) {
    showToast(`Revocation impossible: ${error.message}`, "error");
  }
}

async function renameSelectedFile() {
  const file = selectedFile();
  if (!file) {
    return;
  }

  const name = window.prompt("Nouveau nom", file.name);
  if (name === null || !name.trim()) {
    return;
  }

  try {
    const data = await apiFetch("/rename.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: file.id, name: name.trim() }),
    });
    state.files = state.files.map((entry) => (entry.id === data.file.id ? data.file : entry));
    renderFiles();
    renderDetail();
    showToast("Fichier renomme", "success");
  } catch (error) {
    showToast(`Renommage impossible: ${error.message}`, "error");
  }
}

async function deleteSelectedFile() {
  const file = selectedFile();
  if (!file || !window.confirm(`Supprimer ${file.name} ?`)) {
    return;
  }

  try {
    await apiFetch("/delete.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: file.id }),
    });
    state.selectedFileId = null;
    await refreshFiles({ silent: true });
    showToast("Fichier supprime", "success");
  } catch (error) {
    showToast(`Suppression impossible: ${error.message}`, "error");
  }
}

function updateSelectedFilesMeta() {
  const input = qs("#file-input");
  const files = Array.from(input?.files || []);
  const total = files.reduce((sum, file) => sum + (file.size || 0), 0);
  qs("#selected-files").textContent = files.length
    ? `${files.length} fichier(s) - ${bytesFmt(total)}`
    : "Aucun fichier selectionne.";
}

function setUploading(isUploading) {
  setHidden(qs("#cancel-upload-btn"), !isUploading);
  qs("#file-input").disabled = isUploading;
  qs("#dropzone").classList.toggle("is-disabled", isUploading);
}

async function uploadFiles(event) {
  event.preventDefault();
  const input = qs("#file-input");
  const files = Array.from(input.files || []);
  if (!files.length || state.uploadXhr) {
    return;
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("files[]", file, file.name));

  const progress = qs("#progress");
  const progressBar = qs("#progress-bar");
  const progressText = qs("#progress-text");
  setHidden(progress, false);
  progressBar.style.width = "0%";
  progressText.textContent = "0%";
  setUploading(true);

  try {
    const result = await uploadWithProgress(formData, (loaded, total) => {
      const percent = total ? Math.round((loaded * 100) / total) : 0;
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${percent}%`;
    });
    const failures = (result.results || []).filter((entry) => !entry.success);
    if (failures.length) {
      showToast(`${failures.length} upload(s) en erreur`, "error");
    } else {
      showToast("Upload termine", "success");
    }
    input.value = "";
    updateSelectedFilesMeta();
    await refreshFiles({ silent: true });
  } catch (error) {
    showToast(error.code === "UPLOAD_ABORTED" ? "Upload annule" : `Upload impossible: ${error.message}`, "error");
  } finally {
    setUploading(false);
    setHidden(progress, true);
  }
}

function uploadWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    state.uploadXhr = xhr;
    xhr.open("POST", `${apiBase}/upload.php`);
    xhr.responseType = "json";
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      state.uploadXhr = null;
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response?.success !== false) {
        resolve(xhr.response || {});
        return;
      }
      reject(new Error(xhr.response?.error || xhr.statusText || `HTTP ${xhr.status}`));
    };

    xhr.onerror = () => {
      state.uploadXhr = null;
      reject(new Error("Reseau indisponible"));
    };

    xhr.onabort = () => {
      state.uploadXhr = null;
      const error = new Error("Upload annule");
      error.code = "UPLOAD_ABORTED";
      reject(error);
    };

    xhr.send(formData);
  });
}

function cancelUpload() {
  if (state.uploadXhr) {
    state.uploadXhr.abort();
  }
}

function initDropzone() {
  const dropzone = qs("#dropzone");
  const input = qs("#file-input");
  if (!dropzone || !input) {
    return;
  }

  dropzone.addEventListener("click", () => input.click());
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  ["dragenter", "dragover"].forEach((name) => {
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    dropzone.addEventListener(name, () => dropzone.classList.remove("is-dragover"));
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    const transfer = new DataTransfer();
    Array.from(event.dataTransfer?.files || []).forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    updateSelectedFilesMeta();
  });
}

async function renderPublicShare(token) {
  setView("share");
  try {
    const data = await apiFetch(`/share.php?token=${encodeURIComponent(token)}`);
    const share = data.share;
    qs("#share-title").textContent = share.file.name;
    qs("#share-size").textContent = bytesFmt(share.file.size);
    qs("#share-type").textContent = share.file.mime_type || share.file.extension || "-";
    qs("#share-expiry").textContent = share.expires_at ? dateFmt(share.expires_at) : "Sans expiration";
    qs("#share-download").href = share.download_url;
  } catch (error) {
    qs("#share-title").textContent = "Lien indisponible";
    qs("#share-size").textContent = "-";
    qs("#share-type").textContent = "-";
    qs("#share-expiry").textContent = error.message;
    qs("#share-download").removeAttribute("href");
  }
}

function bindUi() {
  qs("#login-form").addEventListener("submit", login);
  qs("#logout-btn").addEventListener("click", logout);
  qs("#refresh-btn").addEventListener("click", () => refreshFiles({ silent: false }));
  qs("#search-input").addEventListener("input", renderFiles);
  qs("#sort-select").addEventListener("change", renderFiles);
  qs("#upload-form").addEventListener("submit", uploadFiles);
  qs("#file-input").addEventListener("change", updateSelectedFilesMeta);
  qs("#cancel-upload-btn").addEventListener("click", cancelUpload);
  qs("#rename-btn").addEventListener("click", renameSelectedFile);
  qs("#delete-btn").addEventListener("click", deleteSelectedFile);
  qs("#share-form").addEventListener("submit", createShare);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.auth?.is_admin) {
      void refreshFiles({ silent: true });
    }
  });
  initDropzone();
}

window.addEventListener("DOMContentLoaded", () => {
  bindUi();
  updateSelectedFilesMeta();

  const shareToken = new URLSearchParams(window.location.search).get("share");
  if (shareToken) {
    void renderPublicShare(shareToken);
    return;
  }

  void refreshStatus();
});
