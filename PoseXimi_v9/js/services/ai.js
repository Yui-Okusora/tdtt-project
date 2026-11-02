/** Integration contract: implement POST /api/pose-preview in your backend. */
export const API_CONFIG = {
  previewEndpoint: "/api/pose-preview",
  suggestionsEndpoint: "/api/pose-suggestions",
  timeoutMs: 45000,
};
export class AIBackendError extends Error {}

/** @param {string} endpoint - Backend relative URL.
 * @param {object} payload - Image/pose request parameters as JSON.
 * @param {{signal?:AbortSignal,timeoutMs?:number}} options - Cancellation/time limit.
 */
async function postJSON(
  endpoint,
  payload,
  { signal, timeoutMs = API_CONFIG.timeoutMs } = {},
) {
  const timeout = new AbortController();
  const time = setTimeout(
    () => timeout.abort(new Error("AI xử lý quá thời gian 45 giây.")),
    timeoutMs,
  );
  // Cancels on user action or timeout.
  const combined = AbortSignal.any
    ? AbortSignal.any([timeout.signal, ...(signal ? [signal] : [])])
    : timeout.signal;
  const onAbort = () =>
    timeout.abort(signal?.reason || new Error("Người dùng đã hủy."));
  if (!AbortSignal.any && signal)
    signal.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: combined,
      cache: "no-store",
    });
    if (!response.ok)
      throw new AIBackendError(
        response.status === 404
          ? "Backend AI chưa được kết nối (/api/pose-preview)."
          : `Backend phản hồi mã HTTP ${response.status}.`,
      );
    const data = await response.json();
    if (!data || typeof data !== "object")
      throw new AIBackendError("Backend trả về dữ liệu không hợp lệ.");
    return data;
  } catch (error) {
    if (error instanceof AIBackendError) throw error;
    if (timeout.signal.aborted && !signal?.aborted)
      throw new AIBackendError("AI xử lý quá lâu. Vui lòng thử lại.");
    if (signal?.aborted)
      throw new DOMException("Đã hủy thao tác.", "AbortError");
    throw new AIBackendError(
      "Không kết nối được API AI. Hãy kiểm tra backend, HTTPS và cấu hình URL.",
    );
  } finally {
    clearTimeout(time);
    signal?.removeEventListener?.("abort", onAbort);
  }
}
/** @param {object} args - poseId, people, style, backgroundImage, peopleImage, signal.
 * @returns {Promise<string>} AI image URL/data URL returned by the backend.
 */
export async function previewPose({
  poseId,
  people,
  style,
  backgroundImage,
  peopleImage,
  signal,
}) {
  const data = await postJSON(
    API_CONFIG.previewEndpoint,
    { poseId, peopleCount: people, style, backgroundImage, peopleImage },
    { signal },
  );
  const image = data.imageUrl || data.imageBase64 || data.previewUrl;
  // Refuse javascript: and invalid URLs; allow local API image path, https and data:image.
  if (
    typeof image !== "string" ||
    !/^(https?:\/\/|\/[^/]|data:image\/(png|jpeg|webp);base64,)/.test(image)
  )
    throw new AIBackendError("API không trả về imageUrl/imageBase64 hợp lệ.");
  return image;
}
/** Optional backend ranking. If it is not ready, return null and label local presets as demo. */
export async function loadRecommendations({
  people,
  style,
  backgroundImage,
  peopleImage,
}) {
  try {
    const data = await postJSON(
      API_CONFIG.suggestionsEndpoint,
      { peopleCount: people, style, backgroundImage, peopleImage },
      { timeoutMs: 12000 },
    );
    return Array.isArray(data.poseIds)
      ? data.poseIds.filter((s) => typeof s === "string").slice(0, 6)
      : null;
  } catch {
    return null;
  }
}
