# Image Scraper

Cào ảnh từ internet về máy, kèm `metadata.json` + `metadata.csv` để nạp vào database của app khác (hoặc dùng để train AI).

## Cài đặt (Python ≥ 3.10)

```bash
pip install -r requirements.txt
```

## Cách dùng

**Chế độ tương tác** – chạy rồi trả lời các câu hỏi (thể loại, số ảnh, từ khoá cấm, link):

```bash
python main.py
```

**Chế độ tham số:**

```bash
# nhiều thể loại, 100 ảnh mỗi thể loại, có từ khoá cấm
python main.py -c "fashion, pose 1 people, meme" -n 100 -b "watermark, logo, sticker" -y

# cào từ link (trang web hoặc link ảnh trực tiếp), gán vào thể loại "fashion"
python main.py -c fashion -n 50 -l https://example.com/gallery -y

# nhiều thể loại + link riêng cho từng thể loại (cú pháp thể_loại::url)
python main.py -c "fashion, meme" -l "fashion::https://site-a.com/g" -y
#   -> fashion cào từ site-a, meme tự tìm bằng search engine

# đi sâu thêm link con cùng domain, và tự tìm bổ sung nếu link không đủ ảnh
python main.py -c fashion -n 200 -l https://example.com --depth 1 --fallback-search -y
```

Tham số hay dùng: `-o thư_mục_ra`, `--engines bing,duckduckgo,google`, `--workers 8`,
`--min-size 200` (cạnh ngắn nhất, px), `--hash-threshold 5`, `--safesearch off|moderate|strict`,
`--proxy-file proxies.txt`, `--delay 0.3,1.2`. Xem tất cả: `python main.py --help`.

## Đầu ra

```
output/
├── images/<thể_loại>/<thể_loại>_000001.jpg ...
├── metadata.json
└── metadata.csv          (UTF-8 có BOM, mở thẳng bằng Excel)
```

Các cột (cả JSON lẫn CSV):

| Cột | Ý nghĩa |
|---|---|
| `id` | số nguyên tăng dần, duy nhất |
| `filename`, `path` | tên file, đường dẫn tương đối so với thư mục output |
| `category`, `keywords` | thể loại / từ khoá đã dùng để tìm |
| `image_url`, `source_page` | URL ảnh gốc, trang chứa ảnh |
| `title`, `alt_text` | tiêu đề / mô tả đi kèm ảnh (dùng làm caption) |
| `engine` | nguồn: `bing` / `duckduckgo` / `google` / `link` |
| `width`, `height`, `format`, `bytes` | thông tin ảnh |
| `md5`, `phash` | hash nội dung / perceptual hash (hex 64-bit) |
| `scraped_at` | thời điểm cào (UTC, ISO 8601) |

Chạy lại vào cùng thư mục output sẽ **nối tiếp**: ảnh đã có không bị tải lại, `id` tiếp tục tăng.

## Cơ chế chính

- **Từ khoá cấm**: so khớp không phân biệt hoa/thường và dấu tiếng Việt, trên tiêu đề, alt text, URL ảnh và URL trang nguồn. Ảnh dính từ cấm bị loại *trước khi tải*.
- **Chống trùng ảnh** (3 lớp): URL → MD5 nội dung → perceptual hash (pHash, khoảng cách Hamming ≤ `--hash-threshold`). Ảnh cùng hình nhưng khác kích thước/chất lượng cũng bị loại. Tăng ngưỡng nếu muốn loại ảnh *giống* nhau mạnh tay hơn, đặt `0` nếu chỉ muốn loại ảnh y hệt.
- **Chống bị chặn**: xoay User-Agent và session (cookie), giãn cách theo host có jitter ngẫu nhiên, retry + backoff mũ (tôn trọng `Retry-After`), Referer theo trang nguồn khi tải ảnh, hỗ trợ xoay proxy. Gặp captcha/403/429 ở một engine thì engine đó bị tắt tạm cho thể loại hiện tại và app dùng engine còn lại.
- **Nguồn tìm ảnh**: Bing (ổn định nhất) + DuckDuckGo + Google (best-effort, Google hay ra captcha nên có thể bị tắt tự động). Không cần API key, không dùng model AI.

## Lưu ý

- Số ảnh là **mỗi thể loại**. Nếu engine hết kết quả hoặc bị chặn, app dừng và báo số ảnh thực lấy được.
- Ảnh nhỏ hơn `--min-size`, ảnh quá 25 MB, và định dạng ngoài JPEG/PNG/WEBP/GIF/BMP bị bỏ qua.
- Muốn cào lượng lớn mà ít bị chặn: dùng `--proxy-file`, giảm `--workers`, tăng `--delay` (ví dụ `1,3`).
- Google/Bing đôi khi đổi cấu trúc trang; nếu một engine ngừng trả kết quả, chỉ cần dùng `--engines` với engine còn lại, phần phân tích nằm gọn trong `scraper/engines.py`.
