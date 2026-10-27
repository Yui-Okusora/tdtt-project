"""Reddit qua JSON công khai (thêm `.json`); dùng được cookie đăng nhập của bạn qua --cookies.

- Tìm theo từ khoá:   https://www.reddit.com/search.json?q=...
- Theo subreddit:     link dạng  https://www.reddit.com/r/<sub>/  hoặc  r/<sub>  (top mọi thời đại)
- Một bài đăng:       https://www.reddit.com/r/<sub>/comments/<id>/...
Tiêu đề bài đăng được dùng làm title (caption) của ảnh. Hỗ trợ ảnh đơn, gallery, preview,
link imgur trực tiếp. Bài NSFW bị bỏ qua trừ khi --safesearch off.
"""
from __future__ import annotations

import re
from typing import Iterator
from urllib.parse import urlparse

from .http import FetchError, HttpClient
from .models import Candidate, clean_text, is_http_url, normalize_url

REDDIT_UA = {"User-Agent": "image-scraper/1.0 (personal local use)"}
IMG_EXT = re.compile(r"\.(jpe?g|png|webp|gif|bmp)(\?|$)", re.I)


def _imgur_direct(u: str) -> str | None:
    p = urlparse(u)
    if p.netloc.endswith("imgur.com") and not p.netloc.startswith("i."):
        m = re.fullmatch(r"/([A-Za-z0-9]{5,8})", p.path)
        if m:
            return f"https://i.imgur.com/{m.group(1)}.jpg"
    return None


def post_to_candidates(post: dict, allow_nsfw: bool, engine: str = "reddit") -> list[Candidate]:
    if post.get("over_18") and not allow_nsfw:
        return []
    if post.get("is_video"):
        return []
    title = clean_text(post.get("title"))
    page = "https://www.reddit.com" + post.get("permalink", "")
    urls: list[str] = []

    if post.get("is_gallery") and post.get("media_metadata"):
        order = [it["media_id"] for it in (post.get("gallery_data") or {}).get("items", [])]
        for mid in order or list(post["media_metadata"]):
            meta = post["media_metadata"].get(mid) or {}
            src = (meta.get("s") or {})
            u = src.get("u") or src.get("gif")
            if meta.get("status", "valid") == "valid" and u:
                urls.append(u)
    else:
        u = post.get("url_overridden_by_dest") or post.get("url") or ""
        if IMG_EXT.search(urlparse(u).path or "") or "i.redd.it" in u:
            urls.append(u)
        elif (d := _imgur_direct(u)):
            urls.append(d)
        else:
            prev = (post.get("preview") or {}).get("images") or []
            if prev and post.get("post_hint") in ("image", "link"):
                urls.append(prev[0].get("source", {}).get("url", ""))

    out = []
    for u in urls:
        u = normalize_url(u)
        if is_http_url(u):
            out.append(Candidate(image_url=u, title=title, source_page=page, engine=engine))
    return out


def _listing(data) -> dict:
    if isinstance(data, list) and data:          # trang bình luận: [bài đăng, bình luận]
        data = data[0]
    return (data or {}).get("data", {}) if isinstance(data, dict) else {}


def fetch_pages(http: HttpClient, url: str, params: dict, max_pages: int, allow_nsfw: bool,
                engine: str = "reddit") -> Iterator[list[Candidate]]:
    after = None
    for _ in range(max_pages):
        q = dict(params, raw_json=1, limit=100)
        if after:
            q["after"] = after
        r = http.get(url, params=q, kind="json", headers=REDDIT_UA, scale=3.0, retries=1)
        try:
            data = _listing(r.json())
        except ValueError:
            raise FetchError("Reddit trả dữ liệu không phải JSON (có thể bị chặn/cần cookie)")
        children = data.get("children") or []
        items: list[Candidate] = []
        for ch in children:
            items += post_to_candidates(ch.get("data", {}), allow_nsfw, engine)
        if items:
            yield items
        after = data.get("after")
        if not after or not children:
            return


def is_reddit_link(link: str) -> bool:
    return bool(re.match(r"^(https?://)?((www|old|new)\.)?reddit\.com/|^/?r/[\w]+/?$", link.strip(), re.I))


def listing_source(http: HttpClient, link: str, max_pages: int, allow_nsfw: bool) -> Iterator[list[Candidate]]:
    """Link Reddit do người dùng đưa vào (-l)."""
    link = link.strip()
    if re.fullmatch(r"/?r/[\w]+/?", link):
        link = "https://www.reddit.com/" + link.strip("/") + "/"
    if not link.startswith("http"):
        link = "https://" + link
    p = urlparse(link)
    path = p.path.rstrip("/")
    if re.fullmatch(r"/r/[\w]+", path):            # subreddit -> top mọi thời đại
        yield from fetch_pages(http, f"https://www.reddit.com{path}/top.json", {"t": "all"}, max_pages, allow_nsfw)
    elif path.endswith(".json"):
        yield from fetch_pages(http, f"https://www.reddit.com{path}", {}, max_pages, allow_nsfw)
    else:
        yield from fetch_pages(http, f"https://www.reddit.com{path}.json", {}, max_pages, allow_nsfw)
