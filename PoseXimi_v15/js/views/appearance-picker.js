/** PoseXimi v12: v10 two-column palette cards + V6 font presets in the same visual language.
 * Uses only CSS custom properties; never changes component layout when theme changes.
 */
import { PALETTES, FONTS, getAppearance } from "../services/appearance.js";
import { fontIsReady, fontAuditComplete } from "../services/font-safety.js";
import { safe } from "../ui.js";

function swatches(colors) {
  return `<span class="px-theme-swatches" aria-hidden="true">${colors.map((color) => `<i style="background:${color}"></i>`).join("")}</span>`;
}
function paletteTile(theme, selected) {
  return `<button type="button" class="px-theme-choice ${selected ? "is-selected" : ""}" data-palette-choice="${safe(theme.id)}" aria-pressed="${selected}" aria-label="Bảng màu ${safe(theme.label)}">
 <span class="px-theme-hero" style="background:${theme.tokens.hero}" aria-hidden="true"></span>
 ${swatches(theme.swatches)}
 <span class="px-choice-bottom"><strong>${safe(theme.label)}</strong>${selected ? '<span class="px-selected-check" aria-hidden="true">✓</span>' : ""}</span>
 </button>`;
}
function fontTile(font, selected) {
  const decorative = [
    "nightshade",
    "caesar",
    "honk",
    "nabla",
    "metal",
  ].includes(font.id);
  const family = (font.brand.match(/'([^']+)'/) || [])[1];
  const unavailable = decorative && !fontIsReady(family);
  const label = unavailable
    ? fontAuditComplete()
      ? "Font chưa được tải"
      : "Đang tải font"
    : decorative
      ? "Dùng cho tên PoseXimi"
      : "Hiển thị chữ Việt";
  return `<button type="button" class="px-font-choice ${selected ? "is-selected" : ""}" data-font-choice="${safe(font.id)}" aria-pressed="${selected}" ${unavailable ? 'disabled aria-disabled="true"' : ""}>
 <span class="px-font-demo" style="font-family:${font.brand};font-variation-settings:${font.variation || "normal"}">PoseXimi</span>
 <span class="px-choice-bottom"><strong>${safe(font.label)}</strong>${selected ? '<span class="px-selected-check" aria-hidden="true">✓</span>' : ""}</span>
 <small>${label}</small></button>`;
}
export function renderAppearancePicker() {
  const selected = getAppearance();
  return `<div class="px-appearance-editor">
 <section class="px-appearance-section" aria-label="Chọn bảng màu"><div class="px-picker-heading"><h3>Bảng màu studio</h3><small>${PALETTES.length} palette</small></div>
 <div class="px-theme-picker">${PALETTES.map((theme) => paletteTile(theme, theme.id === selected.palette)).join("")}</div></section>
 <section class="px-appearance-section" aria-label="Chọn bộ chữ"><div class="px-picker-heading"><h3>Kiểu chữ</h3><small>Nhấn để xem và áp dụng</small></div>
 <p class="px-picker-hint">Mỗi mẫu hiển thị chữ PoseXimi thật. Các font trang trí chỉ dùng cho thương hiệu để tiếng Việt không bị lỗi dấu.</p>
 <div class="px-font-picker">${FONTS.map((font) => fontTile(font, font.id === selected.font)).join("")}</div></section>
 </div>`;
}
