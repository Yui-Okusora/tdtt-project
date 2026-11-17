"""Provider abstraction. Add a new AI provider by subclassing VisionProvider."""
import logging
import threading
from abc import ABC, abstractmethod

import requests

from ..errors import ConfigError, ProviderError
from ..imaging import tiny_test_image

log = logging.getLogger(__name__)


class VisionProvider(ABC):
    id = "base"
    label = "Base"
    default_base_url = ""
    requires_key = True
    models_verified = False   # True when list_models() reliably returns only vision-capable models
    models_note = ""          # shown under the model picker

    def __init__(self, api_key: str, model: str, base_url: str | None = None, timeout: int = 90):
        if not api_key and self.requires_key:
            raise ConfigError("Chưa cấu hình API Key.")
        base = (base_url or self.default_base_url).rstrip("/")
        if not base:
            raise ConfigError("Chưa cấu hình Base URL.")
        self._user_key = api_key or ""
        self._api_key = api_key or "not-needed"   # placeholder for key-less local servers
        self.model = model
        self.base_url = base
        self.timeout = timeout
        self._tls = threading.local()

    def __repr__(self):  # never expose the key
        return f"<{type(self).__name__} model={self.model!r}>"

    # ---- token usage (thread-local: one provider is shared by worker threads)
    def _set_usage(self, input_tokens, output_tokens):
        cur = getattr(self._tls, "usage", None) or (0, 0)
        self._tls.usage = (cur[0] + int(input_tokens or 0), cur[1] + int(output_tokens or 0))

    def pop_usage(self):
        """Tokens reported by the API since the last pop, as (input, output) or None."""
        u = getattr(self._tls, "usage", None)
        self._tls.usage = None
        return u

    # ---- helpers -------------------------------------------------------
    def _redact(self, text: str) -> str:
        text = text or ""
        return text.replace(self._user_key, "***") if self._user_key else text

    def _request(self, method, url, *, headers=None, json_body=None):
        try:
            r = requests.request(method, url, headers=headers, json=json_body, timeout=self.timeout)
        except requests.Timeout:
            raise ProviderError("Hết thời gian chờ phản hồi từ API.", retryable=True)
        except requests.ConnectionError as e:
            raise ProviderError(f"Không kết nối được tới API: {self._redact(str(e))[:200]}", retryable=True)
        except requests.RequestException as e:
            raise ProviderError(f"Lỗi mạng: {self._redact(str(e))[:200]}", retryable=False)
        if r.status_code >= 400:
            raise self._http_error(r)
        try:
            return r.json()
        except ValueError:
            raise ProviderError("API trả về dữ liệu không phải JSON.", retryable=True)

    def _http_error(self, r) -> ProviderError:
        detail = ""
        try:
            body = r.json()
            err = body.get("error", body) if isinstance(body, dict) else body
            detail = err.get("message", "") if isinstance(err, dict) else str(err)
            if isinstance(err, dict) and err.get("code") == "insufficient_quota":
                detail += " [insufficient_quota]"
        except ValueError:
            detail = (getattr(r, "text", "") or "")[:200]
        detail = self._redact(detail)[:400]
        s = r.status_code
        quota = "insufficient_quota" in detail.lower()
        retryable = (s in (408, 409, 425, 429) or s >= 500) and not quota
        retry_after = None
        try:
            ra = r.headers.get("Retry-After")
            retry_after = float(ra) if ra else None
        except (ValueError, AttributeError):
            pass
        if s in (401, 403):
            msg = f"API Key không hợp lệ hoặc không có quyền (HTTP {s}). {detail}"
        elif s == 429:
            msg = f"Vượt giới hạn request/hạn mức (HTTP 429). {detail}"
        else:
            msg = f"Lỗi API HTTP {s}. {detail}"
        return ProviderError(msg.strip(), retryable=retryable, status=s, retry_after=retry_after)

    # ---- interface -----------------------------------------------------
    @abstractmethod
    def list_models(self, free_only: bool = False) -> list[str]: ...

    @abstractmethod
    def analyze(self, image_bytes: bytes, mime: str, system_prompt: str,
                user_prompt: str, schema: dict) -> dict:
        """Send one image, return the parsed JSON object from the model."""

    def test_connection(self, deep: bool = False) -> tuple[bool, str]:
        try:
            models = self.list_models()
            msg = f"Kết nối thành công ({len(models)} model khả dụng)."
            if deep:
                data, mime = tiny_test_image()
                schema = {"type": "object", "properties": {"ok": {"type": "boolean"}},
                          "required": ["ok"], "additionalProperties": False}
                self.analyze(data, mime, "Reply with JSON only.", 'Return {"ok": true}.', schema)
                msg += f" Model '{self.model}' xử lý được ảnh."
            return True, msg
        except ProviderError as e:
            return False, str(e)
