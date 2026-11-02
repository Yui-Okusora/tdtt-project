/** Simple line-drawn guide matching selected people count and pose variant.
 * Decorative overlay only; it is not saved into the camera frame.
 */
export function PoseGuideOverlay(people = 2, variant = 0) {
  const total = Math.min(4, Math.max(1, Number(people)));
  const xStep = total === 4 ? 82 : total === 3 ? 104 : total === 2 ? 156 : 0;
  const figures = Array.from({ length: total }, (_, i) => {
    const x = 180 + (i - (total - 1) / 2) * xStep;
    const y = i % 2 === 0 ? 0 : 8;
    const arms =
      variant % 3 === 1
        ? `M-17 10 L-44 -20 M17 10 L44 -20`
        : variant % 3 === 2
          ? `M-18 12 L-44 26 M18 12 L42 -25`
          : `M-18 10 L-34 43 M18 10 L38 43`;
    const legs =
      variant % 2
        ? `M-9 72 L-30 136 M9 72 L30 136`
        : `M-9 72 L-16 136 M9 72 L18 136`;
    return `<g transform="translate(${x} ${150 + y})"><circle cx="0" cy="-42" r="19"/><path d="M-15 -16 Q0 -24 15 -16 L15 72 Q0 79 -15 72 Z"/><path d="${arms} ${legs}"/></g>`;
  }).join("");
  return `<svg class="px-guide-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${figures}</svg>`;
}
