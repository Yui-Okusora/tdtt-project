import json
import unittest
import zipfile
import io

from core import export
from core.config import MODE_AUTO, MODE_GUIDED, MODE_STRICT
from core.review import (ORIGIN_AI, ORIGIN_EMPTY, ORIGIN_MANUAL, ORIGIN_NEW, ORIGIN_USER,
                         classify, needs_review, uncertain_fields)
from core.schema import clean_result
from core.store import COMPLETED, ImageRecord
from tests.helpers import good_raw, tmpdir


def rec(name="a.png", raw=None, lists=None, mode=MODE_AUTO):
    r = ImageRecord(id=name, filename=name, stored_name=name, thumb_name=name, size_bytes=1, sha256=name)
    r.result = clean_result(raw or good_raw(), lists or {}, mode)
    r.status = COMPLETED
    return r


REFERENCE_KEYS = ["subject_features", "background_context", "camera_angle", "rag_filter", "rag_search_prompt"]


class ExportTests(unittest.TestCase):
    def test_matches_reference_structure_exactly(self):
        e = export.record_to_entry(rec(), include_filename=False)
        self.assertEqual(list(e.keys()), REFERENCE_KEYS)
        self.assertEqual(list(e["rag_filter"].keys()), ["category", "shot_type", "vibe"])

    def test_aggregate_parses_and_has_filename(self):
        entries = [export.record_to_entry(rec("a.png")), export.record_to_entry(rec("b.png"))]
        text = export.dumps(export.aggregate(entries))
        data = json.loads(text)
        self.assertEqual(data["schema_version"], "1.0")
        self.assertEqual([i["filename"] for i in data["images"]], ["a.png", "b.png"])
        self.assertEqual(list(data["images"][0].keys())[1:], REFERENCE_KEYS)

    def test_filter_only_mode(self):
        e = export.record_to_entry(rec(), fields=export.FIELDS_FILTER)
        self.assertEqual(list(e.keys()), ["filename", "rag_filter"])
        self.assertEqual(export.validate_entries([e], fields=export.FIELDS_FILTER), [])

    def test_review_meta_is_optional(self):
        e = export.record_to_entry(rec(), include_review=True, review_required=True)
        self.assertTrue(e["review_required"])
        self.assertNotIn("review_required", export.record_to_entry(rec()))

    def test_validation_blocks_empty_and_non_snake(self):
        r = rec()
        r.result["rag_filter"]["vibe"] = ""
        r.result["rag_filter"]["category"] = "Not Snake"
        r.result["camera_angle"] = ""
        issues = export.validate_entries([export.record_to_entry(r)])
        msgs = " | ".join(m for _, m in issues)
        self.assertIn("vibe", msgs)
        self.assertIn("snake_case", msgs)
        self.assertIn("camera_angle", msgs)
        self.assertTrue(all(sev == "error" for sev, _ in issues))

    def test_duplicate_filenames_blocked(self):
        e = export.record_to_entry(rec("a.png"))
        issues = export.validate_entries([e, dict(e)])
        self.assertTrue(any("trùng" in m for _, m in issues))

    def test_api_key_never_exported(self):
        r = rec(raw=good_raw(subject_features="leaked sk-live-ABCDEF123456 here"))
        entry = export.record_to_entry(r)
        with self.assertRaises(ValueError):
            export.dumps(export.aggregate([entry]), secrets=["sk-live-ABCDEF123456"])

    def test_export_contains_only_whitelisted_keys(self):
        r = rec()
        r.result["api_key"] = "sk-should-not-appear"   # even if junk sneaks into the record
        text = export.dumps(export.record_to_entry(r), secrets=["sk-should-not-appear"])
        self.assertNotIn("sk-should-not-appear", text)

    def test_zip_per_image(self):
        recs = [rec("a.png"), rec("a.jpg"), rec("b.png")]
        entries = [export.record_to_entry(r, include_filename=False) for r in recs]
        files = export.per_image_files(recs, entries)
        self.assertEqual(sorted(files), ["a.jpg.json", "a.png.json", "b.json"])
        z = zipfile.ZipFile(io.BytesIO(export.build_zip(files)))
        self.assertEqual(json.loads(z.read("b.json"))["rag_filter"]["vibe"], "relaxed_casual")

    def test_unicode_preserved(self):
        r = rec(raw=good_raw(subject_features="người đàn ông đeo kính"))
        text = export.dumps(export.record_to_entry(r))
        self.assertIn("người đàn ông đeo kính", text)

    def test_safe_write_refuses_overwrite(self):
        with tmpdir() as d:
            p = f"{d}/out.json"
            export.safe_write(p, "{}")
            with self.assertRaises(FileExistsError):
                export.safe_write(p, "{}", overwrite=False)
            export.safe_write(p, '{"a":1}', overwrite=True)
            with open(p, encoding="utf-8") as fh:
                self.assertEqual(fh.read(), '{"a":1}')


class ReviewTests(unittest.TestCase):
    LISTS = {"category": ["outdoor_beach"], "shot_type": ["half_body"], "vibe": []}

    def test_origins(self):
        r = rec(lists=self.LISTS, mode=MODE_GUIDED)
        self.assertEqual(classify(r, "category", self.LISTS, MODE_GUIDED), ORIGIN_USER)
        self.assertEqual(classify(r, "shot_type", self.LISTS, MODE_GUIDED), ORIGIN_NEW)
        self.assertEqual(classify(r, "vibe", self.LISTS, MODE_GUIDED), ORIGIN_AI)
        r.edited_fields.append("shot_type")
        self.assertEqual(classify(r, "shot_type", self.LISTS, MODE_GUIDED), ORIGIN_MANUAL)
        r.result["rag_filter"]["vibe"] = ""
        self.assertEqual(classify(r, "vibe", self.LISTS, MODE_GUIDED), ORIGIN_EMPTY)

    def test_review_flags(self):
        r = rec(raw=good_raw(uncertain_fields=["camera_angle"]))
        self.assertEqual(uncertain_fields(r, {}, MODE_AUTO), ["camera_angle"])
        self.assertTrue(needs_review(r, {}, MODE_AUTO))
        r.reviewed = True
        self.assertFalse(needs_review(r, {}, MODE_AUTO))

    def test_manual_edit_clears_uncertainty(self):
        r = rec(raw=good_raw(uncertain_fields=["category"]))
        r.edited_fields.append("category")
        self.assertEqual(uncertain_fields(r, {}, MODE_AUTO), [])

    def test_empty_value_always_needs_review(self):
        r = rec()
        r.result["rag_filter"]["vibe"] = ""
        self.assertIn("vibe", uncertain_fields(r, {}, MODE_AUTO))


if __name__ == "__main__":
    unittest.main()
