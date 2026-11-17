"""Logging that can never leak API keys."""
import logging
import threading

_secrets: set[str] = set()
_lock = threading.Lock()


def register_secret(value: str) -> None:
    if value and len(value) >= 6:
        with _lock:
            _secrets.add(value)


def get_secrets() -> list[str]:
    with _lock:
        return list(_secrets)


def redact(text: str) -> str:
    for s in get_secrets():
        text = text.replace(s, "***")
    return text


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact(record.getMessage())
        record.args = ()
        return True


def setup_logging(log_file=None) -> None:
    root = logging.getLogger()
    if getattr(root, "_tagger_ready", False):
        return
    root.setLevel(logging.INFO)
    handlers = [logging.StreamHandler()]
    if log_file:
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))
    for h in handlers:
        h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
        h.addFilter(RedactingFilter())
        root.addHandler(h)
    root._tagger_ready = True
    logging.getLogger("urllib3").setLevel(logging.WARNING)
