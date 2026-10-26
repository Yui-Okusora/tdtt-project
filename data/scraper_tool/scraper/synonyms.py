"""Bảng đồng nghĩa hai chiều (Việt <-> Anh, số nhiều, biến thể...).

Mỗi nhóm là các cụm từ tương đương nhau: nhập từ nào trong nhóm cũng như nhập các từ còn lại.
Phần tử ĐẦU TIÊN của nhóm là từ "chuẩn", dùng làm câu truy vấn gửi cho search engine.
Hai nhóm có chung một cụm từ sẽ tự gộp thành một nhóm (nên file của người dùng có thể
nối thêm vào nhóm có sẵn).
"""
from __future__ import annotations

import re
from pathlib import Path

from .models import fold

BUILTIN = Path(__file__).with_name("default_aliases.txt")


def norm(s: str) -> str:
    """Chữ thường, bỏ dấu, ký tự lạ -> khoảng trắng: 'T-Shirt' -> 't shirt'."""
    return re.sub(r"[^a-z0-9]+", " ", fold(s)).strip()


def parse_file(path: str | Path) -> list[list[str]]:
    groups: list[list[str]] = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].replace("=", ",")
        items = [re.sub(r"\s+", " ", p).strip() for p in line.split(",")]
        items = [p for p in items if norm(p)]
        if len(items) >= 2:
            groups.append(items)
    return groups


class Synonyms:
    def __init__(self, groups: list[list[str]] | None = None) -> None:
        self.groups: list[list[str]] = []   # giữ nguyên chữ gốc để làm câu truy vấn
        self.index: dict[str, int] = {}     # cụm đã chuẩn hoá -> chỉ số nhóm
        for g in groups or []:
            self._add(g)

    @classmethod
    def load(cls, extra_files: list[str] | None = None, builtin: bool = True) -> "Synonyms":
        groups: list[list[str]] = []
        if builtin and BUILTIN.exists():
            groups += parse_file(BUILTIN)
        for f in extra_files or []:
            groups += parse_file(f)
        return cls(groups)

    def _add(self, items: list[str]) -> None:
        hit = sorted({self.index[norm(p)] for p in items if norm(p) in self.index})
        if not hit:
            self.groups.append([])
            hit = [len(self.groups) - 1]
        target = hit[0]
        # gộp các nhóm có chung cụm vào nhóm sớm nhất
        for other in hit[1:]:
            self.groups[target] += self.groups[other]
            self.groups[other] = []
        seen = {norm(p) for p in self.groups[target]}
        for p in items:
            if norm(p) not in seen:
                seen.add(norm(p))
                self.groups[target].append(p)
        self.index = {norm(p): i for i, g in enumerate(self.groups) for p in g}

    def _split(self, tag: str) -> list[tuple[int | None, str]]:
        """Tách tag thành các đoạn (chỉ số nhóm hoặc None, chữ gốc); ưu tiên cụm dài nhất có trong bảng."""
        orig = tag.split()
        words = [norm(w) for w in orig]
        out: list[tuple[int | None, str]] = []
        i, n = 0, len(words)
        while i < n:
            for j in range(n, i, -1):
                phrase = " ".join(w for w in words[i:j] if w)
                gi = self.index.get(phrase)
                if phrase and gi is not None:
                    out.append((gi, " ".join(orig[i:j])))
                    i = j
                    break
            else:
                if words[i]:
                    out.append((None, orig[i]))
                i += 1
        return out

    def segments(self, tag: str) -> list[tuple[list[str], str]]:
        """Mỗi đoạn = (các cụm tương đương đã chuẩn hoá, từ chuẩn để tìm)."""
        res = []
        for gi, text in self._split(tag):
            if gi is None:
                res.append(([norm(text)], text))
            else:
                g = self.groups[gi]
                res.append(([norm(p) for p in g], g[0]))
        return res

    def query(self, tags: list[str]) -> str:
        return " ".join(canon for t in tags for _, canon in self.segments(t))

    def variants(self, tags: list[str]) -> list[str]:
        """Các câu truy vấn thay MỘT đoạn bằng cách diễn đạt tương đương khác (chỉ chữ ASCII/tiếng Anh)."""
        segs = [s for t in tags for s in self._split(t)]
        base = [self.groups[gi][0] if gi is not None else text for gi, text in segs]
        out: list[str] = []
        for k, (gi, _) in enumerate(segs):
            if gi is None:
                continue
            for alt in self.groups[gi][1:]:
                if not alt.isascii():
                    continue
                q = " ".join(base[:k] + [alt] + base[k + 1:])
                if q not in out:
                    out.append(q)
        return out
