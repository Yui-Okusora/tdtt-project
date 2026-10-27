/** Camera streams, flipping lenses and hardware-supported zoom. */
import { state } from "../state.js";
import { imageToJpeg } from "./images.js";

/** Stops ONLY the final-photo camera, not the separate home input-photo camera. */
export function stopCamera() {
  state.camera.stream?.getTracks().forEach((t) => t.stop());
  state.camera.stream = null;
  state.camera.zoom = 1;
  state.camera.zoomSupported = false;
}
function readZoom(stream) {
  const track = stream.getVideoTracks()[0];
  const caps = track?.getCapabilities?.() || {};
  if (
    caps.zoom
    && Number.isFinite(caps.zoom.min)
    && Number.isFinite(caps.zoom.max)
  ) {
    state.camera.zoomSupported = true;
    state.camera.minZoom = caps.zoom.min;
    state.camera.maxZoom = caps.zoom.max;
    state.camera.zoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1));
  } else {
    state.camera.zoomSupported = false;
    state.camera.minZoom = 1;
    state.camera.maxZoom = 1;
    state.camera.zoom = 1;
  }
}
/** @param {"user"|"environment"} facing - Select selfie or rear physical camera. */
export async function openCamera(facing = state.camera.facing) {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error("Camera chỉ khả dụng qua HTTPS hoặc localhost.");
  stopCamera();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });
  state.camera.stream = stream;
  state.camera.facing = facing;
  readZoom(stream);
  return stream;
}
export async function flipCamera() {
  return openCamera(state.camera.facing === "user" ? "environment" : "user");
}
/** @param {number} value - Hardware-supported zoom in [minZoom,maxZoom]. */
export async function setZoom(value) {
  const track = state.camera.stream?.getVideoTracks()[0];
  if (!track || !state.camera.zoomSupported) return false;
  const zoom = Math.min(
    state.camera.maxZoom,
    Math.max(state.camera.minZoom, Number(value)),
  );
  await track.applyConstraints({ advanced: [{ zoom }] });
  state.camera.zoom = zoom;
  return true;
}
export function captureCamera() {
  const video = document.querySelector("#liveVideo");
  if (!video?.videoWidth) throw new Error("Camera chưa sẵn sàng, hãy thử lại.");
  return imageToJpeg(video, {
    mirror: state.camera.facing === "user",
    filename: "Ảnh chụp",
  });
}
/** @param {"group"|"background"} kind - Type of home input photo. */
export async function openInputCamera(kind) {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error("Camera cần HTTPS hoặc localhost.");
  stopInputCamera();
  state.inputCameraKind = kind;
  state.inputCameraStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: kind === "background" ? "environment" : "user" },
    },
    audio: false,
  });
  return state.inputCameraStream;
}
export function attachInputCamera() {
  const video = document.querySelector("#inputLiveVideo");
  if (video && state.inputCameraStream) {
    video.srcObject = state.inputCameraStream;
    video.play().catch(() => {});
  }
}
export function stopInputCamera() {
  state.inputCameraStream?.getTracks().forEach((t) => t.stop());
  state.inputCameraStream = null;
  state.inputCameraKind = null;
}
export function captureInput() {
  const video = document.querySelector("#inputLiveVideo");
  if (!video?.videoWidth) throw new Error("Camera chưa sẵn sàng.");
  return imageToJpeg(video, {
    mirror: state.inputCameraKind === "group",
    filename: "Ảnh đầu vào",
  });
}
