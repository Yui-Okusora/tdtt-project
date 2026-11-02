/** Bottom navigation is the only persistent app navigation; no hover-only sidebar. */
import { iconMarkup } from "../icons.js";
export const MAIN_TABS = [
  { page: "home", label: "Trang chủ", icon: "home" },
  { page: "poses", label: "Kho pose", icon: "sparkles" },
  { page: "library", label: "Thư viện", icon: "library-photo" },
];
export function MainLayout({ page = "home" } = {}) {
  return MAIN_TABS.map(
    (
      t,
    ) => `<button class="px-tab ${page === t.page ? "is-active" : ""}" type="button" data-page="${t.page}" aria-label="${t.label}" ${page === t.page ? 'aria-current="page"' : ""}>
 ${iconMarkup(t.icon)}<span>${t.label}</span></button>`,
  ).join("");
}
export function mountMainLayout(nav, page) {
  nav.innerHTML = MainLayout({ page });
}
