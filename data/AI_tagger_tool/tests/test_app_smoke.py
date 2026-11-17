"""UI smoke test using Streamlit's AppTest (skipped automatically if Streamlit is missing)."""
import os
import tempfile
import unittest

try:
    from streamlit.testing.v1 import AppTest
except Exception:  # pragma: no cover
    AppTest = None


@unittest.skipIf(AppTest is None, "streamlit not installed")
class AppSmokeTest(unittest.TestCase):
    def test_app_starts_and_reports_unconfigured(self):
        with tempfile.TemporaryDirectory() as d:
            os.environ["TAGGER_DATA_DIR"] = d
            for k in ("OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "COMPAT_API_KEY"):
                os.environ.pop(k, None)
            at = AppTest.from_file("app.py", default_timeout=30).run()
            self.assertFalse(at.exception)
            self.assertTrue(any("API Key" in w.value for w in at.warning))
            # run button must be disabled while unconfigured
            run_btns = [b for b in at.button if "Phân tích" in b.label and "ảnh chờ" in b.label]
            self.assertTrue(run_btns and run_btns[0].disabled)


if __name__ == "__main__":
    unittest.main()
