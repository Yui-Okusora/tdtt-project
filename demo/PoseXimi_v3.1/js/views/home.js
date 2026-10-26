/** Workspace home. Exactly ONE forward CTA, after the five ordered cards. */
import {STYLES} from '../data.js';
import {state,poseList,inputsReady} from '../state.js';
import {poseSVG} from '../art.js';
import {safe} from '../ui.js';
import {heading} from './shared.js';

// Menu workspace chỉ xuất hiện ở sidebar khi hover hoặc bấm icon, không hiển thị trong body trang chủ.
function uploadCard(kind,name,description,photo){return `<div class="input-photo-card ${photo?'has-image':''}">
 <div class="input-photo-preview">${photo?`<img src="${photo}" alt="${safe(name)} đã chọn">`:'<div class="upload-empty-icon">＋</div>'}</div>
 <div class="input-photo-copy"><strong>${safe(name)}</strong><span>${photo?'✓ Đã sẵn sàng':safe(description)}</span></div>
 <div class="input-photo-actions"><button class="btn btn-soft" type="button" data-action="upload-input" data-kind="${kind}">↑ Tải ảnh</button><button class="btn btn-outline" type="button" data-action="camera-input" data-kind="${kind}">◎ Chụp ảnh</button></div>
 </div>`}
export function renderHome(){
 const featured = poseList()[0];
 return `${heading('YOUR CREATIVE SPACE','Studio của riêng bạn ✳','Chuẩn bị ảnh theo từng bước rồi nhấn Gợi ý tư thế ở cuối.',{progress:false})}
 <!-- Banner giữ phong cách và tỷ lệ desktop của bản gốc; không còn nút chuyển trang. -->
 <section class="hero-banner"><div class="hero-copy"><span class="eyebrow">LET’S MAKE MEMORIES</span><h2>Một tư thế đẹp.<br>Một kỷ niệm thật riêng.</h2><p>Khám phá kiểu tạo dáng phù hợp và lưu khoảnh khắc của bạn.</p></div><div class="hero-art"><div class="hero-monogram" aria-hidden="true">P<span>✦</span></div></div></section>
 <div class="home-grid"><div class="home-step-stack">
 <!-- 01: Chọn số người tham gia. -->
 <section class="content-card settings-card"><div class="card-title-row"><h2>01. Số người tham gia</h2><span class="card-sub">Chọn 1–4 người</span></div><div class="person-counter" role="group" aria-label="Số người tham gia">${[1,2,3,4].map(n=>`<button class="count-btn ${state.people===n?'selected':''}" type="button" data-action="set-count" data-count="${n}" aria-pressed="${state.people===n}">${n}</button>`).join('')}</div></section>
 <!-- 02: Hướng dẫn nhanh — chỉ dẫn các bước, không hiển thị ảnh pose trước khi phân tích. -->
 <section class="content-card settings-card"><div class="card-title-row"><h2>02. Hướng dẫn nhanh</h2><span class="card-sub">Bốn thao tác cơ bản</span></div><ol class="quick-guide-list"><li><span class="guide-step-icon">①</span><span>Chọn <strong>số người tham gia</strong> để cá nhân hóa danh sách tư thế.</span></li><li><span class="guide-step-icon">②</span><span>Chọn <strong>phong cách</strong> Casual, Fashion hoặc JoJo.</span></li><li><span class="guide-step-icon">③</span><span>Tải <strong>ảnh nền</strong> và <strong>một ảnh toàn thân của cả nhóm</strong>.</span></li><li><span class="guide-step-icon">④</span><span>Nhấn <strong>Gợi ý tư thế</strong> ở cuối trang, chọn pose rồi chụp ảnh.</span></li></ol></section>
 <!-- 03: Style theo brief mới. -->
 <section class="content-card settings-card"><div class="card-title-row"><h2>03. Style</h2><span class="card-sub">Casual / Fashion / JoJo</span></div><div class="style-grid">${STYLES.map(s=>`<button type="button" class="selection-tile ${state.style===s.id?'selected':''}" data-action="set-style" data-style="${s.id}" aria-pressed="${state.style===s.id}"><span class="style-symbol">${s.symbol}</span><span><strong>${s.label}</strong><small>${s.desc}</small></span></button>`).join('')}</div></section>
 <!-- 04: Upload background. -->
 <section class="content-card settings-card"><div class="card-title-row"><h2>04. Upload background</h2><span class="card-sub">1 ảnh nền</span></div>${uploadCard('background','Ảnh background','Không gian dự kiến chụp ảnh',state.backgroundPhoto)}</section>
 <!-- 05: Upload image of ALL people, 10 MB / 480p..1080p. -->
 <section class="content-card settings-card"><div class="card-title-row"><h2>05. Upload ảnh người dùng</h2><span class="card-sub">1 ảnh toàn bộ nhóm</span></div>${uploadCard('group','Ảnh toàn thân mọi người',`Cần đủ ${state.people} người trong cùng khung hình`,state.groupPhoto)}<div class="image-guideline"><strong>Yêu cầu ảnh đầu vào</strong><p>Tối đa <b>10 MB</b>; tối thiểu <b>480p</b>; ảnh lớn sẽ được tự thu nhỏ về tối đa <b>1080p</b>. Nên thấy rõ toàn thân tất cả ${state.people} người, không cắt chân hoặc đầu.</p><p class="muted">Frontend kiểm tra kích thước và dung lượng; nhận diện đủ người/toàn thân cần backend AI.</p></div></section>
 </div><aside class="home-right"><section class="content-card pose-preview-card"><div class="card-title-row"><h2>Hướng dẫn nhanh</h2><span class="mini-badge">FOR YOU</span></div>${poseSVG(state.people,featured.variant,state.background,state.style)}<div class="pose-preview-bottom"><div><strong>Chuẩn bị trước khi chụp</strong><small>Ảnh nền, ảnh toàn thân và style</small></div></div></section><section class="start-card"><span class="eyebrow light">WORKSPACE STATUS</span><h3>${inputsReady()?'Đã có đủ 2 ảnh':'Đang chuẩn bị ảnh'}</h3><p>${state.backgroundPhoto?'✓':'○'} Background<br>${state.groupPhoto?'✓':'○'} Ảnh người dùng<br>● ${state.people} người · ${safe(state.style)}</p></section></aside></div>
 <!-- CTA duy nhất tới bước gợi ý pose, ở cuối trang. -->
 <section class="single-next-action"><p>Hoàn tất cả năm bước để nhận gợi ý tư thế.</p><button class="btn btn-primary btn-large" type="button" data-action="request-suggestions" ${inputsReady()?'':'disabled'}>✦ Gợi ý tư thế →</button>${inputsReady()?'':'<small>Hãy tải đủ ảnh background và ảnh toàn thân của nhóm.</small>'}</section>`;
}
