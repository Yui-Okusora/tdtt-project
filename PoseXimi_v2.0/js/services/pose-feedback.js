/** Pose-specific retake coaching. Rule based, no ungrounded claim of AI vision. */
import { currentPose, state } from "../state.js";

// Distinct coaching according to pose archetype, number of participants and style.
const VARIANT_TIPS = [
  "Đặt trọng tâm lên một chân và xoay vai nhẹ để dáng đứng tự nhiên hơn.",
  "Nghiêng người vừa phải, giữ lưng thẳng và không che mặt người bên cạnh.",
  "Đưa tay có chủ đích, tránh để hai cánh tay che toàn bộ phần thân.",
  "Thử lệch góc người 20–30° so với camera để ảnh có chiều sâu.",
  "Tách nhẹ hai chân và thả lỏng vai, tránh đứng quá cứng.",
  "Cử động nhỏ giữa các lần bấm chụp để tìm khoảnh khắc tự nhiên.",
];
const STYLE_TIP = {
  Casual: "Casual: mỉm cười tự nhiên, thả lỏng tay và hạn chế gồng vai.",
  Fashion:
    "Fashion: giữ cổ dài, mắt hướng chủ động và tạo đường chéo bằng tay/chân.",
  JoJo: "JoJo: nhấn mạnh đường nét tay, góc vai và biểu cảm mạnh, nhưng giữ thăng bằng.",
};

/** @returns {{title:string, tips:string[]}} Short guidance for the current pose. */
export function retakeCoaching() {
  const pose = currentPose();
  if (!pose)
    return {
      title: "Điều chỉnh tư thế",
      tips: ["Đứng trong khung hình trước khi bấm chụp."],
    };
  const countTip =
    state.people === 1
      ? "Giữ đủ đầu và bàn chân trong khung, chừa một ít khoảng trống phía trên."
      : `Căn đủ cả ${state.people} người trong khung; đứng so le để không che nhau và kiểm tra chân/tay mọi người.`;
  return {
    title: `Chỉnh lại pose “${pose.title}”`,
    tips: [
      VARIANT_TIPS[pose.variant % VARIANT_TIPS.length],
      countTip,
      STYLE_TIP[state.style] || STYLE_TIP.Casual,
      "Ánh sáng nên hướng vào mặt, kiểm tra nền phía sau và giữ máy ổn định.",
    ],
  };
}
