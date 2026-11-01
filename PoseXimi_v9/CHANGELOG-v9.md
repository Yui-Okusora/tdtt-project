# PoseXimi_v9 — UI/UX Refactor (01/11/2026)

## P0
- Bỏ sidebar hover/ẩn, thay bằng bottom navigation 3 tab.
- Home refactor thành wizard 3 bước, phần lựa chọn Style sử dụng ảnh thật từ các ảnh hướng dẫn trong dự án.
- Màn hình Camera toàn viewport, nút chụp chính ở đáy, hẹn giờ 0/3/5/10 giây, grid, hướng dẫn pose SVG và điều khiển opacity.
- Camera tự ẩn bộ điều khiển phụ tại thời điểm capture, vẫn giữ hỗ trợ đổi camera, zoom phần cứng và tải ảnh.

## P1
- Tạo component BaseCard, PrimaryButton, MainLayout, CreateSessionWizard, PoseCarousel, PoseDetailModal, CameraScreen.
- Kho pose dùng carousel scroll-snap, detail xem toàn màn hình, CTA capture sticky.
- Design System Be Vietnam Pro + Bricolage Grotesque, đồng nhất Tabler icon SVG 22/2, giảm gradient, bóng đổ và card lồng nhau.
- Chỉ có một font body và một font heading trên app; hệ thống tùy chỉnh còn bảng màu.
- PWA được cập nhật cache.

## Không thay đổi
- Auth, IndexedDB gallery, mô hình preset pose và các API AI tùy chọn.

## Chưa giải quyết trong lần refactor này
- AI ghép ảnh/đánh giá pose thật, phân tách thư viện theo tài khoản, backend đăng ký đồng thời và kiểm thử thiết bị thật.
