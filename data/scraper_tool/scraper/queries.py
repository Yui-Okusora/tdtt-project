"""Mở rộng truy vấn để vượt trần số kết quả của một câu tìm kiếm.

Mỗi search engine chỉ trả về một số lượng kết quả hữu hạn cho MỘT câu truy vấn. Muốn lấy nhiều
hơn phải tìm bằng nhiều câu khác nhau (nhưng vẫn chứa đủ tag): đồng nghĩa, thêm từ bổ nghĩa
(photo, hd, góc chụp, bối cảnh...), thêm màu, thêm năm.
"""
from __future__ import annotations

from typing import Iterator

from .synonyms import Synonyms, norm

MODIFIERS = [
    "photo", "hd", "high resolution", "aesthetic", "stock photo", "professional", "natural light",
    "studio", "outdoor", "indoor", "candid", "4k", "wallpaper", "real life", "close up",
    "full body", "street", "vintage", "minimalist", "black and white", "dark", "bright",
    "white background", "blurry background", "wide angle", "top view", "side view",
    "back view", "front view", "portrait",
]
COLORS = ["red", "blue", "green", "black", "white", "yellow", "pink", "brown", "gray", "purple", "orange"]
YEARS = ["2025", "2024", "2023", "2022", "2021", "2020"]


def expand(tags: list[str], syn: Synonyms, limit: int = 80) -> Iterator[str]:
    """Sinh lần lượt các câu truy vấn khác nhau (không gồm câu gốc), tối đa `limit`."""
    base = syn.query(tags)
    used_words = set(norm(base).split())
    seen = {norm(base)}
    count = 0

    def emit(q: str) -> str | None:
        nonlocal count
        k = norm(q)
        if k in seen or count >= limit:
            return None
        seen.add(k)
        count += 1
        return q

    def mods(prefix_first: bool = False):
        for m in MODIFIERS:
            if set(norm(m).split()) <= used_words:
                continue
            yield m

    variants = syn.variants(tags)
    # 1) base + từ bổ nghĩa (nhóm đầu)
    modlist = list(mods())
    for m in modlist[:12]:
        if (q := emit(f"{base} {m}")):
            yield q
    # 2) đồng nghĩa, rồi đồng nghĩa + vài từ bổ nghĩa
    for v in variants:
        if (q := emit(v)):
            yield q
    for v in variants[:6]:
        for m in modlist[:4]:
            if (q := emit(f"{v} {m}")):
                yield q
    # 3) phần còn lại của từ bổ nghĩa
    for m in modlist[12:]:
        if (q := emit(f"{base} {m}")):
            yield q
    # 4) màu sắc, năm
    for c in COLORS:
        if c not in used_words and (q := emit(f"{c} {base}")):
            yield q
    for y in YEARS:
        if (q := emit(f"{base} {y}")):
            yield q
    # 5) tổ hợp 2 từ bổ nghĩa (khi vẫn chưa đủ)
    for i, a in enumerate(modlist[:10]):
        for b in modlist[i + 1:10]:
            if (q := emit(f"{base} {a} {b}")):
                yield q
