/** A single expressive body and heading font pair across every screen. */
import { PALETTES, getAppearance } from "../services/appearance.js";
import { safe } from "../ui.js";
export function renderAppearancePicker() {
  const current = getAppearance();
  return `<div class="px-theme-picker" role="group" aria-label="Chọn bảng màu">${PALETTES.map(
    (
      p,
    ) => `<button type="button" class="px-theme-choice ${p.id === current.palette ? "is-selected" : ""}" data-palette-choice="${safe(p.id)}" aria-pressed="${p.id === current.palette}">
   <span class="px-theme-hero" style="background:${p.tokens.hero}"></span>
   <span class="px-theme-swatches">${p.swatches.map((color) => `<i style="background:${color}"></i>`).join("")}</span><strong>${safe(p.label)}</strong>
   </button>`,
  ).join("")}</div>`;
}
