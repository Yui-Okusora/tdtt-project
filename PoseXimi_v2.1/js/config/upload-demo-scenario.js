/**
 * POSEXIMI – DEMO CONFIG (CHỈNH TẠI ĐÂY)
 *
 * Chọn đúng một scenario rồi lưu (Ctrl + S), tải lại web.
 * Các giá trị hợp lệ:
 *   "technical"          = kiểm tra thông số tệp thực (không xác minh người bằng AI)
 *   "both-valid"         = cả 2 ảnh luôn được báo hợp lệ sau khi tải lên
 *   "both-invalid"       = cả 2 ảnh luôn được báo không hợp lệ
 *   "background-invalid" = chỉ background không hợp lệ
 *   "group-invalid"      = chỉ ảnh nhóm không hợp lệ
 *
 * CẢNH BÁO: Bốn chế độ không phải "technical" là kết quả demo đặt sẵn,
 * KHÔNG dùng để xác thực nội dung ảnh thật. Không triển khai như AI validation.
 */
export const UPLOAD_DEMO_SCENARIO = "background-invalid";
