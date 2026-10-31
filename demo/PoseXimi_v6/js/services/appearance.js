/**
 * PoseXimi DESIGN SYSTEM — single configuration file for palettes and font pairs.
 * Add a theme here; no need to edit CSS/layout files or individual pages.
 * Palette objects define CSS custom property values applied to <html>.
 */
const gradient = (a, b, c) => `linear-gradient(115deg, ${a}, ${b}, ${c})`;
const buttonGradient = (a, b) => `linear-gradient(110deg, ${a}, ${b})`;

export const PALETTES = [
  {
    id: "rose",
    label: "Rose Cream",
    swatches: ["#8c2044", "#f9e4eb", "#fffdfa"],
    tokens: {
      accent: "#8c2044",
      accentStrong: "#711835",
      surface: "#fffdfa",
      surfaceSoft: "#faeaf0",
      page: "#fbf7f4",
      text: "#342129",
      textSoft: "#89787e",
      stroke: "#eadbdb",
      hero: gradient("#f9e3e8", "#f8eae8", "#f4d9df"),
      login: "linear-gradient(148deg,#b44d72,#923557,#762641)",
      button: buttonGradient("#9a2850", "#7d1c3d"),
      heroInk: "#78213d",
    },
  },
  {
    id: "lilac",
    label: "Dreamy Lilac",
    swatches: ["#6752af", "#e7dff8", "#fcfaff"],
    tokens: {
      accent: "#6752af",
      accentStrong: "#443184",
      surface: "#fcfaff",
      surfaceSoft: "#ece5ff",
      page: "#f8f6ff",
      text: "#302844",
      textSoft: "#817491",
      stroke: "#e2d9ef",
      hero: gradient("#eee7ff", "#f9f2fc", "#e1d8f9"),
      login: "linear-gradient(148deg,#8570c8,#6955b0,#453483)",
      button: buttonGradient("#8462c2", "#59449f"),
      heroInk: "#514090",
    },
  },
  {
    id: "matcha",
    label: "Matcha Studio",
    swatches: ["#496a57", "#e0ede0", "#fbfcf5"],
    tokens: {
      accent: "#496a57",
      accentStrong: "#2d5140",
      surface: "#fbfcf5",
      surfaceSoft: "#e4f0e4",
      page: "#f6f9f3",
      text: "#263c31",
      textSoft: "#6c8475",
      stroke: "#d8e4d8",
      hero: gradient("#e1eddc", "#f5f8e9", "#dbeacf"),
      login: "linear-gradient(148deg,#6d9678,#496f59,#2f5541)",
      button: buttonGradient("#62866b", "#365b43"),
      heroInk: "#31543a",
    },
  },
  {
    id: "apricot",
    label: "Apricot Pop",
    swatches: ["#a74e42", "#ffe2cf", "#fff9f1"],
    tokens: {
      accent: "#a74e42",
      accentStrong: "#81362f",
      surface: "#fffaf4",
      surfaceSoft: "#ffe9da",
      page: "#fff8f2",
      text: "#482d28",
      textSoft: "#967770",
      stroke: "#eeddd1",
      hero: gradient("#ffeadc", "#fff7ed", "#f8d6c7"),
      login: "linear-gradient(148deg,#d78167,#bb6553,#8d413d)",
      button: buttonGradient("#bd6954", "#994539"),
      heroInk: "#893c35",
    },
  },
  {
    id: "ocean",
    label: "Ocean Breeze",
    swatches: ["#167d9d", "#9ee7e2", "#e9f9fc"],
    tokens: {
      accent: "#167d9d",
      accentStrong: "#095d7b",
      surface: "#f9feff",
      surfaceSoft: "#dff5f5",
      page: "#f2fbff",
      text: "#193c49",
      textSoft: "#5e8693",
      stroke: "#cfe5e8",
      hero: gradient("#a3e9e8", "#d8fbf2", "#b1d8f7"),
      login: "linear-gradient(135deg,#198fb3,#2874b3,#2b426e)",
      button: buttonGradient("#209db2", "#235a9e"),
      heroInk: "#134f71",
    },
  },
  {
    id: "sunset",
    label: "Sunset Sorbet",
    swatches: ["#cb535e", "#ffc38d", "#ffe5b4"],
    tokens: {
      accent: "#bf5360",
      accentStrong: "#953546",
      surface: "#fffdfa",
      surfaceSoft: "#ffe9d6",
      page: "#fff9f1",
      text: "#533039",
      textSoft: "#99717c",
      stroke: "#f0ddcd",
      hero: gradient("#ffb3bc", "#ffcfb0", "#fff0c3"),
      login: "linear-gradient(140deg,#d25380,#ef9b6d,#d45c55)",
      button: buttonGradient("#d76876", "#b14466"),
      heroInk: "#97394e",
    },
  },
  {
    id: "aurora",
    label: "Aurora Mint",
    swatches: ["#438d84", "#a7c6f8", "#e4dbfb"],
    tokens: {
      accent: "#438d84",
      accentStrong: "#256e71",
      surface: "#fbfefc",
      surfaceSoft: "#e4f3f0",
      page: "#f5fafb",
      text: "#263f48",
      textSoft: "#6d8386",
      stroke: "#d7e6e5",
      hero: gradient("#c2f5df", "#b8e9f6", "#e7d0ff"),
      login: "linear-gradient(145deg,#4cbaa3,#598dbe,#896ca6)",
      button: buttonGradient("#40a5a0", "#5d79a8"),
      heroInk: "#30567e",
    },
  },
  {
    id: "berry",
    label: "Berry Galaxy",
    swatches: ["#8c378e", "#db8bc7", "#f6dbf0"],
    tokens: {
      accent: "#8c378e",
      accentStrong: "#6b236c",
      surface: "#fffafd",
      surfaceSoft: "#f8e4f4",
      page: "#fdf6fc",
      text: "#4d2c4b",
      textSoft: "#987c96",
      stroke: "#efdbeb",
      hero: gradient("#e4bef1", "#ffd5e7", "#e5d4fb"),
      login: "linear-gradient(140deg,#702b9c,#b94b91,#d678a8)",
      button: buttonGradient("#af4b9e", "#7b368d"),
      heroInk: "#703675",
    },
  },
  {
    id: "cocoa",
    label: "Cocoa Latte",
    swatches: ["#805344", "#d5aa8b", "#f3eadb"],
    tokens: {
      accent: "#805344",
      accentStrong: "#5e382f",
      surface: "#fffcf7",
      surfaceSoft: "#f3e6d7",
      page: "#faf5ef",
      text: "#3d302b",
      textSoft: "#83736b",
      stroke: "#e8dbce",
      hero: gradient("#f1d8c1", "#eec9c0", "#f9ead6"),
      login: "linear-gradient(140deg,#aa796a,#7c5147,#5e3a3b)",
      button: buttonGradient("#a66c56", "#75473a"),
      heroInk: "#6d433c",
    },
  },
  // Additional radiant / multitone palettes: edit only this source to add more.
  {
    id: "prism",
    label: "Pearl Prism",
    swatches: ["#7d47ba", "#ffbcdb", "#a9f1f2"],
    tokens: {
      accent: "#70459a",
      accentStrong: "#513178",
      surface: "#fffbff",
      surfaceSoft: "#efe5fb",
      page: "#fbf7ff",
      text: "#372b4b",
      textSoft: "#867590",
      stroke: "#e5d9f0",
      hero: gradient("#e9d9ff", "#ffdaeb", "#b8f3f1"),
      login: gradient("#7449bd", "#d47cba", "#7dbbd3"),
      button: buttonGradient("#a05bbb", "#7647a9"),
      heroInk: "#62418e",
    },
  },
  {
    id: "citrus",
    label: "Citrus Spritz",
    swatches: ["#89662f", "#f8cc71", "#cde8a0"],
    tokens: {
      accent: "#76562b",
      accentStrong: "#60421d",
      surface: "#fffef9",
      surfaceSoft: "#fff2d5",
      page: "#fffbef",
      text: "#453621",
      textSoft: "#8b7857",
      stroke: "#ecdfc6",
      hero: gradient("#ffe8a9", "#ffcbc2", "#e8f4ae"),
      login: gradient("#b07943", "#d79b60", "#758e4b"),
      button: buttonGradient("#a9713c", "#77552d"),
      heroInk: "#71461b",
    },
  },
  {
    id: "flamingo",
    label: "Pink Lemonade",
    swatches: ["#a92b68", "#ff9abc", "#ffe49c"],
    tokens: {
      accent: "#a92b68",
      accentStrong: "#832352",
      surface: "#fffafd",
      surfaceSoft: "#ffe6f2",
      page: "#fff8fa",
      text: "#542a45",
      textSoft: "#997188",
      stroke: "#efd8e3",
      hero: gradient("#ffd3ec", "#ffe4ae", "#ffb6c9"),
      login: gradient("#c63782", "#eb8e89", "#b83d70"),
      button: buttonGradient("#d24584", "#a82c63"),
      heroInk: "#a12b69",
    },
  },
  {
    id: "lagoon",
    label: "Tropical Lagoon",
    swatches: ["#157d79", "#a4f1db", "#b1d1ff"],
    tokens: {
      accent: "#157d79",
      accentStrong: "#075a66",
      surface: "#f9fffc",
      surfaceSoft: "#def7ed",
      page: "#f1fbf7",
      text: "#184744",
      textSoft: "#63867e",
      stroke: "#d0e9e4",
      hero: gradient("#a4f1db", "#b1e1fc", "#e1f1bc"),
      login: gradient("#2aa38d", "#338caa", "#5478ad"),
      button: buttonGradient("#239e92", "#176f86"),
      heroInk: "#146e75",
    },
  },
  {
    id: "sky",
    label: "Cloud Nine",
    swatches: ["#4d74ba", "#cae9ff", "#d5ccff"],
    tokens: {
      accent: "#4d74ba",
      accentStrong: "#34598f",
      surface: "#fcfdff",
      surfaceSoft: "#e6f2ff",
      page: "#f7fbff",
      text: "#2b3b58",
      textSoft: "#7286a4",
      stroke: "#dce6f4",
      hero: gradient("#cbeaff", "#f1e8ff", "#d1dbff"),
      login: gradient("#5c84ca", "#897bc9", "#5a9da8"),
      button: buttonGradient("#698de0", "#476bb9"),
      heroInk: "#435d9b",
    },
  },
  {
    id: "lotus",
    label: "Lotus Bloom",
    swatches: ["#924b86", "#ebadc9", "#fad6a5"],
    tokens: {
      accent: "#924b86",
      accentStrong: "#712f67",
      surface: "#fffafd",
      surfaceSoft: "#f7e7f4",
      page: "#fdf7fb",
      text: "#4c304b",
      textSoft: "#906f89",
      stroke: "#ebd9e7",
      hero: gradient("#eac7e7", "#ffd6ca", "#f6e2c0"),
      login: gradient("#9b5292", "#cb7a9e", "#bb7466"),
      button: buttonGradient("#b65b9b", "#88447f"),
      heroInk: "#783d75",
    },
  },
  {
    id: "forest",
    label: "Forest Glow",
    swatches: ["#316d5c", "#b4dfb1", "#e5e8a0"],
    tokens: {
      accent: "#316d5c",
      accentStrong: "#23513f",
      surface: "#fbfef9",
      surfaceSoft: "#e5f3dd",
      page: "#f4faee",
      text: "#284138",
      textSoft: "#698374",
      stroke: "#d6e6d1",
      hero: gradient("#b4dfb1", "#e5efbb", "#bde7d3"),
      login: gradient("#3d856e", "#749d66", "#72978a"),
      button: buttonGradient("#4c956e", "#286f60"),
      heroInk: "#2b6951",
    },
  },
  {
    id: "cosmic",
    label: "Cosmic Candy",
    swatches: ["#663ea5", "#d988dc", "#8fd5ed"],
    tokens: {
      accent: "#663ea5",
      accentStrong: "#4b2e84",
      surface: "#fdfaff",
      surfaceSoft: "#eee1fb",
      page: "#f8f3ff",
      text: "#3c2e59",
      textSoft: "#84729c",
      stroke: "#e5daf0",
      hero: gradient("#b9a9fa", "#f8b7e7", "#99dcef"),
      login: gradient("#523d98", "#8f45a8", "#3987b2"),
      button: buttonGradient("#9d4ebc", "#5543a5"),
      heroInk: "#5f398e",
    },
  },
  {
    id: "desert",
    label: "Desert Sunset",
    swatches: ["#a15038", "#ffca99", "#ebd7b8"],
    tokens: {
      accent: "#a15038",
      accentStrong: "#7b3929",
      surface: "#fffaf4",
      surfaceSoft: "#ffe7d4",
      page: "#fff7ee",
      text: "#533528",
      textSoft: "#957567",
      stroke: "#eddacb",
      hero: gradient("#ffcda8", "#f1bdb5", "#f6e4bb"),
      login: gradient("#b76c4a", "#dd9174", "#a65f57"),
      button: buttonGradient("#c26c4e", "#934334"),
      heroInk: "#84402b",
    },
  },
  {
    id: "hologram",
    label: "Icy Hologram",
    swatches: ["#367f9f", "#c2efff", "#efd8ff"],
    tokens: {
      accent: "#367f9f",
      accentStrong: "#25617f",
      surface: "#fcfeff",
      surfaceSoft: "#e3f6fc",
      page: "#f6fbff",
      text: "#274453",
      textSoft: "#718b9a",
      stroke: "#d9e9f2",
      hero: gradient("#c2efff", "#f0dfff", "#c7f3e7"),
      login: gradient("#408eb3", "#8e88bc", "#5ca9aa"),
      button: buttonGradient("#55a7c7", "#377caa"),
      heroInk: "#3a7692",
    },
  },
];

// Font pair selection. If you add a new Google Font, also add its stylesheet link
// to index.html (or self-host WOFF2 for PWA offline use).
export const FONTS = [
  {
    id: "original",
    label: "Gốc – Jakarta + DM Sans",
    body: "'DM Sans',sans-serif",
    heading: "'Plus Jakarta Sans',sans-serif",
    brand: "'Plus Jakarta Sans',sans-serif",
  },
  {
    id: "sweet",
    label: "Dễ thương – Coiny + Quicksand",
    body: "'Quicksand',sans-serif",
    heading: "'Quicksand',sans-serif",
    brand: "'Coiny',cursive",
  },
  {
    id: "editorial",
    label: "Nghệ thuật – Bricolage + Be Vietnam Pro",
    body: "'Be Vietnam Pro',sans-serif",
    heading: "'Bricolage Grotesque',sans-serif",
    brand: "'Bricolage Grotesque',sans-serif",
  },
  {
    id: "fashion",
    label: "Thời trang – Fraunces + Be Vietnam Pro",
    body: "'Be Vietnam Pro',sans-serif",
    heading: "'Fraunces',serif",
    brand: "'Fraunces',serif",
  },
  // Decorative faces: NOT APPROVED for Vietnamese headings until font glyph coverage is verified.
  // Only Latin 'PoseXimi' brand uses them; all accented Vietnamese text uses Be Vietnam Pro.
  // A browser font loading audit keeps offline display on safe fallbacks.
  {
    id: "nightshade",
    label: "Huyền ảo – Jim Nightshade",
    body: "'Be Vietnam Pro',sans-serif",
    heading: "'Be Vietnam Pro',cursive",
    brand: "'Jim Nightshade','Be Vietnam Pro',cursive",
  },
  {
    id: "caesar",
    label: "Thần thoại – Caesar Dressing",
    body: "'Be Vietnam Pro',sans-serif",
    heading: "'Be Vietnam Pro',cursive",
    brand: "'Caesar Dressing','Be Vietnam Pro',cursive",
  },
  {
    id: "honk",
    label: "Pop Art – Honk",
    body: "'Be Vietnam Pro',sans-serif",
    heading: "'Be Vietnam Pro',system-ui",
    brand: "'Honk','Be Vietnam Pro',system-ui",
    variation: '"MORF" 15, "SHLN" 50',
  },
  {
    id: "nabla",
    label: "3D – Nabla",
    body: "'Be Vietnam Pro',sans-serif",
    heading: "'Be Vietnam Pro',system-ui",
    brand: "'Nabla','Be Vietnam Pro',system-ui",
    variation: '"EDPT" 100, "EHLT" 12',
  },
  {
    id: "metal",
    label: "Rock – Metal Mania",
    body: "'Be Vietnam Pro',sans-serif",
    heading: "'Be Vietnam Pro',cursive",
    brand: "'Metal Mania','Be Vietnam Pro',cursive",
  },
];

const TOKEN_NAMES = {
  accent: "--accent",
  accentStrong: "--accent-strong",
  surface: "--surface",
  surfaceSoft: "--surface-soft",
  page: "--page",
  text: "--text-main",
  textSoft: "--text-soft",
  stroke: "--stroke",
  hero: "--hero-gradient",
  login: "--login-gradient",
  button: "--button-gradient",
  heroInk: "--hero-ink",
};
const KEY = "poseximi-appearance-v1";
const pick = (items, id) => items.find((item) => item.id === id) || items[0];

export function getAppearance() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      palette: pick(PALETTES, value.palette).id,
      font: pick(FONTS, value.font).id,
    };
  } catch {
    return { palette: "rose", font: "original" };
  }
}
/** Persist settings and atomically update all CSS tokens, without touching layout. */
export function setAppearance(choice) {
  const previous = getAppearance();
  const palette = pick(PALETTES, choice.palette ?? previous.palette);
  const font = pick(FONTS, choice.font ?? previous.font);
  const html = document.documentElement;
  html.dataset.palette = palette.id;
  html.dataset.font = font.id;
  // Match the mobile/PWA status bar to the active palette.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", palette.tokens.page);
  for (const [name, varName] of Object.entries(TOKEN_NAMES))
    html.style.setProperty(varName, palette.tokens[name]);
  html.style.setProperty("--font-body", font.body);
  html.style.setProperty("--font-heading", font.heading);
  html.style.setProperty("--font-brand", font.brand);
  // Display-only variable font axes (Honk/Nabla); default fonts use normal.
  html.style.setProperty(
    "--font-display-variation",
    font.variation || "normal",
  );
  localStorage.setItem(
    KEY,
    JSON.stringify({ palette: palette.id, font: font.id }),
  );
  return { palette: palette.id, font: font.id };
}
export function initAppearance() {
  return setAppearance(getAppearance());
}
