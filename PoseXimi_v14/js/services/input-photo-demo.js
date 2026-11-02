/**
 * DEMO-ONLY photo validation. The verdict is deliberately selected by the
 * presenter, NOT inferred from pixels. Never expose it as real AI recognition.
 *
 * Scenario IDs are independent of the uploaded file. The presenter can use
 * any decodable image to demonstrate an accepted or rejected workflow.
 */
export const DEMO_SCENARIOS = Object.freeze([
  { id: "technical", label: "Chế độ thường", short: "Kiểm tra tệp thật" },
  { id: "both-valid", label: "Cả hai hợp lệ", short: "2 ảnh đạt" },
  { id: "both-invalid", label: "Cả hai lỗi", short: "2 ảnh lỗi" },
  { id: "background-invalid", label: "Nền lỗi", short: "Nền lỗi · Nhóm đạt" },
  { id: "group-invalid", label: "Ảnh nhóm lỗi", short: "Nền đạt · Nhóm lỗi" },
]);

/** @param {"background"|"group"} kind */
export function evaluateDemoPhoto(kind, scenario, hasPhoto, people = 2, technicalChecked = false) {
  if (!hasPhoto) {
    return { status: "empty", title: "Chưa có ảnh", detail: "Tải ảnh lên để hiển thị kết quả kiểm tra mô phỏng.", instruction: "" };
  }
  if (scenario === "technical" && !technicalChecked) {
    return { status: "unchecked", title: "Cần kiểm tra tệp",
      detail: "Ảnh này đã thêm trong chế độ demo, chưa qua kiểm tra kích thước thật.",
      instruction: "Hãy tải lại ảnh trong chế độ thường để kiểm tra kỹ thuật.",
    };
  }
  if (scenario === "technical") {
    return {
      status: "technical", title: "Tệp hợp lệ về kỹ thuật",
      detail: "Đã qua kiểm tra định dạng, dung lượng và độ phân giải. Chưa kiểm tra có người hay toàn thân.",
      instruction: "Đây không phải kết quả nhận diện nội dung ảnh.",
    };
  }
  const fail = scenario === "both-invalid" || scenario === `${kind}-invalid`;
  if (fail && kind === "background") {
    return {
      status: "invalid", title: "Ảnh không hợp lệ",
      detail: "Mô phỏng: ảnh background có người trong khung hình.",
      instruction: "Cách sửa: sử dụng ảnh căn phòng hoặc phong cảnh trống, không có người.",
    };
  }
  if (fail && kind === "group") {
    return {
      status: "invalid", title: "Ảnh không hợp lệ",
      detail: `Mô phỏng: ảnh nhóm chưa hiển thị trọn đầu đến bàn chân của đủ ${people} người.`,
      instruction: "Cách sửa: lùi camera, chụp rõ toàn thân và đủ số người đã chọn.",
    };
  }
  return kind === "background"
    ? { status: "valid", title: "Ảnh hợp lệ", detail: "Mô phỏng đạt: background không có người.", instruction: "Có thể tiếp tục." }
    : { status: "valid", title: "Ảnh hợp lệ", detail: `Mô phỏng đạt: ảnh thấy đầy đủ toàn thân ${people} người.`, instruction: "Có thể tiếp tục." };
}

export function areDemoPhotosValid(scenario, backgroundPhoto, groupPhoto, people = 2, technicalChecks = {}) {
  const bg = evaluateDemoPhoto("background", scenario, !!backgroundPhoto, people, technicalChecks.background).status;
  const group = evaluateDemoPhoto("group", scenario, !!groupPhoto, people, technicalChecks.group).status;
  return ["valid", "technical"].includes(bg) && ["valid", "technical"].includes(group);
}
