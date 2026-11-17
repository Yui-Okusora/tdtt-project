import json
import unittest
from unittest.mock import patch

from core import export, paging, tokens as tk
from core.analyzer import analyze_image
from core.batch import BatchJob
from core.errors import InvalidResponse, ProviderError
from core.providers.gemini import GeminiProvider
from core.providers.openai_compat import (GroqProvider, OllamaProvider, OpenAIProvider,
                                          OpenRouterProvider)
from core.providers import create_provider
from core.store import COMPLETED, ImageStore, clean_filename
from tests.helpers import FakeProvider, cfg, good_raw, make_png, tmpdir
from tests.test_providers import FakeResp, oa_ok

import threading

LISTS = {"category": [], "shot_type": [], "vibe": []}


# --------------------------------------------------------------------- tokens
class TokenMathTests(unittest.TestCase):
    def test_known_openai_examples(self):
        self.assertEqual(tk.image_tokens("openai", "gpt-4o", 1024, 1024)[0], 765)      # 85 + 4*170
        self.assertEqual(tk.image_tokens("openai", "gpt-5", 1024, 1024)[0], 630)       # 70 + 4*140
        self.assertLessEqual(abs(tk._patch_tokens(1800, 2400, 1.62) - 2352), 1)         # documented example
        self.assertEqual(tk.image_tokens("openai", "gpt-4o-mini", 512, 512)[0], 2833 + 5667)

    def test_gemini_and_unknown(self):
        self.assertEqual(tk.image_tokens("gemini", "gemini-2.0-flash", 300, 300), (258, "medium"))
        self.assertEqual(tk.image_tokens("gemini", "gemini-2.0-flash", 1536, 768)[0], 2 * 258)
        n, conf = tk.image_tokens("ollama", "llama3.2-vision", 1280, 960)
        self.assertEqual(conf, "low")
        self.assertGreater(n, 0)

    def test_openrouter_model_slug_uses_family_rule(self):
        self.assertEqual(tk.image_tokens("openrouter", "openai/gpt-4o", 1024, 1024)[0], 765)

    def test_resize_only_shrinks(self):
        self.assertEqual(tk.resized_dims(4000, 2000, 1000), (1000, 500))
        self.assertEqual(tk.resized_dims(800, 600, 1000), (800, 600))


class EstimateTests(unittest.TestCase):
    ITEMS = [("a", 4000, 3000), ("b", 1000, 800), ("c", 800, 600)]

    def c(self, **kw):
        return cfg(provider="openai", model="gpt-4o", **kw)

    def test_smaller_side_and_detail_reduce_tokens(self):
        big = tk.estimate_items(self.ITEMS, self.c(max_side=2048, detail="detailed"), LISTS).total
        small = tk.estimate_items(self.ITEMS, self.c(max_side=512, detail="concise"), LISTS).total
        self.assertLess(small, big)

    def test_small_images_unaffected_by_side(self):
        small_items = [("c", 400, 300)]
        a = tk.estimate_items(small_items, self.c(max_side=1280), LISTS).total
        b = tk.estimate_items(small_items, self.c(max_side=2048), LISTS).total
        self.assertEqual(a, b)

    def test_vietnamese_costs_more_output(self):
        en = tk.estimate_items(self.ITEMS, self.c(language="en"), LISTS).output_tokens
        vi = tk.estimate_items(self.ITEMS, self.c(language="vi"), LISTS).output_tokens
        self.assertGreater(vi, en)

    def test_per_image_sums_to_total(self):
        est = tk.estimate_items(self.ITEMS, self.c(), LISTS)
        self.assertEqual(est.images, 3)
        self.assertEqual(sum(i + o for i, o in est.per_image.values()), est.total)

    def test_calibration_scales_estimates(self):
        class R:
            tokens_in, tokens_out, tokens_est_in, tokens_est_out = 2000, 300, 1000, 150
        cal = tk.calibration([R()])
        self.assertEqual(cal, (2.0, 2.0, 1))
        base = tk.estimate_items(self.ITEMS, self.c(), LISTS)
        scaled = tk.estimate_items(self.ITEMS, self.c(), LISTS, cal)
        self.assertAlmostEqual(scaled.total / base.total, 2.0, delta=0.02)
        self.assertEqual(scaled.confidence, "calibrated")

    def test_calibration_is_clamped_and_neutral_without_data(self):
        class R:
            tokens_in, tokens_out, tokens_est_in, tokens_est_out = 10 ** 6, 0, 10, 0
        self.assertEqual(tk.calibration([R()])[0], 4.0)
        self.assertEqual(tk.calibration([]), (1.0, 1.0, 0))

    def test_empty_items(self):
        est = tk.estimate_items([], self.c(), LISTS)
        self.assertEqual((est.images, est.total), (0, 0))


class AdvisorTests(unittest.TestCase):
    ITEMS = [(str(i), 4000, 3000) for i in range(50)]

    def setUp(self):
        self.cfg = cfg(provider="gemini", model="gemini-2.0-flash", max_side=2048, detail="detailed")
        self.table = tk.scenario_table(self.ITEMS, self.cfg, LISTS)

    def test_table_covers_all_scenarios_and_is_monotonic(self):
        self.assertEqual(len(self.table), len(tk.SIDE_OPTIONS) * len(tk.DETAIL_ORDER))
        self.assertLess(self.table[(512, "concise")], self.table[(2048, "detailed")])

    def test_budget_exceeded_recommends_fitting_option(self):
        cur = self.table[(2048, "detailed")]
        budget = int(cur * 0.6)
        best, msgs = tk.recommend(self.table, self.cfg, self.ITEMS, budget)
        self.assertIsNotNone(best)
        self.assertLessEqual(self.table[best], budget)
        self.assertEqual(msgs[0][0], "warning")
        # best quality among the options that fit
        fits = [k for k, v in self.table.items() if v <= budget]
        rank = lambda k: tk.SIDE_OPTIONS.index(k[0]) + tk.DETAIL_ORDER.index(k[1])
        self.assertEqual(rank(best), max(rank(k) for k in fits))

    def test_impossible_budget(self):
        best, msgs = tk.recommend(self.table, self.cfg, self.ITEMS, budget=10)
        self.assertIsNone(best)
        self.assertEqual(msgs[0][0], "error")

    def test_within_budget_can_suggest_upgrade(self):
        low = cfg(provider="gemini", model="gemini-2.0-flash", max_side=512, detail="concise")
        table = tk.scenario_table(self.ITEMS, low, LISTS)
        best, msgs = tk.recommend(table, low, self.ITEMS, budget=table[(2048, "detailed")] * 2)
        self.assertEqual(best, (2048, "detailed"))

    def test_no_budget_suggests_savings_for_expensive_setup(self):
        best, msgs = tk.recommend(self.table, self.cfg, self.ITEMS, 0)
        self.assertEqual(best, (1024, "standard"))
        self.assertIn("%", msgs[0][1])

    def test_openai_tile_models_gain_nothing_above_1024(self):
        # OpenAI clamps the short side to 768px, so a bigger long side costs no extra tokens.
        c = cfg(provider="openai", model="gpt-4o", max_side=2048, detail="standard")
        table = tk.scenario_table(self.ITEMS, c, LISTS)
        self.assertEqual(table[(1024, "standard")], table[(2048, "standard")])
        self.assertLess(table[(512, "standard")], table[(1024, "standard")])

    def test_no_budget_cheap_setup_needs_nothing(self):
        cheap = cfg(provider="gemini", model="gemini-2.0-flash", max_side=768, detail="concise")
        table = tk.scenario_table(self.ITEMS, cheap, LISTS)
        best, _ = tk.recommend(table, cheap, self.ITEMS, 0)
        self.assertIsNone(best)


# ------------------------------------------------------------ usage capture
class UsageTests(unittest.TestCase):
    def test_openai_usage_recorded(self):
        p = OpenAIProvider("sk-secret-abcdef", "gpt-4o")
        resp = FakeResp(200, {"choices": [{"message": {"content": json.dumps(good_raw())}}],
                              "usage": {"prompt_tokens": 1111, "completion_tokens": 222}})
        with patch("requests.request", return_value=resp):
            p.analyze(b"x", "image/jpeg", "s", "u", {})
        self.assertEqual(p.pop_usage(), (1111, 222))
        self.assertIsNone(p.pop_usage())

    def test_gemini_usage_includes_thinking_tokens(self):
        p = GeminiProvider("gem-secret-abcdef", "gemini-x")
        resp = FakeResp(200, {"candidates": [{"content": {"parts": [{"text": json.dumps(good_raw())}]}}],
                              "usageMetadata": {"promptTokenCount": 500, "candidatesTokenCount": 100,
                                                "thoughtsTokenCount": 300}})
        with patch("requests.request", return_value=resp):
            p.analyze(b"x", "image/jpeg", "s", "u", {"type": "object", "properties": {}})
        self.assertEqual(p.pop_usage(), (500, 400))

    def test_usage_is_thread_local(self):
        p = OpenAIProvider("sk-secret-abcdef", "gpt-4o")
        p._set_usage(5, 5)
        seen = {}
        t = threading.Thread(target=lambda: seen.setdefault("u", p.pop_usage()))
        t.start(); t.join()
        self.assertIsNone(seen["u"])
        self.assertEqual(p.pop_usage(), (5, 5))

    def test_analyzer_counts_tokens_of_failed_attempts_too(self):
        class P(FakeProvider):
            def analyze(self, *a):
                self.calls += 1
                self._set_usage(100, 10)
                if self.calls == 1:
                    raise InvalidResponse("bad json")
                return good_raw()
        with tmpdir() as d:
            s = ImageStore(d)
            s.add_files([("a.png", make_png())])
            result, usage = analyze_image(P(), s.image_path(s.records[0]), cfg(max_retries=2), LISTS,
                                          threading.Event())
        self.assertEqual(usage, {"input": 200, "output": 20})
        self.assertEqual(result["rag_filter"]["category"], "outdoor_beach")

    def test_analyzer_no_usage_when_provider_reports_none(self):
        with tmpdir() as d:
            s = ImageStore(d)
            s.add_files([("a.png", make_png())])
            _, usage = analyze_image(FakeProvider(), s.image_path(s.records[0]), cfg(), LISTS, threading.Event())
        self.assertIsNone(usage)

    def test_batch_records_actual_and_estimated_tokens(self):
        class P(FakeProvider):
            def analyze(self, *a):
                self._set_usage(900, 120)
                return good_raw()
        with tmpdir() as d:
            s = ImageStore(d)
            s.add_files([("a.png", make_png())])
            job = BatchJob(s, lambda: P(), cfg(), LISTS, [s.records[0].id])
            job.start(); job.join(5)
            r = s.records[0]
            self.assertEqual((r.tokens_in, r.tokens_out, r.tokens_spent), (900, 120, 1020))
            self.assertGreater(r.tokens_est_in, 0)
            r2 = ImageStore(d).records[0]            # persisted
            self.assertEqual(r2.tokens_spent, 1020)


# ---------------------------------------------------------- free providers
class FreeProviderTests(unittest.TestCase):
    def test_openrouter_free_vision_filter(self):
        data = {"data": [
            {"id": "google/gemma-3-27b-it:free", "architecture": {"input_modalities": ["text", "image"]},
             "pricing": {"prompt": "0", "completion": "0"}},
            {"id": "openai/gpt-4o", "architecture": {"input_modalities": ["text", "image"]},
             "pricing": {"prompt": "0.0000025", "completion": "0.00001"}},
            {"id": "meta/text-only:free", "architecture": {"input_modalities": ["text"]},
             "pricing": {"prompt": "0", "completion": "0"}},
            {"id": "openrouter/auto", "architecture": {"input_modalities": ["text", "image"]},
             "pricing": {"prompt": "-1", "completion": "-1"}},
        ]}
        p = OpenRouterProvider("or-secret-abcdef", "m")
        with patch("requests.request", return_value=FakeResp(200, data)):
            self.assertEqual(p.list_models(free_only=True), ["google/gemma-3-27b-it:free"])
        with patch("requests.request", return_value=FakeResp(200, data)):
            allv = p.list_models(free_only=False)
        self.assertEqual(allv[0], "google/gemma-3-27b-it:free")     # free first
        self.assertNotIn("meta/text-only:free", allv)

    def test_groq_name_filter(self):
        data = {"data": [{"id": "meta-llama/llama-4-scout-17b-16e-instruct"}, {"id": "llama-3.3-70b-versatile"},
                         {"id": "whisper-large-v3"}]}
        p = GroqProvider("gsk-secret-abcdef", "m")
        with patch("requests.request", return_value=FakeResp(200, data)):
            self.assertEqual(p.list_models(), ["meta-llama/llama-4-scout-17b-16e-instruct"])

    def test_ollama_needs_no_key_and_uses_capabilities(self):
        p = OllamaProvider("", "llama3.2-vision")
        self.assertNotIn("not-needed", repr(p))

        def fake(method, url, **kw):
            if url.endswith("/models"):
                return FakeResp(200, {"data": [{"id": "llama3.2-vision"}, {"id": "llama3.1"}, {"id": "mystery"}]})
            name = kw["json"]["model"]
            if name == "mystery":                       # /api/show unavailable -> name heuristic (no match)
                return FakeResp(404, {"error": "not found"})
            caps = {"llama3.2-vision": ["completion", "vision"], "llama3.1": ["completion"]}[name]
            return FakeResp(200, {"capabilities": caps})
        with patch("requests.request", side_effect=fake):
            out = p.list_models()
        self.assertEqual(out, ["llama3.2-vision"])

    def test_keyless_providers_construct_but_openai_still_requires_key(self):
        create_provider("ollama", "", "llama3.2-vision")
        create_provider("compatible", "", "m", "http://localhost:1234/v1")
        with self.assertRaises(ProviderError):
            create_provider("openai", "", "gpt-4o")
        with self.assertRaises(ProviderError):
            create_provider("openrouter", "", "x/y:free")


# -------------------------------------------------------------- rename
class RenameTests(unittest.TestCase):
    def setUp(self):
        self._d = tmpdir()
        self.s = ImageStore(self._d.name)
        self.s.add_files([("a.png", make_png((1, 1, 1))), ("b.jpg", make_png((2, 2, 2))),
                          ("c.png", make_png((3, 3, 3)))])
        self.ids = [r.id for r in self.s.records]

    def tearDown(self):
        self._d.cleanup()

    def test_rename_keeps_extension_and_original_file(self):
        stored = self.s.records[0].stored_name
        self.assertEqual(self.s.rename(self.ids[0], "photo_01"), "photo_01.png")
        self.assertEqual(self.s.records[0].stored_name, stored)
        self.assertEqual(self.s.records[0].original_filename, "a.png")
        self.assertTrue(self.s.image_path(self.s.records[0]).exists())

    def test_typed_extension_is_not_doubled(self):
        self.assertEqual(self.s.rename(self.ids[0], "photo.PNG"), "photo.png")

    def test_invalid_names_rejected(self):
        for bad in ["", "   ", "a/b", 'x"y', "con", "NUL", "a" * 200, "..."]:
            with self.assertRaises(ValueError, msg=bad):
                self.s.rename(self.ids[0], bad)
        self.assertEqual(self.s.records[0].filename, "a.png")

    def test_duplicate_rejected_case_insensitive(self):
        with self.assertRaises(ValueError):
            self.s.rename(self.ids[0], "C")           # c.png already exists
        self.assertEqual(self.s.records[0].filename, "a.png")

    def test_bulk_rename_atomic_on_conflict(self):
        with self.assertRaises(ValueError):
            self.s.bulk_rename({self.ids[0]: "x", self.ids[2]: "x"})  # both -> x.png
        self.assertEqual([r.filename for r in self.s.records], ["a.png", "b.jpg", "c.png"])

    def test_bulk_rename_allows_swap_and_persists(self):
        n = self.s.bulk_rename({self.ids[0]: "c", self.ids[2]: "a"})
        self.assertEqual(n, 2)
        self.assertEqual([r.filename for r in ImageStore(self._d.name).records], ["c.png", "b.jpg", "a.png"])

    def test_bulk_numbering(self):
        m = {rid: f"img_{i:03d}" for i, rid in enumerate(self.ids, 1)}
        self.s.bulk_rename(m)
        self.assertEqual([r.filename for r in self.s.records], ["img_001.png", "img_002.jpg", "img_003.png"])

    def test_rename_flows_into_export(self):
        from core.schema import clean_result
        r = self.s.records[0]
        r.result = clean_result(good_raw(), {}, "auto"); r.status = COMPLETED
        self.s.rename(r.id, "renamed")
        self.assertEqual(export.record_to_entry(r)["filename"], "renamed.png")

    def test_dims_and_preview(self):
        r = self.s.records[0]
        self.assertEqual(self.s.dims(r), (40, 30))
        self.assertTrue(self.s.preview_path(r).exists())

    def test_clean_filename_helper(self):
        self.assertEqual(clean_filename(" my pic. ", ".jpg"), "my pic.jpg")


class ExportImagesTests(unittest.TestCase):
    def test_copy_renamed_images_no_overwrite(self):
        with tmpdir() as d:
            s = ImageStore(d + "/data")
            s.add_files([("a.png", make_png())])
            s.rename(s.records[0].id, "new")
            pairs = [(s.image_path(r), r.filename) for r in s.records]
            out = d + "/out"
            self.assertEqual(export.copy_renamed_images(pairs, out), 1)
            with self.assertRaises(FileExistsError):
                export.copy_renamed_images(pairs, out)
            self.assertEqual(export.copy_renamed_images(pairs, out, overwrite=True), 1)
            import os
            self.assertEqual(os.listdir(out), ["new.png"])
            self.assertTrue(s.image_path(s.records[0]).exists())           # source untouched

    def test_images_zip(self):
        import io, zipfile
        with tmpdir() as d:
            s = ImageStore(d)
            s.add_files([("a.png", make_png())])
            z = zipfile.ZipFile(io.BytesIO(export.build_images_zip([(s.image_path(s.records[0]), "z.png")])))
            self.assertEqual(z.namelist(), ["z.png"])


# -------------------------------------------------------------- paging
class PagingTests(unittest.TestCase):
    def test_counts(self):
        self.assertEqual(paging.page_count(0, 12), 1)
        self.assertEqual(paging.page_count(200, 12), 17)
        self.assertEqual(paging.page_count(24, 12), 2)

    def test_slice_covers_everything_without_overlap(self):
        items = list(range(200))
        pages = paging.page_count(len(items), 12)
        seen = [x for p in range(1, pages + 1) for x in paging.slice_page(items, p, 12)]
        self.assertEqual(seen, items)
        self.assertEqual(len(paging.slice_page(items, 17, 12)), 200 - 16 * 12)

    def test_clamp_and_page_of_index(self):
        self.assertEqual(paging.clamp_page(99, 5), 5)
        self.assertEqual(paging.clamp_page(0, 5), 1)
        self.assertEqual(paging.page_of_index(0, 12), 1)
        self.assertEqual(paging.page_of_index(11, 12), 1)
        self.assertEqual(paging.page_of_index(12, 12), 2)
        self.assertEqual(paging.slice_page(list(range(5)), 99, 12), [0, 1, 2, 3, 4])


class ScaleTest(unittest.TestCase):
    def test_200_images_flow(self):
        with tmpdir() as d:
            s = ImageStore(d)
            s.add_files([(f"i{i}.png", make_png((i % 256, i // 256, 7), (20, 20))) for i in range(200)])
            self.assertEqual(len(s.records), 200)
            job = BatchJob(s, lambda: FakeProvider(), cfg(concurrency=4), LISTS, [r.id for r in s.records])
            job.start(); job.join(60)
            self.assertEqual(job.progress()["ok"], 200)
            est = tk.estimate_items([(r.id, *s.dims(r)) for r in s.records], cfg(provider="openai", model="gpt-4o"), LISTS)
            self.assertEqual(est.images, 200)


if __name__ == "__main__":
    unittest.main()
