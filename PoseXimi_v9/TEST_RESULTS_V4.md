# PoseXimi v4 — Kiểm thử và giới hạn

Ngày kiểm tra: 31/10/2026.

## Đã kiểm tra bằng công cụ
- Toàn bộ file `.js` và `server.mjs` qua `node --check`.
- 12 tổ hợp Hướng dẫn nhanh: 3 style × 4 số người; mỗi tổ hợp trả đúng 1 ảnh và không trả thumbnail của nhóm khác.
- 17 tên icon Tabler do người dùng yêu cầu đều có SVG dự phòng theo tên và lớp webfont.
- 19 palette và 9 bộ font; 5 font trang trí không tác động vào body/heading tiếng Việt.
- 18 stylesheet CSS không có lỗi cú pháp mức stylesheet (tinycss2).
- 68 tài nguyên PWA trong service-worker đều tồn tại trong gói.
- Node HTTP server phục vụ được `index.html`, `assets/poseximi-logo.png` và `js/icons.js` (HTTP 200).
- Logo và các icon PWA là PNG hợp lệ, kích thước đúng 192px / 512px.

## Chưa xác nhận trực tiếp
- Tương tác hiển thị trên Chromium tự động: môi trường kiểm thử trả `net::ERR_BLOCKED_BY_ADMINISTRATOR` khi truy cập localhost. Không coi là đã hoàn tất UI automation.
- Tabler webfont chính thức và Google Fonts: không thể kiểm tra tải trực tuyến trong môi trường hiện tại; dùng SVG / system-font fallback.
- Camera/PWA trên điện thoại thật và backend ghép ảnh AI chưa được kiểm thử ở thiết bị thực.

## Font safety
Việc tải được font chưa đủ để kết luận có mọi dấu tiếng Việt. Vì vậy Jim Nightshade, Caesar Dressing, Honk, Nabla, Metal Mania chỉ dùng cho chuỗi thương hiệu Latin `PoseXimi`; chữ tiếng Việt chuyển sang `Be Vietnam Pro` hoặc sans-serif. Các font trang trí không tải được sẽ bị khóa lựa chọn trong menu.
