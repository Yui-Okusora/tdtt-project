"""Cào ảnh từ link do người dùng đưa vào (trang web hoặc link ảnh trực tiếp)."""
from __future__ import annotations

import re
from collections import deque
from typing import Iterator
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from .http import FetchError, HttpClient
from .models import Candidate, clean_text, is_http_url, normalize_url

IMG_EXT = re.compile(r"\.(jpe?g|png|webp|gif|bmp)(\?|$)", re.I)
LAZY_ATTRS = ("data-src", "data-original", "data-lazy-src", "data-lazy", "data-full-src",
              "data-hi-res-src", "data-large-file", "src")
SRCSET_ATTRS = ("srcset", "data-srcset")


def _largest_from_srcset(srcset: str) -> str | None:
    best, best_w = None, -1.0
    for part in srcset.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        w = 0.0
        if len(bits) > 1:
            try:
                w = float(bits[1].rstrip("wx"))
            except ValueError:
                w = 0.0
        if w >= best_w:
            best, best_w = bits[0], w
    return best


def extract_images(html: str, base_url: str, engine: str = "link") -> tuple[list[Candidate], list[str]]:
    """Trả về (ảnh ứng viên, danh sách link <a> trong trang)."""
    soup = BeautifulSoup(html, "html.parser")
    page_title = clean_text(soup.title.string if soup.title else "")
    out: list[Candidate] = []
    seen: set[str] = set()

    def add(url: str | None, alt: str = "", title: str = "") -> None:
        if not url:
            return
        u = normalize_url(url, base_url)
        if not is_http_url(u) or u in seen or u.lower().split("?")[0].endswith(".svg"):
            return
        seen.add(u)
        out.append(Candidate(image_url=u, title=title or page_title, alt=alt,
                             source_page=base_url, engine=engine))

    for meta in soup.select('meta[property="og:image"], meta[name="twitter:image"]'):
        add(meta.get("content"), title=page_title)

    for img in soup.find_all("img"):
        alt = clean_text(img.get("alt"))
        title = clean_text(img.get("title")) or alt
        # ảnh trong <a href="...jpg"> thường là bản full-size
        parent = img.find_parent("a")
        if parent and parent.get("href") and IMG_EXT.search(parent["href"]):
            add(parent["href"], alt, title)
            continue
        url = None
        for attr in SRCSET_ATTRS:
            if img.get(attr):
                url = _largest_from_srcset(img[attr])
                if url:
                    break
        if not url:
            for attr in LAZY_ATTRS:
                v = img.get(attr)
                if v and not v.startswith("data:"):
                    url = v
                    break
        add(url, alt, title)

    for source in soup.select("picture source"):
        for attr in SRCSET_ATTRS:
            if source.get(attr):
                add(_largest_from_srcset(source[attr]))
                break

    links = [normalize_url(a["href"], base_url) for a in soup.find_all("a", href=True)]
    return out, [l for l in links if is_http_url(l)]


def crawl(http: HttpClient, start_url: str, depth: int = 0, max_pages: int = 30) -> Iterator[list[Candidate]]:
    """Duyệt BFS trong cùng domain, mỗi trang trả một batch ảnh."""
    start_url = normalize_url(start_url)
    host = urlparse(start_url).netloc
    queue: deque[tuple[str, int]] = deque([(start_url, 0)])
    visited: set[str] = set()
    pages = 0
    while queue and pages < max_pages:
        url, d = queue.popleft()
        if url in visited:
            continue
        visited.add(url)

        if IMG_EXT.search(url) and d == 0:
            yield [Candidate(image_url=url, source_page=url, engine="link")]
            pages += 1
            continue
        try:
            r = http.get(url, scale=1.5)
        except FetchError:
            if d == 0:
                raise
            continue
        pages += 1
        ctype = r.headers.get("Content-Type", "").lower()
        if ctype.startswith("image/"):
            yield [Candidate(image_url=r.url, source_page=r.url, engine="link")]
            continue
        items, links = extract_images(r.text, r.url)
        if items:
            yield items
        if d < depth:
            for l in links:
                if urlparse(l).netloc == host and l not in visited and not IMG_EXT.search(l):
                    queue.append((l, d + 1))
