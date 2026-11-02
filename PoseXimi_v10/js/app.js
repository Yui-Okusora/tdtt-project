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
import { poseSVG } from "./art.js";
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
import {
  normalizePhotoTitle,
  validatePhotoTitle,
  filenameFromTitle,
} from "./services/photo-title.js";
import { initAppearance, setAppearance } from "./services/appearance.js";
import { renderAppearancePicker } from "./views/appearance-picker.js";
import { MainLayout } from "./components/MainLayout.js";
import { PoseDetailModal } from "./components/PoseDetailModal.js";
import { createSignupValidation } from "./services/signup-validation.js";

const main = $("#main"),
  input = $("#photoInput");
const workspace = $("#workspace"),
  bottomNav = $("#mainNav");
const pages = {
  home: renderHome,
  poses: renderPoses,
  capture: renderCapture,
  result: renderResult,
  library: renderLibrary,
};
let uxCountdownTimer = null;
function cancelUXCountdown() {
  if (uxCountdownTimer !== null) {
    clearTimeout(uxCountdownTimer);
    uxCountdownTimer = null;
  }
}

// 1) MainLayout — same three destinations throughout the app.
function render() {
  const navPage = ["capture", "result"].includes(state.page)
    ? "poses"
    : state.page;
  $("#pageLabel").textContent = pageNames[state.page] || "Trang chủ";
  bottomNav.innerHTML = MainLayout({ page: navPage });
  main.innerHTML = (pages[state.page] || renderHome)();
  document.body.classList.toggle("px-in-camera", state.page === "capture");
  decorateIcons(main);
  if (state.page === "capture") attachLiveCamera();
  if (state.page === "poses") initPoseCarousel();
}
function attachLiveCamera() {
  const video = $("#liveVideo");
  if (video && state.camera.stream) {
    video.srcObject = state.camera.stream;
    video.play().catch(() => toast("Không phát được video camera."));
  }
}
function initPoseCarousel() {
  const track = $("#poseCarouselTrack");
  if (!track) return;
  const cards = [...track.querySelectorAll(".px-carousel-card")];
  if (cards[state.poseIndex]) {
    const card = cards[state.poseIndex];
    track.scrollLeft =
      card.offsetLeft -
      track.offsetLeft -
      (track.clientWidth - card.clientWidth) / 2;
  }
  const update = () => {
    const center = track.getBoundingClientRect().left + track.clientWidth / 2;
    let index = 0,
      min = Infinity;
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const delta = Math.abs(r.left + r.width / 2 - center);
      if (delta < min) {
        min = delta;
        index = i;
      }
    });
    state.poseIndex = index;
    cards.forEach((card, i) =>
      card.classList.toggle("is-featured", index === i),
    );
    main
      .querySelectorAll(".px-carousel-dots button")
      .forEach((button, i) =>
        button.classList.toggle("is-active", i === index),
      );
  };
  track.addEventListener("scroll", update, { passive: true });
  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      moveCarousel(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  // Touch momentum/scroll-snap implements swipe, without blocking native scrolling.
}
function moveCarousel(steps = 1, index) {
  const track = $("#poseCarouselTrack");
  if (!track) return;
  const cards = [...track.querySelectorAll(".px-carousel-card")];
  const next = Math.min(
    cards.length - 1,
    Math.max(0, index ?? state.poseIndex + steps),
  );
  state.poseIndex = next;
  if (cards[next])
    track.scrollTo({
      left:
        cards[next].offsetLeft -
        track.offsetLeft -
        (track.clientWidth - cards[next].clientWidth) / 2,
      behavior: "smooth",
    });
  cards.forEach((card, i) => card.classList.toggle("is-featured", i === next));
  main
    .querySelectorAll(".px-carousel-dots button")
    .forEach((button, i) => button.classList.toggle("is-active", i === next));
}
function navigate(page) {
  if (!canEnter(page)) {
    toast("Hãy chọn một tư thế trước khi mở camera.");
    return;
  }
  if (state.page === "capture" && page !== "capture") {
    cancelUXCountdown();
    stopCamera();
  }
  state.page = page;
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
  state.photoTitle = "";
  state.suggestions = [];
  state.recommendationsReady = false;
  state.retakeNotes = [];
  state.retakeTitle = "";
  state.albums = [];
  state.wizardStep = 1;
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
  state.poseIndex = 0;
  state.recommendationsReady = false;
  state.suggestions = [];
  state.poseId = null;
  state.capturedPhoto = null;
  state.photoTitle = "";
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
      state.photoTitle = "";
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
    const missing = state.backgroundPhoto ? "group" : "background";
    toast(
      missing === "background"
        ? "Vui lòng thêm ảnh phông nền trước."
        : "Vui lòng thêm ảnh toàn thân của nhóm trước.",
    );
    document
      .querySelector(`[data-kind="${missing}"]`)
      ?.closest(".settings-card")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
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

// 5) Offline-first preview: always show a detailed pose example, AI is optional.
function showLocalPoseExample(id) {
  const detail = PoseDetailModal(id);
  if (detail) showModal(detail, "v9-pose-modal");
}
// AI preview: optional enhancement, not a prerequisite to choosing a pose.
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
      `<h2>Xem trước với ảnh của bạn</h2><img class="ai-preview-image" src="${safe(photo)}" alt="Ảnh xem trước cho tư thế ${safe(pose.title)}"><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Đóng</button><button class="btn btn-primary" data-action="select-pose" data-id="${safe(id)}">Chọn pose & chụp</button></div>`,
      "pose-detail-modal",
    );
  } catch (error) {
    if (state.pendingPreview !== ctrl) return;
    if (error.name === "AbortError") {
      closeModal();
      return;
    }
    // Giữ log kỹ thuật cho người phát triển; không đưa thông báo backend ra UI.
    console.warn("Pose preview is unavailable:", error);
    showModal(
      `<h2>Chưa thể xem trước ảnh</h2><p>Chức năng xem trước tạm thời chưa khả dụng. Bạn vẫn có thể chọn tư thế và tiếp tục chụp.</p><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Đóng</button><button class="btn btn-outline" data-action="retry-preview" data-id="${safe(id)}">Thử lại</button><button class="btn btn-primary" data-action="select-pose" data-id="${safe(id)}">Chọn pose & chụp</button></div>`,
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
  state.photoTitle = "";
  state.camera.showPoseOverlay = true;
  state.retakeNotes = [];
  state.retakeTitle = "";
  navigate("capture");
}

// 6) Final camera: flip front/back, hardware zoom, photo shutter.
async function cameraStart(facing) {
  state.camera.requesting = true;
  render();
  try {
    await openCamera(facing);
  } catch (error) {
    toast(
      error.name === "NotAllowedError"
        ? "Camera bị từ chối quyền. Hãy cho phép trong cài đặt trình duyệt."
        : error.message || "Không thể mở camera.",
    );
  } finally {
    state.camera.requesting = false;
    if (state.page === "capture") render();
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
/** Hide secondary chrome before shutter. Canvas capture reads original video only. */
async function shutter() {
  if (!state.camera.stream || state.camera.capturing) return;
  cancelUXCountdown();
  state.camera.capturing = true;
  const screen = $("#pxCameraScreen");
  screen?.classList.add("is-taking-photo");
  try {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    state.resultTab = "mine";
    state.capturedPhoto = captureCamera().dataUrl;
    state.photoTitle = "";
    state.retakeNotes = [];
    state.retakeTitle = "";
    stopCamera();
    toast("Đã chụp ảnh! Hãy kiểm tra kết quả.");
  } catch (error) {
    toast(error.message || "Không chụp được ảnh.");
  } finally {
    state.camera.capturing = false;
    render();
  }
}
function countdownShutter() {
  if (
    uxCountdownTimer !== null ||
    !state.camera.stream ||
    state.camera.capturing
  )
    return;
  let remaining = state.camera.timer;
  if (!remaining) {
    shutter();
    return;
  }
  const screen = $("#pxCameraScreen");
  screen?.classList.add("is-counting");
  const show = () => {
    if (state.page !== "capture" || !state.camera.stream) {
      cancelUXCountdown();
      return;
    }
    const node = $("#uxShutterCountdown");
    if (!node) {
      cancelUXCountdown();
      return;
    }
    if (remaining === 0) {
      cancelUXCountdown();
      node.hidden = true;
      screen?.classList.remove("is-counting");
      shutter();
      return;
    }
    node.hidden = false;
    node.textContent = String(remaining--);
    uxCountdownTimer = setTimeout(show, 1000);
  };
  show();
}
// 6b) When Retake is requested, navigate straight to camera and pin pose advice beside it.
function retakeWithNotes() {
  const feedback = retakeCoaching(); // Uses the pose selected for the photo just captured.
  state.retakeTitle = feedback.title;
  state.retakeNotes = [...feedback.tips];
  state.capturedPhoto = null;
  navigate("capture");
  cameraStart(); // Retake is an explicit camera action; reopen it immediately.
  toast("Xem gợi ý điều chỉnh ngay trên màn hình camera.");
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
  // Validate before writing; keep the user-entered name if the write fails.
  const raw = document.querySelector("#photoTitle")?.value ?? state.photoTitle;
  const error = validatePhotoTitle(raw);
  if (error) {
    const output = $("#photoTitleError"),
      field = $("#photoTitle");
    if (output) {
      output.textContent = error;
      output.hidden = false;
    }
    field?.setAttribute("aria-invalid", "true");
    field?.focus();
    return;
  }
  const title = normalizePhotoTitle(raw);
  state.photoTitle = title;
  state.busy = true;
  render();
  const pose = currentPose(),
    album = {
      id: crypto.randomUUID?.() || String(Date.now()),
      createdAt: Date.now(),
      title,
      people: state.people,
      style: state.style,
      poseId: pose.id,
      poseTitle: pose.title,
      photos: [state.capturedPhoto],
    };
  try {
    await storeAlbum(album);
    state.capturedPhoto = null;
    state.photoTitle = "";
    toast(`Đã lưu “${title}” vào thư viện.`);
    navigate("library");
  } catch (error) {
    console.error(error);
    toast("Không thể lưu ảnh, hãy kiểm tra bộ nhớ thiết bị.");
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
    `<h2>${safe(a.title || a.poseTitle || "Ảnh chưa đặt tên")}</h2><p>${dateDisplay(a.createdAt)} · ${a.people} người · ${safe(a.style)}</p>${photoGrid(a.photos, "modal-image-grid")}<div class="modal-actionbar"><button class="btn btn-outline" data-action="download-album" data-id="${safe(a.id)}">Tải ảnh</button><button class="btn btn-primary" data-action="modal-close">Đóng</button></div>`,
  );
}
function downloadAlbum(id) {
  const a = albumById(id);
  if (!a) return;
  const link = document.createElement("a");
  link.href = a.photos[0];
  link.download = filenameFromTitle(a.title || a.poseTitle, id, a.photos[0]);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
function confirmDelete(id) {
  const a = albumById(id);
  if (!a) return;
  showModal(
    `<h2>Xóa bộ ảnh?</h2><p>“${safe(a.title || a.poseTitle || "Ảnh này")}” sẽ bị xóa khỏi thiết bị này. Không thể hoàn tác.</p><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Hủy</button><button class="btn btn-danger" data-action="confirm-delete" data-id="${safe(id)}">Xóa ảnh</button></div>`,
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
    case "wizard-next":
      state.wizardStep = Math.min(3, state.wizardStep + 1);
      render();
      break;
    case "wizard-back":
      state.wizardStep = Math.max(1, state.wizardStep - 1);
      render();
      break;
    case "start-wizard":
      state.wizardStep = 1;
      navigate("home");
      break;
    case "carousel-prev":
      moveCarousel(-1);
      break;
    case "carousel-next":
      moveCarousel(1);
      break;
    case "carousel-to":
      moveCarousel(0, Number(button.dataset.index));
      break;
    case "open-pose-detail":
      showLocalPoseExample(button.dataset.id);
      break;
    case "back-poses":
      navigate("poses");
      break;
    case "set-timer":
      state.camera.timer = Number(button.dataset.timer);
      render();
      break;
    case "toggle-grid":
      state.camera.grid = !state.camera.grid;
      render();
      break;
    case "retake-camera":
      state.capturedPhoto = null;
      state.photoTitle = "";
      render();
      await cameraStart();
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
    case "open-pose-example":
      showLocalPoseExample(button.dataset.id);
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
      countdownShutter();
      break;
    case "countdown-photo":
      countdownShutter();
      break;
    case "stop-camera":
      stopCamera();
      render();
      break;
    case "toggle-pose-overlay":
      state.camera.showPoseOverlay = !state.camera.showPoseOverlay;
      render();
      break;
    case "set-result-tab":
      state.resultTab = button.dataset.tab === "sample" ? "sample" : "mine";
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
main.addEventListener("change", (event) => {
  if (state.page !== "library") return;
  if (event.target.id === "libraryStyleFilter") {
    state.libraryFilter = event.target.value;
    render();
  }
  if (event.target.id === "librarySort") {
    state.librarySort = event.target.value;
    render();
  }
});
main.addEventListener("input", async (event) => {
  if (event.target.id === "photoTitle") {
    state.photoTitle = event.target.value;
    event.target.removeAttribute("aria-invalid");
    const error = $("#photoTitleError");
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
    return;
  }
  if (event.target.id === "librarySearch") {
    state.librarySearch = event.target.value;
    const term = state.librarySearch.toLocaleLowerCase("vi");
    let visible = 0;
    document
      .querySelectorAll(".album-card[data-album-search]")
      .forEach((card) => {
        const shown = card.getAttribute("data-album-search").includes(term);
        card.hidden = !shown;
        if (shown) visible++;
      });
    const count = document.querySelector("#libraryResultCount");
    if (count)
      count.textContent = `${visible} / ${document.querySelectorAll(".album-card[data-album-search]").length} bộ ảnh`;
    const noMatches = document.querySelector("#uxInlineNoMatches");
    if (noMatches) noMatches.hidden = visible > 0;
    return;
  }
  if (event.target.id === "poseOpacity") {
    const alpha = Math.min(1, Math.max(0.45, Number(event.target.value)));
    state.camera.overlayOpacity = alpha;
    const guide = $(".px-pose-note");
    if (guide) guide.style.opacity = String(alpha);
    const value = $("#poseOpacityValue");
    if (value) value.textContent = Math.round(alpha * 100) + "%";
    return;
  }
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
    case "preview-pose":
      await showPosePreview(button.dataset.id);
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
    '<h2>Đặt lại mật khẩu</h2><p>Chức năng đặt lại mật khẩu hiện chưa khả dụng. Vui lòng thử lại sau.</p><div class="modal-actionbar"><button class="btn btn-primary" data-action="modal-close">Đóng</button></div>',
  ),
);
// Appearance editor: visual dropdowns with gradient swatches and live font previews.
// The underlying CSS variable engine stays centralized in services/appearance.js.
$("#appearanceBtn").addEventListener("click", () => {
  showModal(
    `<h2>Chọn màu cho studio</h2>
 <p class="muted">Mọi màn hình dùng cùng hai font chữ để nội dung dễ đọc. Bạn có thể đổi bảng màu ở đây.</p>
 <div id="appearancePanel">${renderAppearancePicker()}</div>
 <div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close">Đóng</button></div>`,
    "appearance-modal",
  );
});
$("#modalRoot").addEventListener("click", (event) => {
  const choice = event.target.closest("[data-palette-choice]");
  if (!choice) return;
  if (choice.dataset.paletteChoice)
    setAppearance({ palette: choice.dataset.paletteChoice });
  const panel = $("#appearancePanel");
  if (panel) panel.innerHTML = renderAppearancePicker();
});
$("#logoutBtn").addEventListener("click", logout);
$("#brandLink").addEventListener("click", (event) => {
  event.preventDefault();
  navigate("home");
});
bottomNav.addEventListener("click", (event) => {
  const node = event.target.closest("[data-page]");
  if (node) navigate(node.dataset.page);
});
input.addEventListener("change", async () => {
  const file = input.files?.[0];
  input.value = "";
  await processFile(file);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("#modalRoot").children.length) modalClose();
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

// Attach icons to static account actions; new components render Tabler icons directly.
decorateIcons(document);
