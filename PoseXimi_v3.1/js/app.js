/**
 * PoseXimi PWA application entry point.
 * Sections: Login | Navigation | Upload | AI Preview | Camera | Albums | Events.
 * No hard-coded authentication or AI image editing: both need backend APIs.
 */
import {
  state,
  poseList,
  currentPose,
  inputsReady,
  canEnter,
  pageNames,
} from "./state.js";
import {
  $,
  safe,
  toast,
  showModal,
  closeModal,
  dateDisplay,
  loadingModal,
} from "./ui.js";
import { renderHome } from "./views/home.js";
import { renderPoses } from "./views/poses.js";
import { renderCapture } from "./views/capture.js";
import { renderResult } from "./views/result.js";
import { renderLibrary } from "./views/library.js";
import { photoGrid } from "./views/shared.js";
import { readAlbums, storeAlbum, deleteAlbum } from "./services/storage.js";
import { decodeFile } from "./services/images.js";
import {
  openCamera,
  flipCamera,
  setZoom,
  stopCamera,
  captureCamera,
  openInputCamera,
  stopInputCamera,
  attachInputCamera,
  captureInput,
} from "./services/camera.js";
import { loadRecommendations, previewPose } from "./services/ai.js";

const main = $("#main"),
  input = $("#photoInput");
const sidebarToggle = $("#sidebarToggle"),
  sidebarBackdrop = $("#sidebarBackdrop"),
  workspace = $("#workspace");
const pages = {
  home: renderHome,
  poses: renderPoses,
  capture: renderCapture,
  result: renderResult,
  library: renderLibrary,
};

// 1) Render: update page heading, current nav and protected/locked workspaces.
function render() {
  $("#pageLabel").textContent = pageNames[state.page] || "Trang chủ";
  document.querySelectorAll("[data-page]").forEach((item) => {
    const page = item.dataset.page,
      enabled = canEnter(page),
      active =
        state.page === page || (state.page === "result" && page === "capture");
    item.classList.toggle("active", active);
    item.classList.toggle("nav-locked", !enabled);
    item.setAttribute("aria-disabled", String(!enabled));
    const icon = item.querySelector(".nav-icon");
    if (icon) {
      if (!icon.dataset.originalIcon)
        icon.dataset.originalIcon = icon.textContent;
      icon.textContent = enabled ? icon.dataset.originalIcon : "🔒";
    }
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  main.innerHTML = (pages[state.page] || renderHome)();
  if (state.page === "capture") attachLiveCamera();
}
function attachLiveCamera() {
  const video = $("#liveVideo");
  if (video && state.camera.stream) {
    video.srcObject = state.camera.stream;
    video.play().catch(() => toast("Không phát được video camera."));
  }
}
// MENU: mặc định ẩn; desktop hover vào dải mép trái sẽ tự mở qua CSS.
// Trên mobile hoặc desktop, nút ☰ dùng để ghim/mở menu, click ngoài sẽ đóng.
function setSidebarOpen(open) {
  workspace.classList.toggle("sidebar-open", Boolean(open));
  sidebarToggle.setAttribute("aria-expanded", String(Boolean(open)));
  sidebarToggle.setAttribute(
    "aria-label",
    open ? "Đóng menu workspace" : "Mở menu workspace",
  );
  sidebarBackdrop.hidden = !open;
  if (
    !open
    && document.querySelector("#sidebar")?.contains(document.activeElement)
  )
    sidebarToggle.focus();
}
function navigate(page) {
  if (!canEnter(page)) {
    toast("Workspace này đang khóa. Hoàn thành bước trước để mở.");
    return;
  }
  if (state.page === "capture" && page !== "capture") stopCamera();
  state.page = page;
  setSidebarOpen(false);
  render();
  if (page === "library") refreshLibrary();
  window.scrollTo({ top: 0, behavior: "instant" });
}

// 2) Login: feedback inside a separate UI box, no native browser warning bubble.
function checkCredentials(showError = false) {
  const username = $("#email").value.trim(),
    password = $("#password").value;
  const checks = {
    username: username.length >= 3,
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
  };
  for (const [rule, valid] of Object.entries(checks)) {
    const node = $(`[data-rule="${rule}"]`);
    node.classList.toggle("is-valid", valid);
    node.classList.toggle(
      "is-invalid",
      !valid
        && (showError
          || (rule === "username" ? username : password).length > 0),
    );
    node.textContent =
      (valid ? "✓ "
      : valid === false && showError ? "✕ "
      : "○ ")
      + {
        username: "Tên đăng nhập ít nhất 3 ký tự",
        length: "Mật khẩu ít nhất 8 ký tự",
        uppercase: "Mật khẩu có ít nhất 1 chữ in hoa (A–Z)",
      }[rule];
  }
  const okay = Object.values(checks).every(Boolean),
    error = $("#loginError");
  error.hidden = !showError || okay;
  if (showError && !okay)
    error.textContent = "Vui lòng đáp ứng đủ các tiêu chí trên.";
  return okay;
}
function enterStudio(user) {
  state.user = user;
  sessionStorage.setItem("poseximi-v31-session", JSON.stringify(user));
  $("#loginView").hidden = true;
  $("#workspace").hidden = false;
  const username = user.name || "Khách";
  $("#profileName").textContent = username;
  $("#avatar").textContent = username.slice(0, 1).toUpperCase();
  navigate("home");
}
function logout() {
  setSidebarOpen(false);
  stopCamera();
  stopInputCamera();
  state.user = null;
  state.capturedPhoto = null;
  state.backgroundPhoto = null;
  state.groupPhoto = null;
  state.poseId = null;
  state.suggestions = [];
  state.recommendationsReady = false;
  sessionStorage.removeItem("poseximi-v31-session");
  $("#workspace").hidden = true;
  $("#loginView").hidden = false;
  $("#password").value = "";
  checkCredentials();
  $("#email").focus();
}

/** Home: on changes to person count/style, invalidate previous results.
 * @param {"people"|"style"} kind - Which setting to change.
 * @param {string|number} value - New setting value from its button.
 */
// 3) Home: reconfigure state, invalidate obsolete pose selections and final photos.
function resetRecommendations() {
  state.recommendationsReady = false;
  state.suggestions = [];
  state.poseId = null;
  state.capturedPhoto = null;
  state.showAllPoses = false;
}
function setConfig(kind, value) {
  if (kind === "people") state.people = Number(value);
  if (kind === "style") state.style = value;
  resetRecommendations();
  render();
}
function beginUpload(kind) {
  state.fileTarget = kind;
  input.value = "";
  input.click();
}
/** @param {File|undefined} file - Browser-selected or drag-and-dropped image. */
async function processFile(file) {
  if (!file) return;
  const target = state.fileTarget;
  try {
    const result = await decodeFile(file);
    if (target === "background") {
      state.backgroundPhoto = result.dataUrl;
      resetRecommendations();
    } else if (target === "group") {
      state.groupPhoto = result.dataUrl;
      resetRecommendations();
    } else if (target === "capture" && state.page === "capture") {
      state.capturedPhoto = result.dataUrl;
      stopCamera();
    } else return;
    render();
    toast(
      result.resized ?
        `Đã thêm ảnh và tự thu nhỏ về ${result.width} × ${result.height}px.`
      : "Đã thêm ảnh thành công.",
    );
  } catch (error) {
    toast(error.message || "Không đọc được ảnh.");
  }
}
async function launchInputCamera(kind) {
  showModal(
    `<h2>Chụp ${kind === "background" ? "ảnh background" : "ảnh toàn thân mọi người"}</h2><div class="modal-camera-stage"><video id="inputLiveVideo" autoplay muted playsinline></video></div><p class="capture-footnote">Giữ thiết bị ổn định, lấy đủ khung hình.</p><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Hủy</button><button class="btn btn-primary" data-action="take-input-photo">◎ Chụp ảnh</button></div>`,
    "camera-input-modal",
  );
  try {
    await openInputCamera(kind);
    attachInputCamera();
  } catch (error) {
    stopInputCamera();
    closeModal();
    toast(error.message || "Không thể mở camera.");
  }
}
function takeInputPhoto() {
  try {
    const kind = state.inputCameraKind,
      image = captureInput();
    if (kind === "background") state.backgroundPhoto = image.dataUrl;
    else if (kind === "group") state.groupPhoto = image.dataUrl;
    stopInputCamera();
    closeModal();
    resetRecommendations();
    render();
    toast("Đã chụp ảnh đầu vào.");
  } catch (error) {
    toast(error.message);
  }
}

// 4) Suggestions: optional ranking API, presets remain labeled as demo when no backend.
async function requestSuggestions() {
  if (!inputsReady()) {
    toast("Cần tải đủ ảnh background và ảnh toàn thân mọi người.");
    return;
  }
  state.analyzing = true;
  state.recommendationsReady = true;
  state.page = "poses";
  render();
  try {
    const ids = await loadRecommendations({
      people: state.people,
      style: state.style,
      backgroundImage: state.backgroundPhoto,
      peopleImage: state.groupPhoto,
    });
    state.suggestions = Array.isArray(ids) ? ids : [];
  } finally {
    state.analyzing = false;
    if (state.page === "poses") render();
  }
}

// 5) Preview: request AI composition from backend and display loading modal until response.
/** @param {string} id - Pose preset ID supplied to the AI composition endpoint. */
async function showPosePreview(id) {
  const pose = poseList().find((p) => p.id === id);
  if (!pose) return;
  const ctrl = new AbortController();
  state.pendingPreview = ctrl;
  loadingModal(
    "AI đang ghép ảnh với tư thế",
    `Đang thử ${pose.title} với ảnh toàn thân của bạn…`,
  );
  const slowTimer = setTimeout(() => {
    if (state.pendingPreview === ctrl && $("#aiLoadingMessage"))
      $("#aiLoadingMessage").textContent =
        "Xử lý đang lâu hơn bình thường. Bạn có thể tiếp tục chờ hoặc hủy.";
  }, 6500);
  try {
    const photo = await previewPose({
      poseId: id,
      people: state.people,
      style: state.style,
      backgroundImage: state.backgroundPhoto,
      peopleImage: state.groupPhoto,
      signal: ctrl.signal,
    });
    if (state.pendingPreview !== ctrl) return;
    showModal(
      `<h2>Xem trước với ảnh của bạn</h2><img class="ai-preview-image" src="${safe(photo)}" alt="Ảnh đã ghép bằng AI theo pose ${safe(pose.title)}"><p class="preview-caveat">Ảnh ghép do backend AI cung cấp, chưa phải ảnh chụp cuối cùng.</p><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Đóng</button><button class="btn btn-primary" data-action="select-pose" data-id="${safe(id)}">Chọn pose & chụp →</button></div>`,
      "pose-detail-modal",
    );
  } catch (error) {
    if (state.pendingPreview !== ctrl) return;
    if (error.name === "AbortError") {
      closeModal();
      return;
    }
    showModal(
      `<h2>Chưa tạo được ảnh xem trước</h2><p class="muted">${safe(error.message)}</p><p class="preview-caveat">Cần backend AI để ghép người vào pose. Không sử dụng ảnh ghép giả trên frontend.</p><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Đóng</button><button class="btn btn-primary" data-action="retry-preview" data-id="${safe(id)}">↻ Thử lại</button></div>`,
    );
  } finally {
    clearTimeout(slowTimer);
    if (state.pendingPreview === ctrl) state.pendingPreview = null;
  }
}
function cancelPreview() {
  state.pendingPreview?.abort();
  state.pendingPreview = null;
  closeModal();
}
function selectPose(id) {
  if (!poseList().some((p) => p.id === id)) return;
  cancelPreview();
  state.poseId = id;
  state.capturedPhoto = null;
  state.camera.showPoseOverlay = true;
  navigate("capture");
}

// 6) Final camera: flip front/back, hardware zoom, photo shutter.
async function cameraStart(facing) {
  try {
    await openCamera(facing);
    render();
  } catch (error) {
    toast(
      error.name === "NotAllowedError" ?
        "Chưa cấp quyền camera."
      : error.message || "Không thể mở camera.",
    );
  }
}
async function cameraFlip() {
  try {
    await flipCamera();
    render();
  } catch (error) {
    toast(
      "Không đổi được camera: " + (error.message || "camera không hỗ trợ."),
    );
  }
}
function shutter() {
  try {
    state.capturedPhoto = captureCamera().dataUrl;
    stopCamera();
    render();
    toast("Đã chụp ảnh nhóm.");
  } catch (error) {
    toast(error.message);
  }
}

// 7) Library operations.
async function refreshLibrary() {
  const token = ++state.libraryToken;
  state.libraryLoading = true;
  render();
  try {
    const albums = await readAlbums();
    if (state.page === "library" && state.libraryToken === token)
      state.albums = albums;
  } catch (error) {
    console.error(error);
    toast("Không thể tải thư viện.");
  } finally {
    if (state.page === "library" && state.libraryToken === token) {
      state.libraryLoading = false;
      render();
    }
  }
}
async function approve() {
  if (state.busy || !state.capturedPhoto || !currentPose()) return;
  state.busy = true;
  render();
  const pose = currentPose(),
    album = {
      id: crypto.randomUUID?.() || String(Date.now()),
      createdAt: Date.now(),
      people: state.people,
      style: state.style,
      poseId: pose.id,
      poseTitle: pose.title,
      photos: [state.capturedPhoto],
    };
  try {
    await storeAlbum(album);
    state.capturedPhoto = null;
    toast("Đã duyệt và lưu ảnh.");
    navigate("library");
  } catch (error) {
    console.error(error);
    toast("Không thể lưu, bộ nhớ có thể đã đầy.");
  } finally {
    state.busy = false;
    if (state.page === "result") render();
  }
}
function albumById(id) {
  return state.albums.find((a) => a.id === id);
}
function viewAlbum(id) {
  const a = albumById(id);
  if (!a) return;
  showModal(
    `<h2>${safe(a.poseTitle)}</h2><p>${dateDisplay(a.createdAt)} · ${a.people} người</p>${photoGrid(a.photos, "modal-image-grid")}<div class="modal-actionbar"><button class="btn btn-outline" data-action="download-album" data-id="${safe(a.id)}">↓ Tải ảnh</button><button class="btn btn-primary" data-action="modal-close">Đóng</button></div>`,
  );
}
function downloadAlbum(id) {
  const a = albumById(id);
  if (!a) return;
  const link = document.createElement("a");
  link.href = a.photos[0];
  link.download = `PoseXimi_${id.slice(0, 8)}.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
function confirmDelete(id) {
  const a = albumById(id);
  if (!a) return;
  showModal(
    `<h2>Xóa bộ ảnh?</h2><p>“${safe(a.poseTitle)}” sẽ bị xóa khỏi thiết bị này. Không thể hoàn tác.</p><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Hủy</button><button class="btn btn-danger" data-action="confirm-delete" data-id="${safe(id)}">Xóa ảnh</button></div>`,
  );
}
function modalClose() {
  cancelPreview();
  stopInputCamera();
}

// 8) Delegate interactions from screen components. Every visible button has a handler.
main.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  switch (button.dataset.action) {
    case "set-count":
      setConfig("people", button.dataset.count);
      break;
    case "set-style":
      setConfig("style", button.dataset.style);
      break;
    case "workspace-details":
      state.workspaceExpanded =
        state.workspaceExpanded === button.dataset.workspace ?
          null
        : button.dataset.workspace;
      render();
      break;
    case "upload-input":
      beginUpload(button.dataset.kind);
      break;
    case "camera-input":
      await launchInputCamera(button.dataset.kind);
      break;
    case "request-suggestions":
      await requestSuggestions();
      break;
    case "toggle-more":
      state.showAllPoses = !state.showAllPoses;
      render();
      break;
    case "preview-pose":
      await showPosePreview(button.dataset.id);
      break;
    case "select-pose":
      selectPose(button.dataset.id);
      break;
    case "back-home":
      navigate("home");
      break;
    case "go-camera":
      navigate("capture");
      break;
    case "open-file":
      beginUpload("capture");
      break;
    case "open-camera":
      await cameraStart();
      break;
    case "flip-camera":
      await cameraFlip();
      break;
    case "capture-photo":
      shutter();
      break;
    case "stop-camera":
      stopCamera();
      render();
      break;
    case "toggle-pose-overlay":
      state.camera.showPoseOverlay = !state.camera.showPoseOverlay;
      render();
      break;
    case "go-results":
      navigate("result");
      break;
    case "retake":
      state.capturedPhoto = null;
      navigate("capture");
      break;
    case "approve":
      await approve();
      break;
    case "view-album":
      viewAlbum(button.dataset.id);
      break;
    case "download-album":
      downloadAlbum(button.dataset.id);
      break;
    case "delete-album":
      confirmDelete(button.dataset.id);
      break;
  }
});
main.addEventListener("input", async (event) => {
  if (event.target.id !== "zoomCamera") return;
  try {
    if (await setZoom(event.target.value))
      $("#zoomAmount").textContent = state.camera.zoom.toFixed(1) + "×";
  } catch {
    toast("Camera không hỗ trợ thu phóng tại mức này.");
  }
});
$("#modalRoot").addEventListener("click", async (event) => {
  if (event.target.matches("[data-backdrop]")) return modalClose();
  const button = event.target.closest("[data-action]");
  if (!button) return;
  switch (button.dataset.action) {
    case "modal-close":
      modalClose();
      break;
    case "cancel-preview":
      cancelPreview();
      break;
    case "retry-preview":
      await showPosePreview(button.dataset.id);
      break;
    case "take-input-photo":
      takeInputPhoto();
      break;
    case "select-pose":
      selectPose(button.dataset.id);
      break;
    case "download-album":
      downloadAlbum(button.dataset.id);
      break;
    case "confirm-delete":
      await deleteAlbum(button.dataset.id);
      modalClose();
      toast("Đã xóa ảnh.");
      refreshLibrary();
      break;
  }
});
$("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!checkCredentials(true)) return;
  const username = $("#email").value.trim();
  enterStudio({ name: username.split("@")[0].slice(0, 25), email: username });
  $("#loginForm").reset();
  checkCredentials();
});
$("#email").addEventListener("input", () => checkCredentials());
$("#password").addEventListener("input", () => checkCredentials());
$("#guestBtn").addEventListener("click", () =>
  enterStudio({ name: "Khách trải nghiệm" }),
);
$("#registerBtn").addEventListener("click", () =>
  showModal(
    '<h2>Đăng ký tài khoản</h2><p class="muted">Chưa có API đăng ký. Đây chỉ là giao diện frontend.</p><div class="modal-actionbar"><button class="btn btn-primary" data-action="modal-close">Đã hiểu</button></div>',
  ),
);
$("#resetPasswordBtn").addEventListener("click", () =>
  showModal(
    '<h2>Đặt lại mật khẩu</h2><p class="muted">Chưa kết nối backend xác thực và gửi email khôi phục.</p><div class="modal-actionbar"><button class="btn btn-primary" data-action="modal-close">Đóng</button></div>',
  ),
);
$("#logoutBtn").addEventListener("click", logout);
sidebarToggle.addEventListener("click", () =>
  setSidebarOpen(!workspace.classList.contains("sidebar-open")),
);
sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));
$("#brandLink").addEventListener("click", (event) => {
  event.preventDefault();
  navigate("home");
});
$("#mainNav").addEventListener("click", (event) => {
  const node = event.target.closest("[data-page]");
  if (node) navigate(node.dataset.page);
});
input.addEventListener("change", async () => {
  const file = input.files?.[0];
  input.value = "";
  await processFile(file);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if ($("#modalRoot").children.length) modalClose();
    else setSidebarOpen(false);
  }
});
document.addEventListener("click", (event) => {
  if (
    workspace.classList.contains("sidebar-open")
    && !event.target.closest("#sidebar, #sidebarToggle")
  )
    setSidebarOpen(false);
});
for (const name of ["dragenter", "dragover", "dragleave", "drop"])
  main.addEventListener(name, (event) => {
    const dz = event.target.closest("#captureDropzone");
    if (!dz) return;
    event.preventDefault();
    if (["dragenter", "dragover"].includes(name)) dz.classList.add("dragover");
    else dz.classList.remove("dragover");
    if (name === "drop") {
      state.fileTarget = "capture";
      processFile(event.dataTransfer.files?.[0]);
    }
  });
window.addEventListener("beforeunload", () => {
  stopCamera();
  stopInputCamera();
});
$("#todayDate").textContent = new Date().toLocaleDateString("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
checkCredentials();
try {
  const session = JSON.parse(
    sessionStorage.getItem("poseximi-v31-session") || "null",
  );
  if (session?.name) enterStudio(session);
} catch {}
