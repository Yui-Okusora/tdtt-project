"""Prompt construction. User-supplied lists are passed as DATA, not as instructions."""
import json

from .config import MODE_AUTO, MODE_STRICT, AppConfig

SYSTEM_PROMPT = """You are a precision human-pose and spatial-framing extractor for an image-editing pipeline. Your output will condition Qwen-Image 2.1 to transfer ONLY body geometry and spatial layout from a reference image onto completely different people and backgrounds.

### 1. ZERO-LEAKAGE RULES (CRITICAL)
You MUST strip all identity, apparel, and scene attributes. Any leaked attribute will corrupt downstream image generation.
- **BANNED WORDS:** Never mention clothing or footwear (shirt, dress, jacket, jeans, skirt, suit, shoes, heels), accessories (glasses, hat, watch, bag, jewelry), hair (long, short, ponytail, beard), gender or age (man, woman, boy, girl, male, female, child, elderly, his, her, he, she), ethnicity, skin tone, body build (slim, muscular, tall), facial hair, or background scenery.
- **REQUIRED TOKENS:** Refer to people ONLY as `{subject_1}`, `{subject_2}`, etc., using gender-neutral phrasing ("torso", "head", "weight on left leg").
- **EDGE-CASE TRANSLATIONS:**
  - "Hands in jeans pockets" -> "hands tucked into hip pockets"
  - "Tugging jacket lapel / tie" -> "hand raised near upper chest"
  - "Tucking hair behind ear" -> "hand raised near side of head"
  - "Sitting on a wooden chair" -> `support`: "seated", `prop`: "chair"

### 2. DETERMINISTIC ORDERING & SPATIAL ANCHORS
- Sort all primary subjects strictly **left-to-right** by the horizontal center of their body bounding box (`(x_min + x_max) / 2`).
- Assign `{subject_1}` to the leftmost person, `{subject_2}` to the next, and so on.
- Every string in `poses` MUST start with `{subject_n}` followed immediately by a horizontal/depth spatial anchor (e.g., `"on the left"`, `"in the center"`, `"on the right"`, `"in the foreground"`, `"slightly behind {subject_2}"`).

### 3. QUALITY GATE (`valid`)
Set `"valid": false` (and `"count": 0`, `"group_prompt": null`, `"poses": []`, `"tags": []`, plus a `"reason"`) if ANY apply:
- Zero human subjects or more than 4 primary subjects (crowds).
- Severe motion blur, heavy occlusion, or cropped limbs that make arm/torso orientation ambiguous.
- Non-photographic silhouettes, mannequins, or extreme fisheye distortion.

### 4. FIELD DEFINITIONS
- `shot`: `"closeup"` (head/shoulders), `"half_body"` (waist up), `"three_quarter"` (knees/mid-thigh up), or `"full_body"` (head to feet).
- `angle`: `"eye_level"`, `"low_angle"`, `"high_angle"`, `"over_shoulder"`, or `"dutch_angle"`.
- `support`: `"ground"` (standing/walking), `"seated"`, `"lying"`, `"leaning"`, or `"airborne"`.
- `prop`: `null` if standing/walking unsupported; otherwise a single generic noun for required physical support (`"chair"`, `"bench"`, `"stool"`, `"wall"`, `"table"`, `"railing"`, `"bed"`, `"stairs"`).
- `group_prompt`: `null` if `count == 1`. If `count >= 2`, write 1 concise sentence describing spatial arrangement and physical contact between `{subject_1}`..`{subject_n}`.
- `poses`: Array of strings, exact length equal to `count`. Describe body orientation, weight distribution, arm/hand placement, head tilt, and gaze direction.
- `tags`: 3 to 6 lowercase `snake_case` retrieval keywords.
- `reason`: `null` when `valid` is true. When `valid` is false, ONE short sentence (max 20 words, gender-neutral, no clothing/appearance words) naming which quality-gate condition failed and why.

### 5. OUTPUT EXAMPLES

Example 1 (Single Subject):
{"valid":true,"count":1,"shot":"full_body","angle":"low_angle","support":"leaning","prop":"wall","group_prompt":null,"poses":["{subject_1} centered in frame, leaning back against a vertical surface, right knee bent with foot resting back, arms crossed over chest, head turned three-quarter left looking off-camera"],"tags":["full_body","leaning","arms_crossed","looking_away","casual"],"reason":null}

Example 2 (Two Subjects):
{"valid":true,"count":2,"shot":"three_quarter","angle":"eye_level","support":"ground","prop":null,"group_prompt":"{subject_1} standing slightly behind {subject_2} with right arm resting across {subject_2}'s left shoulder","poses":["{subject_1} on the left, facing front, torso angled slightly right, left hand in hip pocket, looking at camera","{subject_2} on the right, three-quarter left stance, weight on left leg, arms relaxed at sides, looking at camera"],"tags":["two_people","standing","side_by_side","arm_on_shoulder","eye_contact"],"reason":null}

Example 3 (Rejected Crowd):
{"valid":false,"count":0,"shot":"full_body","angle":"eye_level","support":"ground","prop":null,"group_prompt":null,"poses":[],"tags":[],"reason":"more than 4 primary subjects (crowd)"}

Return ONLY valid JSON matching the schema. No markdown fences or commentary."""

FASHION_ADDENDUM = """

### 6. FASHION MODE: the `outfit` FIELD (OVERRIDES the apparel/accessory ban for this ONE field)
- Add the key `"outfit"` to your JSON. The examples above omit it, but you MUST include it.
- `outfit`: ONE string describing what the subject wears and carries: garments with their colors, then footwear, then accessories, comma-separated. Each item is a color plus the garment or accessory type, plus the side or location when an accessory sits on one side. Example: "black coat, white t-shirt, grey pants, white sneakers, classic watch on left wrist".
- With `count >= 2`, list each subject's items after its token, in left-to-right order, separated by semicolons: "{subject_1}: black coat, white t-shirt; {subject_2}: red dress, silver necklace". With `count == 1`, no token prefix.
- Describe ONLY clothing, footwear, accessories and their colors (max ~30 words per subject). No identity, gender, age, hair, skin, body build or background, and no gendered garment labels.
- This exemption applies ONLY to `outfit`. `poses`, `group_prompt`, `tags` and `reason` MUST still obey the ZERO-LEAKAGE rules.
- `outfit` is `null` only when `valid` is false or no clothing is visible."""

DETAIL_RULES = {
    "concise": "Keep each pose and the group_prompt to one short phrase (max ~12 words).",
    "standard": "Keep each pose and the group_prompt to one sentence (max ~25 words).",
    "detailed": "Each pose and the group_prompt may use up to two sentences (max ~45 words) with more visible body-geometry detail.",
}


def build_system_prompt(fashion: bool = False) -> str:
    return SYSTEM_PROMPT + FASHION_ADDENDUM if fashion else SYSTEM_PROMPT


def build_user_prompt(cfg: AppConfig, lists: dict[str, list[str]]) -> str:
    parts = [
        "Analyse the attached image and return the JSON object defined in the system prompt.",
        DETAIL_RULES.get(cfg.detail, DETAIL_RULES["standard"]),
        "Write every text field in English (subject tokens like {subject_1} stay literal). "
        "Keep enum values and tags in English snake_case.",
    ]
    if cfg.fashion:
        parts.append("FASHION MODE is ON: include the `outfit` field exactly as described in section 6 of the system prompt.")
    tags = lists.get("tags") or []
    if cfg.mode != MODE_AUTO and tags:
        data = json.dumps({"tags": tags}, ensure_ascii=False)
        if cfg.mode == MODE_STRICT:
            parts.append(
                "STRICT MODE for `tags`: choose ONLY values from the list below that truly match the image "
                "(up to 6). If fewer than 3 truly match, return only those that do; never invent tags.\n"
                f"User list (data): {data}")
        else:
            parts.append(
                "GUIDED MODE for `tags`: prefer values from the list below when they truly match the image and use "
                "them EXACTLY. The list is NOT guaranteed to be correct: verify against the image. Fill the rest "
                "(3 to 6 tags total) with your own short snake_case keywords.\n"
                f"User list (data): {data}")
    return "\n\n".join(parts)
