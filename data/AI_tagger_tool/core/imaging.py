"""Image validation, downscaling for the API, thumbnails."""
import io

from PIL import Image, ImageOps

from .errors import ProviderError

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def _flatten(im: Image.Image) -> Image.Image:
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        rgba = im.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        return bg
    return im.convert("RGB")


def prepare_image(source, max_side: int = 1280, quality: int = 85) -> tuple[bytes, str]:
    """Return (jpeg_bytes, mime) downscaled so the longest side <= max_side."""
    try:
        with Image.open(source) as im:
            im = _flatten(im)
            if max(im.size) > max_side:
                im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=quality, optimize=True)
            return buf.getvalue(), "image/jpeg"
    except (OSError, ValueError, Image.DecompressionBombError) as e:
        raise ProviderError(f"Không đọc được ảnh: {e}", retryable=False)


def make_thumbnail(source, size: int = 320) -> bytes:
    with Image.open(source) as im:
        im = _flatten(im)
        im.thumbnail((size, size), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=80)
        return buf.getvalue()


def tiny_test_image() -> tuple[bytes, str]:
    """Small image used by the optional 'deep' connection test."""
    im = Image.new("RGB", (64, 64), (200, 60, 60))
    buf = io.BytesIO()
    im.save(buf, "JPEG")
    return buf.getvalue(), "image/jpeg"
