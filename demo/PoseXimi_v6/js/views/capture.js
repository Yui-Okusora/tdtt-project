/** Camera chính lớn, kèm thẻ pose mẫu nhỏ nổi ngay trong viewport (không có cột template). */
import {state,currentPose} from '../state.js';import {safe} from '../ui.js';import {poseSVG} from '../art.js';import {heading} from './shared.js';
export function renderCapture(){
 const pose=currentPose();if(!pose)return `${heading('CAMERA','Hãy chọn pose trước.','Bước này chỉ mở sau khi đã chọn tư thế.')}`;
 const photo=state.capturedPhoto,live=!!state.camera.stream;
 return `${heading('CAMERA & UPLOAD','Studio chụp ảnh',`Đang thực hiện: ${pose.title} · ${state.people} người. Đối chiếu ô pose mẫu nổi trong camera để tạo dáng.`)}
 <div class="camera-workspace content-card"><div class="section-heading"><h2>Máy ảnh của bạn</h2><span class="tag-chip">${photo?'✓ Ảnh đã sẵn sàng':live?'● Camera trực tiếp':'Chưa mở camera'}</span></div>
 <!-- RETAKE NOTES: appear beside the camera ONLY after Retake is pressed on the Result page. -->
 ${state.retakeNotes.length?`<aside class="retake-coaching" role="status" aria-live="polite">
 <div class="retake-coaching-head"><div><span class="retake-coaching-kicker">✦ HƯỚNG DẪN CHỤP LẠI</span><h3>${safe(state.retakeTitle)}</h3></div>
 <button class="retake-dismiss" type="button" data-action="dismiss-retake-notes" aria-label="Ẩn hướng dẫn chụp lại">×</button></div>
 <ul>${state.retakeNotes.map(tip=>`<li>${safe(tip)}</li>`).join('')}</ul>
 <p>Đây là gợi ý theo mẫu pose, chưa phải phân tích ảnh bằng AI.</p>
 </aside>`:''}
 <div id="captureDropzone" class="capture-stage camera-large ${photo&&!live?'has-photo':''}">
 <span class="camera-watermark">P · POSEXIMI</span>
 ${live?`<video id="liveVideo" class="${state.camera.facing==='user'?'front-camera':''}" autoplay muted playsinline aria-label="Camera đang hoạt động"></video>`:photo?`<img class="existing-photo" src="${photo}" alt="Ảnh nhóm sau khi chụp" />`:'<div class="camera-placeholder"><div class="big-camera">◎</div><h3>Chụp trọn khoảnh khắc</h3><p>Cho tất cả người tham gia vào khung hình, sau đó bấm mở camera hoặc tải ảnh.</p></div>'}
 <!-- POSE PIP: luôn nằm trong viewport camera, có thể ẩn và bật lại bằng nút bên dưới. -->
 ${state.camera.showPoseOverlay?`<aside class="pose-camera-pip" aria-label="Pose mẫu đang chọn"><div class="pose-camera-pip-art">${poseSVG(state.people,pose.variant,state.background,state.style)}</div><span class="pose-camera-pip-title">${safe(pose.title)}</span><button class="pose-camera-pip-close" type="button" data-action="toggle-pose-overlay" aria-label="Ẩn pose mẫu" title="Ẩn mẫu">×</button></aside>`:''}
 </div>
 <!-- Camera controls: show/hide sample, flip, zoom, shutter, upload. -->
 <div class="camera-toolbar"><button class="btn btn-soft" type="button" data-action="toggle-pose-overlay" aria-pressed="${state.camera.showPoseOverlay}">${state.camera.showPoseOverlay?'Ẩn pose mẫu':'Hiện pose mẫu'}
 ${live?`<button class="btn btn-soft" type="button" data-action="flip-camera" aria-label="Đổi camera trước hoặc sau">⇄ Đổi camera</button><button class="btn btn-primary shutter-button" type="button" data-action="capture-photo">Chụp ảnh</button><button class="btn btn-outline" type="button" data-action="stop-camera">Tắt camera</button>`:`<button class="btn btn-primary" type="button" data-action="open-camera">Mở camera</button>`}
 </div>
 ${live?`<div class="camera-zoom"><label for="zoomCamera">Thu phóng camera</label><input type="range" id="zoomCamera" min="${state.camera.minZoom}" max="${state.camera.maxZoom}" value="${state.camera.zoom}" step="0.1" ${state.camera.zoomSupported?'':'disabled'} aria-describedby="zoomHelp"/><span id="zoomAmount">${state.camera.zoom.toFixed(1)}×</span><small id="zoomHelp">${state.camera.zoomSupported?'Dùng zoom quang học/kỹ thuật số do camera hỗ trợ.':'Trình duyệt hoặc camera này không cung cấp khả năng zoom.'}</small></div>`:''}
 <p class="capture-footnote">Camera cần HTTPS hoặc localhost và cấp quyền truy cập. Ảnh tải lên phải dưới 10 MB, tối thiểu 480p; ảnh lớn tự thu nhỏ về 1080p.</p>
 </div><div class="continue-bar"><div><strong>${photo?'Ảnh sẵn sàng để đánh giá':'Hãy chụp hoặc tải một ảnh nhóm'}</strong><span>${safe(pose.title)} · ${state.people} người</span></div><button class="btn btn-primary" type="button" data-action="go-results" ${photo?'':'disabled'}>Xem kết quả</button></div>`;
}
