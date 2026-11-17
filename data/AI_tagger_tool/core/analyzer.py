"""Analyse one image: downscale -> prompt -> provider -> validate, with retry/backoff."""
import logging
import random
import threading

from .config import MODE_STRICT, AppConfig
from .errors import Cancelled, ProviderError
from .imaging import prepare_image
from .prompts import build_system_prompt, build_user_prompt
from .schema import build_json_schema, clean_result

log = logging.getLogger(__name__)


def with_retry(fn, max_retries: int, cancel: threading.Event, base_delay: float = 2.0,
               max_delay: float = 60.0):
    """Run fn(); retry retryable ProviderErrors with exponential backoff + jitter.
    Honors Retry-After and aborts promptly when `cancel` is set."""
    attempt = 0
    while True:
        if cancel.is_set():
            raise Cancelled()
        try:
            return fn()
        except ProviderError as e:
            if not e.retryable or attempt >= max_retries:
                raise
            if e.retry_after:
                delay = min(max_delay, e.retry_after)
            else:
                delay = min(max_delay, base_delay * (2 ** attempt)) * (0.75 + random.random() * 0.5)
            attempt += 1
            log.warning("Retry %d/%d sau %.1fs: %s", attempt, max_retries, delay, e)
            if cancel.wait(delay):
                raise Cancelled()


def analyze_image(provider, image_path, cfg: AppConfig, lists: dict[str, list[str]],
                  cancel: threading.Event) -> tuple[dict, dict | None]:
    """Returns (result, usage). usage = {"input": n, "output": n} as reported by the API, or None."""
    data, mime = prepare_image(image_path, cfg.max_side)
    system = build_system_prompt(cfg.fashion)
    user = build_user_prompt(cfg, lists)
    schema = build_json_schema(lists if cfg.mode == MODE_STRICT else None, cfg.fashion)
    total = {"input": 0, "output": 0}
    seen = {"any": False}
    provider.pop_usage()  # drop any stale usage left on this thread

    def call():
        try:
            raw = provider.analyze(data, mime, system, user, schema)
        finally:  # count tokens even when the answer is unusable and gets retried
            u = provider.pop_usage()
            if u:
                total["input"] += u[0]
                total["output"] += u[1]
                seen["any"] = True
        return clean_result(raw, lists, cfg.mode, cfg.fashion)

    result = with_retry(call, cfg.max_retries, cancel, base_delay=cfg.retry_base_delay)
    return result, (total if seen["any"] else None)
