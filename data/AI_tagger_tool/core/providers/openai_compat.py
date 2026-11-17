"""OpenAI Chat Completions API and OpenAI-compatible services with image input
(OpenAI, OpenRouter, Groq, Ollama, any custom server)."""
import base64
import re

from ..errors import InvalidResponse, ProviderError
from ..schema import parse_model_json
from .base import VisionProvider

_VISION = re.compile(r"^(gpt-4o|gpt-4\.1|gpt-4\.5|gpt-5|gpt-4-turbo|gpt-4-vision|chatgpt-4o|o1|o3|o4)", re.I)
_EXCLUDE = re.compile(r"(audio|realtime|transcribe|tts|whisper|embedding|moderation|dall|image|search|codex|instruct)", re.I)
_GROQ_VISION = re.compile(r"(vision|llama-4|scout|maverick|llava)", re.I)
_GROQ_EXCLUDE = re.compile(r"(audio|whisper|tts|guard|embedding|transcribe|playai)", re.I)
_OLLAMA_VISION = re.compile(r"(llava|vision|qwen\d*(\.\d+)?-?vl|gemma3|minicpm-v|moondream|bakllava|llama4|mistral-small3)", re.I)


def _is_zero(value) -> bool:
    try:
        return float(value) == 0.0
    except (TypeError, ValueError):
        return False


class OpenAIProvider(VisionProvider):
    id = "openai"
    label = "OpenAI"
    default_base_url = "https://api.openai.com/v1"
    models_verified = True
    models_note = "Lọc theo họ model có hỗ trợ ảnh (gpt-4o, gpt-4.1, gpt-5, o-series…)."

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        # Learned capabilities (some compatible servers lack these features).
        self._send_temperature = True
        self._schema_mode = "json_schema"  # -> "json_object" -> "none"

    def _headers(self):
        return {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}

    def _model_ids(self) -> list[str]:
        data = self._request("GET", f"{self.base_url}/models", headers=self._headers())
        return sorted({m.get("id", "") for m in data.get("data", []) if m.get("id")})

    def list_models(self, free_only: bool = False) -> list[str]:
        ids = self._model_ids()
        if self.models_verified:
            ids = [i for i in ids if _VISION.match(i) and not _EXCLUDE.search(i)]
        return ids

    def _payload(self, b64, mime, system_prompt, user_prompt, schema):
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": user_prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                ]},
            ],
        }
        if self._send_temperature:
            body["temperature"] = 0.2
        if self._schema_mode == "json_schema":
            body["response_format"] = {"type": "json_schema", "json_schema": {
                "name": "image_analysis", "schema": schema, "strict": True}}
        elif self._schema_mode == "json_object":
            body["response_format"] = {"type": "json_object"}
        return body

    def analyze(self, image_bytes, mime, system_prompt, user_prompt, schema):
        b64 = base64.b64encode(image_bytes).decode()
        last = None
        for _ in range(4):  # feature-degradation ladder
            try:
                data = self._request("POST", f"{self.base_url}/chat/completions", headers=self._headers(),
                                     json_body=self._payload(b64, mime, system_prompt, user_prompt, schema))
                return self._parse(data)
            except ProviderError as e:
                last = e
                text = str(e).lower()
                if e.status != 400:
                    raise
                if self._send_temperature and "temperature" in text:
                    self._send_temperature = False
                elif self._schema_mode == "json_schema" and any(
                        k in text for k in ("response_format", "json_schema", "schema", "strict")):
                    self._schema_mode = "json_object"
                elif self._schema_mode == "json_object" and any(
                        k in text for k in ("response_format", "json_object")):
                    self._schema_mode = "none"
                else:
                    raise
        raise last

    def _parse(self, data: dict) -> dict:
        usage = data.get("usage") or {}
        if usage:
            self._set_usage(usage.get("prompt_tokens"), usage.get("completion_tokens"))
        choice = (data.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        if msg.get("refusal"):
            raise ProviderError(f"Model từ chối xử lý ảnh: {str(msg['refusal'])[:200]}", retryable=False)
        content = msg.get("content")
        if isinstance(content, list):
            content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
        if not content:
            raise InvalidResponse("Phản hồi rỗng từ model.")
        return parse_model_json(content)


class CompatProvider(OpenAIProvider):
    id = "compatible"
    label = "OpenAI-compatible"
    default_base_url = ""
    requires_key = False
    models_verified = False
    models_note = "Không thể tự xác minh model của dịch vụ tùy chỉnh có hỗ trợ ảnh – hãy chắc chắn trước khi chạy."


class OpenRouterProvider(OpenAIProvider):
    id = "openrouter"
    label = "OpenRouter"
    default_base_url = "https://openrouter.ai/api/v1"
    models_verified = True
    models_note = "Lọc theo API của OpenRouter: model có input “image”; “chỉ miễn phí” = giá prompt & completion bằng 0."

    def list_models(self, free_only: bool = False) -> list[str]:
        data = self._request("GET", f"{self.base_url}/models", headers=self._headers())
        free, paid = [], []
        for m in data.get("data", []):
            mid = m.get("id")
            mods = (m.get("architecture") or {}).get("input_modalities") or []
            if not mid or "image" not in mods:
                continue
            pr = m.get("pricing") or {}
            (free if _is_zero(pr.get("prompt")) and _is_zero(pr.get("completion")) else paid).append(mid)
        return sorted(free) if free_only else sorted(free) + sorted(paid)


class GroqProvider(OpenAIProvider):
    id = "groq"
    label = "Groq"
    default_base_url = "https://api.groq.com/openai/v1"
    models_verified = False
    models_note = "Lọc theo tên (vision / llama-4 / scout / maverick…), chưa xác minh – có thể nhập tên model khác."

    def list_models(self, free_only: bool = False) -> list[str]:
        return [i for i in self._model_ids() if _GROQ_VISION.search(i) and not _GROQ_EXCLUDE.search(i)]


class OllamaProvider(OpenAIProvider):
    id = "ollama"
    label = "Ollama (local)"
    default_base_url = "http://localhost:11434/v1"
    requires_key = False
    models_verified = True
    models_note = "Lấy từ máy bạn; chỉ hiện model Ollama báo có khả năng “vision” (nếu server cũ: lọc theo tên)."

    def list_models(self, free_only: bool = False) -> list[str]:
        ids = self._model_ids()
        root = self.base_url[:-3] if self.base_url.endswith("/v1") else self.base_url
        out = []
        for i in ids:
            try:
                info = self._request("POST", f"{root}/api/show", headers={"Content-Type": "application/json"},
                                     json_body={"model": i})
            except ProviderError:
                if _OLLAMA_VISION.search(i):
                    out.append(i)
                continue
            caps = info.get("capabilities")
            if isinstance(caps, list):
                if "vision" in caps:
                    out.append(i)
            elif _OLLAMA_VISION.search(i):
                out.append(i)
        return out
