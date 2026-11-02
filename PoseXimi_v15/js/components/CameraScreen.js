/** Focused camera screen. Stream is attached by app.js after every render. */
import { state, currentPose } from "../state.js";
import { iconMarkup } from "../icons.js";
import { safe } from "../ui.js";
import { poseSVG } from "../art.js";
import { CAMERA_TIMERS } from "../design-system/tokens.js";

const cameraButton = (action, icon, label, extra = "") =>
  `<button type="button" class="px-camera-control" data-action="${action}" aria-label="${safe(label)}" title="${safe(label)}" ${extra}>${iconMarkup(icon)}<span>${safe(label)}</span></button>`;
export function CameraScreen() {
  const pose = currentPose();
  if (!pose)
    return `<div class="px-no-camera"><p>Vui lòng chọn tư thế trước khi mở camera.</p><button type="button" data-action="back-poses">Quay lại kho pose</button></div>`;
  const live = Boolean(state.camera.stream),
    photo = state.capturedPhoto;
  const camera = state.camera;
  return `<section class="px-camera-screen ${camera.capturing ? "is-taking-photo" : ""}" id="pxCameraScreen" aria-label="Studio camera">
 <div class="px-camera-viewport ${camera.facing === "user" ? "is-selfie" : ""}" id="captureDropzone">
   ${photo ? `<img class="px-camera-photo" src="${photo}" alt="Ảnh vừa chụp"/>` : live ? `<video id="liveVideo" autoplay muted playsinline aria-label="Hình ảnh trực tiếp từ camera"></video>` : `<div class="px-camera-empty">${iconMarkup("camera")}<strong>${camera.requesting ? "Đang khởi động camera…" : "Sẵn sàng ghi lại khoảnh khắc"}</strong><p>${camera.requesting ? "Hãy cấp quyền truy cập nếu trình duyệt yêu cầu." : "Đặt điện thoại ổn định, mở camera để bắt đầu."}</p></div>`}
   ${camera.grid && !photo ? `<div class="px-grid-overlay" aria-hidden="true"></div>` : ""}
   <!-- Compact pose reference (inspired by v6): no skeleton is drawn over the people. -->
   ${
     camera.showPoseOverlay && !photo
       ? `<aside class="px-pose-note" style="opacity:${camera.overlayOpacity}" aria-label="Ảnh mẫu tư thế đang chọn">
     <div class="px-pose-note-head"><span>POSE MẪU</span><button type="button" class="px-pose-note-close" data-action="toggle-pose-overlay" aria-label="Ẩn ảnh mẫu" title="Ẩn ảnh mẫu">×</button></div>
     <div class="px-pose-note-image">${poseSVG(state.people, pose.variant, state.background, state.style)}</div>
     <span class="px-pose-note-caption">${safe(pose.title)}</span>
   </aside>`
       : ""
   }
   <div class="px-shutter-countdown" id="uxShutterCountdown" hidden aria-live="assertive">3</div>
   <div class="px-camera-chrome">
     <header class="px-camera-top"><button type="button" class="px-camera-back" data-action="back-poses" aria-label="Quay về kho pose">${iconMarkup("arrow-badge-left")}</button>
       <span class="px-camera-stage-label">${safe(state.style)} · ${state.people} người</span>
       ${cameraButton("stop-camera", "camera-off", "Tắt camera", live ? "" : "disabled")}
     </header>
     ${
       live && !photo
         ? `<div class="px-camera-tools">
        <div class="px-timer-wrap"><span>Hẹn giờ</span>${CAMERA_TIMERS.map((t) => `<button type="button" class="px-timer-pill ${camera.timer === t ? "is-active" : ""}" data-action="set-timer" data-timer="${t}" aria-pressed="${camera.timer === t}">${t ? t + "s" : "Tắt"}</button>`).join("")}</div>
        <button type="button" class="px-tool-pill ${camera.grid ? "is-active" : ""}" data-action="toggle-grid" aria-pressed="${camera.grid}">Lưới ${camera.grid ? "Bật" : "Tắt"}</button>
        <button type="button" class="px-tool-pill ${camera.showPoseOverlay ? "is-active" : ""}" data-action="toggle-pose-overlay" aria-pressed="${camera.showPoseOverlay}">${camera.showPoseOverlay ? "Ẩn pose" : "Hiện pose"}</button>
      </div>`
         : ""
     }
     <div class="px-camera-spacer"></div>
     ${state.retakeNotes.length && !photo ? `<aside class="px-camera-tip"><div><strong>${safe(state.retakeTitle || "Gợi ý chụp lại")}</strong><button type="button" data-action="dismiss-retake-notes" aria-label="Đóng gợi ý">×</button></div><p>${state.retakeNotes.slice(0, 2).map(safe).join(" · ")}</p></aside>` : ""}
     ${camera.showPoseOverlay && !photo ? `<div class="px-opacity-control"><label for="poseOpacity">Độ mờ ảnh mẫu</label><input id="poseOpacity" type="range" min="0.45" max="1" step="0.05" value="${camera.overlayOpacity}" aria-label="Điều chỉnh độ mờ ảnh mẫu"/><span id="poseOpacityValue">${Math.round(camera.overlayOpacity * 100)}%</span></div>` : ""}
     ${live && camera.zoomSupported && !photo ? `<div class="px-zoom-control"><label for="zoomCamera">Zoom</label><input id="zoomCamera" type="range" min="${camera.minZoom}" max="${camera.maxZoom}" step="0.1" value="${camera.zoom}"/><span id="zoomAmount">${camera.zoom.toFixed(1)}×</span></div>` : ""}
     <footer class="px-camera-bottom">
      ${
        photo
          ? `<button type="button" class="px-camera-secondary" data-action="retake-camera">Chụp lại</button><button type="button" class="px-camera-approve" data-action="go-results">Xem kết quả ${iconMarkup("arrow-badge-right")}</button>`
          : `
       ${live ? `<button type="button" class="px-shutter px-shutter-tabler" data-action="capture-photo" aria-label="Chụp ảnh" title="Chụp ảnh">${iconMarkup("camera")}</span></button>` : `<button type="button" class="px-camera-start" data-action="open-camera" ${camera.requesting ? "disabled" : ""}>${iconMarkup("camera")}${camera.requesting ? "Đang mở…" : "Mở camera"}</button>`}
       <button type="button" class="px-camera-aux" data-action="flip-camera" aria-label="Đổi camera trước/sau" ${live ? "" : "disabled"}>${iconMarkup("camera")}</button>`
      }
     </footer>
   </div>
 </div>
 </section>`;
}
