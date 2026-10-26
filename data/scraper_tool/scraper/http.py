"""HTTP client có các lớp chống bị chặn:

- xoay User-Agent + header giống trình duyệt thật
- mỗi luồng (thread) một session riêng (giữ cookie), tự đổi session khi bị chặn
- giãn cách theo từng host (có jitter ngẫu nhiên) để không bắn request dồn dập
- retry với exponential backoff, tôn trọng header Retry-After
- hỗ trợ danh sách proxy (xoay vòng, tạm loại proxy hỏng)
"""
from __future__ import annotations

import random
import threading
import time
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.6 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
]

ACCEPT = {
    "page": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "json": "application/json, text/javascript, */*; q=0.01",
    "image": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}


class FetchError(Exception):
    """Lỗi tải chung (HTTP lỗi, timeout, ...)."""


class Blocked(FetchError):
    """Bị chặn (403/429/503, captcha, ...)."""


class HttpClient:
    def __init__(
        self,
        proxies: list[str] | None = None,
        min_delay: float = 0.3,
        max_delay: float = 1.2,
        timeout: tuple[float, float] = (8, 25),
        max_retries: int = 3,
    ) -> None:
        self.proxies = list(proxies or [])
        self.min_delay = min_delay
        self.max_delay = max(max_delay, min_delay)
        self.timeout = timeout
        self.max_retries = max_retries
        self._local = threading.local()
        self._lock = threading.Lock()
        self._next_ok: dict[str, float] = {}
        self._bad_proxy_until: dict[str, float] = {}

    # ------------------------------------------------------------------ sessions
    def _pick_proxy(self) -> str | None:
        if not self.proxies:
            return None
        now = time.time()
        good = [p for p in self.proxies if self._bad_proxy_until.get(p, 0) < now]
        return random.choice(good or self.proxies)

    def _session(self) -> requests.Session:
        s = getattr(self._local, "session", None)
        if s is None:
            s = requests.Session()
            s.headers["User-Agent"] = random.choice(USER_AGENTS)
            s.headers["Accept-Language"] = "en-US,en;q=0.9,vi;q=0.8"
            s.headers["Accept-Encoding"] = "gzip, deflate"
            adapter = HTTPAdapter(pool_connections=20, pool_maxsize=20)
            s.mount("http://", adapter)
            s.mount("https://", adapter)
            proxy = self._pick_proxy()
            if proxy:
                s.proxies = {"http": proxy, "https": proxy}
                s._scraper_proxy = proxy  # type: ignore[attr-defined]
            self._local.session = s
        return s

    def rotate(self, bad_proxy: bool = False) -> None:
        """Bỏ session hiện tại -> lần gọi sau dùng UA/cookie/proxy mới."""
        s = getattr(self._local, "session", None)
        if s is not None:
            proxy = getattr(s, "_scraper_proxy", None)
            if bad_proxy and proxy:
                self._bad_proxy_until[proxy] = time.time() + 120
            s.close()
        self._local.session = None

    def set_cookie(self, name: str, value: str, domain: str) -> None:
        self._session().cookies.set(name, value, domain=domain)

    # ------------------------------------------------------------------ pacing
    def _throttle(self, host: str, scale: float) -> None:
        delay = random.uniform(self.min_delay, self.max_delay) * scale
        with self._lock:
            now = time.monotonic()
            start = max(now, self._next_ok.get(host, 0.0))
            self._next_ok[host] = start + delay
        wait = start - now
        if wait > 0:
            time.sleep(wait)

    @staticmethod
    def _backoff(attempt: int, retry_after: float | None = None) -> None:
        if retry_after is not None:
            time.sleep(min(retry_after, 30))
        else:
            time.sleep(min(2 ** attempt + random.random(), 20))

    # ------------------------------------------------------------------ request
    def get(
        self,
        url: str,
        *,
        params: dict | None = None,
        headers: dict | None = None,
        referer: str | None = None,
        stream: bool = False,
        kind: str = "page",
        scale: float = 1.0,
        retries: int | None = None,
    ) -> requests.Response:
        host = urlparse(url).netloc
        attempts = (self.max_retries if retries is None else retries) + 1
        last: Exception | None = None
        for i in range(attempts):
            self._throttle(host, scale)
            h = {"Accept": ACCEPT.get(kind, ACCEPT["page"])}
            if kind == "page":
                h["Upgrade-Insecure-Requests"] = "1"
            if kind == "json":
                h["X-Requested-With"] = "XMLHttpRequest"
            if referer:
                h["Referer"] = referer
            h.update(headers or {})
            try:
                r = self._session().get(
                    url, params=params, headers=h, timeout=self.timeout,
                    stream=stream, allow_redirects=True,
                )
            except requests.RequestException as e:
                last = e
                self.rotate(bad_proxy=True)
                if i < attempts - 1:
                    self._backoff(i)
                continue

            code = r.status_code
            if code in (403, 429, 503):
                ra = r.headers.get("Retry-After")
                r.close()
                last = Blocked(f"HTTP {code} từ {host}")
                self.rotate()
                if i < attempts - 1:
                    self._backoff(i, float(ra) if ra and ra.isdigit() else None)
                continue
            if code >= 500:
                r.close()
                last = FetchError(f"HTTP {code} từ {host}")
                if i < attempts - 1:
                    self._backoff(i)
                continue
            if code >= 400:
                r.close()
                raise FetchError(f"HTTP {code} từ {host}")
            return r

        if isinstance(last, Blocked):
            raise last
        raise FetchError(str(last) if last else "không rõ lỗi")
