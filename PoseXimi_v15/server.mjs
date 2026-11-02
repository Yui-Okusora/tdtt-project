/**
 * Local development server for PoseXimi.
 * - Serves PWA files and same-origin auth endpoints (no npm dependencies).
 * - Persists users with salted scrypt password hashes, not plaintext passwords.
 * - Keeps sessions in memory; restarting the server signs users out.
 * This is local-development code, NOT a deployment-ready identity service.
 */
import http from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DB = join(ROOT, ".local-data", "users.json");
const PORT = Number(process.env.PORT) || 5500;
const sessions = new Map(),
  failedLogins = new Map();
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".ico": "image/x-icon",
};

function send(res, status, obj, extra = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  });
  res.end(JSON.stringify(obj));
}
function fail(res, status, message) {
  send(res, status, { message });
}
function validName(username) {
  return /^[\p{L}\p{N}_.-]{3,30}$/u.test(username);
}
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
async function readUsers() {
  try {
    const rows = JSON.parse(await readFile(DB, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
async function storeUsers(rows) {
  await mkdir(join(ROOT, ".local-data"), { recursive: true });
  await writeFile(DB, JSON.stringify(rows, null, 2), { mode: 0o600 });
}
async function hashPassword(password, salt) {
  return (await scrypt(password, salt, 64)).toString("hex");
}
function withoutSecret(row) {
  return { id: row.id, username: row.username, email: row.email };
}
async function jsonBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("Dữ liệu yêu cầu quá lớn.");
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new Error("JSON không hợp lệ.");
  }
}
function cookieValue(req, name) {
  const match = (req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + "="));
  return match?.slice(name.length + 1);
}
const COOKIE = "poseximi_session";
function setSessionCookie(res, token) {
  const secure = process.env.TRUST_HTTPS === "1" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`,
  );
}
function currentSession(req) {
  const token = cookieValue(req, COOKIE);
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}
async function handleAuth(req, res, path) {
  const action = path.slice("/api/auth/".length);
  if (action === "me" && req.method === "GET") {
    const session = currentSession(req);
    if (!session) return fail(res, 401, "Chưa đăng nhập.");
    return send(res, 200, { user: session.user });
  }
  if (req.method !== "POST") return fail(res, 405, "Phương thức không hợp lệ.");
  let data;
  try {
    data = await jsonBody(req);
  } catch (error) {
    return fail(res, 400, error.message);
  }
  if (action === "register") {
    const username = String(data.username || "").trim(),
      email = String(data.email || "")
        .trim()
        .toLowerCase(),
      password = String(data.password || "");
    if (
      !validName(username) ||
      !validEmail(email) ||
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Z]/.test(password)
    )
      return fail(
        res,
        400,
        "Tên đăng nhập, email hoặc mật khẩu không đáp ứng điều kiện đăng ký.",
      );
    const users = await readUsers();
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
      return fail(res, 409, "Tên đăng nhập đã được sử dụng.");
    if (users.some((u) => u.email === email))
      return fail(res, 409, "Email này đã có tài khoản.");
    const salt = randomBytes(16).toString("hex"),
      hash = await hashPassword(password, salt);
    users.push({
      id: randomBytes(16).toString("hex"),
      username,
      email,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    });
    await storeUsers(users);
    return send(res, 201, { message: "Tạo tài khoản thành công." });
  }
  if (action === "login") {
    const identity = String(data.username || "")
        .trim()
        .toLowerCase(),
      password = String(data.password || "");
    const ip = req.socket.remoteAddress || "unknown";
    const block = failedLogins.get(ip);
    if (block?.until > Date.now())
      return fail(
        res,
        429,
        "Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.",
      );
    if (!identity || !password)
      return fail(res, 400, "Hãy nhập tài khoản và mật khẩu.");
    const users = await readUsers();
    const user = users.find(
      (u) => u.username.toLowerCase() === identity || u.email === identity,
    );
    // Always perform scrypt to reduce user-enumeration timing leaks for unknown usernames.
    const fakeSalt = "00".repeat(16);
    const actual = await hashPassword(password, user?.salt || fakeSalt);
    const equal =
      !!user &&
      timingSafeEqual(
        Buffer.from(actual, "hex"),
        Buffer.from(user.hash, "hex"),
      );
    if (!equal) {
      const n =
        (block?.until && block.until < Date.now() ? 0 : block?.count || 0) + 1;
      failedLogins.set(ip, {
        count: n,
        until: n >= 5 ? Date.now() + 15 * 60_000 : 0,
      });
      return fail(res, 401, "Tên đăng nhập hoặc mật khẩu không chính xác.");
    }
    failedLogins.delete(ip);
    const token = randomBytes(32).toString("hex");
    const publicUser = withoutSecret(user);
    sessions.set(token, {
      user: publicUser,
      expiresAt: Date.now() + 7 * 86400_000,
    });
    setSessionCookie(res, token);
    return send(res, 200, { user: publicUser });
  }
  if (action === "logout") {
    const token = cookieValue(req, COOKIE);
    if (token) sessions.delete(token);
    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    );
    return send(res, 200, { message: "Đã đăng xuất." });
  }
  return fail(res, 404, "API không tồn tại.");
}
async function serveStatic(req, res, url) {
  if (!["GET", "HEAD"].includes(req.method))
    return fail(res, 405, "Method not allowed");
  let requested;
  try {
    requested = decodeURIComponent(url.pathname);
  } catch {
    return fail(res, 400, "Đường dẫn không hợp lệ.");
  }
  if (
    requested.includes("\\") ||
    requested.split("/").some((part) => part.startsWith("."))
  )
    return fail(res, 403, "Không có quyền truy cập.");
  const full = resolve(
    ROOT,
    "." + (requested === "/" ? "/index.html" : requested),
  );
  if (
    full !== resolve(ROOT, "index.html") &&
    !full.startsWith(resolve(ROOT) + sep)
  )
    return fail(res, 403, "Không có quyền truy cập.");
  try {
    const info = await stat(full);
    if (!info.isFile()) return fail(res, 404, "Không tìm thấy file.");
    const bytes = await readFile(full);
    res.writeHead(200, {
      "Content-Type": MIME[extname(full)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch (error) {
    if (error.code === "ENOENT") return fail(res, 404, "Không tìm thấy file.");
    throw error;
  }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );
  try {
    if (url.pathname.startsWith("/api/auth/"))
      return await handleAuth(req, res, url.pathname);
    if (url.pathname.startsWith("/api/"))
      return fail(res, 404, "Chưa có backend cho API này.");
    return await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    return fail(res, 500, "Có lỗi máy chủ.");
  }
});
server.listen(PORT, "127.0.0.1", () =>
  console.log(`PoseXimi local: http://localhost:${PORT}`),
);
