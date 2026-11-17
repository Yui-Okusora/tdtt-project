"""Output schema (pose / spatial-framing extractor) + validation of model output."""
import json
import re

from .config import MODE_STRICT
from .errors import InvalidResponse
from .normalize import to_snake_case

SHOT_VALUES = ("closeup", "half_body", "three_quarter", "full_body")
ANGLE_VALUES = ("eye_level", "low_angle", "high_angle", "over_shoulder", "dutch_angle")
SUPPORT_VALUES = ("ground", "seated", "lying", "leaning", "airborne")
ENUM_FIELDS = {"shot": SHOT_VALUES, "angle": ANGLE_VALUES, "support": SUPPORT_VALUES}

REQUIRED_KEYS = ("valid", "count", "shot", "angle", "support",
                 "prop", "group_prompt", "poses", "tags")
# Retrieval/filter fields (used by the "filter" export mode)
FILTER_FIELDS = ("shot", "angle", "support", "prop", "tags")
# Every field that can be flagged "uncertain" / reviewed
ALL_FIELD_NAMES = ("shot", "angle", "support", "prop", "group_prompt", "poses", "tags", "outfit")
MAX_SUBJECTS = 4
MIN_TAGS, MAX_TAGS = 3, 6


def build_json_schema(strict_lists: dict | None = None, fashion: bool = False) -> dict:
    """JSON Schema sent to the model. In strict mode, `tags` items become an enum of the user's list.
    In fashion mode a free-text `outfit` field is added."""
    tag_items = {"type": "string"}
    allowed_tags = (strict_lists or {}).get("tags")
    if allowed_tags:
        tag_items = {"type": "string", "enum": list(allowed_tags)}
    schema = {
        "type": "object",
        "properties": {
            "valid": { "type": "boolean" },
            "count": { "type": "integer" },
            "shot": {
            "type": "string",
            "enum": ["closeup", "half_body", "three_quarter", "full_body"]
            },
            "angle": {
            "type": "string",
            "enum": ["eye_level", "low_angle", "high_angle", "over_shoulder", "dutch_angle"]
            },
            "support": {
            "type": "string",
            "enum": ["ground", "seated", "lying", "leaning", "airborne"]
            },
            "prop": { "type": ["string", "null"] },
            "group_prompt": { "type": ["string", "null"] },
            "reason": { "type": ["string", "null"] },
            "poses": {
            "type": "array",
            "items": { "type": "string" }
            },
            "tags": {
            "type": "array",
            "items": tag_items
            }
        },
        "required": [
            "valid", "count", "shot", "angle", "support",
            "prop", "group_prompt", "reason", "poses", "tags"
        ],
        "additionalProperties": False
    }
    if fashion:
        schema["properties"]["outfit"] = {"type": ["string", "null"]}
        schema["required"].append("outfit")
    return schema


def parse_model_json(text: str) -> dict:
    """Parse JSON from a model reply, tolerating code fences / chatter."""
    if not text or not text.strip():
        raise InvalidResponse("Model trả về nội dung rỗng.")
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.IGNORECASE)
    try:
        data = json.loads(t)
    except ValueError:
        start, end = t.find("{"), t.rfind("}")
        if start == -1 or end <= start:
            raise InvalidResponse("Model không trả về JSON hợp lệ.")
        try:
            data = json.loads(t[start:end + 1])
        except ValueError:
            raise InvalidResponse("Model không trả về JSON hợp lệ.")
    if not isinstance(data, dict):
        raise InvalidResponse("JSON từ model không phải một object.")
    return data


def clean_result(raw: dict, lists: dict[str, list[str]], mode: str, fashion: bool = False) -> dict:
    """Validate + normalise a raw model answer into the stored result.

    `lists["tags"]` / `mode` apply to tags only (strict: values outside the list are dropped).
    `uncertain_fields` is computed locally (not by the model).
    """
    if not isinstance(raw, dict):
        raise InvalidResponse("Phản hồi không phải object JSON.")
    missing = [k for k in REQUIRED_KEYS if k not in raw]
    if fashion and "outfit" not in raw:
        missing.append("outfit")
    if missing:
        raise InvalidResponse("Phản hồi thiếu trường: " + ", ".join(missing))

    valid = raw.get("valid") is True

    # enum fields: always normalised so exports/UI never see junk values
    enums = {}
    uncertain = set()
    for name, allowed in ENUM_FIELDS.items():
        v = to_snake_case(raw.get(name) or "")
        if v not in allowed:
            v = ""
            uncertain.add(name)
        enums[name] = v

    if not valid:
        # quality gate failed: canonical empty record (keeps the model's reason), nothing to review
        reason = " ".join(str(raw.get("reason") or "").split()) or None
        out = {
            "valid": False, "count": 0,
            "shot": enums["shot"], "angle": enums["angle"], "support": enums["support"],
            "prop": None, "group_prompt": None, "poses": [], "tags": [],
            "reject_reason": reason, "uncertain_fields": [],
        }
        if fashion:
            out["outfit"] = None
        return out

    try:
        count = int(raw.get("count"))
    except (TypeError, ValueError):
        raise InvalidResponse("'count' không phải số nguyên.")
    if not 1 <= count <= MAX_SUBJECTS:
        raise InvalidResponse(f"'count' = {count} ngoài khoảng 1..{MAX_SUBJECTS} dù valid=true.")

    poses_raw = raw.get("poses")
    if not isinstance(poses_raw, list):
        raise InvalidResponse("'poses' không phải mảng.")
    poses = [" ".join(str(p).split()) for p in poses_raw if str(p).strip()]
    if len(poses) != count:
        raise InvalidResponse(f"'poses' có {len(poses)} phần tử nhưng count = {count}.")
    for i, p in enumerate(poses, 1):
        if not p.startswith("{subject_"):
            uncertain.add("poses")

    support = enums["support"]
    prop = to_snake_case(raw.get("prop") or "") or None
    if support == "ground":
        prop = None
    elif support and not prop:
        uncertain.add("prop")

    group_prompt = " ".join(str(raw.get("group_prompt") or "").split()) or None
    if count == 1:
        group_prompt = None
    elif not group_prompt:
        uncertain.add("group_prompt")

    tags = []
    tags_raw = raw.get("tags")
    for t in (tags_raw if isinstance(tags_raw, list) else []):
        v = to_snake_case(t)
        if v and v not in tags:
            tags.append(v)
    allowed_tags = lists.get("tags") or []
    if mode == MODE_STRICT and allowed_tags:
        tags = [t for t in tags if t in allowed_tags]   # never trust the model's claim of matching
    if not MIN_TAGS <= len(tags) <= MAX_TAGS:
        uncertain.add("tags")
    tags = tags[:MAX_TAGS]

    result = {
        "valid": True, "count": count,
        "shot": enums["shot"], "angle": enums["angle"], "support": support,
        "prop": prop, "group_prompt": group_prompt, "poses": poses, "tags": tags,
        "reject_reason": None,
    }
    if fashion:
        outfit = " ".join(str(raw.get("outfit") or "").split()) or None
        if not outfit:
            uncertain.add("outfit")
        result["outfit"] = outfit
    result["uncertain_fields"] = sorted(uncertain)
    return result
