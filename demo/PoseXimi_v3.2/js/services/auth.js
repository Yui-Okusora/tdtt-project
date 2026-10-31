/** Same-origin authentication API. Never verify credentials from hard-coded frontend values. */
const BASE = "./api/auth";

/** @param {string} path - API action; @param {object} [body] - JSON payload */
async function request(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${BASE}/${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        payload.message || `Máy chủ trả về lỗi ${response.status}.`,
      );
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("Yêu cầu hết thời gian xử lý.");
    if (error instanceof TypeError)
      throw new Error(
        'Không kết nối được API. Chạy "node server.mjs" để bật đăng nhập thật.',
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const registerAccount = ({ username, email, password }) =>
  request("register", { username, email, password });
export const loginAccount = ({ username, password }) =>
  request("login", { username, password });
export const currentAccount = () => request("me");
export const logoutAccount = () => request("logout", {});
