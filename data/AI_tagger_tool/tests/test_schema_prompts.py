import unittest

from core.config import MODE_AUTO, MODE_GUIDED, MODE_STRICT
from core.errors import InvalidResponse
from core.normalize import is_snake_case, parse_value_list, to_snake_case
from core.prompts import build_user_prompt
from core.schema import build_json_schema, clean_result, parse_model_json
from tests.helpers import cfg, good_raw


class NormalizeTests(unittest.TestCase):
    def test_snake_case(self):
        self.assertEqual(to_snake_case("Outdoor Beach"), "outdoor_beach")
        self.assertEqual(to_snake_case("  full-body!! "), "full_body")
        self.assertEqual(to_snake_case("Bãi biển Đẹp"), "bai_bien_dep")
        self.assertTrue(is_snake_case("relaxed_casual"))
        self.assertFalse(is_snake_case("Relaxed Casual"))

    def test_parse_list_dedupes(self):
        self.assertEqual(parse_value_list("Outdoor Beach, studio\nstudio; outdoor_beach"),
                         ["outdoor_beach", "studio"])


class ParseTests(unittest.TestCase):
    def test_fenced_and_chatty_json(self):
        self.assertEqual(parse_model_json('```json\n{"a": 1}\n```'), {"a": 1})
        self.assertEqual(parse_model_json('Here you go: {"a": 1} thanks'), {"a": 1})

    def test_garbage_raises_retryable(self):
        with self.assertRaises(InvalidResponse) as cm:
            parse_model_json("no json here")
        self.assertTrue(cm.exception.retryable)


class CleanResultTests(unittest.TestCase):
    def test_normalises_filter_values(self):
        out = clean_result(good_raw(), {}, MODE_AUTO)
        self.assertEqual(out["rag_filter"]["category"], "outdoor_beach")
        self.assertEqual(out["uncertain_fields"], [])

    def test_missing_field_is_invalid(self):
        raw = good_raw()
        del raw["camera_angle"]
        with self.assertRaises(InvalidResponse):
            clean_result(raw, {}, MODE_AUTO)

    def test_strict_drops_values_outside_list(self):
        lists = {"category": ["indoor_studio"], "shot_type": ["full_body"], "vibe": []}
        out = clean_result(good_raw(), lists, MODE_STRICT)
        self.assertEqual(out["rag_filter"]["category"], "")          # not in list -> dropped
        self.assertEqual(out["rag_filter"]["shot_type"], "full_body")  # in list -> kept
        self.assertEqual(out["rag_filter"]["vibe"], "relaxed_casual")  # no list -> free
        self.assertIn("category", out["uncertain_fields"])

    def test_guided_keeps_new_values(self):
        lists = {"category": ["indoor_studio"], "shot_type": [], "vibe": []}
        out = clean_result(good_raw(), lists, MODE_GUIDED)
        self.assertEqual(out["rag_filter"]["category"], "outdoor_beach")

    def test_unknown_becomes_empty_and_flagged(self):
        raw = good_raw(rag_filter={"category": "unknown", "shot_type": "full_body", "vibe": "calm"})
        out = clean_result(raw, {}, MODE_AUTO)
        self.assertEqual(out["rag_filter"]["category"], "")
        self.assertIn("category", out["uncertain_fields"])

    def test_model_cannot_claim_match_it_does_not_have(self):
        # Even if the model "says" it matched, we compare locally.
        lists = {"category": ["indoor_studio"], "shot_type": [], "vibe": []}
        out = clean_result(good_raw(), lists, MODE_STRICT)
        self.assertNotEqual(out["rag_filter"]["category"], "outdoor_beach")


class PromptTests(unittest.TestCase):
    def test_auto_mode_ignores_lists(self):
        p = build_user_prompt(cfg(mode=MODE_AUTO), {"category": ["x_y"]})
        self.assertNotIn("x_y", p)

    def test_strict_and_guided_include_lists_as_data(self):
        lists = {"category": ["indoor_studio"], "shot_type": [], "vibe": []}
        self.assertIn("STRICT MODE", build_user_prompt(cfg(mode=MODE_STRICT), lists))
        self.assertIn("GUIDED MODE", build_user_prompt(cfg(mode=MODE_GUIDED), lists))

    def test_strict_schema_uses_enum(self):
        s = build_json_schema({"category": ["a_b"]})
        self.assertIn("a_b", s["properties"]["rag_filter"]["properties"]["category"]["enum"])
        s2 = build_json_schema(None)
        self.assertNotIn("enum", s2["properties"]["rag_filter"]["properties"]["category"])


if __name__ == "__main__":
    unittest.main()
