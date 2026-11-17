"""JSON export: whitelisted fields only, validated, never contains secrets."""
import io
import json
import os
import shutil
import zipfile
from pathlib import Path

from .normalize import is_snake_case
from .schema import ANGLE_VALUES, FILTER_FIELDS, MAX_SUBJECTS, SHOT_VALUES, SUPPORT_VALUES

SCHEMA_VERSION = "2.0"
FIELDS_FULL, FIELDS_FILTER = "full", "filter"


def exportable(records):
    """Split records into (to_export, skipped). Records without a result or with valid=false are skipped."""
    ok, skipped = [], []
    for rec in records:
        (ok if rec.result and rec.result.get("valid") else skipped).append(rec)
    return ok, skipped


def record_to_entry(rec, *, fields=FIELDS_FULL, include_filename=True,
                    include_review=False, review_required=False) -> dict:
    """Build one export entry (flat, same key order as the model's output schema)."""
    r = rec.result
    entry: dict = {}
    if include_filename:
        entry["filename"] = rec.filename
    if fields == FIELDS_FULL:   # .get(): results saved by an older schema must not crash the UI
        entry["valid"] = r.get("valid", False)
        entry["count"] = r.get("count", 0)
        entry["shot"] = r.get("shot", "")
        entry["angle"] = r.get("angle", "")
        entry["support"] = r.get("support", "")
        entry["prop"] = r.get("prop")
        entry["group_prompt"] = r.get("group_prompt")
        entry["poses"] = list(r.get("poses") or [])
        entry["tags"] = list(r.get("tags") or [])
        if "outfit" in r:               # only present when the image was analysed in Fashion mode
            entry["outfit"] = r["outfit"]
    else:
        for k in FILTER_FIELDS:
            entry[k] = list(r.get(k) or []) if k == "tags" else r.get(k)
    if include_review:
        entry["status"] = rec.status
        entry["review_required"] = bool(review_required)
    return entry


def validate_entries(entries: list[dict], *, fields=FIELDS_FULL) -> list[tuple[str, str]]:
    """Return [(severity, message)]. Any 'error' must block the export."""
    issues = []
    seen = set()
    enums = {"shot": SHOT_VALUES, "angle": ANGLE_VALUES, "support": SUPPORT_VALUES}
    for i, e in enumerate(entries, 1):
        who = e.get("filename", f"#{i}")
        if "filename" in e:
            if e["filename"] in seen:
                issues.append(("error", f"{who}: tên file bị trùng trong lần xuất."))
            seen.add(e["filename"])

        if fields == FIELDS_FULL and e.get("valid") is False:
            issues.append(("warning", f"{who}: ảnh bị đánh dấu valid=false (không đạt quality gate)."))
            continue

        for k, allowed in enums.items():
            v = e.get(k, "")
            if not v:
                issues.append(("error", f"{who}: '{k}' đang trống."))
            elif v not in allowed:
                issues.append(("error", f"{who}: {k} = '{v}' không nằm trong {list(allowed)}."))

        prop = e.get("prop")
        if prop is not None and not is_snake_case(prop):
            issues.append(("error", f"{who}: prop = '{prop}' không phải snake_case."))
        if e.get("support") != "ground" and not prop:
            issues.append(("error", f"{who}: support = '{e.get('support')}' nhưng prop đang trống."))

        tags = e.get("tags", [])
        if not tags:
            issues.append(("error", f"{who}: tags đang trống."))
        for t in tags:
            if not is_snake_case(t):
                issues.append(("error", f"{who}: tag '{t}' không phải snake_case."))

        if fields == FIELDS_FULL:
            count, poses = e.get("count"), e.get("poses", [])
            if not isinstance(count, int) or not 1 <= count <= MAX_SUBJECTS:
                issues.append(("error", f"{who}: count = {count!r} ngoài khoảng 1..{MAX_SUBJECTS}."))
            elif len(poses) != count:
                issues.append(("error", f"{who}: poses có {len(poses)} phần tử nhưng count = {count}."))
            for j, p in enumerate(poses, 1):
                if not str(p).strip():
                    issues.append(("error", f"{who}: poses[{j}] đang trống."))
            if "outfit" in e and not str(e.get("outfit") or "").strip():
                issues.append(("error", f"{who}: outfit đang trống."))
            if count == 1 and e.get("group_prompt") is not None:
                issues.append(("error", f"{who}: group_prompt phải là null khi count = 1."))
            if isinstance(count, int) and count >= 2 and not str(e.get("group_prompt") or "").strip():
                issues.append(("error", f"{who}: thiếu group_prompt (count >= 2)."))
    return issues


def aggregate(entries: list[dict]) -> dict:
    return {"schema_version": SCHEMA_VERSION, "images": entries}


def dumps(obj, secrets=()) -> str:
    text = json.dumps(obj, ensure_ascii=False, indent=2)
    json.loads(text)  # round-trip check: guarantees valid JSON
    for s in secrets:
        if s and s in text:
            raise ValueError("Dữ liệu xuất chứa API Key – đã chặn xuất.")
    return text


def per_image_files(records, entries: list[dict]) -> dict[str, str]:
    """{archive_name: json_text}. Per-image files use the reference object (no wrapper)."""
    stems = [Path(r.filename).stem for r in records]
    files = {}
    for rec, entry, stem in zip(records, entries, stems):
        name = f"{stem}.json" if stems.count(stem) == 1 else f"{rec.filename}.json"
        files[name] = dumps(entry)
    return files


def build_zip(files: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, text in files.items():
            z.writestr(name, text)
    return buf.getvalue()


def safe_write(path, text: str, overwrite: bool = False) -> Path:
    """Write text to path; refuse to replace an existing file unless allowed."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists() and not overwrite:
        raise FileExistsError(f"'{p}' đã tồn tại. Bật 'Cho phép ghi đè' hoặc đổi tên file.")
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, p)
    return p


def copy_renamed_images(pairs, out_dir, overwrite: bool = False) -> int:
    """pairs: [(source_path, new_filename)]. Copies originals under their new names (sources untouched)."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    clashes = [name for _, name in pairs if (out / name).exists()]
    if clashes and not overwrite:
        raise FileExistsError(f"{len(clashes)} file đã tồn tại trong '{out}' (vd: {clashes[0]}). "
                              f"Bật “Cho phép ghi đè” hoặc chọn thư mục khác.")
    for src, name in pairs:
        shutil.copy2(src, out / name)
    return len(pairs)


def build_images_zip(pairs) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:   # images are already compressed
        for src, name in pairs:
            z.write(src, name)
    return buf.getvalue()


# ---- synchronized dataset: images/ + json/ with matching names -------------------------
def _write_dataset(zf, records, entries, image_path_of):
    """images/<filename> and json/<stem>.json for every record, names always taken from the current
    record names (so renames done in the tool are reflected in both folders)."""
    files = per_image_files(records, entries)          # {json_name: text}, same order as records
    for rec in records:
        zf.write(image_path_of(rec), f"images/{rec.filename}", compress_type=zipfile.ZIP_STORED)
    for name, text in files.items():
        zf.writestr(f"json/{name}", text, compress_type=zipfile.ZIP_DEFLATED)


def build_dataset_zip(records, entries, image_path_of) -> bytes:
    """entries must come from record_to_entry(..., include_filename=True), aligned with records."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        _write_dataset(z, records, entries, image_path_of)
    return buf.getvalue()


def write_dataset_zip(path, records, entries, image_path_of, overwrite: bool = False) -> Path:
    """Stream the dataset ZIP straight to disk (no big in-memory buffer)."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists() and not overwrite:
        raise FileExistsError(f"'{p}' đã tồn tại. Bật 'Cho phép ghi đè' hoặc đổi tên file.")
    tmp = p.with_suffix(p.suffix + ".tmp")
    try:
        with zipfile.ZipFile(tmp, "w") as z:
            _write_dataset(z, records, entries, image_path_of)
        os.replace(tmp, p)
    finally:
        tmp.unlink(missing_ok=True)
    return p
