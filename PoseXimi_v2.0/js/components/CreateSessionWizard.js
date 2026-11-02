/** 3-stage guided session creation. Inputs and selected config remain in state.js. */
import { state, inputsReady } from "../state.js";
import { guidePhoto } from "../data/quick-guide.js";
import { safe } from "../ui.js";
import { iconMarkup } from "../icons.js";
import { BaseCard, PrimaryButton, TextButton } from "./primitives.js";
import {
  DEMO_SCENARIOS,
  evaluateDemoPhoto,
} from "../services/input-photo-demo.js";

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
 <span class="px-style-caption"><strong>${name}</strong><small>${caption}</small>${state.style === name ? iconMarkup("checkbox") : ""}</span></button>`,
   )
   .join("")}</div>
 <div class="px-stage-footer">${TextButton({ label: "Quay lại", action: "wizard-back" })}${PrimaryButton({ label: "Chuẩn bị ảnh", action: "wizard-next" })}</div>`,
  });
}
/** Demo verdict is read from the selected script, never from pixel recognition. */
function uploadTile(kind, label, hint, img) {
  const result = evaluateDemoPhoto(
    kind,
    state.inputDemoScenario,
    Boolean(img),
    state.people,
    state.inputFileValidated[kind],
  );
  const display = result.status !== "empty";
  const icon =
    ["valid", "technical"].includes(result.status) ? "checkbox"
    : ["invalid", "unchecked"].includes(result.status) ? "camera-off"
    : "cloud-upload";
  return `<section class="px-upload-tile px-demo-tile px-demo-${result.status}" aria-label="${safe(label)}">
    <div class="px-upload-art px-demo-photo-art">
      ${img ? `<img src="${img}" alt="Ảnh vừa tải lên: ${safe(label)}"/>` : `${iconMarkup("cloud-upload")}<span>JPG · PNG · WebP · ảnh thiết bị hỗ trợ</span>`}
      ${display ? `<span class="px-demo-image-tag px-demo-image-tag-${result.status}">${iconMarkup(icon)} ${safe(result.title)}</span>` : ""}
    </div>
    <div class="px-upload-content"><div><strong>${safe(label)}</strong><p>${img ? "Đã tải ảnh · Có thể thay ảnh" : safe(hint)}</p></div></div>
    <div class="px-upload-buttons">
      <button type="button" data-action="upload-input" data-kind="${kind}">${iconMarkup("cloud-upload")}${img ? "Thay ảnh" : "Tải ảnh"}</button>
      <button type="button" data-action="camera-input" data-kind="${kind}">${iconMarkup("camera")}Chụp ảnh</button>
    </div>
    <div class="px-demo-result px-demo-result-${result.status}" role="status" aria-live="polite">
      <div class="px-demo-result-heading">${iconMarkup(icon)}<strong>${safe(result.title)}</strong>${display ? `<span class="px-demo-label">${state.inputDemoScenario === "technical" ? "TỆP" : "DEMO"}</span>` : ""}</div>
      <p>${safe(result.detail)}</p>
      ${result.instruction ? `<p class="px-demo-fix">${safe(result.instruction)}</p>` : ""}
    </div>
  </section>`;
}

function scenarioSelector() {
  return `<section class="px-demo-panel" aria-label="Điều khiển kịch bản mô phỏng">
    <div class="px-demo-panel-heading"><div><span class="px-demo-kicker">KIỂM TRA ẢNH · CÓ CHẾ ĐỘ DEMO</span><h3>Chọn tình huống kiểm tra ảnh</h3><p>Chế độ thường chỉ kiểm tra thuộc tính tệp. Bốn kịch bản demo có thể cho mọi ảnh được tải lên hiện hợp lệ hoặc không hợp lệ để chụp báo cáo; đây không phải AI.</p></div>${iconMarkup("sparkles")}</div>
    <div class="px-demo-scenario-options" role="group" aria-label="Kết quả upload giả lập">
      ${DEMO_SCENARIOS.map((scenario) => `<button type="button" class="px-demo-scenario ${state.inputDemoScenario === scenario.id ? "is-selected" : ""}" data-action="set-upload-demo" data-scenario="${scenario.id}" aria-pressed="${state.inputDemoScenario === scenario.id}">${safe(scenario.label)}</button>`).join("")}
    </div>
  </section>`;
}

function uploadStep() {
  const ready = inputsReady();
  const bgResult = evaluateDemoPhoto(
    "background",
    state.inputDemoScenario,
    !!state.backgroundPhoto,
    state.people,
    state.inputFileValidated.background,
  );
  const groupResult = evaluateDemoPhoto(
    "group",
    state.inputDemoScenario,
    !!state.groupPhoto,
    state.people,
    state.inputFileValidated.group,
  );
  const invalid = [bgResult, groupResult].filter((result) =>
    ["invalid", "unchecked"].includes(result.status),
  );
  const missing = [bgResult, groupResult].filter(
    (result) => result.status === "empty",
  );
  const message =
    ready ?
      state.inputDemoScenario === "technical" ?
        "Hai tệp đã qua kiểm tra kỹ thuật; chưa xác thực nội dung ảnh."
      : "Cả hai ảnh đang ở trạng thái hợp lệ (mô phỏng)."
    : missing.length ? `Cần tải đủ 2 ảnh. Hiện còn thiếu ${missing.length} ảnh.`
    : state.inputDemoScenario === "technical" ?
      "Cần tải lại ảnh đã chọn trong chế độ demo để kiểm tra kỹ thuật."
    : `Có ${invalid.length} ảnh không hợp lệ (mô phỏng). Đổi kịch bản để trình bày tình huống khác.`;
  return BaseCard({
    eyebrow: "03 / ẢNH ĐẦU VÀO",
    title: "Kiểm tra ảnh trước khi chọn pose",
    body: `
      <p class="px-stage-hint">Background cần không có người; ảnh nhóm cần đầy đủ toàn thân và đúng số người.</p>
      ${scenarioSelector()}
      <div class="px-upload-grid">${uploadTile("background", "Ảnh background", "Ảnh phông nền, không có người", state.backgroundPhoto)}
        ${uploadTile("group", "Ảnh của nhóm", `Ảnh toàn thân đủ ${state.people} người`, state.groupPhoto)}</div>
      <div class="px-demo-summary ${ready ? "is-valid" : ""}" role="status" aria-live="polite">${iconMarkup(ready ? "checkbox" : "sparkles")}<span>${safe(message)}</span></div>
      <div class="px-upload-note">${iconMarkup("sparkles")}<span>${state.inputDemoScenario === "technical" ? "Chế độ thường: JPG/PNG/WebP/AVIF, tối đa 10 MB, cạnh ngắn tối thiểu 480px. Nội dung ảnh chưa được AI xác thực." : "CHỈ DEMO: Kết quả xanh/đỏ được chọn trước, không phản ánh nội dung ảnh. Ảnh tải lên được thu nhỏ để hiển thị."}</span></div>
      <div class="px-stage-footer">${TextButton({ label: "Quay lại", action: "wizard-back" })}${PrimaryButton({ label: "Gợi ý tư thế", action: "request-suggestions", icon: "sparkles", disabled: !ready })}</div>
    `,
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
