"""Background batch processing with bounded concurrency, retry, stop and error isolation."""
import logging
import threading
from concurrent.futures import ThreadPoolExecutor

from . import tokens as tk
from .analyzer import analyze_image
from .config import AppConfig
from .errors import Cancelled, ProviderError
from .logging_setup import redact
from .store import COMPLETED, ERROR, PENDING, PROCESSING, ImageStore

log = logging.getLogger(__name__)


class BatchJob:
    """Runs in background threads; never touches Streamlit state."""

    def __init__(self, store: ImageStore, provider_factory, cfg: AppConfig,
                 lists: dict[str, list[str]], targets: list[str]):
        self.store = store
        self.provider_factory = provider_factory
        self.cfg = cfg
        self.lists = lists
        self.targets = list(targets)
        self.cancel = threading.Event()
        self._lock = threading.Lock()
        self._finished = 0
        self._ok = 0
        self._failed = 0
        self._futures = []
        self._thread: threading.Thread | None = None
        self.notified = False  # UI flag: finish already reflected

    # ---- control -------------------------------------------------------
    def start(self):
        self._thread = threading.Thread(target=self._run, daemon=True, name="batch-coordinator")
        self._thread.start()

    def stop(self):
        self.cancel.set()
        for f in self._futures:
            f.cancel()

    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def join(self, timeout=None):
        if self._thread:
            self._thread.join(timeout)

    def progress(self) -> dict:
        with self._lock:
            return {"total": len(self.targets), "finished": self._finished, "ok": self._ok,
                    "failed": self._failed, "stopped": self.cancel.is_set()}

    # ---- internals -----------------------------------------------------
    def _run(self):
        try:
            provider = self.provider_factory()
            with ThreadPoolExecutor(max_workers=max(1, self.cfg.concurrency)) as ex:
                self._futures = [ex.submit(self._work, provider, rid) for rid in self.targets]
                for f in self._futures:
                    try:
                        f.result()
                    except Exception:  # cancelled future or worker bug: never crash the job
                        pass
        except ProviderError as e:  # e.g. not configured -> mark all targets, keep going safe
            for rid in self.targets:
                rec = self.store.get(rid)
                if rec and rec.status != COMPLETED:
                    rec.status, rec.error = ERROR, redact(str(e))
            with self._lock:
                self._failed = len(self.targets)
                self._finished = len(self.targets)
        finally:
            self.store.save()

    def _work(self, provider, rid: str):
        rec = self.store.get(rid)
        if rec is None or self.cancel.is_set():
            return
        had_result = rec.result is not None
        rec.status, rec.error = PROCESSING, None
        outcome = None  # "ok" | "fail" | None (stopped by user)
        try:
            w, h = self.store.dims(rec)
            est = tk.estimate_items([(rec.id, w, h)], self.cfg, self.lists)
            result, usage = analyze_image(provider, self.store.image_path(rec), self.cfg, self.lists, self.cancel)
            with self.store.lock:
                if usage:
                    rec.tokens_in, rec.tokens_out = usage["input"], usage["output"]
                    rec.tokens_spent += usage["input"] + usage["output"]
                    rec.tokens_est_in, rec.tokens_est_out = est.input_tokens, est.output_tokens
                rec.result = result
                rec.status = COMPLETED
                rec.reviewed = False
                rec.edited_fields = []
                rec.attempts += 1
                rec.rev += 1
            outcome = "ok"
        except Cancelled:
            rec.status = COMPLETED if had_result else PENDING
        except ProviderError as e:
            self._fail(rec, had_result, redact(str(e)))
            outcome = "fail"
        except Exception as e:  # unexpected: isolate to this image
            log.exception("Lỗi không mong đợi khi xử lý %s", rec.filename)
            self._fail(rec, had_result, f"Lỗi không mong đợi: {type(e).__name__}: {redact(str(e))[:200]}")
            outcome = "fail"
        finally:
            if outcome:
                with self._lock:
                    self._finished += 1
                    if outcome == "ok":
                        self._ok += 1
                    else:
                        self._failed += 1
            self.store.save()

    @staticmethod
    def _fail(rec, had_result: bool, message: str):
        # Keep any earlier good result instead of wiping it.
        rec.status = COMPLETED if had_result else ERROR
        rec.error = (f"Phân tích lại thất bại (giữ kết quả cũ): {message}" if had_result else message)
        rec.attempts += 1
