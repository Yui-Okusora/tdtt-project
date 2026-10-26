'use strict';

// PoseLab frontend demo. No real sign-in, server calls or external API keys.
const STYLES = [
  { id: 'Casual', label: 'Casual', desc: 'Tự nhiên, thoải mái', symbol: '♡' },
  { id: 'Fashion', label: 'Fashion', desc: 'Thời trang, cá tính', symbol: '✦' },
  { id: 'JoJo', label: 'JoJo', desc: 'Dáng pose mạnh mẽ, nổi bật', symbol: '★' }
];
const BACKGROUNDS = [
  { id: 'studio', label: 'Trong nhà', swatch: 'studio' },
  { id: 'pastel', label: 'Màu trơn', swatch: 'pastel' },
  { id: 'city', label: 'Vintage', swatch: 'city' },
  { id: 'nature', label: 'Ngoài trời', swatch: 'nature' }
];
const POSE_PRESETS = {
  solo: [
    ['solo-walk', 'Bước đi nhẹ nhàng', 'Chuyển động tự nhiên, tự tin.', 0],
    ['solo-lean', 'Nghiêng vai', 'Một chút nghiêng, một chút chất.', 1],
    ['solo-peace', 'Năng lượng tích cực', 'Giơ tay và mỉm cười thật tươi.', 2],
    ['solo-classic', 'Dáng đứng cổ điển', 'Đơn giản mà vẫn nổi bật.', 3],
    ['solo-fashion', 'Tay trong túi', 'Phù hợp với ảnh thời trang.', 4],
    ['solo-wave', 'Vẫy tay chào', 'Một khoảnh khắc thật gần gũi.', 5]
  ],
  duo: [
    ['duo-side', 'Tựa vai nhau', 'Ấm áp và gần gũi.', 0],
    ['duo-highfive', 'High-five!', 'Năng lượng đồng điệu, vui nhộn.', 1],
    ['duo-mirror', 'Đối xứng', 'Cặp đôi cá tính, đồng điệu.', 2],
    ['duo-walk', 'Cùng bước đi', 'Tự nhiên như một thước phim.', 3],
    ['duo-heart', 'Trái tim bạn bè', 'Đáng yêu và đầy cảm xúc.', 4],
    ['duo-back', 'Tựa lưng', 'Đậm chất ảnh kỷ niệm.', 5]
  ],
  trio: [
    ['trio-triangle', 'Bộ ba ăn ý', 'Bố cục cân đối cho ba người.', 0],
    ['trio-wave', 'Hello besties', 'Đầy màu sắc và năng lượng.', 1],
    ['trio-walk', 'Cùng nhau sải bước', 'Ghi lại phút giây tự nhiên.', 2],
    ['trio-line', 'Đứng so le', 'Nhẹ nhàng mà đẹp khung hình.', 3],
    ['trio-classic', 'Ba phong cách', 'Mỗi người một cá tính.', 4],
    ['trio-party', 'Bùng nổ niềm vui', 'Dành cho hội bạn thân.', 5]
  ],
  group: [
    ['group-line', 'Đội hình đồng điệu', 'Mọi người cùng nổi bật.', 0],
    ['group-cheer', 'Cùng giơ tay', 'Lưu lại nguồn năng lượng vui vẻ.', 1],
    ['group-arc', 'Vòng cung', 'Đội hình tự nhiên, hài hòa.', 2],
    ['group-stagger', 'Đứng so le', 'Ảnh nhóm sinh động, cân đối.', 3],
    ['group-walk', 'Hội bạn dạo phố', 'Khung hình tràn đầy sức sống.', 4],
    ['group-creative', 'Tạo dáng tự do', 'Mỗi người một tư thế độc đáo.', 5]
  ]
};
const state = {
  user: null, page: 'home', people: 2, style: 'Casual', background: 'studio',
  backgroundPhoto: null, groupPhoto: null, capturedPhoto: null,
  poseId: null, stream: null, cameraMode: null, fileTarget: 'capture',
  showAllPoses: false, analyzing: false, recommendationsReady: false,
  albums: [], libraryLoading: false, busy: false, libraryToken: 0, showFloatingPose: true
};
const $ = (sel) => document.querySelector(sel);
const main = $('#main');
const photoInput = $('#photoInput');
let toastTimer;
let previousFocus = null;

const safe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const poseList = () => POSE_PRESETS[state.people === 1 ? 'solo' : state.people === 2 ? 'duo' : state.people === 3 ? 'trio' : 'group']
  .map(([id, title, description, variant]) => ({ id, title, description, variant }));
const currentPose = () => poseList().find((p) => p.id === state.poseId) || null;
const initialPhotosReady = () => Boolean(state.backgroundPhoto && state.groupPhoto);
const completedPhotos = () => Number(Boolean(state.capturedPhoto));
const dateDisplay = (value) => new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const pageNames = { home: 'Trang chủ', poses: 'Gợi ý tư thế', capture: 'Chụp ảnh', result: 'Kết quả', library: 'Thư viện' };

// Original vector pose art (rendered locally, no remote images required).
function poseSVG(people = state.people, variant = 0, background = state.background, style = state.style) {
  const palette = {
    studio: ['#fbeaec', '#ebcbd5', '#dcaebf'], pastel: ['#faede3', '#f3d5db', '#e8b7c4'],
    city: ['#e8d9d8', '#bb9fa5', '#ad8896'], nature: ['#edf1df', '#c9dabb', '#a6c3a9']
  }[background] || ['#fbeaec', '#ebcbd5', '#dcaebf'];
  const shirts = style === 'Fashion' ? ['#842342', '#fff1ee', '#40202e', '#ea9eaf', '#b65977', '#7d5568']
    : style === 'JoJo' ? ['#90314a', '#31232f', '#cc5577', '#5d395a', '#c3926d', '#9d4c6c']
    : ['#b45477', '#f8e4d9', '#8e6a76', '#e9b9ad', '#aa7b93', '#f2cad9'];
  const n = Math.max(1, Math.min(4, Number(people)));
  const spacing = n <= 2 ? 133 : n === 3 ? 117 : n === 4 ? 95 : n === 5 ? 79 : 67;
  const scale = n >= 5 ? .78 : n === 4 ? .86 : n === 3 ? .95 : 1.12;
  const figures = Array.from({ length: n }, (_, index) => {
    const x = 240 + (index - (n - 1) / 2) * spacing;
    const y = n === 1 ? 4 : index % 2 === 0 && variant === 3 ? 0 : 7;
    const rotation = variant === 2 ? (index % 2 ? 7 : -7) : variant === 5 ? (index % 2 ? -10 : 9) : 0;
    const armLeft = variant === 1 || variant === 4 ? 'M-18 14 Q-44 -18 -53 -11' : variant === 2 || variant === 5 ? 'M-19 15 Q-47 -10 -42 -33' : 'M-19 18 Q-39 39 -35 59';
    const armRight = variant === 1 || variant === 4 ? 'M18 14 Q45 -17 52 -10' : variant === 2 || variant === 5 ? 'M18 15 Q48 -5 42 -38' : 'M18 18 Q38 39 36 56';
    const legLeft = variant === 3 ? 'M-9 72 Q-25 100 -36 126' : variant === 0 ? 'M-9 72 L-22 126' : 'M-10 72 L-14 128';
    const legRight = variant === 3 ? 'M9 72 Q26 101 33 126' : variant === 0 ? 'M9 72 L23 126' : 'M10 72 L16 128';
    const color = shirts[index % shirts.length];
    return `<g transform="translate(${x} ${155 + y}) scale(${scale}) rotate(${rotation})">
      <ellipse cx="0" cy="129" rx="40" ry="6" fill="#693047" opacity=".11"/>
      <path d="${legLeft} M${index % 2 ? 9 : 8} 72 ${legRight.slice(5)}" fill="none" stroke="#533440" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${armLeft} ${armRight}" fill="none" stroke="#e2aa90" stroke-width="13" stroke-linecap="round"/>
      <rect x="-23" y="5" width="46" height="74" rx="18" fill="${color}" />
      <path d="M-15 66 Q0 73 16 66" fill="none" stroke="#fff" stroke-opacity=".17" stroke-width="3"/>
      <rect x="-7" y="-7" width="14" height="19" rx="6" fill="#e2aa90"/>
      <ellipse cx="0" cy="-31" rx="24" ry="29" fill="#f1c4a7"/>
      <path d="M-25 -36 Q-26 -69 1 -65 Q23 -62 24 -34 Q13 -45 5 -51 Q-13 -42 -25 -36" fill="${index % 3 === 0 ? '#483646' : index % 3 === 1 ? '#675044' : '#332f42'}"/>
      <circle cx="-7" cy="-30" r="1.5" fill="#55454a"/><circle cx="7" cy="-30" r="1.5" fill="#55454a"/>
      <path d="M-5 -19 Q0 -15 5 -19" fill="none" stroke="#b47779" stroke-width="1.6" stroke-linecap="round"/>
      </g>`;
  }).join('');
  return `<svg class="pose-illustration" viewBox="0 0 480 320" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mẫu tạo dáng cho ${n} người">
    <defs><linearGradient id="bg-${background}-${variant}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs>
    <rect width="480" height="320" fill="url(#bg-${background}-${variant})"/>
    <circle cx="396" cy="54" r="78" fill="${palette[2]}" opacity=".37"/><circle cx="67" cy="292" r="109" fill="#fff" opacity=".20"/>
    <path d="M0 278 Q210 255 480 280 V320 H0 Z" fill="#fff" opacity=".25"/>
    <path d="M25 32h34m-17 -17v34" stroke="#fff" stroke-width="3" opacity=".63" stroke-linecap="round" />
    ${figures}
    <text x="26" y="291" fill="#ffffff" opacity=".88" style="font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px;font-weight:bold">POSELAB ♡</text>
  </svg>`;
}

function steps(active) {
  const names = ['Cấu hình', 'Chọn pose', 'Chụp ảnh', 'Hoàn tất'];
  const index = { home: 0, poses: 1, capture: 2, result: 3, library: 3 }[active] ?? 0;
  return `<div class="step-track" aria-label="Tiến trình">${names.map((name, i) => `${i ? '<span class="step-line"></span>' : ''}<span class="step ${i === index ? 'active' : i < index ? 'done' : ''}"><span class="step-index">${i < index ? '✓' : i + 1}</span>${safe(name)}</span>`).join('')}</div>`;
}
function pageHead(eyebrow, title, subtitle, withSteps = true) {
  return `<div class="page-head"><div><span class="eyebrow">${safe(eyebrow)}</span><h1>${title}</h1><p>${safe(subtitle)}</p></div>${withSteps ? steps(state.page) : ''}</div>`;
}
function uploadCard(kind, title, image, description) {
  return `<div class="input-photo-card ${image ? 'has-image' : ''}">
    <div class="input-photo-preview">${image ? `<img src="${image}" alt="${safe(title)} đã tải lên"/>` : `<div class="upload-empty-icon">＋</div>`}</div>
    <div class="input-photo-copy"><strong>${safe(title)}</strong><span>${image ? '✓ Đã có ảnh' : safe(description)}</span></div>
    <div class="input-photo-actions"><button type="button" class="btn btn-soft" data-action="upload-input" data-kind="${kind}">↑ Tải ảnh</button><button type="button" class="btn btn-outline" data-action="camera-input" data-kind="${kind}">◎ Chụp</button></div>
  </div>`;
}
function renderHome() {
  const pose = currentPose() || poseList()[0];
  return `${pageHead('YOUR CREATIVE SPACE', 'Studio của riêng bạn ✳', 'Giữ nguyên không gian làm việc, bổ sung ảnh nền và ảnh nhóm để gợi ý pose.', false)}
  <section class="hero-banner"><div class="hero-copy"><span class="eyebrow">LET’S MAKE MEMORIES</span><h2>Một tư thế đẹp.<br />Một kỷ niệm thật riêng.</h2><p>Chọn số người, phong cách và cung cấp hai ảnh đầu vào để khám phá những kiểu tạo dáng phù hợp.</p><button type="button" class="btn btn-primary" data-action="go-poses">Xem gợi ý tư thế →</button></div><div class="hero-art">${poseSVG(state.people, pose.variant, state.background, state.style)}</div></section>
  <div class="home-grid"><div>
    <section class="content-card settings-card"><div class="card-title-row"><h2>01. Bao nhiêu người tham gia?</h2><span class="card-sub">Từ 1 đến 4 người</span></div><div class="person-counter" role="group" aria-label="Chọn số người">${Array.from({length:4}, (_,i)=> `<button type="button" class="count-btn ${state.people === i+1 ? 'selected' : ''}" data-action="set-count" data-count="${i+1}" aria-pressed="${state.people === i+1}">${i+1}</button>`).join('')}</div></section>
    <section class="content-card settings-card"><div class="card-title-row"><h2>02. Chọn phong cách</h2><span class="card-sub">Casual / Fashion / JoJo</span></div><div class="style-grid">${STYLES.map(s => `<button type="button" class="selection-tile ${state.style === s.id ? 'selected' : ''}" data-action="set-style" data-style="${s.id}" aria-pressed="${state.style === s.id}"><span class="style-symbol">${s.symbol}</span><span><strong>${s.label}</strong><small>${s.desc}</small></span></button>`).join('')}</div></section>
    <section class="content-card settings-card"><div class="card-title-row"><h2>03. Chọn tông nền tham khảo</h2><span class="card-sub">Tùy chọn để xem pose mẫu</span></div><div class="background-grid">${BACKGROUNDS.map(bg => `<button type="button" class="background-tile ${state.background === bg.id ? 'selected' : ''}" data-action="set-background" data-background="${bg.id}" aria-pressed="${state.background === bg.id}"><span class="background-swatch swatch-${bg.swatch}"></span><small>${bg.label}</small></button>`).join('')}</div></section>
    <section class="content-card settings-card"><div class="card-title-row"><h2>04. Tải lên / chụp hai ảnh đầu vào</h2><span class="card-sub">Bắt buộc để tiếp tục</span></div><div class="setup-photo-grid">
      ${uploadCard('background', 'Ảnh background', state.backgroundPhoto, 'Phông nền muốn sử dụng')}
      ${uploadCard('group', 'Ảnh tất cả người tham gia', state.groupPhoto, `Một ảnh có đủ ${state.people} người`)}
      </div><p class="capture-footnote">Mỗi mục cần 1 ảnh. Không cần ảnh riêng của từng người. Bản frontend kiểm tra định dạng, kích thước tệp; chưa thể tự nhận diện chính xác số người trong ảnh.</p></section>
  </div><div class="home-right"><section class="content-card pose-preview-card"><div class="card-title-row" style="padding:4px 3px 0"><h2>Tư thế gợi ý</h2><span class="mini-badge">✦ FOR YOU</span></div>${poseSVG(state.people,pose.variant,state.background,state.style)}<div class="pose-preview-bottom"><div><strong>${safe(pose.title)}</strong><small>${state.people} người · ${safe(state.style)}</small></div><button type="button" class="btn btn-soft" data-action="go-poses">Xem 3 pose →</button></div></section><section class="start-card"><span class="eyebrow light">READY TO SHOOT?</span><h3>Bắt đầu bộ ảnh mới</h3><p>${initialPhotosReady() ? '✓ Đã có đủ 2 ảnh đầu vào. Sẵn sàng nhận 3 gợi ý tư thế.' : 'Hãy thêm ảnh background và ảnh nhóm để bắt đầu.'}</p><button type="button" class="btn btn-primary" data-action="go-poses">✦ Gợi ý tư thế →</button></section></div></div>`;
}
function renderPoses() {
  if (state.analyzing) return `${pageHead('POSE SUGGESTIONS','Đang gợi ý tư thế…','Đang chuẩn bị những mẫu phù hợp với cấu hình của bạn.')}<div class="loading-view" role="status"><div class="loading-spinner"></div><strong>Đang xếp hạng pose mẫu…</strong><p class="muted">Đây là gợi ý mô phỏng theo số người và style; chưa kết nối AI API.</p></div>`;
  const all = poseList();
  const shown = state.showAllPoses ? all : all.slice(0,3);
  return `${pageHead('POSE SUGGESTIONS','Gợi ý tư thế cho bạn.',`3 pose ưu tiên cho ${state.people} người theo phong cách ${state.style}.`)}
  <div class="filter-bar"><span class="filter-hint">✦ Gợi ý theo cấu hình (demo, chưa dùng AI thực)</span><span class="tag-chip">${state.people} người · ${safe(state.style)}</span></div>
  <div class="pose-grid">${shown.map((p,i) => `<article class="pose-card ${p.id === state.poseId ? 'chosen' : ''}">${poseSVG(state.people,p.variant,state.background,state.style)}<div class="pose-meta"><div class="pose-topline"><h3>${safe(p.title)}</h3><span class="mini-badge">${i<3 ? `TOP ${i+1}` : 'MORE'}</span></div><p>${safe(p.description)}</p><div class="pose-actions"><button type="button" class="btn btn-outline" data-action="open-pose" data-id="${p.id}">Xem trước</button><button type="button" class="btn btn-primary" data-action="select-pose" data-id="${p.id}">Chọn pose →</button></div></div></article>`).join('')}</div>
  <div class="more-pose-row"><button class="btn btn-outline" type="button" data-action="toggle-more">${state.showAllPoses ? 'Thu gọn −' : 'Xem thêm 3 tư thế ＋'}</button><button class="btn btn-soft" type="button" data-action="back-home">← Đổi ảnh đầu vào</button></div>`;
}
function renderCapture() {
  const pose=currentPose();
  if (!pose) return `${pageHead('CAMERA & UPLOAD','Chưa chọn pose.','Hãy chọn tư thế mẫu trước khi chụp ảnh.')}<button class="btn btn-primary" data-action="go-poses">Chọn pose</button>`;
  const current=state.capturedPhoto, hasVideo=Boolean(state.stream);
  return `${pageHead('CAMERA & UPLOAD','Sẵn sàng lên hình!', 'Camera và pose mẫu được hiển thị cùng lúc để dễ căn chỉnh.')}
    <div class="capture-layout"><div class="capture-panel content-card">
      <div class="section-heading"><h2>Camera / ảnh toàn bộ nhóm</h2><span class="tag-chip">${current?'✓ Đã có ảnh':'Chờ chụp'}</span></div>
      <div id="captureDropzone" class="capture-stage ${current && !hasVideo ? 'has-photo' : ''}" aria-label="Khu vực chụp hoặc kéo thả ảnh">
        <span class="camera-watermark">♡ POSELAB · ${state.people} người</span>
        <div id="mobilePosePip" class="mobile-pose-pip" ${!(hasVideo || current) || !state.showFloatingPose ? 'hidden' : ''} aria-label="Pose mẫu xem nhanh"><span class="mobile-pose-pip-label">POSE MẪU</span>${poseSVG(state.people,pose.variant,state.background,state.style)}</div>
        ${hasVideo ? '<video id="liveVideo" autoplay muted playsinline aria-label="Khung xem trước camera"></video>' : current ? `<img class="existing-photo" src="${current}" alt="Ảnh chụp toàn bộ nhóm" />` : `<div class="camera-placeholder"><div class="big-camera" aria-hidden="true">◎</div><h3>Cùng tạo dáng nào!</h3><p>Mở camera, chụp hoặc tải lên MỘT ảnh có toàn bộ người tham gia.</p></div>`}
      </div>
      <div class="capture-actions"><button class="btn btn-outline" type="button" data-action="open-file">↑ ${current?'Thay ảnh':'Tải ảnh lên'}</button>${hasVideo ? `<button class="btn btn-primary" type="button" data-action="capture-photo">◎ Chụp ảnh</button><button class="btn btn-outline" type="button" data-action="stop-camera">Tắt camera</button>` : `<button class="btn btn-soft" type="button" data-action="open-camera">◎ Mở camera</button>`}<button class="btn btn-soft" type="button" data-action="reuse-group">Dùng ảnh nhóm ban đầu</button><button class="btn btn-outline mobile-pose-toggle" data-action="toggle-floating-pose" type="button" aria-pressed="${state.showFloatingPose}" aria-controls="mobilePosePip">${state.showFloatingPose ? 'Ẩn pose nổi' : 'Hiện pose nổi'}</button></div>
      <p class="capture-footnote">Bấm chụp lại hoặc thay ảnh nếu chưa ưng ý. Camera cần HTTPS hoặc localhost và quyền truy cập camera.</p>
    </div><div class="capture-right"><section class="content-card"><div class="section-heading"><h2>Ảnh đầu vào</h2><span class="tiny-note">2 ảnh đã chuẩn bị</span></div><div class="slot-list"><div class="slot-btn"><span class="slot-thumbnail"><img src="${state.backgroundPhoto}" alt="Ảnh background" /></span><strong>Background</strong></div><div class="slot-btn"><span class="slot-thumbnail"><img src="${state.groupPhoto}" alt="Ảnh nhóm" /></span><strong>Cả nhóm</strong></div></div><button class="btn btn-plain" type="button" data-action="back-home">Đổi ảnh đầu vào</button></section>
      <section class="content-card"><div class="section-heading"><h2>Pose mẫu bên cạnh</h2><span class="mini-badge">TEMPLATE</span></div>${poseSVG(state.people,pose.variant,state.background,state.style)}<div class="pose-preview-bottom" style="padding-bottom:0"><div><strong>${safe(pose.title)}</strong><small>${state.people} người · ${safe(state.style)}</small></div><button class="btn btn-plain" type="button" data-action="go-poses">Đổi pose</button></div><button class="btn btn-soft preview-me-button" type="button" data-action="try-preview">Xem thử với ảnh của tôi (demo)</button></section></div></div>
    <div class="continue-bar"><div><strong>${current ? 'Ảnh đã sẵn sàng!' : 'Chưa có ảnh chụp cuối cùng'}</strong><span>${current ? 'Kiểm tra kết quả và phê duyệt nếu ưng ý.' : 'Chụp / tải một ảnh chứa toàn bộ người tham gia.'}</span></div><button type="button" class="btn btn-primary" data-action="go-results" ${!current?'disabled':''}>Xem kết quả →</button></div>`;
}
function photoGrid(photos, className) {
  return `<div class="${className} ${photos.length === 1 ? 'one-photo' : ''}">${photos.map((photo,i)=>`<img src="${photo}" alt="Ảnh người ${i+1}" />`).join('')}</div>`;
}
function renderResult() {
  const pose=currentPose();
  if (!pose || !state.capturedPhoto) return `${pageHead('RESULT & APPROVAL','Chưa có ảnh để xem kết quả.','Vui lòng chụp hoặc tải lên một ảnh nhóm.')}<button class="btn btn-primary" data-action="go-camera">Quay lại chụp ảnh</button>`;
  return `${pageHead('RESULT & APPROVAL','Kiểm tra kết quả ♡','So sánh ảnh nhóm cuối cùng với template đã chọn.')}
    <div class="result-grid"><section class="content-card result-preview"><div class="section-heading"><h2>Ảnh của bạn</h2><span class="pill-status">Đã sẵn sàng</span></div>${photoGrid([state.capturedPhoto],'result-photos')}<div class="comparison-caption"><strong>YOUR MOMENT</strong><small>1 ảnh · ${state.people} người</small></div></section>
    <section class="content-card result-reference"><div class="section-heading"><h2>Ảnh pose mẫu</h2><span class="mini-badge">REFERENCE</span></div>${poseSVG(state.people,pose.variant,state.background,state.style)}<div class="comparison-caption"><strong>${safe(pose.title)}</strong><small>${safe(state.style)}</small></div></section></div>
    <section class="feedback-box"><strong>✦ Gợi ý khi tự kiểm tra ảnh</strong><ul><li>Đảm bảo mọi người đều nằm trọn khung hình.</li><li>Điều chỉnh góc máy và khoảng cách để giống bố cục mẫu.</li><li>Nếu chưa hài lòng, chọn chụp lại; đây chưa phải đánh giá bằng computer vision/AI.</li></ul></section>
    <div class="approval-bar"><div><strong>Hài lòng với kết quả chứ?</strong><p>Phê duyệt để lưu vào thư viện cục bộ trên trình duyệt.</p></div><div class="approval-actions"><button class="btn btn-outline" type="button" data-action="retake" ${state.busy?'disabled':''}>↺ Retake</button><button class="btn btn-primary" type="button" data-action="approve" ${state.busy?'disabled':''}>${state.busy?'<span class="inline-loading"><span class="loading-spinner"></span>Đang lưu...</span>':'✓ Approve & lưu ảnh'}</button></div></div>`;
}
function renderLibrary() {
  if(state.libraryLoading) return `${pageHead('YOUR LIBRARY','Thư viện của bạn.','Đang tải ảnh đã duyệt.',false)}<div class="loading-view" role="status"><div class="loading-spinner"></div><strong>Đang tải ảnh…</strong></div>`;
  if(!state.albums.length) return `${pageHead('YOUR LIBRARY','Thư viện của bạn.','Ảnh được phê duyệt sẽ xuất hiện ở đây.',false)}<div class="empty-view"><div class="empty-icon">▧</div><h2>Chưa có ảnh nào</h2><p>Hãy bắt đầu bộ ảnh đầu tiên để lưu lại những khoảnh khắc của bạn.</p><button class="btn btn-primary" type="button" data-action="back-home">+ Tạo bộ ảnh mới</button></div>`;
  return `${pageHead('YOUR LIBRARY','Khoảnh khắc của bạn.','Ảnh được lưu tại trình duyệt này. Bạn có thể xem, tải về hoặc xóa.',false)}<div class="filter-bar"><span class="filter-hint">${state.albums.length} bộ ảnh đã lưu</span><button class="btn btn-soft" type="button" data-action="back-home">+ Bộ ảnh mới</button></div>
  <div class="library-grid">${state.albums.map(a=>`<article class="album-card">${photoGrid(a.photos,'album-thumbs single')}<div class="album-info"><h3>${safe(a.poseTitle)}</h3><p>${safe(dateDisplay(a.createdAt))} · ${a.people} người · ${safe(a.style)}</p><div class="album-buttons"><button class="btn btn-soft" data-action="view-album" data-id="${safe(a.id)}" type="button">Xem</button><button class="btn btn-outline" data-action="download-album" data-id="${safe(a.id)}" type="button">↓ Tải ảnh</button><button class="btn btn-danger" data-action="delete-album" data-id="${safe(a.id)}" type="button" aria-label="Xóa bộ ảnh">✕</button></div></div></article>`).join('')}</div>`;
}
function renderPage() {
  $('#pageLabel').textContent = pageNames[state.page] || 'Trang chủ';
  document.querySelectorAll('[data-page]').forEach(el=>{
    const active = el.dataset.page === state.page || (state.page === 'result' && el.dataset.page === 'capture');
    el.classList.toggle('active',active);
    if (active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  main.innerHTML = ({home:renderHome,poses:renderPoses,capture:renderCapture,result:renderResult,library:renderLibrary}[state.page] || renderHome)();
  if (state.page === 'capture' && state.stream) attachVideo();
}
function navigate(page) {
  if (page === 'capture' && !currentPose()) { toast('Hãy chọn một tư thế trước khi chụp ảnh.'); page = 'poses'; }
  if (page === 'poses' && !initialPhotosReady()) { toast('Vui lòng cung cấp ảnh background và ảnh tất cả người tham gia.'); page='home'; }
  if (page === 'result' && (!state.capturedPhoto || !currentPose())) { toast('Hãy chọn pose và chụp ảnh trước.'); page=currentPose()?'capture':'home'; }
  if (state.page === 'capture' && page !== 'capture') stopCamera(false);
  state.page=page;
  renderPage();
  if (page==='library') refreshLibrary();
  window.scrollTo({ top:0, behavior:'instant' });
}
async function requestSuggestions() {
  if(!initialPhotosReady()) { toast('Vui lòng tải/chụp đủ 2 ảnh: background và tất cả người tham gia.'); navigate('home'); return; }
  state.analyzing=true; state.showAllPoses=false;
  navigate('poses');
  // DEMO only: sorting/analysis is not connected to any AI inference service.
  await new Promise(resolve=>setTimeout(resolve,650));
  if(state.page==='poses') { state.analyzing=false; state.recommendationsReady=true; renderPage(); }
  else state.analyzing=false;
}
function toast(message) {
  const el=$('#toast'); el.textContent=message; el.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{ el.hidden=true; },3500);
}
function updateProfile() {
  const username = state.user?.name || 'Khách';
  $('#profileName').textContent=username;
  $('#avatar').textContent=username.charAt(0).toUpperCase();
}
function enterStudio(user) {
  state.user=user;
  try { sessionStorage.setItem('poseframe-demo-session', JSON.stringify(user)); } catch {}
  $('#loginView').hidden=true;
  $('#workspace').hidden=false;
  updateProfile();
  navigate('home');
}
function logout() {
  stopCamera(false);
  state.user=null;
  state.page='home';
  state.capturedPhoto=null;
  try { sessionStorage.removeItem('poseframe-demo-session'); } catch {}
  $('#workspace').hidden=true;
  $('#loginView').hidden=false;
  $('#password').value='';
  $('#email').focus();
}
function showModal(html, className='') {
  previousFocus = document.activeElement;
  $('#modalRoot').innerHTML=`<div class="modal-backdrop" data-backdrop="true"><div class="modal ${className}" role="dialog" aria-modal="true" aria-label="Hộp thoại"><div class="modal-head"><strong>POSELAB ♡</strong><button type="button" class="icon-btn modal-close" data-action="modal-close" aria-label="Đóng">×</button></div>${html}</div></div>`;
  $('.modal-close')?.focus();
}
function closeModal() {
  if(state.cameraMode) {stopCamera(false);state.cameraMode=null;}
  $('#modalRoot').innerHTML='';
  previousFocus?.focus?.();
}
function showPose(poseId) {
  const pose = poseList().find(p=>p.id===poseId);
  if(!pose) return;
  showModal(`${poseSVG(state.people,pose.variant,state.background,state.style)}<h2>${safe(pose.title)}</h2><p class="muted" style="font-size:13px;line-height:1.7">${safe(pose.description)} · ${state.people} người · ${safe(state.style)}</p><div class="modal-actionbar"><button type="button" class="btn btn-outline" data-action="modal-close">Đóng</button><button type="button" class="btn btn-primary" data-action="select-pose" data-id="${pose.id}">Chọn tư thế này →</button></div>`,'pose-detail-modal');
}

// Two input photographs (background and complete group), both one image each.
function beginInputUpload(kind) {
  state.fileTarget=kind;
  photoInput.click();
}
async function showInputCamera(kind) {
  if(!navigator.mediaDevices?.getUserMedia) { toast('Camera yêu cầu HTTPS/localhost. Bạn có thể tải ảnh lên thay thế.'); return; }
  closeModalIfOpen();
  showModal(`<h2>Chụp ${kind==='background'?'ảnh background':'ảnh tất cả người tham gia'}</h2><div class="modal-camera-stage"><video id="inputLiveVideo" autoplay muted playsinline></video></div><div class="modal-actionbar"><button class="btn btn-outline" data-action="modal-close" type="button">Hủy</button><button class="btn btn-primary" data-action="take-input-photo" type="button">◎ Chụp ảnh</button></div>`,'camera-input-modal');
  state.cameraMode=kind;
  try {
    const stream=await navigator.mediaDevices.getUserMedia({ video:{facingMode:'environment'},audio:false });
    if(!state.cameraMode) {stream.getTracks().forEach(t=>t.stop());return;}
    state.stream=stream;
    attachVideo();
  } catch { closeModal(); toast('Không mở được camera. Hãy dùng nút Tải ảnh.'); }
}
function closeModalIfOpen() { if($('#modalRoot').children.length) closeModal(); }
function takeInputPhoto() {
  const video=$('#inputLiveVideo');
  if(!video?.videoWidth) { toast('Camera đang khởi động, vui lòng thử lại.');return; }
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,1150/Math.max(video.videoWidth,video.videoHeight));
  canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  const image=canvas.toDataURL('image/jpeg',.82), kind=state.cameraMode;
  closeModal();
  if(kind==='group') state.groupPhoto=image; else state.backgroundPhoto=image;
  state.recommendationsReady=false;state.poseId=null;state.capturedPhoto=null;
  renderPage();toast('Đã chụp ảnh đầu vào.');
}
function showTryPreview() {
  if(!state.groupPhoto || !state.backgroundPhoto) return toast('Thiếu ảnh đầu vào.');
  showModal(`<h2>Preview thử với ảnh của tôi</h2><div class="try-composite"><img src="${state.backgroundPhoto}" alt="Ảnh nền"/><img class="composite-foreground" src="${state.groupPhoto}" alt="Ảnh nhóm đặt phía trước"/></div><p class="preview-caveat">Bản xem trước chỉ đặt ảnh nhóm lên trên ảnh nền, <strong>không tự tách người khỏi nền cũ</strong>. Chức năng ghép ảnh AI cần dịch vụ xử lý hình ảnh riêng.</p><div class="modal-actionbar"><button class="btn btn-primary" type="button" data-action="modal-close">Đóng</button></div>`);
}
// Camera and file handling.
function attachVideo() {
  const video=$('#liveVideo') || $('#inputLiveVideo'); if (!video || !state.stream) return;
  video.srcObject=state.stream;
  video.play().catch(()=>toast('Không thể phát hình ảnh camera. Hãy thử tải ảnh lên.'));
}
async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { toast('Camera chưa được hỗ trợ ở đây. Hãy mở bằng localhost/HTTPS hoặc tải ảnh lên.');return; }
  try {
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    if (state.page !== 'capture') { stream.getTracks().forEach(track=>track.stop()); return; }
    state.stream=stream;
    renderPage();
  } catch (err) {
    toast(err?.name==='NotAllowedError' ? 'Quyền truy cập camera bị từ chối. Bạn có thể tải ảnh lên.' : 'Không thể mở camera. Hãy kiểm tra thiết bị hoặc tải ảnh lên.');
  }
}
function stopCamera(render=true) {
  if (state.stream) state.stream.getTracks().forEach(track=>track.stop());
  state.stream=null;
  if (render && state.page==='capture') renderPage();
}
async function processFile(file) {
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)) {toast('Chỉ hỗ trợ JPEG, PNG, WebP hoặc AVIF.');return;}
  if(file.size>25*1024*1024){toast('Ảnh quá lớn, tối đa 25 MB.');return;}
  const target=state.fileTarget;
  try {
    const img=await decodeImage(file);
    if((img.naturalWidth||img.width)<120 || (img.naturalHeight||img.height)<120) {toast('Ảnh quá nhỏ, cần tối thiểu 120 × 120 pixel.');return;}
    const image=compressImage(img);
    if(target==='background')state.backgroundPhoto=image;
    else if(target==='group')state.groupPhoto=image;
    else if(target==='capture' && state.page==='capture')state.capturedPhoto=image;
    if(target==='group'||target==='background') {state.recommendationsReady=false;state.poseId=null;state.capturedPhoto=null;}
    if(target==='capture')stopCamera(false);
    renderPage();toast('Đã thêm ảnh thành công.');
  } catch(err){console.error(err);toast('Không đọc được ảnh. Vui lòng thử ảnh khác.');}
}
function decodeImage(file) {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image decode failed'));};
    img.src=url;
  });
}
function compressImage(img) {
  const canvas=document.createElement('canvas');
  const maxEdge=1150, scale=Math.min(1,maxEdge/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
  canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
  canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.8);
}
function capturePhoto() {
  const video=$('#liveVideo');
  if(!video?.videoWidth) {toast('Camera chưa sẵn sàng.');return;}
  const scale=Math.min(1,1150/Math.max(video.videoWidth,video.videoHeight));
  const w=Math.round(video.videoWidth*scale),h=Math.round(video.videoHeight*scale);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,w,h);
  state.capturedPhoto=canvas.toDataURL('image/jpeg',.82);
  stopCamera(false);renderPage();toast('Đã chụp ảnh nhóm thành công.');
}
// IndexedDB storage, with localStorage fallback where IndexedDB is unavailable.
const DB_NAME='poseframe-local-gallery'; const STORE='albums';
function openDB() {
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Database blocked'));
  });
}
async function storeAction(type,albumOrId) {
  const db=await openDB();
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,type==='getAll'?'readonly':'readwrite');
      const store=tx.objectStore(STORE);
      const request=type==='put'?store.put(albumOrId):type==='delete'?store.delete(albumOrId):store.getAll();
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      tx.onerror=()=>reject(tx.error);
    });
  } finally {db.close();}
}
function fallbackAlbums() {return JSON.parse(localStorage.getItem('poseframe-fallback-albums') || '[]');}
async function getAllAlbums() {
  try {return (await storeAction('getAll')).sort((a,b)=>b.createdAt-a.createdAt);}
  catch {return fallbackAlbums().sort((a,b)=>b.createdAt-a.createdAt);}
}
async function saveAlbum(album) {
  try {await storeAction('put',album);}
  catch {const albums=fallbackAlbums();albums.push(album);localStorage.setItem('poseframe-fallback-albums',JSON.stringify(albums));}
}
async function removeAlbum(id) {
  try {await storeAction('delete',id);}
  catch {localStorage.setItem('poseframe-fallback-albums',JSON.stringify(fallbackAlbums().filter(a=>a.id!==id)));}
}
async function refreshLibrary() {
  const token=++state.libraryToken;
  state.libraryLoading=true;
  renderPage();
  try {
    const albums=await getAllAlbums();
    if (token!==state.libraryToken || state.page!=='library') return;
    state.albums=albums;
  } catch (err) {
    console.error(err);
    toast('Không thể tải thư viện trên trình duyệt này.');
  } finally {
    if (token===state.libraryToken && state.page==='library') {state.libraryLoading=false;renderPage();}
  }
}
async function approve() {
  if(state.busy || !state.capturedPhoto || !currentPose())return;
  state.busy=true;renderPage();
  const pose=currentPose();
  const album={id:window.crypto?.randomUUID?.()||`${Date.now()}-${Math.round(Math.random()*1e6)}`,
    createdAt:Date.now(),people:state.people,style:state.style,poseId:pose.id,
    poseTitle:pose.title,photos:[state.capturedPhoto]};
  try {await saveAlbum(album);state.capturedPhoto=null;state.busy=false;toast('Đã phê duyệt và lưu ảnh!');navigate('library');}
  catch(err) {console.error(err);state.busy=false;toast('Không thể lưu ảnh. Vui lòng kiểm tra bộ nhớ trình duyệt.');renderPage();}
}
function downloadAlbum(id) {
  const album=state.albums.find(a=>a.id===id);if(!album?.photos?.[0])return;
  const link=document.createElement('a');link.href=album.photos[0];link.download=`PoseLab_${new Date(album.createdAt).toISOString().slice(0,10)}_${id.slice(0,6)}.jpg`;
  document.body.appendChild(link);link.click();link.remove();toast('Đang tải ảnh về thiết bị.');
}
function confirmDelete(id) {
  const album=state.albums.find(a=>a.id===id); if(!album)return;
  showModal(`<h2 style="font-size:20px">Xóa bộ ảnh này?</h2><p style="font-size:13px;color:#827a8d;line-height:1.7">“${safe(album.poseTitle)}” sẽ bị xóa khỏi thư viện trên thiết bị này. Thao tác không thể hoàn tác.</p><div class="modal-actionbar"><button class="btn btn-outline" type="button" data-action="modal-close">Hủy</button><button class="btn btn-danger" type="button" data-action="confirm-delete" data-id="${safe(id)}">Xóa bộ ảnh</button></div>`);
}
function viewAlbum(id) {
  const album=state.albums.find(a=>a.id===id);if(!album)return;
  showModal(`<h2 style="font-size:19px">${safe(album.poseTitle)}</h2><p class="muted" style="font-size:12px">${safe(dateDisplay(album.createdAt))} · ${album.people} người · ${safe(album.style)}</p>${photoGrid(album.photos,'modal-image-grid')}<div class="modal-actionbar"><button type="button" class="btn btn-outline" data-action="download-album" data-id="${safe(album.id)}">↓ Tải ảnh</button><button type="button" class="btn btn-primary" data-action="modal-close">Đóng</button></div>`);
}

// Event wiring; dynamically rendered screens use one delegated handler.
$('#loginForm').addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if(!form.reportValidity()) return;
  const email=$('#email').value.trim();
  const name=email.split('@')[0].slice(0,24) || 'Bạn';
  enterStudio({name,email});
  form.reset();
});
$('#guestBtn').addEventListener('click',()=>enterStudio({name:'Khách trải nghiệm'}));
$('#registerBtn').addEventListener('click',()=>showModal('<h2>Đăng ký tài khoản</h2><p class="muted">Bản demo chưa kết nối máy chủ đăng ký. Bạn có thể sử dụng chế độ khách để trải nghiệm đầy đủ giao diện.</p><div class="modal-actionbar"><button type="button" class="btn btn-primary" data-action="modal-close">Đã hiểu</button></div>'));
$('#resetPasswordBtn').addEventListener('click',()=>showModal('<h2>Đặt lại mật khẩu</h2><p class="muted">Chức năng gửi email khôi phục sẽ hoạt động khi kết nối hệ thống xác thực thật. Hiện tại không gửi email hoặc lưu mật khẩu.</p><div class="modal-actionbar"><button type="button" class="btn btn-primary" data-action="modal-close">Đóng</button></div>'));
$('#logoutBtn').addEventListener('click',logout);
$('#brandLink').addEventListener('click',event=>{event.preventDefault();navigate('home');});
$('#mainNav').addEventListener('click',event=>{
  const nav=event.target.closest('[data-page]');
  if(nav)navigate(nav.dataset.page);
});
photoInput.addEventListener('change',async()=>{const file=photoInput.files?.[0];photoInput.value='';await processFile(file);});
main.addEventListener('click',async(event)=>{
  const target=event.target.closest('[data-action]');if(!target || target.disabled)return;
  const action=target.dataset.action;
  switch(action) {
    case 'set-count': {
      const number=Number(target.dataset.count);
      if(number===state.people)return;
      state.people=number;state.poseId=null;state.capturedPhoto=null;state.recommendationsReady=false;renderPage();break;
    }
    case 'set-style':state.style=target.dataset.style;state.poseId=null;state.capturedPhoto=null;state.recommendationsReady=false;renderPage();break;
    case 'set-background':state.background=target.dataset.background;renderPage();break;
    case 'go-poses':await requestSuggestions();break;
    case 'go-camera':navigate('capture');break;
    case 'go-results':navigate('result');break;
    case 'back-home':navigate('home');break;
    case 'upload-input':beginInputUpload(target.dataset.kind);break;
    case 'camera-input':await showInputCamera(target.dataset.kind);break;
    case 'toggle-more':state.showAllPoses=!state.showAllPoses;renderPage();break;
    case 'try-preview':showTryPreview();break;
    case 'reuse-group':state.capturedPhoto=state.groupPhoto;stopCamera(false);renderPage();toast('Đã dùng ảnh nhóm làm ảnh kết quả.');break;
    case 'open-pose':showPose(target.dataset.id);break;
    case 'select-pose':state.poseId=target.dataset.id;state.capturedPhoto=null;closeModalIfOpen();navigate('capture');break;
    case 'open-file':beginInputUpload('capture');break;
    case 'open-camera':await openCamera();break;
    case 'stop-camera':stopCamera();break;
    case 'capture-photo':capturePhoto();break;
    case 'toggle-floating-pose':{
      state.showFloatingPose=!state.showFloatingPose;
      const pip=$('#mobilePosePip');
      if(pip)pip.hidden=!state.showFloatingPose || !(state.stream || state.capturedPhoto);
      target.setAttribute('aria-pressed',String(state.showFloatingPose));
      target.textContent=state.showFloatingPose?'Ẩn pose nổi':'Hiện pose nổi';
      break;
    }
    
    case 'retake':state.capturedPhoto=null;navigate('capture');break;
    case 'approve':await approve();break;
    case 'view-album':viewAlbum(target.dataset.id);break;
    case 'download-album':downloadAlbum(target.dataset.id);break;
    case 'delete-album':confirmDelete(target.dataset.id);break;
  }
});
$('#modalRoot').addEventListener('click',async(event)=>{
  if(event.target.matches('[data-backdrop]')){closeModal();return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  switch(target.dataset.action) {
    case 'modal-close':closeModal();break;
    case 'take-input-photo':takeInputPhoto();break;
    case 'download-album':downloadAlbum(target.dataset.id);break;
    case 'select-pose':state.poseId=target.dataset.id;state.capturedPhoto=null;closeModalIfOpen();navigate('capture');break;
    case 'confirm-delete':{
      try {await removeAlbum(target.dataset.id);closeModal();toast('Đã xóa bộ ảnh.');refreshLibrary();}
      catch(err){console.error(err);toast('Không thể xóa ảnh.');} break;
    }
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && $('#modalRoot').children.length)closeModal();});
const dropzoneEvents=['dragenter','dragover','dragleave','drop'];
dropzoneEvents.forEach(name=>main.addEventListener(name,event=>{
  const area=event.target.closest('#captureDropzone');if(!area)return;
  event.preventDefault();event.stopPropagation();
  if(name==='dragenter'||name==='dragover')area.classList.add('dragover');
  if(name==='dragleave'||name==='drop')area.classList.remove('dragover');
  if(name==='drop'){state.fileTarget='capture';processFile(event.dataTransfer.files?.[0]);}
}));
window.addEventListener('beforeunload',()=>stopCamera(false));

// Initial view.
$('#todayDate').textContent=new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'numeric',month:'long'});
try {const session=JSON.parse(sessionStorage.getItem('poseframe-demo-session') || 'null');if(session?.name)enterStudio(session);} catch {}
