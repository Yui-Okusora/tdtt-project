"""Persistent image/result store (crash recovery). Never contains API keys."""
import hashlib
import json
import os
import re
import threading
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

from PIL import Image

from .imaging import ALLOWED_EXTS, make_thumbnail

PENDING, PROCESSING, COMPLETED, ERROR = "pending", "processing", "completed", "error"

_ILLEGAL = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_RESERVED = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)), *(f"lpt{i}" for i in range(1, 10))}
MAX_STEM = 150


def clean_filename(stem: str, ext: str) -> str:
    """Validate a user-typed name (without extension) and return stem+ext, or raise ValueError."""
    stem = (stem or "").strip()
    if ext and stem.lower().endswith(ext.lower()):
        stem = stem[: -len(ext)]
    stem = stem.strip().rstrip(". ")
    if not stem:
        raise ValueError("Tên file không được để trống.")
    if _ILLEGAL.search(stem):
        raise ValueError('Tên file không được chứa các ký tự \\ / : * ? " < > |')
    if stem.lower() in _RESERVED:
        raise ValueError(f"“{stem}” là tên dành riêng của Windows.")
    if len(stem) > MAX_STEM:
        raise ValueError(f"Tên file quá dài (tối đa {MAX_STEM} ký tự).")
    return stem + ext


@dataclass
class ImageRecord:
    id: str
    filename: str
    stored_name: str
    thumb_name: str
    size_bytes: int
    sha256: str
    status: str = PENDING
    result: dict | None = None
    error: str | None = None
    reviewed: bool = False
    edited_fields: list = field(default_factory=list)
    rev: int = 0        # bumped to force UI widgets to refresh
    attempts: int = 0
    original_filename: str = ""
    width: int = 0
    height: int = 0
    tokens_in: int = 0       # actual usage of the last successful analysis (from the API)
    tokens_out: int = 0
    tokens_spent: int = 0    # cumulative actual tokens over all successful analyses
    tokens_est_in: int = 0   # our estimate at analysis time (for calibration)
    tokens_est_out: int = 0


class ImageStore:
    def __init__(self, data_dir):
        self.dir = Path(data_dir)
        self.img_dir = self.dir / "images"
        self.thumb_dir = self.dir / "thumbs"
        self.img_dir.mkdir(parents=True, exist_ok=True)
        self.thumb_dir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.records: list[ImageRecord] = []
        self.settings: dict = {}
        self._file = self.dir / "session.json"
        self._load()

    # ---- persistence ---------------------------------------------------
    def _load(self):
        if not self._file.exists():
            return
        try:
            data = json.loads(self._file.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            os.replace(self._file, self._file.with_suffix(".corrupt.json"))  # keep, don't lose
            return
        self.settings = data.get("settings", {})
        for d in data.get("records", []):
            try:
                rec = ImageRecord(**d)
            except TypeError:
                continue
            if rec.status == PROCESSING:      # interrupted run -> recover as pending
                rec.status = PENDING
            if (self.img_dir / rec.stored_name).exists():
                self.records.append(rec)

    def save(self):
        with self.lock:
            payload = {"version": 1, "settings": self.settings,
                       "records": [asdict(r) for r in self.records]}
            tmp = self._file.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
            os.replace(tmp, self._file)

    # ---- queries -------------------------------------------------------
    def get(self, rid: str) -> ImageRecord | None:
        with self.lock:
            return next((r for r in self.records if r.id == rid), None)

    def ids_by_status(self, *statuses) -> list[str]:
        with self.lock:
            return [r.id for r in self.records if r.status in statuses]

    def image_path(self, rec: ImageRecord) -> Path:
        return self.img_dir / rec.stored_name

    def thumb_path(self, rec: ImageRecord) -> Path:
        return self.thumb_dir / rec.thumb_name

    # ---- mutations -----------------------------------------------------
    def _unique_name(self, name: str) -> str:
        existing = {r.filename for r in self.records}
        if name not in existing:
            return name
        stem, ext = os.path.splitext(name)
        i = 2
        while f"{stem}_{i}{ext}" in existing:
            i += 1
        return f"{stem}_{i}{ext}"

    def add_files(self, items) -> tuple[int, list[tuple[str, str]]]:
        """items: iterable of (filename, bytes). Returns (added, [(name, reason)])."""
        added, skipped = 0, []
        with self.lock:
            hashes = {r.sha256 for r in self.records}
            for name, data in items:
                name = os.path.basename(name)
                ext = os.path.splitext(name)[1].lower()
                if ext not in ALLOWED_EXTS:
                    skipped.append((name, "định dạng không hỗ trợ"))
                    continue
                h = hashlib.sha256(data).hexdigest()
                if h in hashes:
                    skipped.append((name, "ảnh trùng (đã có trong danh sách)"))
                    continue
                rid = uuid.uuid4().hex[:12]
                path = self.img_dir / f"{rid}{ext}"
                path.write_bytes(data)
                try:
                    with Image.open(path) as im:
                        width, height = im.size
                        im.verify()
                    thumb = make_thumbnail(path)
                except Exception:
                    path.unlink(missing_ok=True)
                    skipped.append((name, "file ảnh hỏng hoặc không đọc được"))
                    continue
                (self.thumb_dir / f"{rid}.jpg").write_bytes(thumb)
                self.records.append(ImageRecord(
                    id=rid, filename=self._unique_name(name), stored_name=path.name,
                    thumb_name=f"{rid}.jpg", size_bytes=len(data), sha256=h,
                    original_filename=name, width=width, height=height))
                hashes.add(h)
                added += 1
            self.save()
        return added, skipped

    # ---- dimensions / preview -------------------------------------------
    def dims(self, rec: ImageRecord) -> tuple[int, int]:
        if not (rec.width and rec.height):
            try:
                with Image.open(self.image_path(rec)) as im:
                    rec.width, rec.height = im.size
            except OSError:
                return 0, 0
        return rec.width, rec.height

    def preview_path(self, rec: ImageRecord, side: int = 900) -> Path:
        """Medium-size preview for the detail panel (generated lazily, cached)."""
        d = self.dir / "previews"
        d.mkdir(exist_ok=True)
        p = d / f"{rec.id}.jpg"
        if not p.exists():
            try:
                p.write_bytes(make_thumbnail(self.image_path(rec), side))
            except OSError:
                return self.thumb_path(rec)
        return p

    # ---- renaming (display / export name only; the stored file is untouched)
    def plan_rename(self, mapping: dict[str, str]) -> dict[str, str]:
        """mapping: id -> new name WITHOUT extension. Returns {id: new_filename} for real changes.
        Raises ValueError (nothing is changed) on invalid or duplicate names."""
        with self.lock:
            new = {}
            for rid, stem in mapping.items():
                rec = self.get(rid)
                if rec is None:
                    continue
                ext = os.path.splitext(rec.filename)[1]
                try:
                    new[rid] = clean_filename(stem, ext)
                except ValueError as e:
                    raise ValueError(f"{rec.filename}: {e}")
            seen = set()
            for r in self.records:
                name = new.get(r.id, r.filename)
                if name.lower() in seen:
                    raise ValueError(f"Trùng tên: “{name}” đã được dùng bởi ảnh khác "
                                     f"(hoặc bị đặt trùng trong cùng lần đổi tên).")
                seen.add(name.lower())
            return {rid: n for rid, n in new.items() if n != self.get(rid).filename}

    def rename(self, rid: str, new_stem: str) -> str:
        changes = self.plan_rename({rid: new_stem})
        with self.lock:
            rec = self.get(rid)
            if rid in changes:
                rec.filename = changes[rid]
                self.save()
            return rec.filename

    def bulk_rename(self, mapping: dict[str, str]) -> int:
        changes = self.plan_rename(mapping)
        with self.lock:
            for rid, name in changes.items():
                self.get(rid).filename = name
            if changes:
                self.save()
        return len(changes)

    def remove(self, rid: str):
        with self.lock:
            rec = self.get(rid)
            if not rec:
                return
            self.records.remove(rec)
            self.image_path(rec).unlink(missing_ok=True)
            self.thumb_path(rec).unlink(missing_ok=True)
            (self.dir / "previews" / f"{rec.id}.jpg").unlink(missing_ok=True)
            self.save()

    def clear(self):
        for rid in [r.id for r in list(self.records)]:
            self.remove(rid)
