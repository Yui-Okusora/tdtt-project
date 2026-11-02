import { state, currentPose } from "../state.js";
import { poseSVG } from "../art.js";
import { safe } from "../ui.js";
import { heading, photoGrid } from "./shared.js";
/** Result screen retains side-by-side photo vs template for final approval. */
export function renderResult() {
  const pose = currentPose();
  if (!pose || !state.capturedPhoto)
    return `${heading("RESULT", "Chưa có ảnh", "Quay lại camera để chụp.")}<button class="btn btn-soft" data-action="go-camera">Quay lại camera</button>`;
  return `${heading("RESULT & APPROVAL", "Kiểm tra kết quả ♡", "Đối chiếu ảnh nhóm với pose đã chọn trước khi lưu.")}
 <div class="ux-result-tabs" role="group" aria-label="Chọn ảnh để xem trên điện thoại">
 <button type="button" class="${state.resultTab === "mine" ? "active" : ""}" data-action="set-result-tab" data-tab="mine" aria-pressed="${state.resultTab === "mine"}">Ảnh của bạn</button>
 <button type="button" class="${state.resultTab === "sample" ? "active" : ""}" data-action="set-result-tab" data-tab="sample" aria-pressed="${state.resultTab === "sample"}">Pose mẫu</button>
 </div>
 <div class="result-grid ux-result-grid ux-result-${state.resultTab}"><section class="content-card result-preview"><div class="section-heading"><h2>Ảnh của bạn</h2><span class="pill-status">Đã sẵn sàng</span></div>${photoGrid([state.capturedPhoto], "result-photos")}<div class="comparison-caption"><strong>YOUR MOMENT</strong><small>${state.people} người</small></div></section>
 <section class="content-card result-reference"><div class="section-heading"><h2>Ảnh mẫu đã chọn</h2><span class="mini-badge">REFERENCE</span></div>${poseSVG(state.people, pose.variant, state.background, state.style)}<div class="comparison-caption"><strong>${safe(pose.title)}</strong><small>${safe(state.style)}</small></div></section></div>
 <section class="feedback-box"><strong>Gợi ý kiểm tra trước khi lưu</strong><ul><li>Toàn thân và khuôn mặt của tất cả mọi người đều rõ.</li><li>Tư thế gần với ảnh tham khảo.</li><li>Nếu chưa hài lòng, chọn chụp lại.</li></ul></section>
 <!-- Naming is required before approval; the album title is saved with the photo. -->
 <section class="px-photo-naming" aria-labelledby="photoNamingHeading">
   <div class="px-photo-naming-head"><div><span class="px-photo-naming-eyebrow">LƯU KHOẢNH KHẮC</span><h2 id="photoNamingHeading">Đặt tên cho bức ảnh</h2></div><span class="px-photo-naming-step">01 / 01</span></div>
   <label for="photoTitle">Tên ảnh <span aria-hidden="true">*</span></label>
   <input id="photoTitle" type="text" maxlength="60" value="${safe(state.photoTitle)}" placeholder="Ví dụ: Ngày vui cùng hội bạn" autocomplete="off" aria-describedby="photoTitleHelp photoTitleError" required />
   <p id="photoTitleHelp" class="px-photo-naming-help">Tên sẽ xuất hiện trong Thư viện và khi bạn tải ảnh về.</p>
   <p id="photoTitleError" class="px-photo-naming-error" role="alert" hidden></p>
 </section>
 <div class="approval-bar"><div><strong>Hài lòng với bức ảnh?</strong><p>Đặt tên và lưu ảnh vào thư viện trên thiết bị hiện tại.</p></div><div class="approval-actions"><button class="btn btn-outline" data-action="retake" type="button" ${state.busy ? "disabled" : ""}>Chụp lại</button><button class="btn btn-primary" data-action="approve" type="button" ${state.busy ? "disabled" : ""}>${state.busy ? "Đang lưu…" : "✓ Lưu ảnh vào thư viện"}</button></div></div>`;
}
