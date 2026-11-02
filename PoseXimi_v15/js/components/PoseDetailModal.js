/** Full-viewport detail with a sticky capture CTA. */
import { state, poseList } from "../state.js";
import { poseSVG } from "../art.js";
import { iconMarkup } from "../icons.js";
import { safe } from "../ui.js";
import { PrimaryButton } from "./primitives.js";
export function PoseDetailModal(id) {
  const pose = poseList().find((item) => item.id === id);
  if (!pose) return "";
  return `<div class="px-detail-head"><div><span class="px-kicker">TƯ THẾ BẠN ĐANG XEM</span><h2>${safe(pose.title)}</h2><p>${state.people} người · ${safe(state.style)}</p></div></div>
 <div class="px-detail-art">${poseSVG(state.people, pose.variant, state.background, state.style)}</div>
 <p class="px-detail-tip">${iconMarkup("sparkles")}Quan sát vị trí tay, chân và khoảng cách giữa mọi người. Bạn có thể chỉnh khi chụp.</p>
 <button type="button" class="px-detail-ai-action" data-action="preview-pose" data-id="${safe(id)}">${iconMarkup("eye-spark")} Thử xem trước với ảnh của tôi</button>
 <div class="px-detail-sticky">${PrimaryButton({ label: "Chụp với pose này", action: "select-pose", attrs: `data-id="${safe(id)}"`, icon: "camera" })}</div>`;
}
