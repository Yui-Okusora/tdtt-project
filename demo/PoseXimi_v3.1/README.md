# PoseXimi_v3.1 — PWA Frontend

**Phiên bản:** `PoseXimi_v3.1` · Dự án frontend HTML + CSS + JavaScript ES Modules, không cần npm hoặc build. Giao diện sử dụng bảng màu kem–hồng phấn–đỏ mận từ PoseLab PWA v3.

## Các điểm mới của 3.1

- Đổi tên toàn bộ ứng dụng thành **PoseXimi** (Login, navbar, modal, icon cài đặt PWA, manifest, nội dung giao diện). Logo vẫn lấy **chữ P** làm trọng tâm.
- **Xóa “AI nâng cao”** và toàn bộ các thẻ workspace từng nằm trong **body Home**.
- Mục **02. Tư thế gợi ý** ở trang chủ được thay bằng **02. Hướng dẫn nhanh** (4 bước bằng chữ, không còn các ô minh họa pose). Người dùng vẫn được xem 3 tư thế + “Xem thêm” ở **Kho tư thế** sau khi đã tải đủ hai ảnh và nhấn nút cuối trang.
- **Workspace sidebar ẩn mặc định.** Desktop: rê chuột tới mép trái hoặc bấm **☰** để mở; khi không hover, menu thu về mép trái. Dùng **☰** để mở giữ menu và bấm ngoài để đóng. Mobile/PWA: bấm **☰** để bật menu dạng drawer; không còn thanh workspace cố định ở đáy màn hình. Menu khóa hiển thị icon **🔒** trước khi hoàn thành bước liên quan.
- **Camera:** giữ camera lớn; có **thẻ pose tham khảo nhỏ NẰM TRONG camera**, có nút **Ẩn/Hiện pose mẫu**. Vẫn hỗ trợ camera trước/sau, zoom phần cứng nếu thiết bị hỗ trợ, chụp hoặc tải ảnh. **Không** quay lại layout có cột template bên cạnh.
- Vẫn giữ duy nhất nút **“Gợi ý tư thế”** ở cuối Home để đi từ cấu hình tới kho pose.

## 1. Chạy local với VS Code

1. Giải nén `PoseXimi_v3.1.zip` rồi **File → Open Folder → PoseXimi_v3.1**.
2. **Terminal → New Terminal** và chạy:

   ```powershell
   py -m http.server 5500
   ```

   Trên macOS/Linux hoặc máy đã cài Python, dùng `python3 -m http.server 5500`.

3. Mở trình duyệt tại **http://localhost:5500/**. **Không** mở qua `file://`, vì ES Module và service worker cần web server.
4. Truy cập dưới dạng khách, hoặc dùng Login demo: username ≥3 ký tự, password ≥8 ký tự và ≥1 chữ in hoa. **Chưa có đăng nhập thật**.

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

`sw.js` đã tăng cache key thành `poseximi-pwa-v3.1-20261026` và xóa cache app shell của PoseLab cũ khi activate. Nếu giao diện vẫn là bản cũ:

1. Chrome DevTools → **Application → Service Workers** → chọn **Update** / **Unregister** nếu cần.
2. **Application → Storage → Clear site data** nếu vẫn bị cache cũ. **Cảnh báo: thao tác này có thể xóa ảnh đã duyệt trong IndexedDB**; hãy tải ảnh xuống trước!
3. Reload mạnh bằng **Ctrl+Shift+R** và mở lại.

## 6. Backend AI cần bổ sung

Các API giữ nguyên như v3:

- `POST /api/pose-suggestions`: đầu vào `peopleCount`, `style`, `backgroundImage`, `peopleImage`; kết quả `{ "poseIds": ["duo-side", "duo-mirror", ...] }`. Khi chưa kết nối, frontend hiện preset được gắn nhãn mẫu.
- `POST /api/pose-preview`: đầu vào `{ "poseId": "duo-side", "peopleCount": 2, "style": "Casual", "backgroundImage": "data:...", "peopleImage": "data:..." }`; kết quả `{ "imageUrl": "https://..." }` hoặc `imageBase64`.

**Giới hạn demo:** PWA không có xác thực thật, AI ghép ảnh và nhận diện toàn thân vẫn cần backend. Album chỉ lưu trên thiết bị, không có đồng bộ tài khoản. Ảnh được tải/chụp và duyệt trong trình duyệt có thể mất khi xóa dữ liệu web.
