from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse, urldefrag


@dataclass
class Candidate:
    """Một ảnh ứng viên tìm thấy (chưa tải)."""
    image_url: str
    title: str = ""
    alt: str = ""
    source_page: str = ""
    engine: str = ""
    width: int = 0
    height: int = 0
    query: str = ""        # câu truy vấn thực tế đã tìm ra ảnh này
    matched: list = None   # type: ignore[assignment]  # các tag của kế hoạch mà ảnh khớp


def clean_text(s: str | None) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", "", html.unescape(s))
    return re.sub(r"\s+", " ", s).strip()


def normalize_url(u: str, base: str | None = None) -> str:
    u = html.unescape((u or "").strip())
    if u.startswith("//"):
        u = "https:" + u
    if base:
        u = urljoin(base, u)
    u, _ = urldefrag(u)
    return u


def is_http_url(u: str) -> bool:
    p = urlparse(u)
    return p.scheme in ("http", "https") and bool(p.netloc)


def fold(s: str) -> str:
    """Chữ thường + bỏ dấu tiếng Việt để so khớp từ khoá cấm."""
    s = s.replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower()


def slugify(s: str) -> str:
    s = fold(s)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s[:60] or "misc"
