/** Home copied forward from the current GitHub main variant: mobile Quick Guide card under step 01. */
import { STYLES } from '../data.js';
import { state, inputsReady } from '../state.js';
import { safe } from '../ui.js';
import { heading } from './shared.js';
import { renderQuickGuide } from './quick-guide.js';
// Workspace items stay inside the collapsible sidebar, not the Home body.
function uploadCard(kind, name, description, photo) {
 return `<div class="input-photo-card ${photo ? 'has-image' : ''}">
 <div class="input-photo-preview">${photo ? `<img src="${photo}" alt="${safe(name)} đã chọn">` : '<div class="upload-empty-icon">＋</div>'}</div>
 <div class="input-photo-copy"><strong>${safe(name)}</strong><span>${photo ? '✓ Đã sẵn sàng' : safe(description)}</span></div>
 <div class="input-photo-actions"><button class="btn btn-soft" type="button" data-action="upload-input" data-kind="${kind}">Tải ảnh</button><button class="btn btn-outline" type="button" data-action="camera-input" data-kind="${kind}">Chụp ảnh</button></div>
 </div>`;
}
export function renderHome() {
 // Replace only the illustration inside existing Quick Guide positions.
 const previewCardHTML=renderQuickGuide();
 return `<style>
 .mobile-preview-section { display:none; }
 @media(max-width:900px) { .mobile-preview-section{display:block;margin-bottom:20px} .home-right{display:none!important} }
 </style>
 <!-- Hero: retains the existing layout and CTA-free banner. -->
 <section class="hero-banner"><div class="hero-copy"><span class="eyebrow">LET’S MAKE MEMORIES</span><h2>Một tư thế đẹp.<br>Một kỷ niệm thật riêng.</h2><p>Khám phá kiểu tạo dáng phù hợp và lưu khoảnh khắc của bạn.</p></div><div class="hero-art"><div class="hero-monogram" aria-hidden="true"><img class="hero-logo-art" src="assets/poseximi-logo.png" alt="" /></div></div></section>
 <div class="home-grid"><div class="home-step-stack">
 <!-- 01: People count -->
 <section class="content-card settings-card"><div class="card-title-row"><h2>01. Số người tham gia</h2><span class="card-sub">Chọn 1–4 người</span></div><div class="person-counter" role="group" aria-label="Số người tham gia">${[1,2,3,4].map(n=>`<button class="count-btn ${state.people===n?'selected':''}" type="button" data-action="set-count" data-count="${n}" aria-pressed="${state.people===n}">${n}</button>`).join('')}</div></section>
 <!-- 02: Mobile Quick Guide, moved directly beneath count as in current repo -->
 <div class="mobile-preview-section">${previewCardHTML}</div>
 <!-- 03: Style -->
 <section class="content-card settings-card"><div class="card-title-row"><h2>03. Style</h2><span class="card-sub">Casual / Fashion / JoJo</span></div><div class="style-grid">${STYLES.map(s=>`<button type="button" class="selection-tile ${state.style===s.id?'selected':''}" data-action="set-style" data-style="${s.id}" aria-pressed="${state.style===s.id}"><span class="style-symbol style-symbol-image"><img src="assets/style-${s.id.toLowerCase()}.png" alt="Minh họa ${safe(s.label)}" loading="lazy" width="45" height="64" /></span><span><strong>${s.label}</strong><small>${s.desc}</small></span></button>`).join('')}</div></section>
 <!-- 04: Background -->
 <section class="content-card settings-card"><div class="card-title-row"><h2>04. Upload background</h2><span class="card-sub">1 ảnh nền</span></div>${uploadCard('background','Ảnh background','Không gian dự kiến chụp ảnh',state.backgroundPhoto)}</section>
 <!-- 05: All participants -->
 <section class="content-card settings-card"><div class="card-title-row"><h2>05. Upload ảnh người dùng</h2><span class="card-sub">1 ảnh toàn bộ nhóm</span></div>${uploadCard('group','Ảnh toàn thân mọi người',`Cần đủ ${state.people} người trong cùng khung hình`,state.groupPhoto)}<div class="image-guideline"><strong>Yêu cầu ảnh đầu vào</strong><p>Tối đa <b>10 MB</b>; tối thiểu <b>480p</b>; ảnh lớn tự thu nhỏ về tối đa <b>1080p</b>. Nên thấy rõ toàn thân tất cả ${state.people} người, không cắt chân hoặc đầu.</p><p class="muted">Frontend kiểm tra kích thước và dung lượng; nhận diện đủ người/toàn thân cần backend AI.</p></div></section>
 </div><aside class="home-right">${previewCardHTML}</aside></div>
 <!-- Only forward CTA: bottom of Home -->
 <section class="single-next-action"><p>Hoàn tất cả năm bước để nhận gợi ý tư thế.</p><button class="btn btn-primary btn-large" type="button" data-action="request-suggestions" ${inputsReady()?'':'disabled'}>Gợi ý tư thế</button>${inputsReady()?'':'<small>Hãy tải đủ ảnh background và ảnh toàn thân của nhóm.</small>'}</section>`;
}
