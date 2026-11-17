import json
import unittest
from pathlib import Path

from core.batch import BatchJob
from core.config import MODE_STRICT
from core.errors import ProviderError
from core.imaging import prepare_image
from core.store import COMPLETED, ERROR, PENDING, ImageStore
from tests.helpers import FakeProvider, cfg, good_raw, make_png, tmpdir

EMPTY_LISTS = {"category": [], "shot_type": [], "vibe": []}


def run_job(store, provider, ids, **cfg_kw):
    job = BatchJob(store, lambda: provider, cfg(**cfg_kw), cfg_kw.pop("lists", EMPTY_LISTS), ids)
    job.start()
    job.join(10)
    return job


class StoreTests(unittest.TestCase):
    def test_add_dedupe_and_reject(self):
        with tmpdir() as d:
            s = ImageStore(d)
            added, skipped = s.add_files([("a.png", make_png()), ("b.png", make_png()),   # b duplicates a
                                          ("c.txt", b"hello"), ("bad.png", b"not an image"),
                                          ("d.png", make_png((1, 2, 3)))])
            self.assertEqual(added, 2)
            self.assertEqual(len(skipped), 3)
            self.assertEqual([r.filename for r in s.records], ["a.png", "d.png"])

    def test_unique_filenames(self):
        with tmpdir() as d:
            s = ImageStore(d)
            s.add_files([("x.png", make_png((1, 1, 1)))])
            s.add_files([("x.png", make_png((2, 2, 2)))])
            self.assertEqual([r.filename for r in s.records], ["x.png", "x_2.png"])

    def test_persistence_and_crash_recovery(self):
        with tmpdir() as d:
            s = ImageStore(d)
            s.add_files([("a.png", make_png())])
            rec = s.records[0]
            rec.status = "processing"        # simulate crash mid-run
            s.settings["lists"] = {"category": "x"}
            s.save()
            s2 = ImageStore(d)
            self.assertEqual(s2.records[0].status, PENDING)
            self.assertEqual(s2.settings["lists"]["category"], "x")

    def test_remove_deletes_files(self):
        with tmpdir() as d:
            s = ImageStore(d)
            s.add_files([("a.png", make_png())])
            rec = s.records[0]
            p = s.image_path(rec)
            s.remove(rec.id)
            self.assertFalse(p.exists())
            self.assertEqual(s.records, [])

    def test_prepare_image_downsizes_and_handles_alpha(self):
        import io
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGBA", (3000, 1500), (255, 0, 0, 100)).save(buf, "PNG")
        data, mime = prepare_image(io.BytesIO(buf.getvalue()), max_side=1000)
        im = Image.open(io.BytesIO(data))
        self.assertEqual(mime, "image/jpeg")
        self.assertEqual(max(im.size), 1000)
        self.assertEqual(im.mode, "RGB")

    def test_prepare_image_corrupt(self):
        import io
        with self.assertRaises(ProviderError):
            prepare_image(io.BytesIO(b"garbage"))


class BatchTests(unittest.TestCase):
    def setUp(self):
        self._d = tmpdir()
        self.store = ImageStore(self._d.name)
        self.store.add_files([(f"img{i}.png", make_png((i * 40, 10, 10))) for i in range(3)])
        self.ids = [r.id for r in self.store.records]

    def tearDown(self):
        self._d.cleanup()

    def test_all_images_get_their_own_result(self):
        script = [good_raw(subject_features=f"subject {i}") for i in range(3)]
        job = run_job(self.store, FakeProvider(script), self.ids)
        self.assertEqual(job.progress()["ok"], 3)
        self.assertEqual([r.result["subject_features"] for r in self.store.records],
                         ["subject 0", "subject 1", "subject 2"])
        self.assertTrue(all(r.status == COMPLETED for r in self.store.records))

    def test_one_failure_does_not_lose_other_results(self):
        script = [good_raw(), ProviderError("HTTP 400 bad image", retryable=False), good_raw()]
        job = run_job(self.store, FakeProvider(script), self.ids)
        st = [r.status for r in self.store.records]
        self.assertEqual(st, [COMPLETED, ERROR, COMPLETED])
        self.assertEqual(job.progress()["failed"], 1)
        self.assertIsNotNone(self.store.records[0].result)
        self.assertIn("bad image", self.store.records[1].error)

    def test_unexpected_exception_is_isolated(self):
        script = [RuntimeError("boom"), good_raw(), good_raw()]
        run_job(self.store, FakeProvider(script), self.ids)
        st = [r.status for r in self.store.records]
        self.assertEqual(st, [ERROR, COMPLETED, COMPLETED])

    def test_retry_failed_only_and_skip_completed(self):
        run_job(self.store, FakeProvider([good_raw(), ProviderError("x"), good_raw()]), self.ids)
        prov = FakeProvider()
        failed = self.store.ids_by_status(ERROR)
        self.assertEqual(len(failed), 1)
        run_job(self.store, prov, failed)
        self.assertEqual(prov.calls, 1)                       # completed images not re-sent
        self.assertTrue(all(r.status == COMPLETED for r in self.store.records))

    def test_transient_error_is_retried(self):
        script = [ProviderError("rate limit", retryable=True, status=429), good_raw()]
        prov = FakeProvider(script)
        job = run_job(self.store, prov, self.ids[:1], max_retries=2)
        self.assertEqual(job.progress()["ok"], 1)
        self.assertEqual(prov.calls, 2)

    def test_reanalysis_failure_keeps_old_result(self):
        run_job(self.store, FakeProvider(), self.ids[:1])
        old = self.store.records[0].result
        run_job(self.store, FakeProvider([ProviderError("down", retryable=False)]), self.ids[:1])
        rec = self.store.records[0]
        self.assertEqual(rec.status, COMPLETED)
        self.assertEqual(rec.result, old)
        self.assertIn("giữ kết quả cũ", rec.error)

    def test_stop_before_start_leaves_pending(self):
        prov = FakeProvider()
        job = BatchJob(self.store, lambda: prov, cfg(), EMPTY_LISTS, self.ids)
        job.stop()
        job.start()
        job.join(5)
        self.assertEqual(prov.calls, 0)
        self.assertTrue(all(r.status == PENDING for r in self.store.records))

    def test_unconfigured_provider_marks_error_not_fake_success(self):
        def factory():
            from core.providers import create_provider
            return create_provider("openai", "", "gpt-4o-mini")
        job = BatchJob(self.store, factory, cfg(), EMPTY_LISTS, self.ids)
        job.start()
        job.join(5)
        self.assertTrue(all(r.status == ERROR and r.result is None for r in self.store.records))
        self.assertIn("API Key", self.store.records[0].error)

    def test_strict_mode_never_stores_value_outside_list(self):
        lists = {"category": ["indoor_studio"], "shot_type": ["full_body"], "vibe": ["calm"]}
        job = BatchJob(self.store, lambda: FakeProvider(), cfg(mode=MODE_STRICT), lists, self.ids[:1])
        job.start()
        job.join(5)
        rf = self.store.records[0].result["rag_filter"]
        self.assertEqual(rf, {"category": "", "shot_type": "full_body", "vibe": ""})

    def test_results_survive_restart(self):
        run_job(self.store, FakeProvider(), self.ids)
        s2 = ImageStore(self._d.name)
        self.assertTrue(all(r.status == COMPLETED and r.result for r in s2.records))


if __name__ == "__main__":
    unittest.main()
