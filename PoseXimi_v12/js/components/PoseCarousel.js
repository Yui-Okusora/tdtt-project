/** Swipe-enabled pose explorer. Browser scrolling supplies native touch momentum. */
import { state, poseList, inputsReady } from "../state.js";
import { poseSVG } from "../art.js";
import { iconMarkup } from "../icons.js";
import { safe } from "../ui.js";
import { PrimaryButton } from "./primitives.js";
export function PoseCarousel() {
  if (!inputsReady() || !state.recommendationsReady) {
    return `<section class="px-pose-empty"><div class="px-empty-symbol">${iconMarkup("sparkles")}</div><p class="px-kicker">KHO POSE</p><h1>Ý tưởng đang chờ bạn.</h1><p>Hoàn thành ba bước tạo buổi chụp để xem tư thế phù hợp với nhóm.</p>${PrimaryButton({ label: "Tạo buổi chụp", action: "start-wizard" })}</section>`;
  }
  const shown = poseList().slice(0, 6); // 6 choices = 2 desktop pages × 3 cards.
  state.poseIndex = Math.min(
    Math.max(0, state.poseIndex || 0),
    shown.length - 1,
  );
  return `<section class="px-pose-page"><div class="px-pose-heading"><div><p class="px-kicker">POSE DISCOVERY</p><h1>Chọn một tư thế.<br><em>Để khoảnh khắc lên tiếng.</em></h1><p>${state.people} người · ${safe(state.style)} · Vuốt ngang để khám phá</p></div><button class="px-icon-button px-reset-session" type="button" data-action="start-wizard" aria-label="Thay đổi cấu hình">${iconMarkup("arrow-badge-left")}</button></div>
 <div class="px-carousel-row"><button type="button" class="px-carousel-arrow" data-action="carousel-prev" aria-label="Pose trước">${iconMarkup("arrow-badge-left")}</button>
 <div class="px-pose-track" id="poseCarouselTrack" tabindex="0" aria-label="Danh sách mẫu pose, có thể cuộn ngang">${shown
   .map(
     (
       pose,
       i,
     ) => `<article class="px-carousel-card ${i === state.poseIndex ? "is-featured" : ""}" data-pose-index="${i}">
  <button type="button" class="px-pose-photo" data-action="open-pose-detail" data-id="${safe(pose.id)}" aria-label="Mở xem lớn mẫu ${safe(pose.title)}">${poseSVG(state.people, pose.variant, state.background, state.style)}<span class="px-photo-expand">${iconMarkup("eye-spark")}Xem toàn màn hình</span></button>
  <div class="px-pose-footer"><span>POSE ${String(i + 1).padStart(2, "0")}</span><button type="button" class="px-outline-button" data-action="open-pose-detail" data-id="${safe(pose.id)}">Xem tư thế ${iconMarkup("arrow-badge-right")}</button></div></article>`,
   )
   .join("")}</div>
 <button type="button" class="px-carousel-arrow" data-action="carousel-next" aria-label="Pose sau">${iconMarkup("arrow-badge-right")}</button></div>
 <div class="px-carousel-bottom"><div class="px-carousel-dots px-dots-desktop" aria-label="Hai trang tư thế">${[0, 3].map((start, i) => `<button type="button" class="${Math.floor(state.poseIndex / 3) === i ? "is-active" : ""}" data-action="carousel-to" data-index="${start}" aria-label="Trang ${i + 1} / 2"></button>`).join("")}</div>
 <div class="px-carousel-dots px-dots-mobile" aria-label="Sáu mẫu tư thế">${shown.map((_, i) => `<button type="button" class="${i === state.poseIndex ? "is-active" : ""}" data-action="carousel-to" data-index="${i}" aria-label="Tư thế ${i + 1} / 6"></button>`).join("")}</div>
 <small class="px-carousel-page-number" id="posePageNumber">Trang ${Math.floor(state.poseIndex / 3) + 1} / 2</small></div></section>`;
}
