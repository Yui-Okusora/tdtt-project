/** Quick Guide shows exactly one matching image (style + participants).
 * Selecting e.g. Fashion + 3 people shows fashion-3.webp, never other photos.
 */
import { state } from "../state.js";
import { guidePhoto } from "../data/quick-guide.js";
import { safe } from "../ui.js";

const COPY = {
  Casual: "Tạo dáng tự nhiên, giữ toàn thân mọi người trong cùng khung hình.",
  Fashion:
    "Tạo đường nét bằng góc vai, tay và dáng đứng để làm nổi bật trang phục.",
  JoJo: "Chọn tư thế mạnh mẽ, phối hợp tay chân và đội hình rõ nét.",
};
export function renderQuickGuide() {
  const { style, people } = state,
    photo = guidePhoto(style, people);
  return `<section class="content-card pose-preview-card quick-guide-card" aria-label="Hướng dẫn nhanh">
 <div class="card-title-row"><h2>02. Hướng dẫn nhanh</h2><span class="mini-badge">${safe(style)} · ${people} người</span></div>
 ${
   photo
     ? `<figure class="quick-guide-feature quick-guide-single">
   <img src="${photo}" alt="Ảnh gợi ý ${safe(style)} đúng ${people} người" decoding="async" loading="lazy" width="450" height="600" />
   <figcaption>${safe(style)} <span>${people} người</span></figcaption>
 </figure><p class="quick-guide-help">${COPY[style]}</p>`
     : '<div class="quick-guide-empty" role="status">Chọn số người (1–4) và phong cách Casual, Fashion hoặc JoJo để xem ảnh minh họa phù hợp.</div>'
 }
 </section>`;
}
