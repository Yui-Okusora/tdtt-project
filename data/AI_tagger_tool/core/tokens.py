"""Token estimation + settings advisor.

Estimates are APPROXIMATE (vendors change tokenisation rules). The real usage reported by the API is
recorded per image and used to calibrate later estimates.
"""
import json
import math
import re
from dataclasses import dataclass, field, replace

from .config import MODE_STRICT, AppConfig
from .prompts import build_system_prompt, build_user_prompt
from .schema import build_json_schema

SIDE_OPTIONS = [512, 768, 1024, 1280, 1600, 2048]
DETAIL_ORDER = ["concise", "standard", "detailed"]
DETAIL_LABEL = {"concise": "Ngắn", "standard": "Vừa", "detailed": "Chi tiết"}
OUTPUT_BASE = {"concise": 90, "standard": 150, "detailed": 240}    # rough JSON output tokens per image (pose schema, 1-2 subjects); calibrated by real usage
FASHION_EXTRA = 45        # extra output tokens per image for the `outfit` field
VI_FACTOR = 1.6          # Vietnamese text costs more tokens
REQUEST_OVERHEAD = 12
DEFAULT_DIMS = (1024, 768)


# ------------------------------------------------------------------ primitives
def text_tokens(text: str) -> int:
    return max(1, math.ceil(len(text) / 3.8))


def resized_dims(w: int, h: int, max_side: int) -> tuple[int, int]:
    if max(w, h) <= max_side:
        return w, h
    s = max_side / max(w, h)
    return max(1, round(w * s)), max(1, round(h * s))


def _tile_tokens(w, h, base, tile):
    if max(w, h) > 2048:
        s = 2048 / max(w, h)
        w, h = w * s, h * s
    if min(w, h) > 768:
        s = 768 / min(w, h)
        w, h = w * s, h * s
    return base + tile * math.ceil(w / 512) * math.ceil(h / 512)


def _patch_tokens(w, h, mult, budget=1536):
    patches = math.ceil(w / 32) * math.ceil(h / 32)
    if patches > budget:
        sf = math.sqrt(32 ** 2 * budget / (w * h))
        adj = min(math.floor(w * sf / 32) / (w * sf / 32), math.floor(h * sf / 32) / (h * sf / 32))
        patches = math.ceil(w * sf * adj / 32) * math.ceil(h * sf * adj / 32)
    return math.ceil(patches * mult)


def _openai_rule(m: str):
    if m.startswith("gpt-4o-mini"):
        return ("tile", 2833, 5667)
    if re.match(r"(gpt-4\.1|gpt-5(\.\d+)?)-(mini|nano)|o4-mini", m):
        mult = 2.46 if "nano" in m else (1.72 if m.startswith("o4") else 1.62)
        return ("patch", mult)
    if re.match(r"gpt-5\.([2-9]|\d{2})", m):
        return ("patch", 1.2)
    if re.match(r"gpt-5", m):
        return ("tile", 70, 140)
    if m.startswith(("o1", "o3")):
        return ("tile", 75, 150)
    if re.match(r"(gpt-4o|gpt-4\.1|gpt-4\.5|chatgpt-4o|gpt-4-turbo|gpt-4-vision)", m):
        return ("tile", 85, 170)
    return None


def image_tokens(provider: str, model: str, w: int, h: int) -> tuple[int, str]:
    """Approx tokens for one image already resized to (w, h). Returns (tokens, confidence)."""
    m = (model or "").lower().split("/")[-1]
    if provider == "gemini" or m.startswith("gemini"):
        n = 258 if max(w, h) <= 384 else math.ceil(w / 768) * math.ceil(h / 768) * 258
        return n, "medium"
    rule = _openai_rule(m)
    if rule and rule[0] == "tile":
        return _tile_tokens(w, h, rule[1], rule[2]), "medium"
    if rule and rule[0] == "patch":
        return _patch_tokens(w, h, rule[1]), "medium"
    return _patch_tokens(w, h, 1.0), "low"      # unknown model: generic patch-based guess


def prompt_tokens(cfg: AppConfig, lists: dict) -> int:
    schema = build_json_schema(lists if cfg.mode == MODE_STRICT else None, cfg.fashion)
    text = build_system_prompt(cfg.fashion) + build_user_prompt(cfg, lists) + json.dumps(schema)
    return text_tokens(text) + REQUEST_OVERHEAD


# ------------------------------------------------------------------ estimation
@dataclass
class TokenEstimate:
    images: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    prompt_tokens: int = 0
    confidence: str = "low"     # low | medium | calibrated
    per_image: dict = field(default_factory=dict)   # id -> (input, output)

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens


def estimate_items(items, cfg: AppConfig, lists: dict, cal=(1.0, 1.0, 0)) -> TokenEstimate:
    """items: iterable of (id, width, height) of the ORIGINAL images."""
    pt = prompt_tokens(cfg, lists)
    out_each = (OUTPUT_BASE.get(cfg.detail, OUTPUT_BASE["standard"]) + (FASHION_EXTRA if cfg.fashion else 0)) \
        * (VI_FACTOR if cfg.language == "vi" else 1)
    est = TokenEstimate(prompt_tokens=pt)
    confs = []
    for rid, w, h in items:
        w, h = (w, h) if w and h else DEFAULT_DIMS
        rw, rh = resized_dims(w, h, cfg.max_side)
        it, conf = image_tokens(cfg.provider, cfg.model, rw, rh)
        confs.append(conf)
        i, o = round((it + pt) * cal[0]), round(out_each * cal[1])
        est.per_image[rid] = (i, o)
        est.input_tokens += i
        est.output_tokens += o
        est.images += 1
    est.confidence = "calibrated" if cal[2] else ("medium" if confs and all(c == "medium" for c in confs) else "low")
    return est


def calibration(records) -> tuple[float, float, int]:
    """(input_factor, output_factor, n_images) = actual API usage / our estimate at analysis time."""
    ai = ei = ao = eo = n = 0
    for r in records:
        if r.tokens_in and r.tokens_est_in:
            ai, ei, n = ai + r.tokens_in, ei + r.tokens_est_in, n + 1
        if r.tokens_out and r.tokens_est_out:
            ao, eo = ao + r.tokens_out, eo + r.tokens_est_out
    clamp = lambda x: min(4.0, max(0.25, x))
    return (clamp(ai / ei) if ei else 1.0, clamp(ao / eo) if eo else 1.0, n)


def scenario_table(items, cfg: AppConfig, lists: dict, cal=(1.0, 1.0, 0)) -> dict:
    items = list(items)
    table = {}
    for side in SIDE_OPTIONS:
        for det in DETAIL_ORDER:
            table[(side, det)] = estimate_items(items, replace(cfg, max_side=side, detail=det), lists, cal).total
    return table


# ------------------------------------------------------------------ advisor
def fmt(n: int) -> str:
    return f"{int(n):,}".replace(",", ".")


def recommend(table: dict, cfg: AppConfig, items, budget: int = 0):
    """Returns (best_key | None, [(level, message)]). best_key = (max_side, detail) to apply."""
    items = list(items)
    cur_key = (cfg.max_side, cfg.detail)
    cur = table[cur_key]
    rank = lambda k: SIDE_OPTIONS.index(k[0]) + DETAIL_ORDER.index(k[1])
    best_of = lambda keys: max(keys, key=lambda k: (rank(k), k[0]))
    desc = lambda k: f"cạnh dài {k[0]}px, mức “{DETAIL_LABEL[k[1]]}”"
    msgs, best = [], None

    if budget > 0:
        fits = [k for k, v in table.items() if v <= budget]
        if cur <= budget:
            better = [k for k in fits if rank(k) > rank(cur_key)]
            if better:
                best = best_of(better)
                msgs.append(("info", f"Thiết lập hiện tại (~{fmt(cur)} token) nằm trong ngân sách. Còn dư, có thể nâng lên "
                                     f"{desc(best)} (~{fmt(table[best])} token)."))
            else:
                msgs.append(("success", f"Thiết lập hiện tại (~{fmt(cur)} token) nằm trong ngân sách {fmt(budget)}."))
        elif fits:
            best = best_of(fits)
            msgs.append(("warning", f"Ước tính ~{fmt(cur)} token, vượt ngân sách {fmt(budget)} khoảng {fmt(cur - budget)}. "
                                    f"Gợi ý {desc(best)} (~{fmt(table[best])} token) – giữ chất lượng cao nhất còn vừa ngân sách."))
        else:
            msgs.append(("error", f"Ngay cả thiết lập nhỏ nhất (~{fmt(min(table.values()))} token) vẫn vượt ngân sách "
                                  f"{fmt(budget)}. Hãy giảm số ảnh hoặc tăng ngân sách."))
    else:
        side = min(cfg.max_side, 1024)
        det = cfg.detail if cfg.detail != "detailed" else "standard"
        k = (side, det)
        if k != cur_key and table[k] <= cur * 0.9:
            best = k
            pct = round(100 * (1 - table[k] / cur))
            msgs.append(("info", f"Có thể giảm ~{pct}% token (còn ~{fmt(table[k])}) với {desc(k)}. Hãy thử vài ảnh để chắc "
                                 f"chất lượng vẫn đạt; giữ kích thước lớn nếu cần nhìn chi tiết nhỏ (kính, phụ kiện)."))
        else:
            msgs.append(("success", "Thiết lập hiện tại đã khá tiết kiệm; giảm thêm chỉ tiết kiệm ít."))

    small = sum(1 for _, w, h in items if w and h and max(w, h) <= cfg.max_side)
    if items and small:
        msgs.append(("info", f"{small}/{len(items)} ảnh nhỏ hơn hoặc bằng cạnh dài tối đa nên không bị thu nhỏ – "
                             f"đổi kích thước chỉ tiết kiệm token ở các ảnh lớn hơn."))
    return best, msgs
