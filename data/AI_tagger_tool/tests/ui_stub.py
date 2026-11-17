"""Minimal fake `streamlit` so app.py can be exercised without Streamlit installed."""
import os
import runpy
import sys
import types

class SS(dict):
    __getattr__ = dict.get
    def __setattr__(self, k, v): self[k] = v

class Ctx:
    def __init__(self, st): self._st = st
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def __getattr__(self, n): return getattr(self._st, n)

LOG = {"codes": [], "dataframes": [], "errors": [], "downloads": [], "metrics": [], "msgs": []}

def make_st(files, press):
    st = types.ModuleType("streamlit")
    st.session_state = SS()
    S = st.session_state
    st.cache_resource = lambda f: f
    st.fragment = lambda *a, **k: (a[0] if a and callable(a[0]) else (lambda f: f))
    st.sidebar = Ctx(st)
    def widget(default_fn):
        def w(label, *a, **k):
            key = k.get("key")
            d = default_fn(label, a, k)
            if key:
                if key not in S: S[key] = d
                return S[key]
            return d
        return w
    st.text_input = widget(lambda l, a, k: k.get("value", ""))
    st.text_area = widget(lambda l, a, k: k.get("value", ""))
    st.checkbox = widget(lambda l, a, k: k.get("value", False))
    st.selectbox = widget(lambda l, a, k: (list(a[0])[k.get("index", 0)] if a and len(list(a[0])) else ""))
    st.radio = widget(lambda l, a, k: list(a[0])[k.get("index", 0)])
    st.select_slider = widget(lambda l, a, k: k.get("value", list(a[0])[0]))
    st.slider = widget(lambda l, a, k: a[2] if len(a) > 2 else k.get("value"))
    st.multiselect = widget(lambda l, a, k: list(k.get("default") or []))
    st.number_input = widget(lambda l, a, k: a[2] if len(a) > 2 else (k.get("value", 0)))
    st.file_uploader = lambda *a, **k: (files or [])
    def columns(spec, **k):
        n = spec if isinstance(spec, int) else len(spec)
        return [Ctx(st) for _ in range(n)]
    st.columns = columns
    st.tabs = lambda labels: [Ctx(st) for _ in labels]
    st.container = lambda **k: Ctx(st)
    st.expander = lambda *a, **k: Ctx(st)
    st.spinner = lambda *a, **k: Ctx(st)
    def button(label, **k):
        key = k.get("key", label)
        if key in press or label in press:
            if k.get("on_click"): k["on_click"](*(k.get("args") or ()))
            return True
        return False
    st.button = button
    st.download_button = lambda label, data, **k: LOG["downloads"].append((label, len(data)))
    st.code = lambda text, **k: LOG["codes"].append(text)
    st.dataframe = lambda rows, **k: LOG["dataframes"].append(rows)
    st.metric = lambda label, value, **k: LOG["metrics"].append((label, value))
    def rerun(): raise RuntimeError("RERUN")
    st.rerun = rerun
    st.error = lambda m, *a, **k: LOG["errors"].append(m)
    for n in ("set_page_config","title","caption","subheader","header","warning","info","success","image",
              "divider","progress","toast","markdown"):
        setattr(st, n, lambda *a, **k: None)
    return st

class F:
    def __init__(s, n, b): s.name, s.b = n, b
    def getvalue(s): return s.b

def run(data, files=None, press=(), state=None, root=None):
    os.environ["TAGGER_DATA_DIR"] = data
    os.environ["TAGGER_EXPORT_DIR"] = data + "/exp"
    for k in ("OPENAI_API_KEY","GEMINI_API_KEY","GOOGLE_API_KEY","COMPAT_API_KEY","OPENROUTER_API_KEY","GROQ_API_KEY"):
        os.environ.pop(k, None)
    st = make_st(files, set(press))
    if state: st.session_state.update(state)
    saved = sys.modules.get("streamlit")
    sys.modules["streamlit"] = st
    try:
        g = runpy.run_path(os.path.join(root or ".", "app.py"))
        return "ok", g, st
    except RuntimeError as e:
        return str(e), None, st
    finally:
        if saved is not None:
            sys.modules["streamlit"] = saved
        else:
            sys.modules.pop("streamlit", None)

