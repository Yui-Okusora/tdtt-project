# Kết quả kiểm thử PoseXimi_v9

**Phạm vi:** Source được refactor từ PoseXimi_v8.

| Kiểm tra                                           | Kết quả           | Phương pháp                                                                    |
| -------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| Cú pháp JavaScript của toàn bộ ES Modules          | ĐẠT               | `node --check`                                                                 |
| Cú pháp CSS của các stylesheet                     | ĐẠT               | `tinycss2.parse_stylesheet`                                                    |
| PWA: danh sách tệp precache                        | ĐẠT               | 80 file + entry gốc, không thiếu đường dẫn                                     |
| HTTP GET `/`                                       | ĐẠT               | Server Node local trả 200                                                      |
| MainLayout: chính xác 3 tab                        | ĐẠT               | Unit render                                                                    |
| Wizard bước 1: 4 người                             | ĐẠT               | Unit render                                                                    |
| Wizard bước 2: 3 Style                             | ĐẠT               | Unit render                                                                    |
| Wizard bước 3: hai loại ảnh                        | ĐẠT               | Unit render                                                                    |
| Wizard: khóa CTA nếu thiếu ảnh                     | ĐẠT               | Unit render                                                                    |
| Wizard: mở CTA khi có đủ ảnh                       | ĐẠT               | Unit render                                                                    |
| Pose carousel: 3 và 6 thẻ                          | ĐẠT               | Unit render                                                                    |
| Fullscreen PoseDetailModal + sticky CTA            | ĐẠT               | Unit render                                                                    |
| AI preview tùy chọn vẫn có nút truy cập            | ĐẠT               | Unit render                                                                    |
| Camera timer 0/3/5/10, grid, opacity, pose overlay | ĐẠT               | Unit render                                                                    |
| Camera có chụp, đổi camera, tải ảnh                | ĐẠT               | Unit render                                                                    |
| Render tĩnh mobile 390 × 844                       | ĐẠT               | Playwright `set_content`, không chạy luồng JS                                  |
| End-to-end tại URL local, quyền camera, iOS PWA    | **CHƯA XÁC NHẬN** | Môi trường Chromium chặn điều hướng localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`) |

**Lưu ý:** Render tĩnh và kiểm tra module không tương đương với việc chạy app và thử trực tiếp trên điện thoại. Bộ ảnh screenshot chỉ minh họa bố cục khi dùng viewport di động. Các kết quả này không xác nhận camera phần cứng, zoom, hẹn giờ khi chụp hay API AI.
