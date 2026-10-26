"""Các search engine ảnh. Mỗi engine là generator trả về từng "trang" kết quả."""
from __future__ import annotations

import json
import re
from typing import Iterator

from bs4 import BeautifulSoup

from .http import Blocked, FetchError, HttpClient
from .models import Candidate, clean_text, is_http_url, normalize_url


class Engine:
    name = "base"

    def __init__(self, http: HttpClient, safesearch: str = "moderate") -> None:
        self.http = http
        self.safesearch = safesearch

    def _get(self, url: str, **kw):
        """Request tới search engine: retry ít để báo bị chặn nhanh thay vì chờ backoff lâu."""
        kw.setdefault("retries", 1)
        return self.http.get(url, **kw)

    def search(self, query: str) -> Iterator[list[Candidate]]:
        raise NotImplementedError


# ---------------------------------------------------------------------- Bing
class BingEngine(Engine):
    name = "bing"
    URL = "https://www.bing.com/images/async"

    def search(self, query: str) -> Iterator[list[Candidate]]:
        first = 0
        empty = 0
        while True:
            params = {"q": query, "first": first, "count": 35, "mmasync": 1}
            if self.safesearch == "off":
                params["adlt"] = "off"
            elif self.safesearch == "strict":
                params["adlt"] = "strict"
            r = self._get(
                self.URL, params=params, referer="https://www.bing.com/images/search",
                scale=2.0,
            )
            soup = BeautifulSoup(r.text, "html.parser")
            items: list[Candidate] = []
            anchors = soup.select("a.iusc")
            if not anchors and any(k in r.text.lower() for k in ("captcha", "unusual traffic", "are you a robot")):
                raise Blocked("Bing yêu cầu captcha")
            for a in anchors:
                try:
                    m = json.loads(a.get("m", "{}"))
                except json.JSONDecodeError:
                    continue
                url = normalize_url(m.get("murl", ""))
                if not is_http_url(url):
                    continue
                items.append(Candidate(
                    image_url=url,
                    title=clean_text(m.get("t")),
                    alt=clean_text(m.get("desc")),
                    source_page=normalize_url(m.get("purl", "")),
                    engine=self.name,
                ))
            first += max(len(anchors), 35)
            if not items:
                empty += 1
                if empty >= 2:
                    return
                continue
            empty = 0
            yield items


# ---------------------------------------------------------------- DuckDuckGo
class DuckDuckGoEngine(Engine):
    name = "duckduckgo"

    def _vqd(self, query: str) -> str:
        r = self._get(
            "https://duckduckgo.com/", params={"q": query, "iax": "images", "ia": "images"},
            scale=2.0,
        )
        m = re.search(r'vqd=["\']?([\d-]+)["\']?', r.text)
        if not m:
            raise Blocked("DuckDuckGo không trả vqd token")
        return m.group(1)

    def search(self, query: str) -> Iterator[list[Candidate]]:
        vqd = self._vqd(query)
        offset = 0
        while True:
            params = {
                "l": "us-en", "o": "json", "q": query, "vqd": vqd, "f": ",,,,,",
                "p": "-1" if self.safesearch == "off" else "1", "s": offset,
            }
            r = self._get(
                "https://duckduckgo.com/i.js", params=params, kind="json",
                referer="https://duckduckgo.com/", scale=2.0,
            )
            try:
                data = r.json()
            except ValueError:
                raise Blocked("DuckDuckGo trả dữ liệu không phải JSON")
            results = data.get("results") or []
            items = []
            for it in results:
                url = normalize_url(it.get("image", ""))
                if not is_http_url(url):
                    continue
                items.append(Candidate(
                    image_url=url,
                    title=clean_text(it.get("title")),
                    source_page=normalize_url(it.get("url", "")),
                    engine=self.name,
                    width=int(it.get("width") or 0),
                    height=int(it.get("height") or 0),
                ))
            if not results:
                return
            offset += len(results)
            if items:
                yield items
            if not data.get("next"):
                return


# -------------------------------------------------------------------- Google
class GoogleEngine(Engine):
    """Best-effort: Google hay đổi cấu trúc và dễ ra captcha -> tự bị tắt khi lỗi."""
    name = "google"
    PAIR = re.compile(r'\["(https?://[^"]+?)",\s*(\d{2,5}),\s*(\d{2,5})\]')

    def search(self, query: str) -> Iterator[list[Candidate]]:
        self.http.set_cookie("CONSENT", "YES+cb", ".google.com")
        seen: set[str] = set()
        for page in range(4):
            params = {"q": query, "tbm": "isch", "udm": 2, "hl": "en", "start": page * 20}
            if self.safesearch == "off":
                params["safe"] = "off"
            elif self.safesearch == "strict":
                params["safe"] = "active"
            r = self._get("https://www.google.com/search", params=params, scale=3.0)
            if "/sorry/" in r.url or "unusual traffic" in r.text[:20000].lower():
                raise Blocked("Google yêu cầu captcha")
            items: list[Candidate] = []
            for m in self.PAIR.finditer(r.text):
                raw, w, h = m.groups()
                try:
                    url = json.loads(f'"{raw}"')
                except ValueError:
                    url = raw
                url = normalize_url(url)
                if not is_http_url(url) or "gstatic.com" in url or ".google." in url:
                    continue
                if url in seen:
                    continue
                seen.add(url)
                items.append(Candidate(
                    image_url=url, engine=self.name, width=int(w), height=int(h),
                ))
            if not items:
                if page == 0:
                    raise FetchError("Google không trả kết quả ảnh (có thể bị consent/captcha)")
                return
            yield items


# -------------------------------------------------------------------- Reddit
class RedditEngine(Engine):
    """Tìm bài đăng theo từ khoá trên toàn Reddit; tiêu đề bài đăng làm caption cho ảnh."""
    name = "reddit"

    def search(self, query: str) -> Iterator[list[Candidate]]:
        from .reddit import fetch_pages
        yield from fetch_pages(
            self.http, "https://www.reddit.com/search.json",
            {"q": query, "type": "link", "sort": "relevance", "t": "all"},
            max_pages=5, allow_nsfw=self.safesearch == "off", engine=self.name,
        )


ENGINES = {
    "bing": BingEngine,
    "duckduckgo": DuckDuckGoEngine,
    "google": GoogleEngine,
    "reddit": RedditEngine,
}
