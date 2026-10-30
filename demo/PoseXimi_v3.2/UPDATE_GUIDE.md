# PoseXimi — áp dụng vào repo tdtt-project

Nguồn tham khảo: `https://github.com/Yui-Okusora/tdtt-project.git` (thư mục `PoseXimi_v3.1`).

## Cách áp dụng không làm mất git history

1. Trong VS Code, mở terminal tại repo hiện có và chạy `git status` để kiểm tra thay đổi chưa commit.
2. Nếu có thay đổi quan trọng, commit/stash trước khi chép đè.
3. Giải nén **PoseXimi_GitHub_Update_Auth_Retake_Themes.zip** vào thư mục gốc của repo, sao cho các đường dẫn bắt đầu bằng `PoseXimi_v3.1/`.
4. Kiểm tra `git diff` trước khi commit. Không thay đổi thư mục `data/` của repo.
5. `cd PoseXimi_v3.1 && node server.mjs` rồi mở `http://localhost:5500`.

## Thay đổi chính

- `index.html`: thêm màn hình **Đăng ký (Sign up)**, bỏ khung điều kiện khỏi Log in, có nút tùy chỉnh giao diện.
- `js/app.js`: xác thực API, xử lý form Sign up, Retake coaching và menu palette/font.
- `js/services/auth.js`: client cho API auth.
- `server.mjs`: backend local, quản lý username/email/hash mật khẩu, session cookie HttpOnly.
- `js/services/pose-feedback.js`: gợi ý theo pose/số người/style khi chọn Retake.
- `css/appearance.css` và `js/services/appearance.js`: các theme và bộ font có thể đổi trong app.
- `css/signup.css`: form và hộp thoại bổ sung, không đổi layout gốc.
- `js/views/home.js`: giữ biến thể Hướng dẫn nhanh cho mobile theo repo.
- `sw.js`: cache các file mới, không cache API.

### Cấu hình thêm palette và font mới

Để đổi cho người dùng ngay lập tức: sau khi vào studio, nhấn **◐ Giao diện**, chọn palette và font.
Tùy chọn được lưu tại `localStorage`, không yêu cầu sửa HTML hay từng trang.

Để tạo theme mới bằng mã nguồn:
1. Chỉ cần mở `js/services/appearance.js`, thêm một phần tử vào `PALETTES` với `id`, `label`, `swatches`, `tokens`.
2. Thêm bộ font mới trong cùng file tại `FONTS` bằng `body`, `heading`, `brand`.
3. Nếu đó là một font chưa tải, thêm font tự host hoặc link font vào `index.html`.
4. Tăng `VERSION` trong `sw.js` khi phát hành PWA để điện thoại nhận phiên bản mới.

Các CSS như `css/appearance.css` chỉ áp dụng biến màu và font cho component chung, không cần sửa khi thêm palette mới.

## Quan trọng

- `Sign in` và `Log in` đồng nghĩa. Theo luồng có nút **Đăng ký**, tính năng đã được xây thành **Sign up (Đăng ký)** để đặt điều kiện mật khẩu. Log in chỉ hỏi tài khoản/mật khẩu và xác minh với máy chủ.
- Mã server dành cho local demo. Không triển khai công khai khi chưa có HTTPS, database production, kiểm tra email, reset password, kiểm soát session/rate limits đầy đủ.
- `AI` phân tích ảnh/tạo pose thực tế vẫn cần backend riêng. Gợi ý Retake hiện là nội dung theo pose mẫu, không phân tích ảnh đã chụp.
- `.local-data` có mật khẩu dưới dạng hash và bị `.gitignore` loại trừ; không chia sẻ file này.
- Nếu đang có PWA cũ, reload trang và cập nhật Service Worker tại DevTools → Application → Service Workers khi cần.
