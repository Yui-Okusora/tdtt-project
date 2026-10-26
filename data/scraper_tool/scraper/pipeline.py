"""Điều phối: nguồn (link / search engine) -> lọc -> tải song song -> chống trùng -> lưu."""
from __future__ import annotations

import hashlib
import itertools
from typing import Iterator
import random
import re
import time
import shutil
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, wait
from dataclasses import dataclass, field
from io import BytesIO
from urllib.parse import urlparse

import imagehash
from PIL import Image

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


@dataclass
class Config:
    out_dir: str = "output"
    engines: list[str] = field(default_factory=lambda: ["bing", "duckduckgo", "google"])
    banned: list[str] = field(default_factory=list)
    workers: int = 8
    min_size: int = 200          # cạnh ngắn nhất (px)
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
    synonyms: bool = True        # bật bảng đồng nghĩa (thời trang = fashion, ...)
    alias_files: list[str] = field(default_factory=list)
    match: str = "strict"        # strict: ảnh phải chứa TẤT CẢ tag trong metadata; loose: chỉ AND ở câu truy vấn
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
    def __init__(self) -> None:
        self.saved = self.dup = self.banned = self.failed = self.small = self.seen = self.nomatch = self.partial = 0
        self.source = ""
        self.lock = threading.Lock()

    def inc(self, name: str) -> None:
        with self.lock:
            setattr(self, name, getattr(self, name) + 1)


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


class Scraper:
    def __init__(self, cfg: Config, http: HttpClient, store: Store, console: Console | None = None) -> None:
        self.cfg, self.http, self.store = cfg, http, store
        self.con = console or Console()
        self.syn = Synonyms.load(cfg.alias_files) if cfg.synonyms else Synonyms([])
        self.banned = [fold(b.strip()) for b in cfg.banned if b.strip()]
        self.seen_urls: set[str] = set()
        self.tag_rejected: set[str] = set()
        self.dead: set[str] = set()      # engine bị chặn -> không dùng lại trong kế hoạch hiện tại
        self.engines: list[Engine] = [
            ENGINES[n](http, cfg.safesearch) for n in cfg.engines if n in ENGINES
        ]

    # ------------------------------------------------------------------ sources
    def _link_sources(self, job: Job) -> list[Source]:
        return [Source("link", crawl(self.http, l, self.cfg.depth, self.cfg.max_pages)) for l in job.links]

    def _engine_sources(self, query: str) -> list[Source]:
        return [Source(e.name, e.search(query), query) for e in self.engines if e.name not in self.dead]

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
            toks = self._toks(c) if self.cfg.match == "strict" else None
            if toks is None:                       # không kiểm chứng được -> tin vào câu truy vấn
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
            c.matched = matched
            keep.append(c)
        return keep

    # ------------------------------------------------------------------ download
    def _download(self, c: Candidate) -> bytes | None:
        origin = c.source_page or f"{urlparse(c.image_url).scheme}://{urlparse(c.image_url).netloc}/"
        r = self.http.get(c.image_url, referer=origin, stream=True, kind="image", retries=1)
        try:
            ctype = r.headers.get("Content-Type", "").lower()
            if ctype and not (ctype.startswith("image/") or "octet-stream" in ctype):
                return None
            clen = r.headers.get("Content-Length")
            if clen and clen.isdigit() and int(clen) > self.cfg.max_bytes:
                return None
            buf = bytearray()
            for chunk in r.iter_content(65536):
                buf += chunk
                if len(buf) > self.cfg.max_bytes:
                    return None
            return bytes(buf)
        finally:
            r.close()

    def _process(self, c: Candidate, job: Job, st: Stats) -> None:
        if st.saved >= job.count:
            return
        try:
            data = self._download(c)
            if not data:
                st.inc("failed")
                return
            img = Image.open(BytesIO(data))
            fmt = img.format or ""
            img.verify()
            img = Image.open(BytesIO(data))
            w, h = img.size
            if fmt not in EXT:
                st.inc("failed")
                return
            if min(w, h) < self.cfg.min_size:
                st.inc("small")
                return
            thumb = img.copy()
            thumb.thumbnail((512, 512))
            phash = int(str(imagehash.phash(thumb.convert("RGB"))), 16)
        except (FetchError, OSError, ValueError, Image.DecompressionBombError, SyntaxError):
            st.inc("failed")
            return

        md5 = hashlib.md5(data).hexdigest()
        with st.lock:
            if st.saved >= job.count:
                return
            rec, reason = self.store.commit(
                data=data, ext=EXT[fmt], md5=md5, phash=phash,
                meta={
                    "category": job.category, "keywords": c.query or job.query, "tags": job.tags,
                    "matched_tags": c.matched or job.tags,
                    "match": "full" if len(c.matched or job.tags) == len(job.tags) else "partial",
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
        self.con.progress(
            f"[{job.category}] {st.saved}/{job.count} | trùng {st.dup} | cấm {st.banned} | lệch tag {st.nomatch} | một phần {st.partial} | "
            f"nhỏ {st.small} | lỗi {st.failed} | {st.source}"
        )

    def _drain(self, sources: list[Source], job: Job, st: Stats, pool: ThreadPoolExecutor, limit: int,
               subset: list[str] | None = None) -> None:
        """Lấy ảnh từ các nguồn (xoay vòng) cho tới khi đủ số lượng hoặc hết nguồn."""
        while st.saved < job.count and sources and st.seen < limit:
            for src in list(sources):
                if st.saved >= job.count:
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
                        if isinstance(e, Blocked) and src.name != "link":
                            self.dead.add(src.name)
                        self.con.line(f"  ! tạm tắt nguồn {src.name} cho kế hoạch này")
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

    def _make_round(self, job: Job, tags: list[str], max_queries: int, include_base: bool = True) -> "Round":
        subset = None if tags == job.tags else tags

        def gen() -> Iterator[str]:
            if include_base:
                yield self.syn.query(tags)
            if self.cfg.expand:
                yield from expand(tags, self.syn, max_queries)

        return Round(subset, gen())

    def _run_rounds(self, job: Job, st: Stats, pool: ThreadPoolExecutor, limit: int, rounds: list["Round"]) -> int:
        """Chạy xen kẽ các bộ tag (mỗi lượt 1 câu truy vấn mỗi bộ) để số ảnh chia đều giữa các bộ."""
        n = 0
        active = list(rounds)
        while active and st.saved < job.count and st.seen < limit:
            for r in list(active):
                if st.saved >= job.count:
                    break
                if r.stall >= self.cfg.stall_queries:
                    active.remove(r)
                    continue
                if not [e for e in self.engines if e.name not in self.dead]:
                    self.con.line("  ! mọi search engine đều đang bị chặn, dừng mở rộng")
                    return n
                q = next(r.gen, None)
                if q is None:
                    active.remove(r)
                    continue
                before = st.saved
                n += 1
                time.sleep(random.uniform(0.8, 2.0))
                self._drain(self._engine_sources(q), job, st, pool, limit, r.subset)
                r.stall = 0 if st.saved > before else r.stall + 1
        return n

    def run_job(self, job: Job) -> Stats:
        st = Stats()
        job.tag_segments = {t: self.syn.segments(t) for t in job.tags}
        job.segments = [seg for t in job.tags for seg in job.tag_segments[t]]
        job.search_query = self.syn.query(job.tags)
        self.seen_urls = set()   # ảnh bị loại ở kế hoạch khác vẫn được xét lại ở kế hoạch này
        self.tag_rejected = set()
        self.dead = set()
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
            if use_search and self.cfg.split and len(job.tags) > 1 and st.saved < job.count:
                subsets = [list(c) for k in range(len(job.tags) - 1, 0, -1)
                           for c in itertools.combinations(job.tags, k)][: self.cfg.max_subsets]
                self.con.line(f"  → chưa đủ ảnh khớp tất cả tag, chuyển sang tìm theo tag lẻ "
                              f"({len(subsets)} tổ hợp); ảnh khớp một phần được đánh dấu match=partial")
                for k in range(len(job.tags) - 1, 0, -1):          # từng mức: cùng số tag, chạy xen kẽ
                    level = [t for t in subsets if len(t) == k]
                    if not level:
                        continue
                    if st.saved >= job.count or st.seen >= limit:
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
        if queries_run:
            self.con.line(f"  (đã dùng thêm {queries_run} câu truy vấn mở rộng/tách tag)")
        if st.partial:
            self.con.line(f"  ℹ {st.partial}/{st.saved} ảnh chỉ khớp một phần tag (cột match=partial, "
                          f"matched_tags cho biết tag nào khớp)")
        if st.saved < job.count:
            hint = "thử --match loose, thêm tag đồng nghĩa vào aliases.txt, hoặc đưa thêm link"
            self.con.line(f"  ⚠ chỉ lấy được {st.saved}/{job.count} ảnh cho '{job.category}'. Gợi ý: {hint}")
        return st
