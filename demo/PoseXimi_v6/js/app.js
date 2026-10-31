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
import { iconMarkup, decorateIcons } from "./icons.js";
import { auditFonts } from "./services/font-safety.js";
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
import {
  loginAccount,
  registerAccount,
  currentAccount,
  logoutAccount,
} from "./services/auth.js";
import { retakeCoaching } from "./services/pose-feedback.js";
import { initAppearance, setAppearance } from "./services/appearance.js";
import { renderAppearancePicker } from "./views/appearance-picker.js";
import { createSignupValidation } from "./services/signup-validation.js";

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
      icon.innerHTML = iconMarkup(
        !enabled
          ? "lock-square-rounded"
          : {
              home: "home",
              poses: "sparkles",
              capture: "camera",
              library: "library-photo",
            }[page] || "photo",
      );
    }
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  main.innerHTML = (pages[state.page] || renderHome)();
  decorateIcons(main);
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
    !open &&
    document.querySelector("#sidebar")?.contains(document.activeElement)
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

// 2) Auth: Log in is server verified; Sign up has field-strength/confirmation rules.
function authFeedback(id, message, success = false) {
  const node = $(id);
  node.hidden = !message;
  node.textContent = message;
  node.classList.toggle("success", success);
}
function showAuthView(view) {
  $("#loginView").hidden = view !== "login";
  $("#signupView").hidden = view !== "signup";
  $("#workspace").hidden = true;
  authFeedback("#loginFeedback", "");
  authFeedback("#signupFeedback", "");
  (view === "signup" ? $("#signupUsername") : $("#email")).focus();
}
// Sign up rules are handled by a separate module; validation only on blur/submit.
const signupValidator = createSignupValidation();
function enterStudio(user) {
  state.user = user;
  // Guest mode uses a display-only browser session. Real auth relies on HttpOnly server cookie.
  if (user.guest)
    sessionStorage.setItem("poseximi-v31-guest", JSON.stringify(user));
  else sessionStorage.removeItem("poseximi-v31-guest");
  $("#loginView").hidden = true;
  $("#signupView").hidden = true;
  $("#workspace").hidden = false;
  const name = user.name || "Khách";
  $("#profileName").textContent = name;
  $("#avatar").textContent = name.slice(0, 1).toUpperCase();
  navigate("home");
}
async function logout() {
  setSidebarOpen(false);
  stopCamera();
  stopInputCamera();
  if (state.user && !state.user.guest) {
    try {
      await logoutAccount();
    } catch (e) {
      console.warn("Logout API:", e.message);
    }
  }
  state.user = null;
  state.capturedPhoto = null;
  state.backgroundPhoto = null;
  state.groupPhoto = null;
  state.poseId = null;
  state.suggestions = [];
  state.recommendationsReady = false;
  state.retakeNotes = [];
  state.retakeTitle = "";
  sessionStorage.removeItem("poseximi-v31-guest");
  sessionStorage.removeItem("poseximi-v31-session");
  $("#loginForm").reset();
  $("#signupForm").reset();
  showAuthView("login");
}
async function submitLogin(event) {
  event.preventDefault();
  const username = $("#email").value.trim(),
    password = $("#password").value;
  // Login page has no password complexity checks: account & password are validated by backend.
  if (!username || !password) {
    authFeedback("#loginFeedback", "Hãy nhập tên đăng nhập và mật khẩu.");
    return;
  }
  const button = $('#loginForm button[type="submit"]');
  button.disabled = true;
  authFeedback("#loginFeedback", "");
  try {
    const response = await loginAccount({ username, password });
    $("#password").value = "";
    enterStudio({ name: response.user.username, email: response.user.email });
  } catch (error) {
    authFeedback("#loginFeedback", error.message);
  } finally {
    button.disabled = false;
  }
}
async function submitSignup(event) {
  event.preventDefault();
  authFeedback("#signupFeedback", "");
  if (!signupValidator.validateAll()) return;
  const button = $("#signupSubmit");
  button.disabled = true;
  button.textContent = "Đang tạo tài khoản…";
  try {
    const username = $("#signupUsername").value.trim(),
      email = $("#signupEmail").value.trim();
    await registerAccount({
      username,
      email,
      password: $("#signupPassword").value,
    });
    $("#signupForm").reset();
    signupValidator.reset();
    showAuthView("login");
    $("#email").value = username;
    authFeedback(
      "#loginFeedback",
      "Tạo tài khoản thành công. Hãy đăng nhập.",
      true,
    );
  } catch (error) {
    authFeedback("#signupFeedback", error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Tạo tài khoản ↗";
  }
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
  state.retakeNotes = [];
  state.retakeTitle = "";
}
function setConfig(kind, value) {
  if (kind === "people") state.people = Number(value);
  if (kind === "style") {
    state.style = value;
  }
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
      state.retakeNotes = [];
      state.retakeTitle = "";
      stopCamera();
    } else return;
    render();
    toast(
      result.resized
        ? `Đã thêm ảnh và tự thu nhỏ về ${result.width} × ${result.height}px.`
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
      `<h2>Xem trước với ảnh của bạn</h2><img class="ai-preview-image" src="${safe(photo)}" alt="Ảnh đã ghép bằng AI theo pose ${safe(pose.title)}"><p class="preview-caveat">Ảnh ghép do backend AI cung cấp, chưa phải ảnh chụp cuối cùng.</p><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Đóng</button><button class="btn btn-primary" data-action="select-pose" data-id="${safe(id)}">Chọn pose & chụp</button></div>`,
      "pose-detail-modal",
    );
  } catch (error) {
    if (state.pendingPreview !== ctrl) return;
    if (error.name === "AbortError") {
      closeModal();
      return;
    }
    showModal(
      `<h2>Chưa tạo được ảnh xem trước</h2><p class="muted">${safe(error.message)}</p><p class="preview-caveat">Cần backend AI để ghép người vào pose. Không sử dụng ảnh ghép giả trên frontend.</p><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Đóng</button><button class="btn btn-primary" data-action="retry-preview" data-id="${safe(id)}">Thử lại</button></div>`,
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
  state.retakeNotes = [];
  state.retakeTitle = "";
  navigate("capture");
}

// 6) Final camera: flip front/back, hardware zoom, photo shutter.
async function cameraStart(facing) {
  try {
    await openCamera(facing);
    render();
  } catch (error) {
    toast(
      error.name === "NotAllowedError"
        ? "Chưa cấp quyền camera."
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
    state.retakeNotes = [];
    state.retakeTitle = "";
    stopCamera();
    render();
    toast("Đã chụp ảnh nhóm.");
  } catch (error) {
    toast(error.message);
  }
}

// 6b) When Retake is requested, navigate straight to camera and pin pose advice beside it.
function retakeWithNotes() {
  const feedback = retakeCoaching(); // Uses the pose selected for the photo just captured.
  state.retakeTitle = feedback.title;
  state.retakeNotes = [...feedback.tips];
  state.capturedPhoto = null;
  navigate("capture");
  toast("Xem gợi ý điều chỉnh ngay cạnh camera trước khi chụp lại.");
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
    `<h2>${safe(a.poseTitle)}</h2><p>${dateDisplay(a.createdAt)} · ${a.people} người</p>${photoGrid(a.photos, "modal-image-grid")}<div class="modal-actionbar"><button class="btn btn-outline" data-action="download-album" data-id="${safe(a.id)}">Tải ảnh</button><button class="btn btn-primary" data-action="modal-close">Đóng</button></div>`,
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
        state.workspaceExpanded === button.dataset.workspace
          ? null
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
      retakeWithNotes();
      break;
    case "dismiss-retake-notes":
      state.retakeNotes = [];
      state.retakeTitle = "";
      render();
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
$("#loginForm").addEventListener("submit", submitLogin);
$("#signupForm").addEventListener("submit", submitSignup);
$("#guestBtn").addEventListener("click", () =>
  enterStudio({ name: "Khách trải nghiệm", guest: true }),
);
$("#registerBtn").addEventListener("click", () => showAuthView("signup"));
$("#backToLoginBtn").addEventListener("click", () => showAuthView("login"));
$("#resetPasswordBtn").addEventListener("click", () =>
  showModal(
    '<h2>Đặt lại mật khẩu</h2><p class="muted">Chưa kết nối backend xác thực và gửi email khôi phục.</p><div class="modal-actionbar"><button class="btn btn-primary" data-action="modal-close">Đóng</button></div>',
  ),
);
// Appearance editor: visual dropdowns with gradient swatches and live font previews.
// The underlying CSS variable engine stays centralized in services/appearance.js.
$("#appearanceBtn").addEventListener("click", () => {
  showModal(
    `<h2>Tùy chỉnh giao diện ♡</h2>
 <p class="muted">Xem trước palette gradient và font rồi chọn. Layout vẫn được giữ nguyên.</p>
 <div id="appearancePanel">${renderAppearancePicker()}</div>
 <div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Đóng</button></div>`,
    "appearance-modal",
  );
});
$("#modalRoot").addEventListener("click", (event) => {
  const choice = event.target.closest(
    "[data-palette-choice],[data-font-choice]",
  );
  if (!choice) return;
  if (choice.dataset.paletteChoice)
    setAppearance({ palette: choice.dataset.paletteChoice });
  if (choice.dataset.fontChoice)
    setAppearance({ font: choice.dataset.fontChoice });
  const panel = $("#appearancePanel");
  if (panel) panel.innerHTML = renderAppearancePicker();
});
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
    workspace.classList.contains("sidebar-open") &&
    !event.target.closest("#sidebar, #sidebarToggle")
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
// Restore guest only from browser storage. Restore authenticated user from server cookie.
initAppearance();
signupValidator.update();
try {
  const guest = JSON.parse(
    sessionStorage.getItem("poseximi-v31-guest") || "null",
  );
  if (guest?.guest) enterStudio(guest);
} catch {}
if (!state.user) {
  currentAccount()
    .then(({ user }) => {
      if (user && !state.user)
        enterStudio({ name: user.username, email: user.email });
    })
    .catch(() => {});
}

// v4: check remote decorative faces; keep Vietnamese UI on safe heading/body fonts.
auditFonts().catch(() => {});
window.addEventListener("poseximi-font-audit", () => {
  const panel = $("#appearancePanel");
  // Don't collapse a dropdown while the user is inspecting or changing a choice.
  if (panel && !panel.querySelector(".appearance-dropdown[open]"))
    panel.innerHTML = renderAppearancePicker();
});
// Add Tabler icons to buttons defined in static HTML (dynamic cards hydrate in render()).
decorateIcons(document);
