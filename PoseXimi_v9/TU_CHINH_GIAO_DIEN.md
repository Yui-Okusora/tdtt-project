# Tự chỉnh tên, mô tả và ghi chú trong PoseXimi

## 1. Thẻ pose

Mở `js/views/poses.js`. Mỗi ảnh được render trong một thẻ `<article class="pose-card">`.

- `poseSVG(...)`: ảnh minh họa.
- `pose-actions`: nhóm nút.
- `data-action="preview-pose"`: xem trước bằng ảnh người dùng.
- `data-action="select-pose"`: chọn tư thế.

Bản v7 đã **không còn** các dòng hiển thị `<h3>${safe(pose.title)}</h3>` hoặc `<p>${safe(pose.description)}</p>` hay nhãn TOP/MORE trên thẻ. **Không xóa `pose.title` ở dữ liệu** vì phần camera, ảnh lưu và ARIA vẫn dùng.

Muốn đổi chữ trên nút, chỉ sửa nội dung giữa thẻ `<button>...</button>`, giữ nguyên `data-action` và `data-id`.

Muốn đổi khoảng cách, mở `css/poses.css` và tìm `.pose-meta` hoặc `.pose-actions`.

## 2. Ghi chú kỹ thuật

Nhấn `Ctrl + Shift + F` trong VS Code để tìm tất cả file theo các từ `backend`, `frontend`, `demo`, `preview-caveat`, `muted`, `pose-meta`.

Các vị trí từng chứa ghi chú UI đã bỏ trong v7:

- `index.html`: ghi chú dưới form Log in / Sign up.
- `js/views/home.js`: ghi chú kiểm tra ảnh ở khu vực upload.
- `js/views/poses.js`: thông báo xếp hạng từ backend.
- `js/views/capture.js`: dòng giải thích gợi ý chụp lại.
- `js/app.js`: thông báo ở popup xem trước và đặt lại mật khẩu.

**Đừng xóa code gọi API** trong `js/services/ai.js`, `js/services/auth.js`, hàm trong `js/app.js`, hoặc chú thích kỹ thuật nếu chỉ muốn ẩn chữ trên trang web. Nếu một chức năng chưa triển khai, hãy giữ trạng thái xử lý lỗi thực tế, đừng báo thành công giả.

## 3. Xem lại thay đổi

Mở Terminal ở thư mục `PoseXimi_v7` và chạy:

```bash
node server.mjs
```

Mở `http://localhost:5500`, chọn một style và tải đủ ảnh để vào Kho tư thế.

Nếu trang vẫn hiển thị chữ cũ, nhấn `Ctrl + Shift + R`. Với PWA đã cài, mở DevTools → Application → Service Workers → **Update** và tải lại. **Không dùng Clear site data** nếu đang lưu ảnh trong thư viện.

Khi muốn đổi chữ bằng cách an toàn, nên sao lưu trước hoặc `git commit` rồi mới chỉnh.
