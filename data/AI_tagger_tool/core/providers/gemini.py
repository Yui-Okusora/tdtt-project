"""Google Gemini (generateContent REST API)."""
import base64

from ..errors import InvalidResponse, ProviderError
from ..schema import parse_model_json
from .base import VisionProvider

_EXCLUDE = ("embedding", "tts", "aqa", "imagen", "veo", "live", "native-audio", "robotics")


def to_gemini_schema(node):
    """JSON Schema -> Gemini responseSchema (OpenAPI subset, upper-case types)."""
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k == "additionalProperties":
                continue
            if k == "type" and isinstance(v, list):   # ["string", "null"] -> STRING + nullable
                kinds = [t for t in v if t != "null"]
                out["type"] = (kinds[0] if kinds else "string").upper()
                if "null" in v:
                    out["nullable"] = True
                continue
            out[k] = v.upper() if (k == "type" and isinstance(v, str)) else to_gemini_schema(v)
        return out
    if isinstance(node, list):
        return [to_gemini_schema(x) for x in node]
    return node


class GeminiProvider(VisionProvider):
    id = "gemini"
    label = "Google Gemini"
    default_base_url = "https://generativelanguage.googleapis.com/v1beta"
    models_verified = True  # Gemini models are natively multimodal
    models_note = "Chỉ hiện model gemini hỗ trợ generateContent (đa phương thức)."

    def _headers(self):
        return {"x-goog-api-key": self._api_key, "Content-Type": "application/json"}

    def list_models(self, free_only: bool = False) -> list[str]:
        data = self._request("GET", f"{self.base_url}/models?pageSize=200", headers=self._headers())
        out = []
        for m in data.get("models", []):
            name = m.get("name", "").removeprefix("models/")
            if "generateContent" not in m.get("supportedGenerationMethods", []):
                continue
            if not name.startswith("gemini") or any(x in name for x in _EXCLUDE):
                continue
            out.append(name)
        return sorted(set(out))

    def analyze(self, image_bytes, mime, system_prompt, user_prompt, schema):
        model = self.model.removeprefix("models/")
        url = f"{self.base_url}/models/{model}:generateContent"
        b64 = base64.b64encode(image_bytes).decode()
        gen = {"temperature": 0.2, "responseMimeType": "application/json",
               "responseSchema": to_gemini_schema(schema)}
        body = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [
                {"text": user_prompt}, {"inlineData": {"mimeType": mime, "data": b64}}]}],
            "generationConfig": gen,
        }
        try:
            data = self._request("POST", url, headers=self._headers(), json_body=body)
        except ProviderError as e:
            if e.status == 400 and "schema" in str(e).lower():
                gen.pop("responseSchema")  # fall back to mime-type only JSON mode
                data = self._request("POST", url, headers=self._headers(), json_body=body)
            else:
                raise
        return self._parse(data)

    def _parse(self, data: dict) -> dict:
        um = data.get("usageMetadata") or {}
        if um:  # thinking tokens are billed as output
            self._set_usage(um.get("promptTokenCount"),
                            (um.get("candidatesTokenCount") or 0) + (um.get("thoughtsTokenCount") or 0))
        block = (data.get("promptFeedback") or {}).get("blockReason")
        if block:
            raise ProviderError(f"Gemini chặn ảnh này ({block}).", retryable=False)
        cands = data.get("candidates") or []
        if not cands:
            raise InvalidResponse("Gemini không trả về kết quả.")
        parts = (cands[0].get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        if not text:
            finish = cands[0].get("finishReason", "")
            if finish in ("SAFETY", "PROHIBITED_CONTENT", "IMAGE_SAFETY", "RECITATION", "BLOCKLIST"):
                raise ProviderError(f"Gemini từ chối kết quả ({finish}).", retryable=False)
            raise InvalidResponse("Gemini trả về nội dung rỗng.")
        return parse_model_json(text)
