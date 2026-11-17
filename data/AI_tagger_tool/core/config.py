"""Application configuration. API keys are NEVER stored in AppConfig."""
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()  # reads .env if present (never committed)

MODE_AUTO = "auto"        # AI decides everything
MODE_GUIDED = "guided"    # prefer user's values, may add new ones
MODE_STRICT = "strict"    # only user's values allowed

PROVIDERS = {
    "openai": {
        "label": "OpenAI", "env": ("OPENAI_API_KEY",), "needs_key": True, "note": "",
    },
    "gemini": {
        "label": "Google Gemini (có gói miễn phí)", "env": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
        "needs_key": True,
        "note": "Key tạo ở Google AI Studio có hạn mức miễn phí (giới hạn request/phút và request/ngày, "
                "có thể thay đổi theo thời điểm). Model dòng flash / flash-lite thường tiết kiệm nhất.",
    },
    "openrouter": {
        "label": "OpenRouter (có model miễn phí)", "env": ("OPENROUTER_API_KEY",), "needs_key": True,
        "note": "Cần tài khoản + API key. Model có hậu tố “:free” bị giới hạn request/ngày và có thể áp dụng "
                "chính sách dữ liệu riêng – hãy tránh gửi ảnh nhạy cảm.",
    },
    "groq": {
        "label": "Groq (gói miễn phí giới hạn)", "env": ("GROQ_API_KEY",), "needs_key": True,
        "note": "Chỉ một số model nhận ảnh; danh sách được lọc theo tên nên có thể chưa đầy đủ – "
                "có thể nhập tên model khác.",
    },
    "ollama": {
        "label": "Ollama (chạy local, miễn phí)", "env": (), "needs_key": False,
        "note": "Cần cài Ollama và tải model có hỗ trợ ảnh (ví dụ: ollama pull llama3.2-vision). "
                "Ảnh không rời khỏi máy bạn. Máy yếu sẽ chậm → tăng timeout.",
    },
    "compatible": {
        "label": "OpenAI-compatible (tùy chỉnh)", "env": ("COMPAT_API_KEY",), "needs_key": False,
        "note": "Dịch vụ/server bất kỳ tương thích OpenAI Chat Completions và nhận ảnh. "
                "Bỏ trống key nếu server local không yêu cầu.",
    },
}

DEFAULT_BASE_URLS = {
    "ollama": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
    "compatible": os.environ.get("COMPAT_BASE_URL", ""),
}


@dataclass(frozen=True)
class AppConfig:
    provider: str
    model: str
    base_url: str = ""
    mode: str = MODE_GUIDED
    language: str = "auto"      # auto | en | vi  (descriptive fields only)
    detail: str = "standard"    # concise | standard | detailed
    concurrency: int = 3
    max_retries: int = 3
    retry_base_delay: float = 2.0
    max_side: int = 1280
    timeout: int = 90
    fashion: bool = False       # add the free-text `outfit` field (clothes + colours + accessories)


def env_api_key(provider_id: str) -> str:
    for name in PROVIDERS[provider_id]["env"]:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return ""
