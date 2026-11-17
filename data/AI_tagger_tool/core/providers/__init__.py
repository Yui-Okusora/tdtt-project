from ..config import PROVIDERS
from ..errors import ConfigError
from .base import VisionProvider
from .gemini import GeminiProvider
from .openai_compat import (CompatProvider, GroqProvider, OllamaProvider, OpenAIProvider,
                            OpenRouterProvider)

REGISTRY: dict[str, type[VisionProvider]] = {
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
    "openrouter": OpenRouterProvider,
    "groq": GroqProvider,
    "ollama": OllamaProvider,
    "compatible": CompatProvider,
}

DEFAULT_MODELS = {  # fallbacks shown until the live model list is fetched
    "openai": ["gpt-4o-mini", "gpt-4o"],
    "gemini": ["gemini-2.0-flash", "gemini-2.5-flash"],
    "openrouter": ["google/gemma-3-27b-it:free"],
    "groq": ["meta-llama/llama-4-scout-17b-16e-instruct"],
    "ollama": ["llama3.2-vision", "qwen2.5vl", "gemma3"],
    "compatible": [],
}


def create_provider(provider_id: str, api_key: str, model: str,
                    base_url: str = "", timeout: int = 90) -> VisionProvider:
    if provider_id not in REGISTRY:
        raise ConfigError(f"Provider không được hỗ trợ: {provider_id}")
    if not model:
        raise ConfigError("Chưa chọn model.")
    return REGISTRY[provider_id](api_key, model, base_url or None, timeout)


__all__ = ["create_provider", "REGISTRY", "DEFAULT_MODELS", "PROVIDERS", "VisionProvider"]
