import { state } from "../state.js";
import { dateDisplay, safe } from "../ui.js";
import { heading, photoGrid } from "./shared.js";
/** Library with loading and empty state; stored in IndexedDB. */
export function renderLibrary() {
  if (state.libraryLoading)
    return `${heading("YOUR LIBRARY", "Thư viện của bạn.", "Đang đọc ảnh đã duyệt.", { progress: false })}<div class="loading-view" role="status"><div class="loading-spinner"></div><strong>Đang tải ảnh…</strong></div>`;
  if (!state.albums.length)
    return `${heading("YOUR LIBRARY", "Thư viện của bạn.", "Ảnh đã duyệt sẽ xuất hiện ở đây.", { progress: false })}<div class="empty-view"><div class="empty-icon">▧</div><h2>Chưa có ảnh nào</h2><p>Bắt đầu bộ ảnh đầu tiên để lưu khoảnh khắc của bạn.</p><button class="btn btn-primary" data-action="back-home" type="button">+ Tạo bộ ảnh mới</button></div>`;
  const filtered = state.albums
    .filter(
      (a) => state.libraryFilter === "all" || a.style === state.libraryFilter,
    )
    .sort((a, b) =>
      state.librarySort === "oldest"
        ? a.createdAt - b.createdAt
        : b.createdAt - a.createdAt,
    );
  const visible = filtered.filter((a) =>
    `${a.title || a.poseTitle || ""} ${a.poseTitle || ""} ${a.style} ${a.people} người`
      .toLocaleLowerCase("vi")
      .includes(state.librarySearch.toLocaleLowerCase("vi")),
  );
  return `${heading("YOUR LIBRARY", "Khoảnh khắc của bạn.", "Xem, tải xuống hoặc xóa ảnh đã lưu trên thiết bị này.", { progress: false })}
 <div class="ux-library-tools">
   <label class="ux-library-search"><span>Tìm ảnh</span><input id="librarySearch" type="search" placeholder="Tìm theo pose, style, số người…" value="${safe(state.librarySearch)}" autocomplete="off" /></label>
   <label><span>Phong cách</span><select id="libraryStyleFilter" aria-label="Lọc theo phong cách">${[
     ["all", "Tất cả"],
     ["Casual", "Casual"],
     ["Fashion", "Fashion"],
     ["JoJo", "JoJo"],
   ]
     .map(
       ([value, label]) =>
         `<option value="${value}" ${state.libraryFilter === value ? "selected" : ""}>${label}</option>`,
     )
     .join("")}</select></label>
   <label><span>Sắp xếp</span><select id="librarySort" aria-label="Sắp xếp ảnh"><option value="newest" ${state.librarySort === "newest" ? "selected" : ""}>Mới nhất</option><option value="oldest" ${state.librarySort === "oldest" ? "selected" : ""}>Cũ nhất</option></select></label>
   <button class="btn btn-soft ux-new-album" data-action="back-home" type="button">+ Bộ ảnh mới</button>
 </div>
 <p class="ux-count-caption" role="status" id="libraryResultCount">${visible.length} / ${state.albums.length} bộ ảnh</p>
 <div class="library-grid">${visible.map((album) => `<article class="album-card" data-album-search="${safe(`${album.title || album.poseTitle || ""} ${album.poseTitle || ""} ${album.style} ${album.people} người`.toLocaleLowerCase("vi"))}">${photoGrid(album.photos, "album-thumbs single")}<div class="album-info"><h3>${safe(album.title || album.poseTitle || "Ảnh chưa đặt tên")}</h3><p>${safe(dateDisplay(album.createdAt))} · ${album.people} người · ${safe(album.style)}</p><div class="album-buttons"><button class="btn btn-soft" data-action="view-album" data-id="${safe(album.id)}">Xem</button><button class="btn btn-outline" data-action="download-album" data-id="${safe(album.id)}">Tải về</button><button class="btn btn-danger" data-action="delete-album" data-id="${safe(album.id)}" aria-label="Xóa bộ ảnh"></button></div></div></article>`).join("")}</div>
 <div id="uxInlineNoMatches" class="ux-no-matches" role="status" ${visible.length ? "hidden" : ""}>Không tìm thấy bộ ảnh phù hợp. Hãy thay bộ lọc hoặc từ khóa.</div>`;
}
