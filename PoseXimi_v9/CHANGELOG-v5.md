# PoseXimi v5 — sửa tính năng đổi palette/font

## Chẩn đoán

`renderAppearancePicker()` tại `js/views/appearance-picker.js` có 2 biến chưa khai báo (`ornate`, `unsupported`). Khi nhấn nút **◐ Giao diện**, trình duyệt ném `ReferenceError: ornate is not defined` và không render modal.

## Sửa

- Khai báo/đánh giá trạng thái font đang chọn ngay khi tạo menu; fallback an toàn nếu id cũ không hợp lệ.
- Không render lại menu ngay giữa lúc người dùng đang mở dropdown mà tiến trình kiểm tra font bất đồng bộ kết thúc.
- Tăng cache service worker, app version và manifest lên v5. Không sửa ảnh, bố cục, palette, tính năng AI hay backend.

## Kiểm tra thủ công

`node server.mjs` → mở `http://localhost:5500` → Đăng nhập với tư cách khách → Giao diện → đổi palette (ví dụ Ocean Breeze) → đổi font (Sweet) → đóng và mở menu, reload trang để xác nhận cấu hình được lưu.
