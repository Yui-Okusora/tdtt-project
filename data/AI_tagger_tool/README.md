# 🏷️ AI Image Auto-Tagging Tool

Ứng dụng chạy cục bộ: tải nhiều ảnh (đã thử luồng 200 ảnh) → AI đa phương thức **thực sự nhìn ảnh** → JSON theo
cấu trúc RAG pose như ảnh tham khảo. Có ước tính token, đổi tên ảnh, thư viện phân trang và nhiều nguồn model miễn phí.

## Cấu trúc JSON xuất ra

```json
{
  "subject_features": "...",
  "background_context": "...",
  "camera_angle": "eye-level, full-body shot",
  "rag_filter": { "category": "outdoor_beach", "shot_type": "full_body", "vibe": "relaxed_casual" },
  "rag_search_prompt": "relaxed casual standing pose for beach outdoor full body"
}
```
* **File từng ảnh (.zip):** đúng object trên (tên file JSON = tên ảnh; tùy chọn kèm `filename`).
* **File tổng hợp:** `{"schema_version": "1.0", "images": [ { "filename": "...", ...các trường trên... } ]}`.
* Tùy chọn: chỉ `filename + rag_filter`; kèm `status` + `review_required`. `rag_filter` luôn là snake_case tiếng Anh.

## Cài đặt & chạy trên Windows

Yêu cầu Python 3.10+ (tick “Add Python to PATH”).
```bat
cd ai-image-tagger
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      (tùy chọn: điền API Key vào .env)
streamlit run app.py
```
Hoặc bấm đúp **run.bat**. Trình duyệt mở tại http://localhost:8501.

## Nguồn model (có lựa chọn miễn phí)

| Provider | Miễn phí? | Ghi chú |
|---|---|---|
| **Google Gemini** | Gói free của Google AI Studio | Có giới hạn request/phút & /ngày. Dòng flash / flash-lite thường tiết kiệm nhất. |
| **OpenRouter** | Có model “:free” | Bật “Chỉ hiện model miễn phí”: ứng dụng lọc theo API của OpenRouter (model nhận ảnh + giá 0). Giới hạn request/ngày; có thể có chính sách dữ liệu riêng → tránh ảnh nhạy cảm. |
| **Groq** | Gói free giới hạn | Danh sách lọc theo tên model (chưa xác minh) – có thể gõ tên model khác. |
| **Ollama (local)** | Hoàn toàn miễn phí | Không cần key, ảnh không rời máy. `ollama pull llama3.2-vision` rồi bấm “Tải model”. Máy yếu → tăng timeout. |
| OpenAI / OpenAI-compatible | Trả phí / tùy dịch vụ | Server local (LM Studio…) bỏ trống key. |

> **Về Antigravity:** đây là IDE/CLI của Google, hiện không có API key chính thức để gọi model của nó từ ứng dụng
> khác (không hỗ trợ “mang key riêng”). Các công cụ trung gian bên thứ ba dùng lại token đăng nhập của gói thuê bao là
> không chính thức, có thể vi phạm điều khoản và rủi ro cho tài khoản nên **không được tích hợp**. Nếu sau này có
> endpoint tương thích OpenAI chính thức, chỉ cần dùng provider “OpenAI-compatible”.

Mẹo gói miễn phí: hạ “Số request đồng thời” xuống 1–2, dùng cạnh dài 1024px, mức chi tiết “Ngắn/Vừa”.

## Ước tính token & gợi ý cấu hình (tab 1)

* Tính **cho 1 ảnh đang chọn, các ảnh chờ xử lý, hoặc tất cả**: số request, token vào/ra, tổng.
* Ước tính theo công thức token ảnh của nhà cung cấp (OpenAI: ô 512px hoặc patch 32px tùy model; Gemini: ô 768px) +
  token chữ của prompt/schema + token output theo mức chi tiết (tiếng Việt tính nhiều hơn).
* **Token thực tế** lấy từ API (OpenAI `usage`, Gemini `usageMetadata`, gồm cả token “thinking”) được lưu cho từng ảnh
  và dùng để **tự hiệu chỉnh** các lần ước tính sau (model chưa có công thức → độ tin cậy “thấp” cho tới khi chạy thử).
* **Gợi ý:** bảng so sánh “cạnh dài × mức chi tiết”; nhập **ngân sách token** để nhận gợi ý cấu hình chất lượng cao
  nhất còn vừa ngân sách; không có ngân sách thì gợi ý giảm khi tiết kiệm đáng kể. Nút “Áp dụng gợi ý” chỉnh thẳng
  các thanh trượt ở sidebar. Lưu ý: với nhóm gpt-4o/4.1, OpenAI giới hạn cạnh ngắn 768px nên cạnh dài >1024px
  không tốn thêm token ảnh – ứng dụng sẽ không gợi ý giảm trong trường hợp đó.
* Ước tính chỉ là tham khảo; chưa quy đổi ra tiền vì giá thay đổi theo nhà cung cấp.

## Thư viện, chỉnh sửa & đổi tên (tab 2)

* **Thư viện phân trang** (6–24 ảnh/trang, lọc theo trạng thái/tên/“cần kiểm tra”, nút ⏮ ◀ ▶ ⏭ và ô “Đến trang”):
  chỉ vẽ ảnh của trang hiện tại nên mượt với 200+ ảnh.
* **Khung chi tiết** bên phải: ảnh xem trước + **JSON của chính ảnh đó** cạnh nhau, rồi các ô chỉnh sửa.
  **◀ Trước / Sau ▶** để lướt từng ảnh (tự nhảy trang); **“✔ Đã kiểm tra → ảnh sau”** để duyệt nhanh cả loạt.
* **Đổi tên ảnh:** gõ tên mới (đuôi giữ nguyên); chặn tên rỗng, ký tự cấm, tên dành riêng của Windows, trùng tên
  (không phân biệt hoa/thường). **Đổi tên hàng loạt:** tiền tố + số thứ tự, hoặc tìm & thay thế, có xem trước và
  kiểm tra trùng trước khi áp dụng (tất cả hoặc không gì cả). File gốc trong `.data/` không bị sửa.
* Nhãn nguồn gốc giá trị: 🟦 từ danh sách · 🟧 AI đề xuất mới (✅ Chấp nhận = thêm vào danh sách, ❌ Từ chối = xóa) ·
  🟩 bạn đã sửa · ⚠️ cần kiểm tra. Có “Áp dụng giá trị rag_filter cho nhiều ảnh”.

## Xuất (tab 3)

Xem trước dạng bảng **phân trang** (10/25/50 dòng) + JSON của từng trang; tải 1 file tổng hợp hoặc zip từng ảnh; lưu
vào thư mục (không ghi đè nếu chưa bật). **Xuất ảnh với tên mới:** sao chép ảnh gốc sang tên đã đổi vào thư mục
(hoặc ZIP nếu ≤300 MB) để khớp với JSON. Việc xuất bị chặn nếu có trường trống / sai snake_case / trùng tên / phát hiện
API Key trong dữ liệu.

## Bảo mật API Key
Key chỉ ở bộ nhớ phiên hoặc `.env` (đã `.gitignore`); không vào `.data/session.json`, JSON xuất ra hay log (log có bộ
lọc che key, lỗi API được che key); gửi qua header, không đưa vào URL. Ảnh được gửi tới provider bạn chọn.

## Độ ổn định
Xử lý nền nhiều luồng, retry exponential backoff + jitter (tôn trọng `Retry-After`; lỗi vĩnh viễn không retry),
lỗi một ảnh không ảnh hưởng ảnh khác, phân tích lại thất bại không mất kết quả cũ, tự lưu `.data/` sau mỗi ảnh (đóng
mở lại vẫn còn). Khi đang chạy, thư viện tự làm mới (giãn cách ≥4 giây) để thấy kết quả dần.

## Cấu trúc dự án
```
app.py                  Giao diện Streamlit (3 tab)
core/config.py          Cấu hình, chế độ, danh sách provider
core/schema.py          JSON Schema + kiểm tra/chuẩn hóa đầu ra model
core/prompts.py         Prompt (chỉnh quy tắc mô tả tại đây)
core/providers/         base · openai_compat (OpenAI/OpenRouter/Groq/Ollama/compatible) · gemini
core/analyzer.py        Thu nhỏ ảnh → gọi AI → kiểm tra, retry, ghi nhận token thực tế
core/batch.py           Xử lý hàng loạt nền, dừng, cô lập lỗi
core/tokens.py          Ước tính token, hiệu chỉnh, gợi ý cấu hình
core/paging.py          Hàm phân trang
core/store.py           Lưu/khôi phục phiên, đổi tên, xem trước
core/review.py          Nguồn gốc giá trị & cờ “cần kiểm tra”
core/export.py          Xuất + kiểm tra JSON, zip, sao chép ảnh đổi tên
tests/                  113 test (provider/HTTP giả, không gọi API thật)
```

## Kiểm thử
```bat
pip install -r requirements-dev.txt
pytest
```
hoặc `python -m unittest discover -s tests -t .`. Không tốn tiền. `tests/test_ui_stub.py` chạy luồng giao diện với
Streamlit giả; `tests/test_app_smoke.py` dùng AppTest thật (tự bỏ qua nếu chưa cài Streamlit).

## Giới hạn
* Prompt cấm suy đoán danh tính và thuộc tính nhạy cảm (sắc tộc, quốc tịch…); muốn đổi sửa `core/prompts.py`.
* Chưa ghi IPTC/XMP vào ảnh. Danh sách model Groq/tùy chỉnh không thể tự xác minh khả năng đọc ảnh.
* Công thức token ảnh thay đổi theo từng đời model; hãy dựa vào số liệu thực tế sau vài ảnh đầu.
