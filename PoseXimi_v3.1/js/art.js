/** Local SVG thumbnails. This is NOT an AI-generated user composite. */
import { state } from "./state.js";
export function poseSVG(
  people = state.people,
  variant = 0,
  background = state.background,
  style = state.style,
) {
  const palette = {
    studio: ["#fbeaec", "#ebcbd5", "#dcaebf"],
    pastel: ["#faede3", "#f3d5db", "#e8b7c4"],
    city: ["#e8d9d8", "#bb9fa5", "#ad8896"],
    nature: ["#edf1df", "#c9dabb", "#a6c3a9"],
  }[background] || ["#fbeaec", "#ebcbd5", "#dcaebf"];
  const shirts =
    style === "Fashion"
      ? ["#842342", "#fff1ee", "#40202e", "#ea9eaf", "#b65977", "#7d5568"]
      : style === "JoJo"
        ? ["#90314a", "#31232f", "#cc5577", "#5d395a", "#c3926d", "#9d4c6c"]
        : ["#b45477", "#f8e4d9", "#8e6a76", "#e9b9ad", "#aa7b93", "#f2cad9"];
  const n = Math.max(1, Math.min(4, Number(people)));
  const spacing =
    n <= 2 ? 133 : n === 3 ? 117 : n === 4 ? 95 : n === 5 ? 79 : 67;
  const scale = n >= 5 ? 0.78 : n === 4 ? 0.86 : n === 3 ? 0.95 : 1.12;
  const figures = Array.from({ length: n }, (_, index) => {
    const x = 240 + (index - (n - 1) / 2) * spacing;
    const y = n === 1 ? 4 : index % 2 === 0 && variant === 3 ? 0 : 7;
    const rotation =
      variant === 2
        ? index % 2
          ? 7
          : -7
        : variant === 5
          ? index % 2
            ? -10
            : 9
          : 0;
    const armLeft =
      variant === 1 || variant === 4
        ? "M-18 14 Q-44 -18 -53 -11"
        : variant === 2 || variant === 5
          ? "M-19 15 Q-47 -10 -42 -33"
          : "M-19 18 Q-39 39 -35 59";
    const armRight =
      variant === 1 || variant === 4
        ? "M18 14 Q45 -17 52 -10"
        : variant === 2 || variant === 5
          ? "M18 15 Q48 -5 42 -38"
          : "M18 18 Q38 39 36 56";
    const legLeft =
      variant === 3
        ? "M-9 72 Q-25 100 -36 126"
        : variant === 0
          ? "M-9 72 L-22 126"
          : "M-10 72 L-14 128";
    const legRight =
      variant === 3
        ? "M9 72 Q26 101 33 126"
        : variant === 0
          ? "M9 72 L23 126"
          : "M10 72 L16 128";
    const color = shirts[index % shirts.length];
    return `<g transform="translate(${x} ${155 + y}) scale(${scale}) rotate(${rotation})">
      <ellipse cx="0" cy="129" rx="40" ry="6" fill="#693047" opacity=".11"/>
      <path d="${legLeft} M${index % 2 ? 9 : 8} 72 ${legRight.slice(5)}" fill="none" stroke="#533440" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${armLeft} ${armRight}" fill="none" stroke="#e2aa90" stroke-width="13" stroke-linecap="round"/>
      <rect x="-23" y="5" width="46" height="74" rx="18" fill="${color}" />
      <path d="M-15 66 Q0 73 16 66" fill="none" stroke="#fff" stroke-opacity=".17" stroke-width="3"/>
      <rect x="-7" y="-7" width="14" height="19" rx="6" fill="#e2aa90"/>
      <ellipse cx="0" cy="-31" rx="24" ry="29" fill="#f1c4a7"/>
      <path d="M-25 -36 Q-26 -69 1 -65 Q23 -62 24 -34 Q13 -45 5 -51 Q-13 -42 -25 -36" fill="${
        index % 3 === 0 ? "#483646" : index % 3 === 1 ? "#675044" : "#332f42"
      }"/>
      <circle cx="-7" cy="-30" r="1.5" fill="#55454a"/><circle cx="7" cy="-30" r="1.5" fill="#55454a"/>
      <path d="M-5 -19 Q0 -15 5 -19" fill="none" stroke="#b47779" stroke-width="1.6" stroke-linecap="round"/>
      </g>`;
  }).join("");
  return `<svg class="pose-illustration" viewBox="0 0 480 320" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mẫu tạo dáng cho ${n} người">
    <defs><linearGradient id="bg-${background}-${variant}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs>
    <rect width="480" height="320" fill="url(#bg-${background}-${variant})"/>
    <circle cx="396" cy="54" r="78" fill="${palette[2]}" opacity=".37"/><circle cx="67" cy="292" r="109" fill="#fff" opacity=".20"/>
    <path d="M0 278 Q210 255 480 280 V320 H0 Z" fill="#fff" opacity=".25"/>
    <path d="M25 32h34m-17 -17v34" stroke="#fff" stroke-width="3" opacity=".63" stroke-linecap="round" />
    ${figures}
    <text x="26" y="291" fill="#ffffff" opacity=".88" style="font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px;font-weight:bold">POSEXIMI ♡</text>
  </svg>`;
}
