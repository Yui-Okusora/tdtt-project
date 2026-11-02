/** Image validation and resizing. p = shorter side of an image, including portraits. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MIN_SHORT_EDGE = 480;
export const MAX_SHORT_EDGE = 1080;
export const MAX_LONG_EDGE = 1920;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function decodeFile(file) {
  if (!file || !TYPES.has(file.type))
    throw new Error("Chỉ nhận ảnh JPG, PNG, WebP hoặc AVIF.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error("Ảnh vượt quá 10 MB. Hãy chọn ảnh nhỏ hơn.");
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () =>
        reject(new Error("Tệp ảnh bị lỗi hoặc không đọc được."));
      img.src = url;
    });
    return imageToJpeg(img, { filename: file.name });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** @param {HTMLImageElement|HTMLVideoElement} image browser image or camera video */
export function imageToJpeg(image, { mirror = false, filename = "Ảnh" } = {}) {
  const w = image.videoWidth || image.naturalWidth || image.width;
  const h = image.videoHeight || image.naturalHeight || image.height;
  if (!w || !h) throw new Error("Ảnh chưa sẵn sàng.");
  if (Math.min(w, h) < MIN_SHORT_EDGE)
    throw new Error(
      `${filename}: cạnh ngắn tối thiểu 480px (480p). Ảnh hiện tại ${w}×${h}px.`,
    );
  const scale = Math.min(
    1,
    MAX_SHORT_EDGE / Math.min(w, h),
    MAX_LONG_EDGE / Math.max(w, h),
  );
  const targetW = Math.round(w * scale),
    targetH = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (mirror) {
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(image, 0, 0, targetW, targetH);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.84),
    resized: scale < 1,
    width: targetW,
    height: targetH,
    sourceWidth: w,
    sourceHeight: h,
  };
}

/**
 * For SCREENSHOT DEMOS only: decode any browser-supported image regardless of
 * resolution/content and scale it down for safe UI rendering. Production upload
 * must keep using decodeFile(), which validates size/dimensions and file type.
 * Max payload bound prevents a large image from freezing the demo browser.
 */
export async function decodeDemoImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Chế độ demo chỉ nhận tệp hình ảnh.");
  }
  if (file.size > 40 * 1024 * 1024) {
    throw new Error("Tệp demo quá lớn (trên 40 MB), hãy chọn ảnh nhỏ hơn.");
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Không đọc được tệp ảnh này."));
      image.src = url;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) throw new Error("Ảnh không có kích thước hợp lệ.");
    const scale = Math.min(1, 1280 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.8),
      width: canvas.width,
      height: canvas.height,
      resized: scale < 1,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
