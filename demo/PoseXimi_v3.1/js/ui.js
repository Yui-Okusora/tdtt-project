/** Shared DOM helpers and accessible feedback/modals. */
export const $ = selector => document.querySelector(selector);
export const safe = value => String(value??'').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const dateDisplay = time => new Date(time).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric'});
let toastTimeout, restoreFocus;
export function toast(message) {
  const target=$('#toast'); target.textContent=message;target.hidden=false;
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{target.hidden=true},4500);
}
export function showModal(body, style='') {
  restoreFocus=document.activeElement;
  $('#modalRoot').innerHTML=`<div class="modal-backdrop" data-backdrop="true"><div class="modal ${safe(style)}" role="dialog" aria-modal="true" aria-label="Hộp thoại PoseXimi"><div class="modal-head"><strong>POSEXIMI ♡</strong><button class="icon-btn modal-close" type="button" data-action="modal-close" aria-label="Đóng">×</button></div>${body}</div></div>`;
  $('.modal-close')?.focus();
}
export function closeModal(){
  $('#modalRoot').innerHTML='';restoreFocus?.focus?.();
}
export function loadingModal(title='Đang xử lý ảnh',text='AI đang tạo bản xem trước…'){
  showModal(`<div class="ai-loading" role="status" aria-live="polite"><div class="loading-spinner"></div><h2>${safe(title)}</h2><p id="aiLoadingMessage">${safe(text)}</p><div class="ai-progress-track"><span></span></div><button type="button" class="btn btn-outline" data-action="cancel-preview">Hủy xử lý</button></div>`,'ai-loading-modal');
}
// Make PWA installation instructions reusable without coupling pwa.js to the app bundle.
window.PoseXimiShowModal=showModal;
