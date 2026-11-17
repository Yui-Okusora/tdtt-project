import json
import unittest
from unittest.mock import patch

from core.analyzer import with_retry
from core.errors import Cancelled, ConfigError, ProviderError
from core.logging_setup import redact, register_secret
from core.providers import create_provider
from core.providers.gemini import GeminiProvider, to_gemini_schema
from core.providers.openai_compat import OpenAIProvider
from tests.helpers import good_raw

import threading


class FakeResp:
    def __init__(self, status=200, body=None, headers=None):
        self.status_code = status
        self._body = body if body is not None else {}
        self.headers = headers or {}
        self.text = json.dumps(self._body)

    def json(self):
        return self._body


def oa_ok(raw=None):
    return FakeResp(200, {"choices": [{"message": {"content": json.dumps(raw or good_raw())}}]})


class OpenAITests(unittest.TestCase):
    def test_no_key_is_config_error(self):
        with self.assertRaises(ConfigError):
            create_provider("openai", "", "gpt-4o-mini")

    def test_success_sends_image_and_schema(self):
        p = OpenAIProvider("sk-secret-abcdef", "gpt-4o-mini")
        with patch("requests.request", return_value=oa_ok()) as m:
            out = p.analyze(b"jpegbytes", "image/jpeg", "sys", "user", {"type": "object"})
        body = m.call_args.kwargs["json_body"] if "json_body" in m.call_args.kwargs else m.call_args.kwargs["json"]
        self.assertEqual(out["rag_filter"]["shot_type"], "full_body")
        self.assertEqual(body["response_format"]["type"], "json_schema")
        self.assertTrue(body["messages"][1]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,"))

    def test_fallback_when_schema_and_temperature_unsupported(self):
        p = OpenAIProvider("sk-secret-abcdef", "some-model")
        seq = [FakeResp(400, {"error": {"message": "Unsupported parameter: temperature"}}),
               FakeResp(400, {"error": {"message": "response_format json_schema not supported"}}),
               oa_ok()]
        with patch("requests.request", side_effect=seq) as m:
            out = p.analyze(b"x", "image/jpeg", "s", "u", {"type": "object"})
        self.assertEqual(m.call_count, 3)
        self.assertIsNotNone(out)
        self.assertFalse(p._send_temperature)
        self.assertEqual(p._schema_mode, "json_object")

    def test_rate_limit_is_retryable_and_reads_retry_after(self):
        p = OpenAIProvider("sk-secret-abcdef", "m")
        with patch("requests.request", return_value=FakeResp(429, {"error": {"message": "slow down"}},
                                                             {"Retry-After": "7"})):
            with self.assertRaises(ProviderError) as cm:
                p.analyze(b"x", "image/jpeg", "s", "u", {})
        self.assertTrue(cm.exception.retryable)
        self.assertEqual(cm.exception.retry_after, 7.0)

    def test_bad_key_not_retryable_and_key_not_in_message(self):
        p = OpenAIProvider("sk-secret-abcdef", "m")
        resp = FakeResp(401, {"error": {"message": "Incorrect API key provided: sk-secret-abcdef"}})
        with patch("requests.request", return_value=resp):
            with self.assertRaises(ProviderError) as cm:
                p.analyze(b"x", "image/jpeg", "s", "u", {})
        self.assertFalse(cm.exception.retryable)
        self.assertNotIn("sk-secret-abcdef", str(cm.exception))

    def test_quota_exhausted_not_retryable(self):
        p = OpenAIProvider("sk-secret-abcdef", "m")
        resp = FakeResp(429, {"error": {"message": "You exceeded your quota", "code": "insufficient_quota"}})
        with patch("requests.request", return_value=resp):
            with self.assertRaises(ProviderError) as cm:
                p.analyze(b"x", "image/jpeg", "s", "u", {})
        self.assertFalse(cm.exception.retryable)

    def test_model_list_filters_non_vision(self):
        p = OpenAIProvider("sk-secret-abcdef", "m")
        data = {"data": [{"id": "gpt-4o"}, {"id": "gpt-4o-mini"}, {"id": "text-embedding-3-small"},
                         {"id": "gpt-4o-audio-preview"}, {"id": "whisper-1"}, {"id": "gpt-3.5-turbo"}]}
        with patch("requests.request", return_value=FakeResp(200, data)):
            self.assertEqual(p.list_models(), ["gpt-4o", "gpt-4o-mini"])

    def test_repr_hides_key(self):
        self.assertNotIn("secret", repr(OpenAIProvider("sk-secret-abcdef", "m")))


class GeminiTests(unittest.TestCase):
    def test_schema_conversion(self):
        out = to_gemini_schema({"type": "object", "additionalProperties": False,
                                "properties": {"a": {"type": "string", "enum": ["x"]}}})
        self.assertEqual(out["type"], "OBJECT")
        self.assertNotIn("additionalProperties", out)
        self.assertEqual(out["properties"]["a"]["type"], "STRING")

    def test_success_and_key_in_header_not_url(self):
        p = GeminiProvider("gem-secret-abcdef", "gemini-x")
        resp = FakeResp(200, {"candidates": [{"content": {"parts": [{"text": json.dumps(good_raw())}]}}]})
        with patch("requests.request", return_value=resp) as m:
            out = p.analyze(b"x", "image/jpeg", "s", "u", {"type": "object", "properties": {}})
        self.assertEqual(out["rag_filter"]["vibe"], "relaxed_casual")
        self.assertNotIn("gem-secret-abcdef", m.call_args.args[1])
        self.assertEqual(m.call_args.kwargs["headers"]["x-goog-api-key"], "gem-secret-abcdef")

    def test_blocked_prompt_is_not_retryable(self):
        p = GeminiProvider("gem-secret-abcdef", "gemini-x")
        with patch("requests.request", return_value=FakeResp(200, {"promptFeedback": {"blockReason": "SAFETY"}})):
            with self.assertRaises(ProviderError) as cm:
                p.analyze(b"x", "image/jpeg", "s", "u", {})
        self.assertFalse(cm.exception.retryable)

    def test_list_models_only_generate_content_gemini(self):
        data = {"models": [
            {"name": "models/gemini-2.0-flash", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]},
            {"name": "models/gemini-embedding-001", "supportedGenerationMethods": ["generateContent"]},
        ]}
        p = GeminiProvider("gem-secret-abcdef", "m")
        with patch("requests.request", return_value=FakeResp(200, data)):
            self.assertEqual(p.list_models(), ["gemini-2.0-flash"])


class RetryTests(unittest.TestCase):
    def test_retries_then_succeeds(self):
        calls = {"n": 0}

        def fn():
            calls["n"] += 1
            if calls["n"] < 3:
                raise ProviderError("temp", retryable=True)
            return "ok"

        self.assertEqual(with_retry(fn, 3, threading.Event(), base_delay=0.001), "ok")
        self.assertEqual(calls["n"], 3)

    def test_non_retryable_raises_immediately(self):
        calls = {"n": 0}

        def fn():
            calls["n"] += 1
            raise ProviderError("bad", retryable=False)

        with self.assertRaises(ProviderError):
            with_retry(fn, 3, threading.Event(), base_delay=0.001)
        self.assertEqual(calls["n"], 1)

    def test_gives_up_after_max_retries(self):
        calls = {"n": 0}

        def fn():
            calls["n"] += 1
            raise ProviderError("temp", retryable=True)

        with self.assertRaises(ProviderError):
            with_retry(fn, 2, threading.Event(), base_delay=0.001)
        self.assertEqual(calls["n"], 3)

    def test_cancel_interrupts_backoff(self):
        ev = threading.Event()
        ev.set()
        with self.assertRaises(Cancelled):
            with_retry(lambda: 1, 3, ev)


class RedactTests(unittest.TestCase):
    def test_redact(self):
        register_secret("sk-topsecret-999")
        self.assertEqual(redact("key=sk-topsecret-999!"), "key=***!")


if __name__ == "__main__":
    unittest.main()
