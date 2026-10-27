"""Cào ảnh từ link do người dùng đưa vào (trang web hoặc link ảnh trực tiếp)."""
from __future__ import annotations

import re
from collections import deque
from typing import Iterator
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from .http import FetchError, HttpClient
from .models import Candidate, clean_text, is_http_url, normalize_url

# ảnh "trang trí" của diễn đàn/web: avatar, emoji, biểu tượng, banner quảng cáo...
JUNK_URL = re.compile(
    r"(avatar|emoji|emoticon|smil(e|ies)|sprite|favicon|/icons?/|icon[-_]|[-_]icon|badge|rank|"
    r"button|spacer|pixel|blank\.|loading|/ads?/|banner|logo|signature|/flags?/|reaction)", re.I)
JUNK_CLASS = re.compile(r"(avatar|emoji|smil|icon|badge|logo|signature|reaction)", re.I)
NEXT_TEXT = {"next", "next page", "older", "›", "»", ">", ">>", "sau", "tiếp", "tiếp theo", "trang sau", "trang tiếp"}
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


def _page_title(soup: BeautifulSoup) -> str:
    """Tiêu đề thread/bài viết: ưu tiên og:title, rồi <h1>, rồi <title>."""
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        return clean_text(og["content"])
    h1 = soup.find("h1")
    if h1 and clean_text(h1.get_text()):
        return clean_text(h1.get_text())
    return clean_text(soup.title.string if soup.title else "")


def _is_junk_img(img, url: str) -> bool:
    if JUNK_URL.search(url) or JUNK_CLASS.search(" ".join(img.get("class") or [])):
        return True
    for attr in ("width", "height"):                    # ảnh có khai báo kích thước quá nhỏ
        v = str(img.get(attr, "")).strip().rstrip("px")
        if v.isdigit() and int(v) < 80:
            return True
    return False


def find_next_page(soup: BeautifulSoup, base_url: str) -> str | None:
    """Link "trang sau" của thread/danh sách (rel=next hoặc chữ 'next', 'sau', '›'...)."""
    tag = soup.find("link", rel=lambda v: v and "next" in v) or soup.find("a", rel=lambda v: v and "next" in v)
    if tag and tag.get("href"):
        return normalize_url(tag["href"], base_url)
    for a in soup.find_all("a", href=True):
        txt = clean_text(a.get_text()).lower()
        cls = " ".join(a.get("class") or []).lower()
        if txt in NEXT_TEXT or re.search(r"(^|[-_ ])next($|[-_ ])", cls):
            return normalize_url(a["href"], base_url)
    return None


def extract_images(html: str, base_url: str, engine: str = "link") -> tuple[list[Candidate], list[str], str | None]:
    """Trả về (ảnh ứng viên, danh sách link <a> trong trang, link trang sau)."""
    soup = BeautifulSoup(html, "html.parser")
    page_title = _page_title(soup)
    out: list[Candidate] = []
    seen: set[str] = set()

    def add(url: str | None, alt: str = "", title: str = "", img=None) -> None:
        if not url:
            return
        u = normalize_url(url, base_url)
        if not is_http_url(u) or u in seen or u.lower().split("?")[0].endswith(".svg"):
            return
        if img is not None and _is_junk_img(img, u):
            return
        seen.add(u)
        out.append(Candidate(image_url=u, title=title or page_title, alt=alt,
                             source_page=base_url, engine=engine))

    for meta in soup.select('meta[property="og:image"], meta[name="twitter:image"]'):
        add(meta.get("content"), title=page_title)

    for img in soup.find_all("img"):
        alt = clean_text(img.get("alt"))
        title = clean_text(img.get("title"))
        # ảnh trong <a href="...jpg"> thường là bản full-size
        parent = img.find_parent("a")
        if parent and parent.get("href") and IMG_EXT.search(parent["href"]):
            add(parent["href"], alt, title, img)
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
        add(url, alt, title, img)

    for source in soup.select("picture source"):
        for attr in SRCSET_ATTRS:
            if source.get(attr):
                add(_largest_from_srcset(source[attr]))
                break

    links = [normalize_url(a["href"], base_url) for a in soup.find_all("a", href=True)]
    return out, [l for l in links if is_http_url(l)], find_next_page(soup, base_url)


def crawl(http: HttpClient, start_url: str, depth: int = 0, max_pages: int = 30,
          allow_nsfw: bool = False, follow_next: bool = True) -> Iterator[list[Candidate]]:
    """Duyệt link người dùng đưa vào. Reddit -> JSON; trang thường -> BFS cùng domain
    (depth) và tự lật "trang sau" của thread/diễn đàn (follow_next), tối đa max_pages trang."""
    from .reddit import is_reddit_link, listing_source
    if is_reddit_link(start_url):
        yield from listing_source(http, start_url, max_pages, allow_nsfw)
        return

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
        items, links, nxt = extract_images(r.text, r.url)
        if items:
            yield items
        if follow_next and nxt and nxt not in visited and urlparse(nxt).netloc == host:
            queue.appendleft((nxt, d))          # lật trang sau trước, cùng độ sâu
        if d < depth:
            for l in links:
                if urlparse(l).netloc == host and l not in visited and not IMG_EXT.search(l):
                    queue.append((l, d + 1))
