"""Text normalisation helpers (snake_case, list parsing)."""
import re
import unicodedata

_SNAKE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")


def to_snake_case(value) -> str:
    """'Outdoor Beach' / 'outdoor-beach' / 'Bãi biển' -> snake_case ascii."""
    if not value:
        return ""
    s = unicodedata.normalize("NFKD", str(value))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("đ", "d").replace("Đ", "D")
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").lower()


def is_snake_case(value: str) -> bool:
    return bool(_SNAKE.match(value or ""))


def parse_value_list(text: str) -> list[str]:
    """'a, b\\nc; a' -> ['a','b','c'] (normalised, de-duplicated, ordered)."""
    out: list[str] = []
    for part in re.split(r"[,\n;]+", text or ""):
        v = to_snake_case(part)
        if v and v not in out:
            out.append(v)
    return out
