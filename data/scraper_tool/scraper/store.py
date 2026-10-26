"""Lưu ảnh + metadata, chống trùng (URL, MD5, perceptual hash), xuất JSON/CSV."""
from __future__ import annotations

import csv
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

FIELDS = [
    "id", "filename", "path", "category", "tags", "match", "matched_tags", "keywords", "image_url", "source_page",
    "title", "alt_text", "engine", "width", "height", "format", "bytes",
    "md5", "phash", "scraped_at",
]


class Store:
    def __init__(self, out_dir: str | Path, hash_threshold: int = 5) -> None:
        self.out = Path(out_dir)
        self.img_dir = self.out / "images"
        self.img_dir.mkdir(parents=True, exist_ok=True)
        self.json_path = self.out / "metadata.json"
        self.csv_path = self.out / "metadata.csv"
        self.threshold = hash_threshold
        self.lock = threading.RLock()
        self.records: list[dict] = []
        self.urls: set[str] = set()
        self.md5s: set[str] = set()
        self.phashes: list[int] = []
        self.next_id = 1
        self._unsaved = 0
        self._load()

    # ------------------------------------------------------------------ load
    def _load(self) -> None:
        if not self.json_path.exists():
            return
        try:
            data = json.loads(self.json_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        for r in data if isinstance(data, list) else []:
            if not (self.out / r.get("path", "")).exists():
                continue  # file ảnh đã bị xoá -> bỏ khỏi metadata
            self.records.append(r)
            self.urls.add(r["image_url"])
            self.md5s.add(r["md5"])
            try:
                self.phashes.append(int(r["phash"], 16))
            except (ValueError, KeyError):
                pass
            self.next_id = max(self.next_id, int(r["id"]) + 1)

    # ------------------------------------------------------------------ query
    def has_url(self, url: str) -> bool:
        with self.lock:
            return url in self.urls

    def count(self, category: str | None = None) -> int:
        with self.lock:
            if category is None:
                return len(self.records)
            return sum(1 for r in self.records if r["category"] == category)

    # ------------------------------------------------------------------ commit
    def commit(self, *, data: bytes, ext: str, md5: str, phash: int, meta: dict) -> tuple[dict | None, str]:
        """Ghi ảnh nếu không trùng. Trả về (record, "") hoặc (None, lý do)."""
        from .models import slugify

        with self.lock:
            if meta["image_url"] in self.urls or md5 in self.md5s:
                return None, "dup"
            for h in self.phashes:
                if (h ^ phash).bit_count() <= self.threshold:
                    return None, "dup"

            rid = self.next_id
            self.next_id += 1
            slug = slugify(meta["category"])
            folder = self.img_dir / slug
            folder.mkdir(parents=True, exist_ok=True)
            filename = f"{slug}_{rid:06d}.{ext}"
            (folder / filename).write_bytes(data)

            rec = {
                "id": rid,
                "filename": filename,
                "path": f"images/{slug}/{filename}",
                "category": meta["category"],
                "tags": list(meta.get("tags", [])),
                "match": meta.get("match", "full"),
                "matched_tags": list(meta.get("matched_tags", meta.get("tags", []))),
                "keywords": meta["keywords"],
                "image_url": meta["image_url"],
                "source_page": meta.get("source_page", ""),
                "title": meta.get("title", ""),
                "alt_text": meta.get("alt_text", ""),
                "engine": meta.get("engine", ""),
                "width": meta["width"],
                "height": meta["height"],
                "format": meta["format"],
                "bytes": len(data),
                "md5": md5,
                "phash": f"{phash:016x}",
                "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            self.records.append(rec)
            self.urls.add(rec["image_url"])
            self.md5s.add(md5)
            self.phashes.append(phash)
            self._unsaved += 1
            if self._unsaved >= 20:
                self.save()
            return rec, ""

    # ------------------------------------------------------------------ export
    def save(self) -> None:
        with self.lock:
            tmp = self.json_path.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(self.records, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(tmp, self.json_path)
            with open(self.csv_path, "w", newline="", encoding="utf-8-sig") as f:
                w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
                w.writeheader()
                for r in self.records:
                    row = dict(r)
                    row["tags"] = "|".join(r.get("tags", []))
                    row["matched_tags"] = "|".join(r.get("matched_tags", r.get("tags", [])))
                    w.writerow(row)
            self._unsaved = 0
