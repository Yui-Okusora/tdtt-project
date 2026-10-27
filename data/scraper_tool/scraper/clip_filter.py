"""Lọc ảnh rác bằng CLIP chạy local: so nội dung ảnh với từng tag và với các mẫu "ảnh rác"
(logo, banner quảng cáo, ảnh chụp màn hình...). Không cần chữ (tag/tiêu đề) đi kèm ảnh nên
dùng được cho ảnh ở diễn đàn/Reddit vốn không có tag.

Cài thêm:  pip install -r requirements-clip.txt   (torch + transformers; lần đầu tự tải model ~600MB)
"""
from __future__ import annotations

import threading
from dataclasses import dataclass

import numpy as np

JUNK_PROMPTS = [
    "a logo", "an advertisement banner", "a screenshot of a website", "a screenshot of a phone app",
    "an icon", "clip art illustration", "a product package on a white background",
    "a page of text document", "a QR code", "a plain blank image",
]


class ClipUnavailable(RuntimeError):
    pass


class TransformersBackend:
    """Backend mặc định: openai/clip-vit-base-patch32 qua transformers + torch (CPU)."""

    def __init__(self, model_name: str = "openai/clip-vit-base-patch32", device: str = "cpu") -> None:
        try:
            import torch
            from transformers import CLIPModel, CLIPProcessor
        except ImportError as e:  # pragma: no cover
            raise ClipUnavailable(
                "Chưa cài CLIP. Chạy: pip install -r requirements-clip.txt  "
                f"(lỗi gốc: {e})") from e
        self.torch = torch
        self.model = CLIPModel.from_pretrained(model_name).eval().to(device)
        self.proc = CLIPProcessor.from_pretrained(model_name)
        self.device = device

    def _unit(self, out) -> np.ndarray:
        torch = self.torch
        if not torch.is_tensor(out):                      # một số bản transformers trả object
            out = getattr(out, "pooler_output", None)
            if out is None:
                raise ClipUnavailable("Không đọc được embedding từ CLIP (phiên bản transformers lạ)")
        out = out / out.norm(dim=-1, keepdim=True)
        return out.detach().cpu().numpy().astype("float32")

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        with self.torch.no_grad():
            inp = self.proc(text=texts, return_tensors="pt", padding=True, truncation=True).to(self.device)
            return self._unit(self.model.get_text_features(**inp))

    def embed_image(self, img) -> np.ndarray:
        with self.torch.no_grad():
            inp = self.proc(images=img, return_tensors="pt").to(self.device)
            return self._unit(self.model.get_image_features(**inp))[0]


@dataclass
class ClipVerdict:
    scores: dict          # tag -> cosine
    matched: list         # các tag khớp
    junk: bool            # bị coi là ảnh rác
    junk_label: str = ""


class ClipFilter:
    def __init__(self, backend=None, model_name: str = "openai/clip-vit-base-patch32", threshold: float = 0.22,
                 junk: bool = True, junk_margin: float = 0.02) -> None:
        self.backend = backend or TransformersBackend(model_name)
        self.threshold = threshold
        self.use_junk = junk
        self.junk_margin = junk_margin
        self.lock = threading.Lock()          # model không an toàn khi gọi song song
        self.tags: list[str] = []
        self.tag_emb = np.zeros((0, 1), dtype="float32")
        self.junk_emb = None
        self._junk_cache = None

    def prepare(self, tag_texts: dict[str, str]) -> None:
        """tag_texts: {tag người dùng nhập -> mô tả tiếng Anh (từ chuẩn sau đồng nghĩa)}."""
        self.tags = list(tag_texts)
        with self.lock:
            self.tag_emb = self.backend.embed_texts([f"a photo of {t}" for t in tag_texts.values()])
            if self.use_junk and self._junk_cache is None:
                self._junk_cache = self.backend.embed_texts([f"a photo of {j}" if not j.startswith("a ") else j
                                                             for j in JUNK_PROMPTS])
        self.junk_emb = self._junk_cache if self.use_junk else None

    def judge(self, img) -> ClipVerdict:
        with self.lock:
            v = self.backend.embed_image(img)
        sims = self.tag_emb @ v
        scores = {t: float(round(s, 4)) for t, s in zip(self.tags, sims)}
        matched = [t for t, s in scores.items() if s >= self.threshold]
        junk, label = False, ""
        if self.junk_emb is not None:
            js = self.junk_emb @ v
            k = int(np.argmax(js))
            if float(js[k]) > float(sims.max() if len(sims) else 0) + self.junk_margin:
                junk, label = True, JUNK_PROMPTS[k]
        return ClipVerdict(scores, matched, junk, label)
