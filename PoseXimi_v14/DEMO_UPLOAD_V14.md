# PoseXimi_v14 — Demo trạng thái hợp lệ/không hợp lệ của ảnh đầu vào

## Mục đích

Bản này sửa **trực tiếp source trong file `tdtt-project-PoseXimi_v1.2.zip`**, cụ thể ứng dụng ở `PoseXimi_v1.0/`. Bản phát hành được đặt tên **PoseXimi_v14** theo lịch sử các phiên bản. Không thay đổi giao diện Camera, Pose Carousel, thư viện, đăng nhập hay backend.

Giảng viên có thể quan sát 2 trường hợp: background phải **không có người**, còn ảnh nhóm phải thấy **đầy đủ toàn thân, đúng số người**.

## Chạy trong VS Code

Mở thư mục chứa `server.mjs`, chạy:

```powershell
node server.mjs
```

Sau đó mở `http://localhost:5500` (không nên mở `file://` để thử PWA và xác thực tài khoản).

Vào ứng dụng bằng tài khoản đã đăng ký hoặc **Trải nghiệm với tư cách khách**. Trên Home: **Số người → Style → Ảnh đầu vào**.

## Cách demo và chụp 4 ảnh báo cáo

Ở bước **Ảnh đầu vào**, phần **Chọn tình huống kiểm tra ảnh** có 5 nút:

| Chế độ | Background | Ảnh nhóm | Khi nào dùng |
| --- | --- | --- | --- |
| Chế độ thường | Kiểm tra kỹ thuật | Kiểm tra kỹ thuật | Khi không demo kết quả nhận diện |
| Cả hai hợp lệ | Ảnh hợp lệ (mô phỏng) | Ảnh hợp lệ (mô phỏng) | Chụp màn hình trạng thái thành công |
| Cả hai lỗi | Background có người (mô phỏng) | Thiếu toàn thân/không đủ người (mô phỏng) | Chụp màn hình 2 lỗi |
| Nền lỗi | Background không hợp lệ | Ảnh nhóm hợp lệ | Chụp lỗi riêng background |
| Ảnh nhóm lỗi | Background hợp lệ | Ảnh nhóm không hợp lệ | Chụp lỗi riêng ảnh nhóm |

1. Chọn một chế độ demo trước hoặc sau khi tải ảnh.
2. Bấm **Tải ảnh** tại **Ảnh background** và **Ảnh của nhóm**. Bạn có thể chọn bất kỳ ảnh mà trình duyệt đọc được, không cần ảnh thật chứa lỗi. Trong chế độ demo, ảnh được thu nhỏ để phục vụ preview; có giới hạn bảo vệ 40 MB cho mỗi file.
3. Trên từng ảnh, ứng dụng hiển thị nhãn **Ảnh hợp lệ** (xanh) hoặc **Ảnh không hợp lệ** (đỏ) cùng lý do và cách khắc phục. Mọi kết quả có nhãn **DEMO**.
4. Chụp màn hình mỗi tình huống để làm báo cáo. Chuyển chế độ ở cùng màn hình để có thêm ảnh mà không phải upload lại.
5. Nếu cả hai ảnh đang được đánh dấu hợp lệ, nút **Gợi ý tư thế** sáng lên. Nếu một ảnh không hợp lệ hoặc thiếu, nút bị khóa.

**Không có checkbox tự đánh giá**: kết quả được xác định theo kịch bản do người trình bày chọn.

## Điều quan trọng về tính trung thực

Chế độ demo **không phân tích pixel, không phát hiện người thật**. Nó cố tình hiển thị kết quả theo kịch bản để minh họa UI/UX, giúp nhóm có ảnh minh họa cho báo cáo. Hãy ghi rõ “Mô phỏng kiểm tra ảnh – chưa tích hợp AI nhận diện” trên slide/demo.

Ở **Chế độ thường**, frontend giữ kiểm tra kỹ thuật cũ: JPG/PNG/WebP/AVIF, tối đa 10 MB, cạnh ngắn tối thiểu 480 px. Đây vẫn **chưa phải** kiểm tra background có người hay nhóm có đủ toàn thân. Nếu muốn kiểm tra nội dung ảnh tự động, cần thêm một API nhận diện/đếm người và phát hiện toàn thân.

Nếu bạn upload ảnh trong chế độ demo rồi chuyển sang Chế độ thường, app yêu cầu **tải lại** ảnh để áp dụng kiểm tra kỹ thuật; không dùng kết quả giả làm kết quả thật.

## File chỉnh sửa

- `js/services/input-photo-demo.js` — 5 kịch bản và quy tắc màu/trạng thái. **File mới**.
- `js/components/CreateSessionWizard.js` — thẻ upload ảnh, thông báo kết quả, nút chọn kịch bản; bỏ nhu cầu checkbox. **File sửa**.
- `js/services/images.js` — giải mã ảnh nhẹ cho chế độ demo, giữ `decodeFile()` cho chế độ thường. **File sửa**.
- `js/state.js` — lưu mode và kết quả kiểm tra kỹ thuật, khóa nút nếu không đạt. **File sửa**.
- `js/app.js` — xử lý chuyển kịch bản, upload/camera ảnh đầu vào, reset trạng thái. **File sửa**.
- `css/upload-demo-v14.css` — màu xanh/đỏ/cảnh báo, responsive. **File mới**.
- `index.html` — nạp CSS mới, nhãn phiên bản. **File sửa**.
- `sw.js` — cache PWA v14 và tài nguyên bổ sung. **File sửa**.
- `tests/v14-demo-upload.mjs` — bài test cho 5 chế độ; chạy `node tests/v14-demo-upload.mjs`. **File mới**.

## Nếu browser vẫn hiển thị code cũ

Mở DevTools → Application → Service Workers → **Update**, sau đó Ctrl + Shift + R. Không chọn Clear site data, vì có thể mất thư viện ảnh lưu trong trình duyệt.

## Lưu ý kiểm thử

Đã chạy kiểm tra cú pháp JavaScript, test logic kịch bản, kiểm tra đường dẫn file PWA và HTTP local. Chromium tự động trong môi trường xây dựng không mở được trang localhost, nên chưa thể xác nhận thao tác nhấp/ảnh thực tế qua trình duyệt. Bạn nên chụp và thử thực tế trên Chrome/VS Code.
