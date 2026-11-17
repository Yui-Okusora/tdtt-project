import io
import tempfile
import threading

from PIL import Image

from core.config import MODE_GUIDED, AppConfig
from core.errors import ProviderError
from core.providers.base import VisionProvider


def make_png(color=(10, 120, 200), size=(40, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


def good_raw(**over):
    raw = {
        "subject_features": "young man with glasses, standing",
        "background_context": "tropical beach, sunny daylight",
        "camera_angle": "eye-level, full-body shot",
        "rag_filter": {"category": "Outdoor Beach", "shot_type": "full_body", "vibe": "relaxed_casual"},
        "rag_search_prompt": "relaxed casual standing pose for beach outdoor full body",
        "uncertain_fields": [],
    }
    raw.update(over)
    return raw


class FakeProvider(VisionProvider):
    """Deterministic provider: `script` is a list of dicts or exceptions, consumed in order."""
    id = "fake"
    default_base_url = "http://fake"

    def __init__(self, script=None, api_key="sk-test-123456"):
        super().__init__(api_key, "fake-model")
        self.script = list(script or [])
        self.calls = 0
        self._lock = threading.Lock()

    def list_models(self):
        return ["fake-model"]

    def analyze(self, image_bytes, mime, system_prompt, user_prompt, schema):
        with self._lock:
            self.calls += 1
            item = self.script.pop(0) if self.script else good_raw()
        if isinstance(item, Exception):
            raise item
        return item


def cfg(**kw):
    base = dict(provider="openai", model="m", mode=MODE_GUIDED, concurrency=1,
                max_retries=0, retry_base_delay=0.01)
    base.update(kw)
    return AppConfig(**base)


def tmpdir():
    return tempfile.TemporaryDirectory()
