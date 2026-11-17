"""Exercises app.py end-to-end against a fake Streamlit (runs anywhere, no browser needed)."""
import json
import os
import tempfile
import unittest
from pathlib import Path

from core.schema import clean_result
from core.store import COMPLETED, ImageStore
from tests import ui_stub
from tests.helpers import good_raw, make_png

ROOT = str(Path(__file__).resolve().parent.parent)
ENV_KEYS = ("TAGGER_DATA_DIR", "TAGGER_EXPORT_DIR")


class UiFlowTests(unittest.TestCase):
    def setUp(self):
        self._saved = {k: os.environ.get(k) for k in ENV_KEYS}
        self._tmp = tempfile.TemporaryDirectory()
        self.d = self._tmp.name
        for k in ui_stub.LOG:
            ui_stub.LOG[k].clear()

    def tearDown(self):
        for k, v in self._saved.items():
            os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)
        self._tmp.cleanup()

    def run_app(self, **kw):
        return ui_stub.run(self.d, root=ROOT, **kw)

    def seed(self, n=30):
        files = [ui_stub.F(f"photo_{i:03d}.png", make_png((i % 256, (i * 7) % 256, 50), (40, 30))) for i in range(n)]
        self.assertEqual(self.run_app(files=files)[0], "RERUN")      # upload triggers a rerun
        s = ImageStore(self.d)
        for i, rec in enumerate(s.records):
            rec.result = clean_result(good_raw(uncertain_fields=["camera_angle"] if i % 3 == 0 else []), {}, "guided")
            rec.status = COMPLETED
        s.save()
        return [r.id for r in s.records]

    def test_empty_app_renders(self):
        self.assertEqual(self.run_app()[0], "ok")

    def test_upload_then_render_with_token_estimate(self):
        files = [ui_stub.F(f"p{i}.png", make_png((i, 5, 5))) for i in range(5)]
        self.run_app(files=files)
        r, g, st = self.run_app()
        self.assertEqual(r, "ok")
        self.assertEqual(dict(ui_stub.LOG["metrics"])["Số request"], "5")

    def test_detail_shows_exact_reference_json(self):
        self.seed()
        r, g, st = self.run_app()
        self.assertEqual(r, "ok")
        entry = json.loads(ui_stub.LOG["codes"][0])
        self.assertEqual(list(entry), ["filename", "subject_features", "background_context", "camera_angle",
                                       "rag_filter", "rag_search_prompt"])

    def test_pagination_30_images(self):
        ids = self.seed(30)
        self.assertEqual(self.run_app(press={"pl_top"})[2].session_state["gallery_page"], 3)
        self.assertEqual(self.run_app(press={"pn_top"})[2].session_state["gallery_page"], 2)
        # first page shows 12 open-buttons; selecting one works
        st = self.run_app(press={f"open_{ids[3]}"})[2]
        self.assertEqual(st.session_state["sel_id"], ids[3])

    def test_nav_follows_page(self):
        ids = self.seed(30)
        st = self.run_app(press={"nav_prev"}, state={"sel_id": ids[12], "gallery_page": 2, "page_size": 12})[2]
        self.assertEqual(st.session_state["sel_id"], ids[11])
        self.assertEqual(st.session_state["gallery_page"], 1)

    def test_rename_callback_and_duplicate_guard(self):
        ids = self.seed(3)
        r, g, st = self.run_app(state={"sel_id": ids[0]})
        rec = g["store"].get(ids[0])
        key = f"{rec.id}_{rec.rev}_name"
        st.session_state[key] = "my_first"
        g["cb_rename"](rec.id, key)
        self.assertEqual(g["store"].get(ids[0]).filename, "my_first.png")
        st.session_state[key] = "photo_001"                          # taken by another image
        g["cb_rename"](rec.id, key)
        self.assertEqual(g["store"].get(ids[0]).filename, "my_first.png")
        self.assertEqual(st.session_state["_msg"][0], "error")

    def test_export_tab_offers_downloads(self):
        self.seed(30)
        r, g, st = self.run_app()
        labels = [x[0] for x in ui_stub.LOG["downloads"]]
        self.assertTrue(any("tổng hợp" in l for l in labels))
        self.assertEqual(len(ui_stub.LOG["dataframes"][-1]), 25)      # paginated preview (25/page)
        self.assertEqual(ui_stub.LOG["errors"], [])


if __name__ == "__main__":
    unittest.main()
