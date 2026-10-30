# PoseXimi UI Refinements — 30/10/2026

Giữ nguyên bố cục và luồng của PoseXimi_v3.1; điều chỉnh có phạm vi.

1. Sign up: chỉ hiển thị lỗi dấu ✕, viền đỏ và lời nhắc sau `blur` hoặc khi nhấn Tạo tài khoản nhưng chưa hợp lệ. Trong khi gõ, trạng thái lỗi của ô đó về trung tính; khi rời ô, kiểm tra lại. Các rule khác vẫn có trạng thái trung tính/đúng tương ứng. Sign in/Log in giữ nguyên cơ chế xác thực backend.
2. Retake: khi nhấn Chụp lại ở trang Result, các gợi ý theo pose được giữ trong state và gắn ngay bên dưới thanh công cụ camera; có thể tắt bằng nút ×. Tự ẩn sau khi chụp hoặc tải ảnh mới; không giả là AI phân tích ảnh.
3. Theme: mở Tùy chỉnh giao diện để thấy các ô màu gradient và xem trước font ngay bên trong menu. Thêm Ocean Breeze, Sunset Sorbet, Aurora Mint, Berry Galaxy và Cocoa Latte (cộng với 4 palette cũ). Theme tiếp tục sử dụng `js/services/appearance.js` và các CSS variables, không đổi layout.
4. Style: thay 3 biểu tượng Casual, Fashion, JoJo bằng ảnh do người dùng cung cấp, được crop bỏ viền screenshot và xuất thành PNG nền trong suốt.
5. PWA: service worker tăng version cache, thêm file CSS/JS và 3 biểu tượng mới.

## Chạy

```bash
cd PoseXimi_v3.1
node server.mjs
```

Mở http://localhost:5500. Nếu thấy bản cũ, vào Chrome DevTools > Application > Service Workers > Update, sau đó reload.

**Ghi chú**: Bản build tiếp tục dùng Node.js API local đăng ký/đăng nhập đã có trong bản repo zip trước đó. Chưa ghi đè GitHub remote.
