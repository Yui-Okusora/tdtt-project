/* Install, update and connectivity UI; no framework or build step needed. */
(() => {
  "use strict";
  const installBtn = document.getElementById("installAppBtn");
  const netStatus = document.getElementById("networkStatus");
  const updateBar = document.getElementById("pwaUpdateBanner");
  const updateBtn = document.getElementById("pwaUpdateBtn");
  const dismissBtn = document.getElementById("pwaDismissBtn");
  const iOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
  const standalone = () =>
    matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true;
  let installPrompt = null;
  let waitingWorker = null;
  let reloadForUpdate = false;

  const showOnlineState = () => {
    netStatus.hidden = navigator.onLine;
    if (!navigator.onLine) netStatus.textContent = "Offline";
  };
  window.addEventListener("online", showOnlineState);
  window.addEventListener("offline", showOnlineState);
  showOnlineState();

  const updateInstallButton = () => {
    installBtn.hidden = standalone() || !(installPrompt || iOS);
  };
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    updateInstallButton();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installBtn.hidden = true;
  });
  installBtn.addEventListener("click", async () => {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      installBtn.hidden = true;
      await prompt.prompt();
      await prompt.userChoice;
      updateInstallButton();
    } else if (iOS) {
      const message =
        "<h2>Cài PoseXimi lên màn hình chính</h2>" +
        '<p class="muted">Trên iPhone, mở trang bằng Safari, nhấn nút Chia sẻ (Share) hoặc menu trình duyệt và chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.</p>' +
        '<p class="muted">Để cài thật trên iPhone, hãy mở website qua HTTPS; địa chỉ HTTP dạng IP LAN không đủ điều kiện cho camera và service worker.</p>' +
        '<div class="modal-actionbar"><button class="btn btn-primary" data-action="modal-close" type="button">Đã hiểu</button></div>';
      if (typeof window.PoseXimiShowModal === "function")
        window.PoseXimiShowModal(message);
      else alert("Trong Safari: Chia sẻ → Thêm vào Màn hình chính.");
    }
  });
  window.addEventListener("pageshow", updateInstallButton);
  updateInstallButton();

  if (!("serviceWorker" in navigator)) return;
  // HTTP LAN IP cannot register a worker; localhost and HTTPS can.
  if (!window.isSecureContext) return;
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
      });
      const offerUpdate = (worker) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        waitingWorker = worker;
        updateBar.hidden = false;
      };
      offerUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed")
            offerUpdate(registration.waiting || newWorker);
        });
      });
      // Check updates when returning to the app.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && navigator.onLine)
          registration.update().catch(() => {});
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloadForUpdate) window.location.reload();
      });
      updateBtn.addEventListener("click", () => {
        if (!waitingWorker) return;
        reloadForUpdate = true;
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      });
      dismissBtn.addEventListener("click", () => {
        updateBar.hidden = true;
      });
    } catch (error) {
      console.warn("Không đăng ký được PWA service worker:", error);
    }
  });
})();
