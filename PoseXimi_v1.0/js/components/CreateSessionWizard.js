/** 3-stage guided session creation. Inputs and selected config remain in state.js. */
import { state, inputsReady } from "../state.js";
import { guidePhoto } from "../data/quick-guide.js";
import { safe } from "../ui.js";
import { iconMarkup } from "../icons.js";
import { BaseCard, PrimaryButton, TextButton } from "./primitives.js";

function stageProgress() {
  const labels = ["Số người", "Phong cách", "Ảnh đầu vào"];
  return `<div class="px-wizard-progress" role="group" aria-label="Tiến trình tạo buổi chụp">${labels.map((name, i) => `<div class="px-wizard-step ${i + 1 < state.wizardStep ? "is-done" : ""} ${i + 1 === state.wizardStep ? "is-current" : ""}" ${i + 1 === state.wizardStep ? 'aria-current="step"' : ""}><span>${i + 1 < state.wizardStep ? iconMarkup("checkbox") : i + 1}</span><small>${name}</small></div>`).join("")}</div>`;
}
function peopleStep() {
  return BaseCard({
    eyebrow: "01 / SỐ NGƯỜI",
    title: "Ai sẽ xuất hiện trong khung hình?",
    body: `
 <p class="px-stage-hint">Chọn số lượng người tham gia để gợi ý tư thế chính xác hơn.</p>
 <div class="px-people-choices" role="group" aria-label="Số người tham gia">${[1, 2, 3, 4].map((n) => `<button data-action="set-count" data-count="${n}" aria-pressed="${state.people === n}" type="button" class="px-people-choice ${state.people === n ? "is-selected" : ""}">${iconMarkup("users")}<strong>${n}</strong><span>người</span></button>`).join("")}</div>
 <div class="px-stage-footer">${PrimaryButton({ label: "Chọn phong cách", action: "wizard-next" })}</div>`,
  });
}
function styleStep() {
  const styles = [
    ["Casual", "Tự nhiên"],
    ["Fashion", "Thời trang"],
    ["JoJo", "Cá tính"],
  ];
  return BaseCard({
    eyebrow: "02 / PHONG CÁCH",
    title: "Bạn muốn bộ ảnh mang cảm giác nào?",
    body: `
 <p class="px-stage-hint">Chạm vào hình minh họa phù hợp với cá tính của nhóm.</p>
 <div class="px-visual-style-grid">${styles
   .map(
     ([
       name,
       caption,
     ]) => `<button type="button" class="px-visual-style ${state.style === name ? "is-selected" : ""}" data-action="set-style" data-style="${name}" aria-pressed="${state.style === name}" aria-label="Chọn phong cách ${name}">
 <img src="assets/guide/${name.toLowerCase()}-${state.people}.webp" alt="Ví dụ tạo dáng ${name} cho ${state.people} người" loading="lazy"/>
 <span class="px-v6-style-icon" aria-hidden="true"><img src="assets/style-${name.toLowerCase()}.png" alt="" loading="lazy"></span>
 <span class="px-style-caption"><strong>${name}</strong><small>${caption}</small>${state.style === name ? iconMarkup("checkbox") : ""}</span></button>`,
   )
   .join("")}</div>
 <div class="px-stage-footer">${TextButton({ label: "Quay lại", action: "wizard-back" })}${PrimaryButton({ label: "Chuẩn bị ảnh", action: "wizard-next" })}</div>`,
  });
}
function uploadTile(kind, label, hint, img) {
  return `<div class="px-upload-tile ${img ? "is-ready" : ""}">
 <div class="px-upload-art">${img ? `<img src="${img}" alt="${safe(label)} đã chọn"/>` : `${iconMarkup("cloud-upload")}<span>JPG · PNG · WebP</span>`}</div>
 <div class="px-upload-content"><div><strong>${safe(label)}</strong><p>${img ? "Đã thêm ảnh · Có thể thay ảnh" : safe(hint)}</p></div>${img ? `<span class="px-upload-ready">${iconMarkup("checkbox")} Sẵn sàng</span>` : ""}</div>
 <div class="px-upload-buttons"><button type="button" data-action="upload-input" data-kind="${kind}">${iconMarkup("cloud-upload")}${img ? "Thay ảnh" : "Tải ảnh"}</button><button type="button" data-action="camera-input" data-kind="${kind}">${iconMarkup("camera")}Chụp ảnh</button></div>
 </div>`;
}
function uploadStep() {
  const guide = guidePhoto(state.style, state.people);
  return BaseCard({
    eyebrow: "03 / ẢNH ĐẦU VÀO",
    title: "Chuẩn bị cho một bức ảnh đẹp",
    body: `
 <p class="px-stage-hint">Chỉ cần hai ảnh: một phông nền và một ảnh nhìn thấy rõ mọi người.</p>
 <div class="px-upload-grid">${uploadTile("background", "Ảnh background", "Không gian bạn muốn chụp", state.backgroundPhoto)}
 ${uploadTile("group", "Ảnh của nhóm", `Cần nhìn rõ toàn thân ${state.people} người`, state.groupPhoto)}</div>
 <div class="px-upload-note">${iconMarkup("sparkles")}<span>Ảnh tối đa 10 MB, cạnh ngắn từ 480px. Ảnh lớn được thu nhỏ tự động.</span></div>
 <div class="px-stage-footer">${TextButton({ label: "Quay lại", action: "wizard-back" })}${PrimaryButton({ label: "Gợi ý tư thế", action: "request-suggestions", icon: "sparkles", disabled: !inputsReady() })}</div>
 ${
   !inputsReady() ?
     `<p class="px-required-hint" role="status">${
       !state.backgroundPhoto && !state.groupPhoto ?
         "Vui lòng thêm hai ảnh để tiếp tục."
       : !state.backgroundPhoto ? "Còn thiếu ảnh background."
       : "Còn thiếu ảnh toàn thân của nhóm."
     }</p>`
   : ""
 }`,
  });
}
export function CreateSessionWizard() {
  const stage =
    [peopleStep, styleStep, uploadStep][state.wizardStep - 1] || peopleStep;
  return `<div class="px-home-page">
  ${state.wizardStep === 1 ? `<div class="px-home-hero"><div><p class="px-kicker">Chụp ngay không bay 5tr</p><h1>Pose bá đạo điểm nhấn tự tạo<br><em>Pose duyên dáng đáng bỏ công</em></h1></div></div>` : ""}
  <div class="px-wizard-shell"><div class="px-wizard-top"><div><span class="px-eyebrow">TẠO BUỔI CHỤP MỚI</span><h2>Mình bắt đầu nhé?</h2></div><span class="px-step-count">Bước ${state.wizardStep} / 3</span></div>
  ${stageProgress()}${stage()}</div>
 </div>`;
}
