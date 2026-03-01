const configuredApiBase = window.__SHINEDEBOX_API_BASE__ || "https://api.shinederu.lol/box";
const apiBase = String(configuredApiBase).replace(/\/+$/, "");
const configuredAuthApiBase = window.__SHINEDEBOX_AUTH_API_BASE__ || "https://api.shinederu.lol/auth";
const authApiBase = String(configuredAuthApiBase).replace(/\/+$/, "");

let currentUploadXhr = null;
let filesCache = [];
let selectedIds = new Set();
let autoRefreshTimer = null;
let isAdminSession = false;

function qs(sel) {
  return document.querySelector(sel);
}

function setHidden(el, hidden) {
  if (!el) {
    return;
  }
  el.classList.toggle("hidden", !!hidden);
}

function bytesFmt(n) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = Number(n) || 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function showToast(message, type = "info", ttlMs = 3200) {
  const container = qs("#toast-container");
  if (!container) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, ttlMs);
}

function getExt(name) {
  const idx = name.lastIndexOf(".");
  if (idx < 0) {
    return "FILE";
  }
  return name.slice(idx + 1).toUpperCase().slice(0, 6) || "FILE";
}

function setSelectionMeta() {
  const meta = qs("#selection-meta");
  if (!meta) {
    return;
  }
  meta.textContent = `${selectedIds.size} selection`;
}

function setSelectedFilesMeta() {
  const input = qs("#files");
  const el = qs("#selected-files-meta");
  if (!input || !el) {
    return;
  }

  const count = input.files ? input.files.length : 0;
  if (!count) {
    el.textContent = "Aucun fichier selectionne.";
    return;
  }
  let total = 0;
  for (const f of input.files) {
    total += f.size || 0;
  }
  el.textContent = `${count} fichier(s) selectionne(s) - ${bytesFmt(total)}`;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    credentials: "include",
    ...options,
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok || (isJson && body && body.success === false)) {
    const message = isJson ? body.error || JSON.stringify(body) : body || `HTTP ${res.status}`;
    const err = new Error(message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return isJson ? body : { raw: body };
}

async function authApiFetch(path, options = {}) {
  const res = await fetch(`${authApiBase}${path}`, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    credentials: "include",
    ...options,
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok || (isJson && body && body.success === false)) {
    const message = isJson ? body.error || body.message || JSON.stringify(body) : body || `HTTP ${res.status}`;
    const err = new Error(message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return isJson ? body : { raw: body };
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(async () => {
    if (!isAdminSession || currentUploadXhr) {
      return;
    }
    try {
      await refreshList({ silent: true });
    } catch (_) {
      // no-op
    }
  }, 20000);
}

function stopAutoRefresh() {
  if (!autoRefreshTimer) {
    return;
  }
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = null;
}

function applyAuthUi(auth) {
  const authStatus = qs("#auth-status");
  const loginForm = qs("#login-form");
  const refreshAuthBtn = qs("#refresh-auth-btn");
  const logoutBtn = qs("#logout-btn");
  const uploader = qs("#uploader");
  const filesActions = qs("#files-actions");
  const accessNote = qs("#access-note");

  setHidden(refreshAuthBtn, false);

  if (!auth || !auth.authenticated) {
    isAdminSession = false;
    stopAutoRefresh();
    authStatus.textContent = "Non connecte. Connexion admin requise.";
    setHidden(loginForm, false);
    setHidden(logoutBtn, true);
    setHidden(uploader, true);
    setHidden(filesActions, true);
    setHidden(accessNote, false);
    filesCache = [];
    selectedIds.clear();
    renderFiles();
    return;
  }

  const username = auth.user && auth.user.username ? auth.user.username : "inconnu";
  setHidden(logoutBtn, false);
  setHidden(loginForm, true);

  if (!auth.is_admin) {
    isAdminSession = false;
    stopAutoRefresh();
    authStatus.textContent = `Connecte: ${username} (non admin)`;
    setHidden(uploader, true);
    setHidden(filesActions, true);
    setHidden(accessNote, false);
    filesCache = [];
    selectedIds.clear();
    renderFiles();
    return;
  }

  isAdminSession = true;
  startAutoRefresh();
  authStatus.textContent = `Connecte admin: ${username}`;
  setHidden(uploader, false);
  setHidden(filesActions, false);
  setHidden(accessNote, true);
}

async function fetchAuthStatus() {
  return apiFetch("/auth.php?action=status");
}

async function refreshStatus() {
  const listErrors = qs("#list-errors");
  try {
    const auth = await fetchAuthStatus();
    applyAuthUi(auth);
    if (auth.authenticated && auth.is_admin) {
      await refreshList({ silent: true });
      return;
    }
    listErrors.textContent = "";
  } catch (e) {
    isAdminSession = false;
    stopAutoRefresh();
    qs("#auth-status").textContent = "Erreur de verification de session";
    setHidden(qs("#login-form"), false);
    setHidden(qs("#uploader"), true);
    setHidden(qs("#files-actions"), true);
    setHidden(qs("#access-note"), false);
    filesCache = [];
    selectedIds.clear();
    renderFiles();
    listErrors.textContent = e.message || String(e);
  }
}

async function doLogin(ev) {
  ev.preventDefault();
  const username = (qs("#login-username")?.value || "").trim();
  const password = qs("#login-password")?.value || "";

  if (!username || !password) {
    qs("#auth-status").textContent = "Username et password requis.";
    return;
  }

  try {
    await authApiFetch("/?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ action: "login", username, password }).toString(),
    });
    qs("#login-password").value = "";
    showToast("Connexion reussie", "success");
    await refreshStatus();
  } catch (e) {
    qs("#auth-status").textContent = `Connexion echouee: ${e.message}`;
    showToast(`Connexion echouee: ${e.message}`, "error", 4200);
  }
}

async function doLogout() {
  try {
    await authApiFetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ action: "logout" }).toString(),
    });
    await apiFetch("/auth.php?action=logout");
    showToast("Deconnexion effectuee", "info");
  } catch (_) {
    // best effort
  } finally {
    await refreshStatus();
  }
}

function uploadWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    currentUploadXhr = xhr;
    xhr.open("POST", `${apiBase}/upload.php`);
    xhr.responseType = "json";
    xhr.withCredentials = true;

    const clearCurrent = () => {
      if (currentUploadXhr === xhr) {
        currentUploadXhr = null;
      }
    };

    xhr.onload = () => {
      clearCurrent();
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response && xhr.response.success !== false) {
        resolve(xhr.response);
        return;
      }
      const msg = (xhr.response && (xhr.response.error || JSON.stringify(xhr.response))) || xhr.statusText;
      reject(new Error(msg || `HTTP ${xhr.status}`));
    };

    xhr.onerror = () => {
      clearCurrent();
      reject(new Error("Reseau/serveur indisponible"));
    };

    xhr.onabort = () => {
      clearCurrent();
      const err = new Error("Upload annule.");
      err.code = "UPLOAD_ABORTED";
      reject(err);
    };

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) {
          return;
        }
        onProgress(e.loaded, e.total);
      };
    }

    xhr.send(formData);
  });
}

function setUploadingState(uploading) {
  const fileInput = qs("#files");
  const sendBtn = qs("#upload-submit-btn");
  const cancelBtn = qs("#cancel-upload-btn");
  const dropzone = qs("#dropzone");

  if (fileInput) {
    fileInput.disabled = uploading;
  }
  if (sendBtn) {
    sendBtn.disabled = uploading;
  }
  if (dropzone) {
    dropzone.style.pointerEvents = uploading ? "none" : "auto";
    dropzone.style.opacity = uploading ? "0.65" : "1";
  }
  setHidden(cancelBtn, !uploading);
}

function cancelCurrentUpload() {
  if (!currentUploadXhr) {
    return;
  }
  currentUploadXhr.abort();
}

async function startUpload(fileListLike) {
  if (currentUploadXhr) {
    return;
  }

  const files = Array.from(fileListLike || []);
  if (!files.length) {
    return;
  }

  const fd = new FormData();
  for (const f of files) {
    fd.append("files[]", f, f.name);
  }

  const bar = qs("#progress-bar");
  const wrap = qs("#progress");
  const text = qs("#progress-text");
  const uploadErrors = qs("#upload-errors");
  setHidden(wrap, false);
  setUploadingState(true);
  bar.style.width = "0%";
  text.textContent = "";
  uploadErrors.textContent = "";

  try {
    const result = await uploadWithProgress(fd, (loaded, total) => {
      const pct = total ? Math.round((loaded * 100) / total) : 0;
      bar.style.width = `${pct}%`;
      text.textContent = `${pct}%`;
    });

    setHidden(wrap, true);
    setUploadingState(false);
    qs("#files").value = "";
    setSelectedFilesMeta();

    const failed = (result.results || []).filter((x) => !x.success);
    if (failed.length) {
      showToast(`${failed.length} fichier(s) en echec`, "error", 4200);
      uploadErrors.textContent = failed.map((x) => `${x.name}: ${x.error || "Erreur"}`).join("\n");
    } else {
      showToast("Upload termine", "success");
    }
    await refreshList({ silent: true });
  } catch (e) {
    setHidden(wrap, true);
    setUploadingState(false);
    uploadErrors.textContent = e.code === "UPLOAD_ABORTED" ? "Upload annule." : String(e.message || e);
    if (e.code === "UPLOAD_ABORTED") {
      showToast("Upload annule", "info");
    } else {
      showToast(`Upload en erreur: ${e.message || e}`, "error", 4200);
    }
    if (e.status === 401 || e.status === 403) {
      await refreshStatus();
    }
  }
}

async function doUpload(ev) {
  ev.preventDefault();
  const input = qs("#files");
  await startUpload(input.files);
}

function getFilteredSortedFiles() {
  const search = (qs("#search-input")?.value || "").trim().toLowerCase();
  const sort = qs("#sort-select")?.value || "newest";

  let list = filesCache.slice();
  if (search) {
    list = list.filter((f) => String(f.name || "").toLowerCase().includes(search));
  }

  list.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return (a.mtime || 0) - (b.mtime || 0);
      case "name_asc":
        return String(a.name || "").localeCompare(String(b.name || ""));
      case "name_desc":
        return String(b.name || "").localeCompare(String(a.name || ""));
      case "size_desc":
        return (b.size || 0) - (a.size || 0);
      case "newest":
      default:
        return (b.mtime || 0) - (a.mtime || 0);
    }
  });

  return list;
}

function renderFiles() {
  const listEl = qs("#file-list");
  if (!listEl) {
    return;
  }

  const filtered = getFilteredSortedFiles();
  listEl.innerHTML = "";
  setSelectionMeta();

  if (!filtered.length) {
    listEl.innerHTML = "<li>Aucun fichier.</li>";
    return;
  }

  for (const f of filtered) {
    const li = document.createElement("li");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "file-select";
    checkbox.checked = selectedIds.has(f.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedIds.add(f.id);
      } else {
        selectedIds.delete(f.id);
      }
      setSelectionMeta();
    });
    li.appendChild(checkbox);

    const meta = document.createElement("div");
    meta.className = "file-meta";

    const titleRow = document.createElement("div");
    titleRow.className = "file-title-row";
    const badge = document.createElement("span");
    badge.className = "ext-badge";
    badge.textContent = getExt(f.name);

    const link = document.createElement("a");
    link.href = f.url;
    link.textContent = f.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    titleRow.appendChild(badge);
    titleRow.appendChild(link);

    const sub = document.createElement("small");
    const dt = new Date((f.mtime || 0) * 1000).toLocaleString();
    sub.textContent = `${bytesFmt(f.size || 0)} - ${dt}`;

    meta.appendChild(titleRow);
    meta.appendChild(sub);
    li.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copier lien";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(f.url);
        showToast("Lien copie", "success");
      } catch (_) {
        showToast("Copie impossible", "error");
      }
    });

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.textContent = "Renommer";
    renameBtn.addEventListener("click", async () => {
      const dot = f.name.lastIndexOf(".");
      const ext = dot > 0 ? f.name.slice(dot) : "";
      const base = dot > 0 ? f.name.slice(0, dot) : f.name;
      const input = prompt(`Nouveau nom (sans extension ${ext || ""})`, base);
      if (input == null) {
        return;
      }
      let newBase = input.trim();
      if (!newBase) {
        return;
      }
      if (ext && newBase.toLowerCase().endsWith(ext.toLowerCase())) {
        newBase = newBase.slice(0, -ext.length);
      }
      try {
        await apiFetch("/rename.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ id: f.id, name: newBase }).toString(),
        });
        showToast("Fichier renomme", "success");
        await refreshList({ silent: true });
      } catch (e) {
        showToast(`Renommage echoue: ${e.message}`, "error", 4200);
        if (e.status === 401 || e.status === 403) {
          await refreshStatus();
        }
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger-soft";
    deleteBtn.textContent = "Supprimer";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Supprimer ${f.name} ?`)) {
        return;
      }
      try {
        await apiFetch("/delete.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ id: f.id }).toString(),
        });
        selectedIds.delete(f.id);
        showToast("Fichier supprime", "success");
        await refreshList({ silent: true });
      } catch (e) {
        showToast(`Suppression echouee: ${e.message}`, "error", 4200);
        if (e.status === 401 || e.status === 403) {
          await refreshStatus();
        }
      }
    });

    actions.appendChild(copyBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(actions);
    listEl.appendChild(li);
  }
}

async function refreshList({ silent = false } = {}) {
  const errs = qs("#list-errors");
  if (!silent) {
    errs.textContent = "";
  }

  try {
    const data = await apiFetch("/list.php");
    filesCache = Array.isArray(data.files) ? data.files : [];
    selectedIds.forEach((id) => {
      if (!filesCache.find((x) => x.id === id)) {
        selectedIds.delete(id);
      }
    });
    renderFiles();
  } catch (e) {
    errs.textContent = String(e.message || e);
    if (e.status === 401 || e.status === 403) {
      await refreshStatus();
    }
  }
}

function handleDropzoneFiles(files) {
  const input = qs("#files");
  if (!files || !files.length || !input) {
    return;
  }

  const dataTransfer = new DataTransfer();
  for (const file of files) {
    dataTransfer.items.add(file);
  }
  input.files = dataTransfer.files;
  setSelectedFilesMeta();
}

function initDropzone() {
  const dropzone = qs("#dropzone");
  const input = qs("#files");
  if (!dropzone || !input) {
    return;
  }

  dropzone.addEventListener("click", () => input.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  const setOver = (over) => {
    dropzone.classList.toggle("is-dragover", over);
  };

  dropzone.addEventListener("dragenter", (e) => {
    e.preventDefault();
    setOver(true);
  });
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    setOver(true);
  });
  dropzone.addEventListener("dragleave", () => setOver(false));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    setOver(false);
    handleDropzoneFiles(e.dataTransfer?.files || []);
  });
}

function bindToolbar() {
  qs("#search-input")?.addEventListener("input", renderFiles);
  qs("#sort-select")?.addEventListener("change", renderFiles);
  qs("#refresh-files-btn")?.addEventListener("click", () => refreshList({ silent: false }));

  qs("#select-all-btn")?.addEventListener("click", () => {
    for (const f of getFilteredSortedFiles()) {
      selectedIds.add(f.id);
    }
    renderFiles();
  });

  qs("#clear-selection-btn")?.addEventListener("click", () => {
    selectedIds.clear();
    renderFiles();
  });

  qs("#delete-selected-btn")?.addEventListener("click", async () => {
    if (!selectedIds.size) {
      showToast("Aucune selection", "info");
      return;
    }
    if (!confirm(`Supprimer ${selectedIds.size} fichier(s) selectionne(s) ?`)) {
      return;
    }

    const ids = Array.from(selectedIds);
    let deleted = 0;
    for (const id of ids) {
      try {
        await apiFetch("/delete.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ id }).toString(),
        });
        deleted += 1;
        selectedIds.delete(id);
      } catch (_) {
        // Continue and report count.
      }
    }

    await refreshList({ silent: true });
    if (deleted > 0) {
      showToast(`${deleted} fichier(s) supprime(s)`, "success");
    } else {
      showToast("Aucune suppression effectuee", "error");
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  qs("#login-form")?.addEventListener("submit", doLogin);
  qs("#logout-btn")?.addEventListener("click", doLogout);
  qs("#refresh-auth-btn")?.addEventListener("click", refreshStatus);
  qs("#upload-form")?.addEventListener("submit", doUpload);
  qs("#cancel-upload-btn")?.addEventListener("click", cancelCurrentUpload);
  qs("#files")?.addEventListener("change", setSelectedFilesMeta);

  bindToolbar();
  initDropzone();
  setSelectedFilesMeta();
  setSelectionMeta();
  refreshStatus();
});

