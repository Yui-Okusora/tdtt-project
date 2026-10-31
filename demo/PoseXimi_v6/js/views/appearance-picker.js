/** Visual theme/font dropdowns. Native <select> options cannot contain swatches or rendered text. */
import {PALETTES,FONTS,getAppearance} from '../services/appearance.js';
import {safe} from '../ui.js';
import {fontIsReady,fontAuditComplete} from '../services/font-safety.js';
const dots=colors=>`<span class="appearance-dots" aria-hidden="true">${colors.map(color=>`<i style="background:${color}"></i>`).join('')}</span>`;
function themeChoice(p,checked=false){
 return `<button type="button" class="appearance-choice ${checked?'chosen':''}" data-palette-choice="${p.id}" aria-pressed="${checked}">
  <span class="appearance-gradient" style="background:${p.tokens.hero}" aria-hidden="true"></span>
  <span class="appearance-choice-copy"><strong>${safe(p.label)}</strong><small>${dots(p.swatches)} <span class=\"appearance-button-demo\" style=\"background:${p.tokens.button}\">Nút</span> Gradient</small></span>
  <span class="appearance-picked">${checked?'✓':'＋'}</span></button>`;
}
function fontChoice(f,checked=false){
 const ornate=['nightshade','caesar','honk','nabla','metal'].includes(f.id);
 const family=(f.brand.match(/'([^']+)'/)||[])[1];
 const unsupported=ornate&&!fontIsReady(family);
 return `<button type="button" ${unsupported?'disabled title="Font này chưa tải xong hoặc không có sẵn; giao diện sẽ giữ font tiếng Việt an toàn"':''}  class="appearance-choice appearance-font-choice ${checked?'chosen':''}" data-font-choice="${f.id}" aria-pressed="${checked}">
  <span class="appearance-font-glyph" style="font-family:${f.brand};font-variation-settings:${f.variation||'normal'}">Px</span>
  <span class="appearance-choice-copy"><strong>${safe(f.label)}</strong>
  <small class="appearance-sample" style="font-family:${f.brand};font-variation-settings:${f.variation||'normal'}">PoseXimi ♡ · CREATE YOUR MOMENT</small>${ornate?`<small class="font-safety-note">${unsupported?(fontAuditComplete()?"Chưa tải được font – không cho chọn":"Đang kiểm tra font…"):"Đã tải font; chữ Việt dùng font hỗ trợ dấu"}</small>`:""}</span>
  <span class="appearance-picked">${checked?'✓':'＋'}</span></button>`;
}
/** Render after each selection. <details> provides keyboard-friendly disclosure and scrollable options. */
export function renderAppearancePicker(){
 const chosen=getAppearance();
 const palette=PALETTES.find(p=>p.id===chosen.palette)||PALETTES[0];
 const font=FONTS.find(f=>f.id===chosen.font)||FONTS[0];
 // v5: these states are required by the CURRENT font summary as well as the option list.
 // v4 referenced `ornate` / `unsupported` here without declaring them, throwing a
 // ReferenceError and preventing the entire appearance modal from opening.
 const ornate=['nightshade','caesar','honk','nabla','metal'].includes(font.id);
 const family=(font.brand.match(/'([^']+)'/)||[])[1];
 const unsupported=ornate&&!fontIsReady(family);
 return `<div class="appearance-form appearance-editor">
 <div class="appearance-picker-block"><div class="appearance-picker-label">Bảng màu · Gradient</div>
 <details class="appearance-dropdown" id="paletteDropdown"><summary class="appearance-current">
 <span class="appearance-gradient" style="background:${palette.tokens.hero}"></span>
 <span><strong>${safe(palette.label)}</strong><small>${dots(palette.swatches)}</small></span>
 <span class="appearance-chevron">⌄</span></summary>
 <div class="appearance-options">${PALETTES.map(p=>themeChoice(p,p.id===chosen.palette)).join('')}</div></details></div>
 <div class="appearance-picker-block"><div class="appearance-picker-label">Bộ phông chữ</div>
 <details class="appearance-dropdown" id="fontDropdown"><summary class="appearance-current">
 <span class="appearance-font-glyph" style="font-family:${font.brand};font-variation-settings:${font.variation||'normal'}">Px</span>
 <span><strong>${safe(font.label)}</strong><small class="appearance-sample" style="font-family:${font.brand};font-variation-settings:${font.variation||'normal'}">PoseXimi ♡ · CREATE YOUR MOMENT</small>${ornate?`<small class="font-safety-note">${unsupported?(fontAuditComplete()?"Chưa tải được font – không cho chọn":"Đang kiểm tra font…"):"Đã tải font; chữ Việt dùng font hỗ trợ dấu"}</small>`:""}</span>
 <span class="appearance-chevron">⌄</span></summary>
 <div class="appearance-options">${FONTS.map(f=>fontChoice(f,f.id===chosen.font)).join('')}</div></details></div>
 </div>`;
}
