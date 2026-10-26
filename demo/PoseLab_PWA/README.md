# PoseLab PWA – chạy local và preview trên điện thoại

**Bản nâng cấp từ PoseLab UI v2:** Giữ nguyên layout Login 2 cột trên desktop, sidebar, banner, lưới pose, khu vực chụp 2 phần, Result và Library, giữ palette kem–hồng–đỏ mận. Không cần npm/React.

## 1. Chạy trong VS Code (Windows / macOS / Linux)

1. Giải nén `PoseLab_PWA_Ready.zip` và mở đúng thư mục **PoseLab_PWA** trong VS Code (`File > Open Folder`).
2. Mở **Terminal > New Terminal**; kiểm tra đang đứng trong thư mục có `index.html`.
3. Chạy:
   ```bash
   python -m http.server 5500
   ```
   Nếu Windows báo không có `python`, dùng:
   ```powershell
   py -m http.server 5500
   ```
4. Mở **Chrome / Edge** tại `http://localhost:5500`. KHÔNG mở `index.html` bằng đường dẫn `file:///`.
5. Chọn **Trải nghiệm với tư cách khách** để dùng thử ngay.

Bạn cũng có thể cài extension **Live Server** (VS Code), nhấp phải `index.html` > **Open with Live Server**. URL/port có thể khác, thường `http://127.0.0.1:5500`.

## 2. Preview iPhone / Android ngay trên VS Code

- Mở URL local trên Chrome/Edge máy tính; nhấn `F12` hoặc `Ctrl+Shift+I` (`Cmd+Option+I` trên macOS).
- Bật biểu tượng **Toggle device toolbar** hoặc `Ctrl+Shift+M` (`Cmd+Shift+M` trên macOS).
- Chọn **iPhone 14 Pro / iPhone 15 Pro / Pixel 7**, hoặc nhập kích thước **390 × 844** (iPhone gần tương đương) hay **360 × 800** (Android).
- F5 reload trang sau khi thay đổi viewport; thử **Home, Kho tư thế, Chụp & tải ảnh, Kết quả, Thư viện**.
- Device toolbar chỉ giả lập kích thước và cảm ứng, **không phải** camera thật hay iOS Safari thật.

## 3. Thử PWA cài lên máy tính

- Chrome/Edge → DevTools → **Application** → **Manifest**: kiểm tra tên, icons 192/512, `display: standalone`.
- **Application → Service Workers**: kiểm tra `sw.js` có trạng thái activated/running.
- Trên Chrome/Edge, sử dụng biểu tượng cài app cạnh thanh địa chỉ hoặc menu **Install PoseLab** khi trình duyệt cho phép.
- Đóng kết nối mạng bằng **DevTools → Network → Offline**, tải lại trang để thử **offline app shell**. Hãy mở app ít nhất một lần ở chế độ online trước.
- Offline chỉ dành cho giao diện và ảnh thư viện đã lưu **trên chính thiết bị/trình duyệt**; không có AI/cloud offline.

## 4. Test trên Android thật bằng USB (giữ localhost + camera)

1. Điện thoại bật **Developer options > USB debugging**, kết nối USB tới máy tính có Android Platform Tools (`adb`).
2. Chạy server VS Code như trên.
3. Trong terminal khác:
   ```bash
   adb devices
   adb reverse tcp:5500 tcp:5500
   ```
4. Mở **Chrome Android** → `http://localhost:5500`. Vì là `localhost` trên điện thoại sau reverse, camera/service worker có thể hoạt động khi cấp quyền.
5. Chrome menu `⋮` → **Install app** / **Add to Home screen** (tùy trình duyệt), thử cài PoseLab.

**Lưu ý:** Nếu chỉ mở `http://192.168.x.x:5500` từ điện thoại cùng Wi-Fi, bạn có thể xem giao diện nhưng origin HTTP LAN thông thường **không** là secure context; camera và PWA install/service worker có thể bị chặn. Không dùng đường này để đánh giá PWA thật.

## 5. Test trên iPhone thật

- iPhone không hỗ trợ `adb reverse`. Để thử đủ **camera + cài PWA**, dùng địa chỉ **HTTPS đáng tin cậy** (ví dụ tunnel HTTPS đến server local hoặc deploy một bản test lên host HTTPS).
- Mở HTTPS trong Safari → **Chia sẻ** → **Thêm vào Màn hình chính** → **Thêm**; mở biểu tượng PoseLab từ Home Screen để kiểm tra chế độ `standalone`.
- Có thể preview layout qua HTTP Wi‑Fi trên iPhone, nhưng **camera/service worker/cài app đúng chuẩn** cần HTTPS.

## 6. Những file được bổ sung

```text
PoseLab_PWA/
├── index.html                    # Viewport safe area, manifest, PWA controls
├── styles.css                    # CSS gốc + safe-area mobile, camera pose nổi
├── app.js                        # JS gốc + bật/tắt pose nổi mobile
├── pwa.js                        # Install prompt, mạng offline, update worker
├── sw.js                         # Cache offline app shell; không cache ảnh upload
├── manifest.webmanifest          # Tên/icon/màu/dislay standalone
├── assets/
│   ├── favicon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   └── apple-touch-icon.png
└── README.md
```

## 7. Giới hạn prototype (không thay đổi)

- **Login chỉ là demo**, chưa tích hợp OAuth hoặc backend.
- Gợi ý pose là danh sách mẫu SVG lọc theo số người/phong cách, **không phải AI thật**.
- Ghép nền / chấm điểm so pose chưa có AI.
- Thư viện lưu trong IndexedDB trình duyệt; mất nếu xóa dữ liệu website/app. **Không đồng bộ với điện thoại khác**.
- Cài PWA không tự tạo thông báo đẩy, tài khoản hay đồng bộ đám mây.
- PWA offline mở được giao diện đã cache; Google Fonts có thể dùng font dự phòng khi không có mạng. Camera ngoại tuyến có thể chạy nếu trang đang ở secure context và có quyền, nhưng không có xử lý AI offline.
- Trong thời gian phát triển, nếu cập nhật code mà trình duyệt chưa đổi giao diện: DevTools → Application → Service Workers → **Update** hoặc **Unregister**, rồi hard reload. Phiên bản SW nằm ở biến `VERSION` trong `sw.js`.

## 8. Giao diện trên điện thoại

- Dưới 760px, sidebar giữ logic thành **tab bar dưới cùng**; đã bù `env(safe-area-inset-bottom)` cho điện thoại có thanh home indicator.
- Camera vẫn nằm trong màn hình cũ, còn **pose mẫu được hiển thị nổi (Picture-in-Picture UI)** trên khung chụp/ảnh ở màn hình nhỏ, có nút **Ẩn pose nổi / Hiện pose nổi**. Phần pose mẫu bên cạnh của desktop giữ nguyên; trên mobile khối này vẫn tồn tại ở dưới để đọc chi tiết.
- Bố cục và palette trên desktop không bị thay đổi.

## 9. Debug trực tiếp từ VS Code

Bộ source kèm `.vscode/launch.json`. Sau khi chạy server bằng Terminal, mở tab **Run and Debug** (`Ctrl+Shift+D`) → chọn **PoseLab – Chrome mobile preview** → `F5`. Chrome sẽ mở cửa sổ test. Nhấn `F12` và bật **Toggle Device Toolbar** (`Ctrl+Shift+M`) để chọn thiết bị ảo.
