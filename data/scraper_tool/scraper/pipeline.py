"""Điều phối: nguồn (link / search engine / Reddit) -> lọc -> tải song song -> chống trùng
-> (CLIP lọc ảnh rác) -> lưu."""
from __future__ import annotations

import hashlib
import itertools
import random
import re
import shutil
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, wait
from dataclasses import dataclass, field
from io import BytesIO
from typing import Iterator
from urllib.parse import urlparse

import imagehash
from PIL import Image

from .clip_filter import ClipFilter, ClipUnavailable
from .engines import ENGINES, Engine
from .http import Blocked, FetchError, HttpClient
from .models import Candidate, fold
from .pagecrawl import crawl
from .queries import expand
from .store import Store
from .synonyms import Synonyms

Image.MAX_IMAGE_PIXELS = 80_000_000
EXT = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp", "GIF": "gif", "BMP": "bmp"}
SKIP_EXT = (".svg", ".ico", ".cur")
IMAGE_TIMEOUT = (5, 15)


@dataclass
class Config:
    out_dir: str = "output"
    engines: list[str] = field(default_factory=lambda: ["bing", "duckduckgo", "reddit", "google"])
    banned: list[str] = field(default_factory=list)
    workers: int = 8
    min_size: int = 200          # cạnh ngắn nhất (px)
    max_aspect: float = 4.0      # bỏ ảnh quá dài/ngang kiểu banner (cạnh dài / cạnh ngắn)
    max_bytes: int = 25 * 1024 * 1024
    hash_threshold: int = 5      # khoảng cách Hamming tối đa coi là "trùng" (0-64)
    safesearch: str = "moderate"
    fallback_search: bool = False
    split: bool = True           # hết cách mà chưa đủ -> tách lẻ tag (ảnh khớp một phần, được đánh dấu match=partial)
    split_queries: int = 20      # số câu mở rộng tối đa cho mỗi tổ hợp tag con
    max_subsets: int = 15        # số tổ hợp tag con tối đa
    expand: bool = True          # mở rộng truy vấn để vượt trần số kết quả của 1 câu tìm kiếm
    max_queries: int = 80        # tối đa số câu truy vấn mở rộng cho mỗi kế hoạch
    stall_queries: int = 8       # dừng nếu từng ấy câu mở rộng liên tiếp không thêm được ảnh nào
    max_seconds: int = 900       # giới hạn thời gian cho mỗi kế hoạch (0 = không giới hạn)
    engine_cooldown: int = 600   # engine bị captcha/chặn sẽ nghỉ từng ấy giây (áp dụng xuyên các kế hoạch)
    host_fail_limit: int = 6     # host tải lỗi liên tiếp từng ấy lần mà chưa thành công lần nào -> bỏ qua host đó
    synonyms: bool = True        # bật bảng đồng nghĩa (thời trang = fashion, ...)
    alias_files: list[str] = field(default_factory=list)
    # auto: có CLIP thì để CLIP phán xét nội dung ảnh, không có thì kiểm tra chữ (strict)
    # strict: chữ (tiêu đề/alt/URL) phải chứa TẤT CẢ tag; loose: không kiểm tra chữ
    match: str = "auto"
    clip: str = "auto"           # auto: dùng nếu đã cài; on: bắt buộc; off: tắt
    clip_model: str = "openai/clip-vit-base-patch32"
    clip_threshold: float = 0.22
    clip_junk: bool = True
    clip_junk_margin: float = 0.02
    depth: int = 0
    max_pages: int = 30


@dataclass
class Job:
    """Một kế hoạch: ảnh phải khớp TẤT CẢ tag."""
    tags: list[str]
    count: int
    links: list[str] = field(default_factory=list)
    search_query: str = ""                                  # do Scraper điền (từ chuẩn sau đồng nghĩa)
    tag_segments: dict = field(default_factory=dict)        # tag -> các đoạn tương đương
    segments: list = field(default_factory=list)            # [(các cụm tương đương, từ chuẩn), ...]

    @property
    def category(self) -> str:
        return " + ".join(self.tags)

    @property
    def query(self) -> str:
        return self.search_query or " ".join(self.tags)


class Stats:
    def __init__(self, max_seconds: int = 0) -> None:
        self.saved = self.dup = self.banned = self.failed = self.small = self.seen = 0
        self.nomatch = self.partial = self.clipped = self.junk = 0
        self.source = ""
        self.reasons: Counter = Counter()
        self.deadline = time.monotonic() + max_seconds if max_seconds else None
        self.lock = threading.Lock()

    def inc(self, name: str) -> None:
        with self.lock:
            setattr(self, name, getattr(self, name) + 1)

    def fail(self, reason: str) -> None:
        with self.lock:
            self.failed += 1
            self.reasons[reason] += 1

    @property
    def timed_out(self) -> bool:
        return self.deadline is not None and time.monotonic() > self.deadline


class Console:
    """In 1 dòng tiến trình duy nhất; cảnh báo chen lên trên dòng đó."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.width = shutil.get_terminal_size((100, 20)).columns - 1

    def progress(self, text: str) -> None:
        with self.lock:
            sys.stdout.write("\r" + text[: self.width].ljust(self.width))
            sys.stdout.flush()

    def line(self, text: str) -> None:
        with self.lock:
            sys.stdout.write("\r" + " " * self.width + "\r" + text + "\n")
            sys.stdout.flush()


class Source:
    def __init__(self, name: str, it, query: str = "") -> None:
        self.name, self.it, self.query = name, it, query
        self.fails = 0
        self.stale = 0


class Round:
    """Một bộ tag đang được tìm: sinh lần lượt các câu truy vấn."""
    def __init__(self, subset, gen) -> None:
        self.subset, self.gen, self.stall = subset, gen, 0


class Skip(Exception):
    """Bỏ qua ảnh vì lý do rõ ràng (không phải lỗi mạng)."""


class Scraper:
    def __init__(self, cfg: Config, http: HttpClient, store: Store,
                 console: Console | None = None, clip: ClipFilter | None = None) -> None:
        self.cfg, self.http, self.store = cfg, http, store
        self.con = console or Console()
        self.syn = Synonyms.load(cfg.alias_files) if cfg.synonyms else Synonyms([])
        self.banned = [fold(b.strip()) for b in cfg.banned if b.strip()]
        self.seen_urls: set[str] = set()
        self.tag_rejected: set[str] = set()
        self.blocked_until: dict[str, float] = {}     # engine -> thời điểm được dùng lại (xuyên các kế hoạch)
        self.host_fail: Counter = Counter()
        self.host_ok: set[str] = set()
        self._host_lock = threading.Lock()
        self.clip_obj = clip
        self._clip_tried = clip is not None
        self.engines: list[Engine] = [
            ENGINES[n](http, cfg.safesearch) for n in cfg.engines if n in ENGINES
        ]

    # ------------------------------------------------------------------ CLIP
    def _ensure_clip(self) -> None:
        if self._clip_tried or self.cfg.clip == "off":
            return
        self._clip_tried = True
        try:
            self.con.line("Đang nạp CLIP (lần đầu sẽ tải model ~600MB)...")
            self.clip_obj = ClipFilter(model_name=self.cfg.clip_model, threshold=self.cfg.clip_threshold,
                                       junk=self.cfg.clip_junk, junk_margin=self.cfg.clip_junk_margin)
        except Exception as e:  # noqa: BLE001
            if self.cfg.clip == "on":
                raise
            why = str(e) if isinstance(e, ClipUnavailable) else f"{type(e).__name__}: {e}"
            self.con.line(f"  ! không dùng được CLIP, chuyển sang lọc theo chữ. ({why})")
            self.clip_obj = None

    def _text_strict(self) -> bool:
        return self.cfg.match == "strict" or (self.cfg.match == "auto" and self.clip_obj is None)

    # ------------------------------------------------------------------ engine health
    def _alive(self, e: Engine) -> bool:
        return time.time() >= self.blocked_until.get(e.name, 0)

    def _any_alive(self) -> bool:
        return any(self._alive(e) for e in self.engines)

    def _block(self, name: str, seconds: int) -> None:
        self.blocked_until[name] = time.time() + seconds

    # ------------------------------------------------------------------ sources
    def _link_sources(self, job: Job) -> list[Source]:
        nsfw = self.cfg.safesearch == "off"
        return [Source("link", crawl(self.http, l, self.cfg.depth, self.cfg.max_pages, nsfw)) for l in job.links]

    def _engine_sources(self, query: str) -> list[Source]:
        return [Source(e.name, e.search(query), query) for e in self.engines if self._alive(e)]

    # ------------------------------------------------------------------ filters
    def _is_banned(self, c: Candidate) -> bool:
        if not self.banned:
            return False
        hay = fold(" ".join([c.title, c.alt, c.image_url, c.source_page]))
        return any(b in hay for b in self.banned)

    @staticmethod
    def _tokens(text: str) -> set[str]:
        text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)      # MemePose -> Meme Pose
        return set(re.findall(r"[a-z0-9]+", fold(text)))

    @staticmethod
    def _word_ok(w: str, toks: set[str]) -> bool:
        """Từ w có trong tập từ của ảnh không (chịu số nhiều, tiền tố, từ dính liền)."""
        if w.isdigit():
            return w in toks
        stems = {w}
        if len(w) >= 5 and w.endswith("es"):
            stems.add(w[:-2])
        if len(w) >= 5 and w.endswith("s"):
            stems.add(w[:-1])
        for v in stems:
            if v in toks or v + "s" in toks or v + "es" in toks:
                return True
            if len(v) >= 4 and any(t.startswith(v) for t in toks):     # meme -> memepose, memeing
                return True
            if len(v) >= 6 and any(v in t for t in toks):              # selfie -> mirrorselfie
                return True
        return False

    def _toks(self, c: Candidate) -> set[str] | None:
        """Tập từ của ảnh (tiêu đề + alt + đường dẫn URL không phải số). None = không có chữ để kiểm chứng."""
        if not c.title and not c.alt:
            return None
        toks = self._tokens(c.title + " " + c.alt)
        for u in (c.image_url, c.source_page):
            p = urlparse(u)
            toks |= {t for t in self._tokens(p.path + " " + p.query) if not t.isdigit()}
        return toks

    def _segs_ok(self, segments: list, toks: set[str]) -> bool:
        """Mỗi đoạn phải khớp ÍT NHẤT MỘT cụm tương đương, và cụm đó phải có đủ mọi từ."""
        return all(
            any(all(self._word_ok(w, toks) for w in alt.split()) for alt in alts)
            for alts, _ in segments
        )

    def _filter(self, batch: list[Candidate], st: Stats, job: Job, subset: list[str] | None = None) -> list[Candidate]:
        """`subset` = các tag mà ảnh PHẢI khớp ở vòng này (mặc định: tất cả tag của kế hoạch)."""
        subset = subset or job.tags
        strict = self._text_strict()
        keep = []
        for c in batch:
            st.inc("seen")
            u = c.image_url
            if u in self.seen_urls or self.store.has_url(u):
                continue
            if urlparse(u).path.lower().endswith(SKIP_EXT):
                self.seen_urls.add(u)
                continue
            if self._is_banned(c):
                self.seen_urls.add(u)
                st.inc("banned")
                continue
            toks = self._toks(c) if strict else None
            if toks is None:                       # không kiểm chứng được bằng chữ -> để CLIP/câu truy vấn lo
                matched = list(subset)
            else:
                matched = [t for t in job.tags if self._segs_ok(job.tag_segments[t], toks)]
                if not all(t in matched for t in subset):
                    # không đánh dấu "đã thấy": vòng sau (tổ hợp tag khác) vẫn được xét lại
                    if u not in self.tag_rejected:
                        self.tag_rejected.add(u)
                        st.inc("nomatch")
                    continue
            self.seen_urls.add(u)
            if c.width and c.height and min(c.width, c.height) < self.cfg.min_size:
                st.inc("small")
                continue
            c.matched, c.need = matched, list(subset)
            keep.append(c)
        return keep

    # ------------------------------------------------------------------ download
    def _download(self, c: Candidate) -> bytes:
        origin = c.source_page or f"{urlparse(c.image_url).scheme}://{urlparse(c.image_url).netloc}/"
        r = self.http.get(c.image_url, referer=origin, stream=True, kind="image", retries=0,
                          timeout=IMAGE_TIMEOUT)
        try:
            ctype = r.headers.get("Content-Type", "").lower()
            if ctype and not (ctype.startswith("image/") or "octet-stream" in ctype):
                raise Skip("không phải ảnh")
            clen = r.headers.get("Content-Length")
            if clen and clen.isdigit() and int(clen) > self.cfg.max_bytes:
                raise Skip("quá lớn")
            buf = bytearray()
            for chunk in r.iter_content(65536):
                buf += chunk
                if len(buf) > self.cfg.max_bytes:
                    raise Skip("quá lớn")
            return bytes(buf)
        finally:
            r.close()

    def _host_blocked(self, host: str) -> bool:
        with self._host_lock:
            return self.host_fail[host] >= self.cfg.host_fail_limit and host not in self.host_ok

    def _note_host(self, host: str, ok: bool) -> None:
        with self._host_lock:
            if ok:
                self.host_ok.add(host)
            else:
                self.host_fail[host] += 1

    @staticmethod
    def _reason(e: Exception) -> str:
        m = re.search(r"HTTP (\d{3})", str(e))
        return f"HTTP {m.group(1)}" if m else "lỗi mạng/timeout"

    def _process(self, c: Candidate, job: Job, st: Stats) -> None:
        if st.saved >= job.count or st.timed_out:
            return
        host = urlparse(c.image_url).netloc
        if self._host_blocked(host):
            st.fail("host bị bỏ qua (lỗi liên tiếp)")
            return
        try:
            data = self._download(c)
        except Skip as e:
            st.fail(str(e))
            return
        except FetchError as e:
            self._note_host(host, False)
            st.fail(self._reason(e))
            return
        except Exception as e:  # noqa: BLE001  (đứt kết nối giữa chừng, v.v.)
            self._note_host(host, False)
            st.fail(self._reason(e))
            return
        self._note_host(host, True)

        try:
            img = Image.open(BytesIO(data))
            fmt = img.format or ""
            img.verify()
            img = Image.open(BytesIO(data))
            w, h = img.size
            if fmt not in EXT:
                st.fail("định dạng lạ")
                return
            if min(w, h) < self.cfg.min_size or max(w, h) / max(1, min(w, h)) > self.cfg.max_aspect:
                st.inc("small")                      # quá nhỏ hoặc dị dạng (banner dài/hẹp)
                return
            thumb = img.copy()
            thumb.thumbnail((512, 512))
            rgb = thumb.convert("RGB")
            phash = int(str(imagehash.phash(rgb)), 16)
        except (OSError, ValueError, Image.DecompressionBombError, SyntaxError):
            st.fail("ảnh hỏng")
            return

        md5 = hashlib.md5(data).hexdigest()
        if self.store.is_dup(md5, phash):            # kiểm tra trùng TRƯỚC khi tốn công chạy CLIP
            st.inc("dup")
            return

        matched = list(c.matched or job.tags)
        scores = None
        if self.clip_obj is not None:
            try:
                v = self.clip_obj.judge(rgb)
            except Exception:  # noqa: BLE001
                st.fail("CLIP lỗi")
                return
            if v.junk:
                st.inc("junk")
                return
            matched, scores = v.matched, v.scores
            if not all(t in matched for t in (c.need or job.tags)):
                st.inc("clipped")
                return

        with st.lock:
            if st.saved >= job.count:
                return
            rec, reason = self.store.commit(
                data=data, ext=EXT[fmt], md5=md5, phash=phash,
                meta={
                    "category": job.category, "keywords": c.query or job.query, "tags": job.tags,
                    "matched_tags": matched, "clip_scores": scores,
                    "match": "full" if len(matched) == len(job.tags) else "partial",
                    "image_url": c.image_url, "source_page": c.source_page,
                    "title": c.title, "alt_text": c.alt, "engine": c.engine,
                    "width": w, "height": h, "format": fmt.lower(),
                },
            )
            if rec:
                st.saved += 1
                if rec["match"] == "partial":
                    st.partial += 1
        if not rec:
            st.inc("dup")

    # ------------------------------------------------------------------ run
    def _render(self, job: Job, st: Stats) -> None:
        clip = f" | lệch ảnh {st.clipped} rác {st.junk}" if self.clip_obj else ""
        self.con.progress(
            f"[{job.category}] {st.saved}/{job.count} | trùng {st.dup} | cấm {st.banned} | "
            f"lệch tag {st.nomatch}{clip} | một phần {st.partial} | nhỏ {st.small} | lỗi {st.failed} | {st.source}"
        )

    def _drain(self, sources: list[Source], job: Job, st: Stats, pool: ThreadPoolExecutor, limit: int,
               subset: list[str] | None = None) -> None:
        """Lấy ảnh từ các nguồn (xoay vòng) cho tới khi đủ số lượng, hết nguồn hoặc hết thời gian."""
        while st.saved < job.count and sources and st.seen < limit and not st.timed_out:
            for src in list(sources):
                if st.saved >= job.count or st.timed_out:
                    break
                st.source = f"{src.name}: {src.query}" if src.query else src.name
                self._render(job, st)
                try:
                    batch = next(src.it)
                except StopIteration:
                    sources.remove(src)
                    continue
                except (Blocked, FetchError) as e:
                    src.fails += 1
                    self.con.line(f"  ! {src.name}: {e}")
                    if src.fails >= 2 or isinstance(e, Blocked):
                        if src.name != "link":
                            self._block(src.name, self.cfg.engine_cooldown if isinstance(e, Blocked) else 120)
                            self.con.line(f"  ! nghỉ nguồn {src.name} một lúc (áp dụng cho các kế hoạch sau)")
                        sources.remove(src)
                    continue
                src.fails = 0
                cands = self._filter(batch, st, job, subset)
                for c in cands:
                    c.query = src.query
                src.stale = 0 if cands else src.stale + 1
                if src.stale >= 5:
                    sources.remove(src)
                pending = {pool.submit(self._process, c, job, st) for c in cands}
                while pending:
                    _, pending = wait(pending, timeout=0.5)
                    self._render(job, st)

    def _make_round(self, job: Job, tags: list[str], max_queries: int, include_base: bool = True) -> Round:
        subset = None if tags == job.tags else tags

        def gen() -> Iterator[str]:
            if include_base:
                yield self.syn.query(tags)
            if self.cfg.expand:
                yield from expand(tags, self.syn, max_queries)

        return Round(subset, gen())

    def _run_rounds(self, job: Job, st: Stats, pool: ThreadPoolExecutor, limit: int, rounds: list[Round]) -> int:
        """Chạy xen kẽ các bộ tag (mỗi lượt 1 câu truy vấn mỗi bộ) để số ảnh chia đều giữa các bộ."""
        n = 0
        active = list(rounds)
        while active and st.saved < job.count and st.seen < limit and not st.timed_out:
            for r in list(active):
                if st.saved >= job.count or st.timed_out:
                    break
                if r.stall >= self.cfg.stall_queries:
                    active.remove(r)
                    continue
                if not self._any_alive():
                    self.con.line("  ! mọi search engine đang bị chặn/nghỉ, dừng mở rộng")
                    return n
                q = next(r.gen, None)
                if q is None:
                    active.remove(r)
                    continue
                before = st.saved
                n += 1
                time.sleep(random.uniform(0.3, 0.8))
                self._drain(self._engine_sources(q), job, st, pool, limit, r.subset)
                r.stall = 0 if st.saved > before else r.stall + 1
        return n

    def run_job(self, job: Job) -> Stats:
        st = Stats(self.cfg.max_seconds)
        self._ensure_clip()
        job.tag_segments = {t: self.syn.segments(t) for t in job.tags}
        job.segments = [seg for t in job.tags for seg in job.tag_segments[t]]
        job.search_query = self.syn.query(job.tags)
        if self.clip_obj is not None:
            self.clip_obj.prepare({t: self.syn.query([t]) for t in job.tags})
        self.seen_urls = set()   # ảnh bị loại ở kế hoạch khác vẫn được xét lại ở kế hoạch này
        self.tag_rejected = set()
        use_search = not job.links or self.cfg.fallback_search
        limit = job.count * 80 + 500
        pool = ThreadPoolExecutor(max_workers=self.cfg.workers)
        queries_run = 0
        try:
            # vòng 1: link do người dùng đưa + câu truy vấn gốc, ảnh phải khớp TẤT CẢ tag
            first = self._link_sources(job) + (self._engine_sources(job.query) if use_search else [])
            self._drain(first, job, st, pool, limit)
            # ... rồi các câu mở rộng của bộ tag đầy đủ
            if use_search and self.cfg.expand:
                queries_run += self._run_rounds(
                    job, st, pool, limit, [self._make_round(job, job.tags, self.cfg.max_queries, False)])

            # vòng 2: vẫn thiếu -> tách lẻ tag (từ tổ hợp lớn xuống nhỏ), ảnh khớp một phần được đánh dấu
            if use_search and self.cfg.split and len(job.tags) > 1 and st.saved < job.count and not st.timed_out:
                subsets = [list(c) for k in range(len(job.tags) - 1, 0, -1)
                           for c in itertools.combinations(job.tags, k)][: self.cfg.max_subsets]
                self.con.line(f"  → chưa đủ ảnh khớp tất cả tag, chuyển sang tìm theo tag lẻ "
                              f"({len(subsets)} tổ hợp); ảnh khớp một phần được đánh dấu match=partial")
                for k in range(len(job.tags) - 1, 0, -1):          # từng mức: cùng số tag, chạy xen kẽ
                    level = [t for t in subsets if len(t) == k]
                    if not level:
                        continue
                    if st.saved >= job.count or st.seen >= limit or st.timed_out:
                        break
                    queries_run += self._run_rounds(
                        job, st, pool, limit,
                        [self._make_round(job, t, self.cfg.split_queries) for t in level])
        except KeyboardInterrupt:
            pool.shutdown(wait=False, cancel_futures=True)
            self.store.save()
            raise
        finally:
            pool.shutdown(wait=True, cancel_futures=True)
            self.store.save()
        self._render(job, st)
        self.con.line("")
        self._report(job, st, queries_run)
        return st

    def _report(self, job: Job, st: Stats, queries_run: int) -> None:
        if queries_run:
            self.con.line(f"  (đã dùng thêm {queries_run} câu truy vấn mở rộng/tách tag)")
        if st.partial:
            self.con.line(f"  ℹ {st.partial}/{st.saved} ảnh chỉ khớp một phần tag (cột match=partial, "
                          f"matched_tags cho biết tag nào khớp)")
        if st.reasons:
            top = ", ".join(f"{k}: {v}" for k, v in st.reasons.most_common(4))
            self.con.line(f"  ℹ ảnh tải lỗi/bỏ qua: {top}")
        now = time.time()
        blocked = [f"{n} (~{int(t - now)}s)" for n, t in self.blocked_until.items() if t > now]
        if blocked:
            self.con.line(f"  ⚠ engine đang bị chặn/captcha: {', '.join(blocked)}. "
                          f"Thử --cookies (cookie trình duyệt của bạn), --proxy-file, hoặc đợi vài phút")
        if st.timed_out:
            self.con.line(f"  ⏱ hết giới hạn thời gian {self.cfg.max_seconds}s cho kế hoạch này (đổi bằng --time-limit)")
        if st.saved < job.count:
            hint = "thử --match loose, thêm tag đồng nghĩa vào aliases.txt, hạ --clip-threshold, hoặc đưa thêm link"
            self.con.line(f"  ⚠ chỉ lấy được {st.saved}/{job.count} ảnh cho '{job.category}'. Gợi ý: {hint}")
