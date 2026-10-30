# PoseXimi_v3.1 — PWA Frontend

**Phiên bản:** `PoseXimi_v3.1` · Dự án frontend HTML + CSS + JavaScript ES Modules, không cần npm hoặc build. Giao diện sử dụng bảng màu kem–hồng phấn–đỏ mận từ PoseLab PWA v3.

## Các điểm mới của 3.1

- Đổi tên toàn bộ ứng dụng thành **PoseXimi** (Login, navbar, modal, icon cài đặt PWA, manifest, nội dung giao diện). Logo vẫn lấy **chữ P** làm trọng tâm.
- **Xóa “AI nâng cao”** và toàn bộ các thẻ workspace từng nằm trong **body Home**.
- Mục **02. Tư thế gợi ý** ở trang chủ được thay bằng **02. Hướng dẫn nhanh** (phần Hướng dẫn nhanh lấy lại từ bản v3). Người dùng vẫn được xem 3 tư thế + “Xem thêm” ở **Kho tư thế** sau khi đã tải đủ hai ảnh và nhấn nút cuối trang.
- **Workspace sidebar ẩn mặc định.** Desktop: rê chuột tới mép trái hoặc bấm **☰** để mở; khi không hover, menu thu về mép trái. Dùng **☰** để mở giữ menu và bấm ngoài để đóng. Mobile/PWA: bấm **☰** để bật menu dạng drawer; không còn thanh workspace cố định ở đáy màn hình. Menu khóa hiển thị icon **🔒** trước khi hoàn thành bước liên quan.
- **Camera:** giữ camera lớn; có **thẻ pose tham khảo nhỏ NẰM TRONG camera**, có nút **Ẩn/Hiện pose mẫu**. Vẫn hỗ trợ camera trước/sau, zoom phần cứng nếu thiết bị hỗ trợ, chụp hoặc tải ảnh. **Không** quay lại layout có cột template bên cạnh.
- Vẫn giữ duy nhất nút **“Gợi ý tư thế”** ở cuối Home để đi từ cấu hình tới kho pose.

## 1. Chạy local với VS Code

1. Giải nén `PoseXimi_GitHub_Update_Auth_Retake_Themes.zip` rồi **File → Open Folder → PoseXimi_v3.1**.
2. **Terminal → New Terminal** và chạy:

   ```powershell
   node server.mjs
   ```

   Trên Windows, macOS hoặc Linux đều dùng Node.js 20+; `python -m http.server` không có API đăng nhập.
3. Mở **http://localhost:5500/**; không mở file bằng `file://`.
4. Chọn **Đăng ký (Sign up)** để tạo tài khoản thực trong backend local; dùng **Log in** để đăng nhập hoặc **Khách** để xem thử.

## 2. Xem PWA trên màn hình điện thoại ở VS Code

- **F12 → Ctrl+Shift+M** (Chrome DevTools), chọn iPhone hoặc Pixel; có thể dùng kích thước tùy chỉnh `390 × 844`.
- Hoặc VS Code **Run and Debug → PoseXimi – Chrome mobile preview** (file `.vscode/launch.json`). Nếu mở từ VS Code, bật **Toggle device toolbar** bằng Ctrl+Shift+M.
- Trong PWA trên điện thoại, menu workspace ẩn mặc định: chạm **☰** tại đầu trang để mở. Nhấn nền ngoài hoặc chọn trang để đóng.
- **Trên điện thoại thật**: cần **HTTPS** để dùng camera và cài PWA đúng cách (truy cập IP LAN qua HTTP thông thường không đủ). Máy tính local tại `http://localhost` dùng được service worker và camera nếu có quyền.

## 3. Luồng chính

1. Login / Khách → Home.
2. Home hiển thị theo thứ tự: **01 Số người → 02 Hướng dẫn nhanh → 03 Style → 04 Upload background → 05 Upload ảnh toàn thân cả nhóm**.
3. Giới hạn ảnh đầu vào: JPEG/PNG/WebP/AVIF, tối đa **10 MB**, cạnh ngắn tối thiểu **480 px**, tự thu nhỏ về giới hạn 1080p (cạnh ngắn ≤1080 px, cạnh dài ≤1920 px). Frontend **không tự xác minh** có đủ toàn thân mọi người; backend AI phải thực hiện bước đó nếu cần.
4. Nhấn **Gợi ý tư thế** ở CUỐI trang Home → Kho pose: 3 mẫu đầu và nút **Xem thêm**.
5. **Xem trước với ảnh của tôi** → gọi `POST /api/pose-preview`. Trong khi chờ có loading và nút hủy; chưa có backend sẽ hiện lỗi thật, **không tạo ảnh AI giả**.
6. **Chọn pose** → Camera lớn kèm thumbnail pose nổi; có thể ẩn/hiện thumbnail, đổi camera, zoom nếu hỗ trợ, chụp/tải ảnh.
7. **Kết quả** → Retake / Approve → Thư viện cục bộ; có xem, tải về, xóa.

## 4. Cấu trúc mã nguồn

```text
PoseXimi_v3.1/
├── index.html              # Login, sidebar/drawer, header và root của các view
├── manifest.webmanifest    # Tên PWA PoseXimi, icon chữ P
├── sw.js                   # Cache giao diện để sử dụng offline
├── assets/                 # Logo P, favicon, app icons
├── css/
│   ├── base.css, auth.css, layout.css, home.css, poses.css
│   ├── camera.css, library.css, utilities.css, responsive.css
│   ├── theme.css, pwa.css, enhancements.css
│   └── v31.css             # MỚI: drawer, Hướng dẫn nhanh, PiP camera, mobile
├── js/
│   ├── app.js              # Routing, sự kiện menu, upload, camera, thư viện
│   ├── state.js            # Dữ liệu giao diện, quyền truy cập, bật/tắt pose nổi
│   ├── data.js, ui.js, art.js, pwa.js
│   ├── views/
│   │   ├── home.js         # 5 bước ở trang chủ, duy nhất 1 nút chuyển tiếp
│   │   ├── poses.js        # Danh sách pose / preview
│   │   ├── capture.js      # Camera + thumbnail pose nổi
│   │   ├── result.js, library.js, shared.js
│   └── services/
│       ├── ai.js           # Các endpoint backend cần tích hợp
│       ├── camera.js       # getUserMedia, đổi lens, zoom
│       ├── images.js       # Kiểm tra dung lượng và độ phân giải
│       └── storage.js      # IndexedDB local
└── .vscode/launch.json     # Chrome debugging
```

Mỗi file có comment nhận diện phần giao diện, sự kiện và logic xử lý. Các file cũ được giữ nguyên phần lớn để tránh thay đổi layout không cần thiết; thay đổi v3.1 tập trung trong `css/v31.css`, `js/views/home.js`, `js/views/capture.js`, `js/app.js`, `js/state.js`, PWA metadata.

## 5. Xóa cache khi nâng cấp từ v3 (quan trọng)

`sw.js` dùng cache key `poseximi-pwa-auth-theme-20261030` và xóa cache app shell của PoseLab cũ khi activate. Nếu giao diện vẫn là bản cũ:

1. Chrome DevTools → **Application → Service Workers** → chọn **Update** / **Unregister** nếu cần.
2. **Application → Storage → Clear site data** nếu vẫn bị cache cũ. **Cảnh báo: thao tác này có thể xóa ảnh đã duyệt trong IndexedDB**; hãy tải ảnh xuống trước!
3. Reload mạnh bằng **Ctrl+Shift+R** và mở lại.

## 6. Backend AI cần bổ sung

Các API giữ nguyên như v3:

- `POST /api/pose-suggestions`: đầu vào `peopleCount`, `style`, `backgroundImage`, `peopleImage`; kết quả `{ "poseIds": ["duo-side", "duo-mirror", ...] }`. Khi chưa kết nối, frontend hiện preset được gắn nhãn mẫu.
- `POST /api/pose-preview`: đầu vào `{ "poseId": "duo-side", "peopleCount": 2, "style": "Casual", "backgroundImage": "data:...", "peopleImage": "data:..." }`; kết quả `{ "imageUrl": "https://..." }` hoặc `imageBase64`.

**Giới hạn demo:** PWA có backend đăng ký/đăng nhập local, nhưng chưa có xác thực sẵn sàng production; AI ghép ảnh và nhận diện toàn thân vẫn cần backend. Album chỉ lưu trên thiết bị, không có đồng bộ tài khoản. Ảnh được tải/chụp và duyệt trong trình duyệt có thể mất khi xóa dữ liệu web.


## Bản cập nhật ngày 30/10/2026 — Đăng ký, chỉnh pose và đổi theme

- **Đăng ký (Sign up):** màn hình riêng; kiểm tra tên người dùng, email, mật khẩu ít nhất 8 ký tự, 1 chữ hoa và xác nhận khớp. Trùng tên/email được backend kiểm tra.
- **Đăng nhập (Log in):** không còn hộp điều kiện mật khẩu; kiểm tra tài khoản/mật khẩu thực sự qua API.
- **Retake:** hiển thị hộp gợi ý chỉnh dáng theo pose đã chọn trước khi quay lại camera. Chưa phải phân tích ảnh AI.
- **Đổi màu và font:** trong studio chọn nút **◐ Giao diện**. Đổi bảng màu và cặp font trong **một file** `js/services/appearance.js`; `css/appearance.css` chỉ chứa các quy tắc áp dụng chung lên component.

### Chạy với backend local xác thực tài khoản

Cài Node.js 20+, chạy ngay tại thư mục chứa `index.html`:

```bash
node server.mjs
```

Mở `http://localhost:5500`. **Không dùng `python -m http.server` khi kiểm thử đăng ký/đăng nhập**: server Python tĩnh không có `/api/auth/*`.

Tài khoản đăng ký được lưu trong `.local-data/users.json` với password hash `scrypt` có salt; không commit dữ liệu này. Session in-memory và cookie HttpOnly, phục vụ demo/local, chưa có chức năng email verification/reset, quản trị phiên tập trung hoặc HTTPS production. Thử ở thiết bị điện thoại thực cần HTTPS (hoặc một môi trường local secure context hợp lệ).

Chỉ trang **Đăng ký** kiểm tra quy tắc tạo mật khẩu. Đăng nhập vẫn cần backend đối chiếu mật khẩu, nhưng không bắt người dùng vượt lại các tiêu chí mật khẩu khi gõ.

### Đổi palette và font nhanh (chỉ sửa một file)

Mở `js/services/appearance.js` và thêm một đối tượng vào `PALETTES` gồm `id`, `label`, `swatches` và `tokens`; các biến CSS tự gán cho tất cả màn hình. Thêm cặp font vào `FONTS` bằng các thuộc tính `body`, `heading`, `brand`. Khi font mới chưa có trong Google Fonts đã link trong `index.html`, thêm một lần đường dẫn font WOFF2 hoặc stylesheet tương ứng.

Các preset có sẵn: Rose Cream, Dreamy Lilac, Matcha Studio, Apricot Pop; cùng bốn cặp font Original, Sweet, Editorial và Fashion. Nút **◐ Giao diện** trong thanh trên mở công cụ chuyển theme ngay lập tức và lưu lựa chọn localStorage.
