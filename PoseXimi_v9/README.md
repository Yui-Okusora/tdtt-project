# PoseXimi_v9 — Korean Photobooth × Editorial Studio

Refactor tiếp tục trực tiếp từ PoseXimi_v8. Source **vanilla HTML/CSS/ES Modules + Node.js server + PWA**, không bắt buộc React và không cần bước build. Không thay thế dữ liệu thư viện ảnh đang có trong trình duyệt khi chỉ cập nhật file.

## Chạy local bằng VS Code

1. Giải nén `PoseXimi_v9_Full_Source.zip`, mở thư mục `PoseXimi_v9` bằng VS Code.
2. Yêu cầu Node.js **18+**; trong Terminal chạy:

   ```bash
   node server.mjs
   ```

3. Mở `http://localhost:5500`. Để trải nghiệm khách, bấm **Trải nghiệm với tư cách khách**.
4. Xem giả lập mobile: Chrome DevTools (`F12` → `Ctrl+Shift+M`) → 390 × 844.
5. Camera chỉ hoạt động ở secure context (HTTPS hoặc localhost) và cần người dùng cấp quyền. Trên điện thoại thật dùng URL **HTTPS**, không dùng HTTP qua địa chỉ IP LAN.

## Luồng người dùng (P0)

- **Trang chủ:** wizard 3 bước (1. số người, 2. style bằng ảnh, 3. background và ảnh toàn thân). CTA `Gợi ý tư thế` chỉ sáng khi có đủ hai ảnh.
- **Kho pose:** cho phép điều hướng đến dù chưa có ảnh; khi chưa cấu hình hiển thị empty state + nút tạo buổi chụp. Sau đó hiển thị 3 pose ban đầu, mở rộng 6. Cuộn ngang/ vuốt bằng CSS scroll-snap, có nút điều hướng và full-screen detail modal. CTA `Chụp với pose này` luôn cố định ở đáy modal.
- **Camera:** full viewport trên desktop/mobile, nút thao tác ở đáy; camera trước/sau, hẹn giờ tắt/3/5/10s, bật/tắt lưới, pose guide nét vẽ + opacity slider; zoom theo phần cứng nếu được hỗ trợ; upload ảnh dự phòng. Các controls phụ được ẩn ngay lúc chụp. Pose overlay không bị ghi lên ảnh cuối.
- **Kết quả & Thư viện:** tái sử dụng logic Retake/Approve, IndexedDB, lọc/xóa/tải ảnh đã có từ v8.
- **Điều hướng:** `MainLayout` có đúng ba tab cố định `Trang chủ`, `Kho pose`, `Thư viện`. Camera là màn hình độc lập chiếm toàn bộ viewfinder.

## Kiến trúc module

```text
index.html                    # Auth, app shell, bottom-nav slot
css/design-tokens.css        # Semantic color/typography/radius/spacing tokens
css/ui-components-v9.css     # BaseCard, PrimaryButton, buttons, icon rules
css/experience-v9.css        # Home wizard, poses, modal, full-screen camera, responsive
js/design-system/tokens.js   # JS design tokens and camera timer presets
js/components/primitives.js  # BaseCard, PrimaryButton, TextButton
js/components/MainLayout.js
js/components/CreateSessionWizard.js
js/components/PoseCarousel.js
js/components/PoseDetailModal.js
js/components/PoseGuideOverlay.js
js/components/CameraScreen.js
js/app.js                   # Routing, event delegation, auth, uploads, camera lifecycle
js/state.js                 # Shared user/session/wizard/camera state
js/services/*               # Auth, camera, upload, appearance, storage, optional AI
manifest.webmanifest, sw.js # PWA
```

## Design System

- **Body:** `Be Vietnam Pro` (tiếng Việt), fallback Arial.
- **Display:** `Bricolage Grotesque`, fallback Be Vietnam Pro.
- **Icon:** Tabler, khung 22px, 2px stroke; SVG fallback offline.
- **Palette:** `js/services/appearance.js` quản lý màu CSS toàn app. Font đã **khóa ở một cặp** để tránh trộn nhiều font hoặc lỗi dấu. Màu gradient chỉ ưu tiên CTA/active, không dùng khung nhiều tầng.
- **Design components:** 24px radius card, 48px action button, spacing 8/12/16/24/32/48px. Hỗ trợ `prefers-reduced-motion`, safe area mobile và focus-visible.

## Backend/AI — giới hạn rõ ràng

Backend Node local đang phục vụ login/signup và session cookie. Kho pose hiện sử dụng các **pose preset có sẵn**; API ranking hoặc ghép ảnh AI (`/api/pose-suggestions`, `/api/pose-preview`) là tùy chọn và **chưa có backend AI hoạt động trong source**. Full-screen modal hoạt động bằng hình mẫu SVG offline. Lớp pose nét vẽ chỉ là hướng dẫn hình học, không phải skeleton từ máy học.

**Không deploy backend xác thực này cho người dùng thật khi chưa xử lý các vấn đề đã xác định từ bản v6:** tách ảnh theo tài khoản, đồng bộ/truy cập ảnh trên server và ghi danh sách tài khoản an toàn khi đăng ký đồng thời. IndexedDB hiện lưu ảnh cục bộ trên trình duyệt.

## PWA và cache

Service worker cache được đổi sang `poseximi-v9-design-20261101` và thêm tất cả module mới. Nếu app vẫn mở mã cũ: Chrome DevTools → **Application → Service Workers → Update**, rồi reload. Không dùng `Clear site data` nếu muốn giữ ảnh đã lưu. Google Fonts cần kết nối mạng trong lần tải đầu; fallback hệ thống luôn có sẵn.

## Kiểm thử

Chạy `node tests/render-smoke.mjs` và `node tests/asset-check.mjs`. Xem `TEST_RESULTS_V9.md`. Đã kiểm tra cú pháp tất cả JS, CSS, 81 tài nguyên PWA và 15 bài kiểm tra render của component; browser chặn điều hướng local nên **chưa xác nhận end-to-end với camera thật/thiết bị thật**.
