"""Origin classification and review flags for the pose schema.

User lists apply to `tags` only (key "tags" in `lists`).
"""
from .config import MODE_AUTO
from .schema import ALL_FIELD_NAMES

ORIGIN_USER = "user_list"   # (legacy) value found in the user's list
ORIGIN_NEW = "ai_new"       # (legacy) AI proposed a value outside the user's list
ORIGIN_AI = "ai"            # plain AI value
ORIGIN_MANUAL = "manual"    # edited / confirmed by hand
ORIGIN_EMPTY = "empty"


def classify(rec, field_name: str, lists: dict, mode: str) -> str:
    value = _value(rec, field_name) if rec.result else None
    has_value = bool(value)
    if field_name in rec.edited_fields:
        return ORIGIN_MANUAL if has_value else ORIGIN_EMPTY
    if not has_value:
        return ORIGIN_EMPTY
    allowed = lists.get(field_name) or []
    if field_name == "tags" and allowed and mode != MODE_AUTO:
        return ORIGIN_USER if all(t in allowed for t in value) else ORIGIN_NEW
    return ORIGIN_AI


def uncertain_fields(rec, lists: dict, mode: str) -> list[str]:
    """Fields that need the user's attention (computed by schema.clean_result)."""
    if not rec.result or not rec.result.get("valid", False):
        return []
    out = []
    for name in ALL_FIELD_NAMES:
        if name in rec.edited_fields and _value(rec, name):
            continue
        if name in rec.result.get("uncertain_fields", []):
            out.append(name)
    return out


def needs_review(rec, lists: dict, mode: str) -> bool:
    return bool(uncertain_fields(rec, lists, mode)) and not rec.reviewed


def _value(rec, name: str):
    return rec.result.get(name)
