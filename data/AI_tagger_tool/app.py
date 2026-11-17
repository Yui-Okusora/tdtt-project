"""AI Image Auto-Tagging Tool – Streamlit UI.

Output schema (pose / spatial-framing extractor):
valid / count / shot / angle / support / prop / group_prompt / poses / tags
"""
import hashlib
import json
import os
import time
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import streamlit as st

from core import export, paging, tokens as tk
from core.batch import BatchJob
from core.config import (DEFAULT_BASE_URLS, MODE_AUTO, MODE_GUIDED, MODE_STRICT, PROVIDERS, AppConfig,
                         env_api_key)
from core.errors import ProviderError
from core.logging_setup import get_secrets, register_secret, setup_logging
from core.normalize import parse_value_list, to_snake_case
from core.providers import DEFAULT_MODELS, REGISTRY, create_provider
from core.review import (ORIGIN_AI, ORIGIN_EMPTY, ORIGIN_MANUAL, ORIGIN_NEW, ORIGIN_USER, classify,
                         needs_review, uncertain_fields)
from core.schema import ENUM_FIELDS, MAX_SUBJECTS
from core.store import COMPLETED, ERROR, PENDING, PROCESSING, ImageStore

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("TAGGER_DATA_DIR", ROOT / ".data"))
EXPORT_DIR = Path(os.environ.get("TAGGER_EXPORT_DIR", ROOT / "exports"))
THUMB_W = 110
GRID_COLS = 3

st.set_page_config(page_title="AI Image Auto-Tagging Tool", page_icon="🏷️", layout="wide")

STATUS_LABEL = {PENDING: "⏳ Chờ xử lý", PROCESSING: "🔄 Đang xử lý", COMPLETED: "✅ Hoàn thành", ERROR: "❌ Lỗi"}
STATUS_ICON = {PENDING: "⏳", PROCESSING: "🔄", COMPLETED: "✅", ERROR: "❌"}
LIST_FIELDS = ("tags",)   # user lists apply to tags only
FIELD_LABEL = {
    "shot": "shot – cỡ khung hình",
    "angle": "angle – góc máy",
    "support": "support – điểm tựa",
    "prop": "prop – vật dụng để tựa",
    "group_prompt": "group_prompt – bố cục nhóm",
    "tags": "tags – từ khóa truy vấn (ngăn cách bằng dấu phẩy)",
    "outfit": "outfit – trang phục & phụ kiện (màu + món đồ, ngăn cách bằng dấu phẩy)",
}
LIST_HELP = {"tags": "VD: standing, arms_crossed, looking_away, casual"}
BADGE = {
    ORIGIN_USER: "🟦 Từ danh sách của bạn",
    ORIGIN_NEW: "🟧 AI đề xuất mới (ngoài danh sách)",
    ORIGIN_AI: "⬜ AI tạo",
    ORIGIN_MANUAL: "🟩 Bạn đã sửa/xác nhận",
    ORIGIN_EMPTY: "⚠️ Trống – cần điền",
}
MODE_OPTIONS = {
    "Mode 1 – AI Automatic": MODE_AUTO,
    "Mode 2 – User-Guided": MODE_GUIDED,
    "Mode 3 – Strict Matching": MODE_STRICT,
}
SCOPES = ["Ảnh đang chọn", "Ảnh chờ xử lý", "Tất cả ảnh"]


@st.cache_resource
def get_runtime():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    setup_logging(DATA_DIR / "app.log")
    return SimpleNamespace(store=ImageStore(DATA_DIR), job=None)


rt = get_runtime()
store: ImageStore = rt.store


def fmt_size(n: int) -> str:
    return f"{n / 1024:.0f} KB" if n < 1024 * 1024 else f"{n / 1024 / 1024:.1f} MB"


def short(name: str, n: int = 16) -> str:
    return name if len(name) <= n else name[: n - 1] + "…"


# ------------------------------------------------------------- session defaults
for _f in LIST_FIELDS:
    st.session_state.setdefault(f"list_{_f}", store.settings.get("lists", {}).get(_f, ""))
for _k, _v in {"uploader_rev": 0, "models_cache": {}, "cfg_detail": "standard", "cfg_max_side": 1280,
               "gallery_page": 1, "page_size": 12, "f_status": list(STATUS_LABEL), "f_search": "",
               "f_review": False, "f_invalid": False, "cfg_fashion": False, "sel_id": None, "tok_scope": SCOPES[1], "tok_budget": 0}.items():
    st.session_state.setdefault(_k, _v)


def current_lists() -> dict[str, list[str]]:
    return {f: parse_value_list(st.session_state.get(f"list_{f}", "")) for f in LIST_FIELDS}


def save_lists():
    store.settings["lists"] = {f: st.session_state[f"list_{f}"] for f in LIST_FIELDS}
    store.save()


# ------------------------------------------------------------------ callbacks
def cb_reset_page():
    st.session_state["gallery_page"] = 1


def cb_page(action, pages):
    cur = st.session_state.get("gallery_page", 1)
    st.session_state["gallery_page"] = {"first": 1, "prev": cur - 1, "next": cur + 1, "last": pages}[action]


def cb_select(rid):
    st.session_state["sel_id"] = rid


def cb_nav(delta, fids):
    if not fids:
        return
    cur = st.session_state.get("sel_id")
    i = fids.index(cur) + delta if cur in fids else 0
    i = max(0, min(len(fids) - 1, i))
    st.session_state["sel_id"] = fids[i]
    st.session_state["gallery_page"] = paging.page_of_index(i, st.session_state["page_size"])


def cb_confirm_next(rid, fids):
    rec = store.get(rid)
    if rec:
        rec.reviewed = True
        rec.rev += 1
        store.save()
    cb_nav(1, fids)


def cb_apply_rec(side, detail):
    st.session_state["cfg_max_side"] = side
    st.session_state["cfg_detail"] = detail


def _mark_edited(rec, field):
    if field not in rec.edited_fields:
        rec.edited_fields.append(field)
    store.save()


def cb_text(rid, field, key):          # group_prompt
    rec = store.get(rid)
    if rec and rec.result:
        rec.result[field] = " ".join(st.session_state[key].split()) or None
        _mark_edited(rec, field)


def cb_pose(rid, i, key):
    rec = store.get(rid)
    if rec and rec.result and i < len(rec.result["poses"]):
        rec.result["poses"][i] = " ".join(st.session_state[key].split())
        _mark_edited(rec, "poses")


def cb_enum(rid, field, key):          # shot / angle / support
    rec = store.get(rid)
    if rec and rec.result:
        rec.result[field] = st.session_state[key]
        _mark_edited(rec, field)


def cb_prop(rid, key):
    rec = store.get(rid)
    if rec and rec.result:
        v = to_snake_case(st.session_state[key])
        st.session_state[key] = v
        rec.result["prop"] = v or None
        _mark_edited(rec, "prop")


def cb_tags(rid, key):
    rec = store.get(rid)
    if rec and rec.result:
        tags = parse_value_list(st.session_state[key])
        st.session_state[key] = ", ".join(tags)
        rec.result["tags"] = tags
        _mark_edited(rec, "tags")


def cb_outfit(rid, key):
    rec = store.get(rid)
    if rec and rec.result:
        rec.result["outfit"] = " ".join(st.session_state[key].split()) or None
        _mark_edited(rec, "outfit")


def cb_accept(rid, field):             # add the AI's new tags to the user's list
    rec = store.get(rid)
    if not rec or not rec.result:
        return
    k = f"list_{field}"
    allowed = parse_value_list(st.session_state[k])
    new = [t for t in rec.result[field] if t not in allowed]
    if new:
        cur = st.session_state[k].strip().rstrip(",")
        st.session_state[k] = ", ".join(x for x in [cur, *new] if x)
        save_lists()
    rec.result["uncertain_fields"] = [x for x in rec.result.get("uncertain_fields", []) if x != field]
    store.save()


def cb_reject(rid, field):             # drop tags that are not in the user's list
    rec = store.get(rid)
    if rec and rec.result:
        allowed = parse_value_list(st.session_state[f"list_{field}"])
        rec.result[field] = [t for t in rec.result[field] if t in allowed]
        rec.rev += 1
        _mark_edited(rec, field)


def cb_make_manual(rid):               # override a rejected image: start a blank, valid record to fill by hand
    rec = store.get(rid)
    if rec and rec.result and not rec.result.get("valid"):
        rec.result = {"valid": True, "count": 1, "shot": "", "angle": "", "support": "", "prop": None,
                      "group_prompt": None, "poses": [""], "tags": [],
                      "reject_reason": rec.result.get("reject_reason"),
                      "uncertain_fields": ["shot", "angle", "support", "poses", "tags"]}
        if st.session_state.get("cfg_fashion"):
            rec.result["outfit"] = None
            rec.result["uncertain_fields"].append("outfit")
        rec.reviewed = False
        rec.edited_fields = []
        rec.rev += 1
        store.save()


def cb_count(rid, key):
    rec = store.get(rid)
    if rec and rec.result and rec.result.get("valid"):
        n = max(1, min(MAX_SUBJECTS, int(st.session_state[key])))
        poses = list(rec.result["poses"])[:n]
        poses += [""] * (n - len(poses))
        rec.result["count"], rec.result["poses"] = n, poses
        if n == 1:
            rec.result["group_prompt"] = None
        rec.rev += 1                   # rebuild the pose widgets
        _mark_edited(rec, "poses")


def cb_review(rid, key):
    rec = store.get(rid)
    if rec:
        rec.reviewed = bool(st.session_state[key])
        store.save()


def cb_rename(rid, key):
    rec = store.get(rid)
    if not rec:
        return
    try:
        store.rename(rid, st.session_state[key])
    except ValueError as e:
        st.session_state["_msg"] = ("error", f"Không đổi tên được: {e}")
    st.session_state[key] = os.path.splitext(store.get(rid).filename)[0]


def cb_remove(rid):
    store.remove(rid)
    if st.session_state.get("sel_id") == rid:
        st.session_state["sel_id"] = None


def cb_select_all_filtered(names):
    st.session_state["bulk_targets"] = list(names)


# -------------------------------------------------------------------- sidebar
with st.sidebar:
    st.header("⚙️ AI Configuration")
    provider_id = st.selectbox("AI Provider", list(PROVIDERS), format_func=lambda k: PROVIDERS[k]["label"])
    meta = PROVIDERS[provider_id]
    provider_cls = REGISTRY[provider_id]
    if meta["note"]:
        st.caption(meta["note"])
    needs_key = meta["needs_key"]
    typed_key = st.text_input("API Key" + ("" if needs_key else " (không bắt buộc)"), type="password",
                              help="Chỉ giữ trong bộ nhớ phiên làm việc, không ghi ra file/JSON/log. "
                                   "Hoặc đặt trong file .env.")
    env_key = env_api_key(provider_id)
    api_key = typed_key.strip() or env_key
    if api_key:
        register_secret(api_key)
    if not typed_key and env_key:
        st.caption("🔒 Đang dùng API Key từ biến môi trường/.env")
    base_url = ""
    if provider_id in ("compatible", "ollama"):
        base_url = st.text_input("Base URL", value=DEFAULT_BASE_URLS.get(provider_id, ""),
                                 placeholder="https://host/v1", key=f"base_{provider_id}").strip()
    free_only = False
    if provider_id == "openrouter":
        free_only = st.checkbox("Chỉ hiện model miễn phí", value=True)

    cache_key = f"{provider_id}|{base_url}|{free_only}"
    fetched = st.session_state["models_cache"].get(cache_key)
    options = fetched if fetched is not None else DEFAULT_MODELS[provider_id]
    model_sel = st.selectbox("Model (hỗ trợ ảnh)", options) if options else ""
    custom_model = st.text_input("Hoặc nhập tên model khác").strip()
    model = custom_model or model_sel
    if fetched is not None and not fetched:
        st.warning("Không tìm thấy model nào hỗ trợ ảnh với cấu hình này.")
    st.caption(provider_cls.models_note +
               ("" if fetched is not None else " Đang hiện danh sách mặc định – bấm “Tải model” để lấy danh sách thật."))

    c1, c2 = st.columns(2)
    deep = st.checkbox("Test sâu (gửi 1 ảnh nhỏ, tốn ~1 request)", value=False)

    def _provider_or_error():
        try:
            return create_provider(provider_id, api_key, model or "x", base_url)
        except ProviderError as e:
            st.error(str(e))
            return None

    if c1.button("🔄 Tải model"):
        prov = _provider_or_error()
        if prov:
            try:
                with st.spinner("Đang tải danh sách model..."):
                    names = prov.list_models(free_only=free_only)
                st.session_state["models_cache"][cache_key] = names
                st.rerun()
            except ProviderError as e:
                st.error(str(e))
    if c2.button("🔌 Kiểm tra"):
        prov = _provider_or_error()
        if prov:
            with st.spinner("Đang kiểm tra..."):
                ok, msg = prov.test_connection(deep=deep)
            (st.success if ok else st.error)(msg)

    st.divider()
    mode_label = st.radio("Chế độ gắn tag", list(MODE_OPTIONS), index=1)
    mode = MODE_OPTIONS[mode_label]
    fashion = st.toggle("👗 Chế độ Fashion (thêm trường outfit)", key="cfg_fashion",
                        help="Bật: model mô tả thêm trang phục, màu sắc và phụ kiện vào trường outfit "
                             "(tốn thêm ít token output). Ảnh đã phân tích trước đó cần “Phân tích lại” để có outfit.")
    language = "en"   # poses feed an image model -> always English
    detail = st.select_slider("Mức độ chi tiết", tk.DETAIL_ORDER, key="cfg_detail", format_func=tk.DETAIL_LABEL.get)
    max_side = st.select_slider("Cạnh dài tối đa của ảnh gửi AI (px)", tk.SIDE_OPTIONS, key="cfg_max_side")
    concurrency = st.slider("Số request đồng thời", 1, 8, 3,
                            help="Gói miễn phí thường giới hạn request/phút – hạ xuống 1–2 nếu hay gặp lỗi 429.")
    max_retries = st.slider("Số lần thử lại khi lỗi tạm thời", 0, 6, 3)
    timeout = st.slider("Timeout mỗi request (giây)", 30, 300, 90, step=10,
                        help="Model chạy local (Ollama) có thể cần 120–300 giây.")

cfg = AppConfig(provider=provider_id, model=model, base_url=base_url, mode=mode, language=language,
                detail=detail, concurrency=concurrency, max_retries=max_retries, max_side=max_side,
                timeout=timeout, fashion=fashion)
lists = current_lists()

problems = []
if needs_key and not api_key:
    problems.append("Chưa cấu hình API Key – ứng dụng sẽ không phân tích ảnh cho đến khi bạn nhập key.")
if not model:
    problems.append("Chưa chọn model.")
if provider_id in ("compatible", "ollama") and not base_url:
    problems.append("Chưa nhập Base URL.")
if mode == MODE_STRICT and not any(lists.values()):
    problems.append("Chế độ Strict cần danh sách tags (mục B ở tab 1).")

rt_job = rt.job
running = bool(rt_job and rt_job.is_running())


def start_job(ids: list[str]):
    if not ids or problems or running:
        return
    key = api_key
    factory = lambda: create_provider(cfg.provider, key, cfg.model, cfg.base_url, cfg.timeout)
    job = BatchJob(store, factory, cfg, lists, ids)
    rt.job = job
    job.start()
    st.rerun()


def dims_items(recs):
    return [(r.id, *store.dims(r)) for r in recs]


# ----------------------------------------------------------------- header / run bar
st.title("🏷️ AI Image Auto-Tagging Tool")
for p in problems:
    st.warning(p, icon="⚠️")

n_pending, n_failed = len(store.ids_by_status(PENDING)), len(store.ids_by_status(ERROR))
b1, b2, b3, b4 = st.columns(4)
if b1.button(f"▶️ Phân tích {n_pending} ảnh chờ", type="primary", disabled=bool(problems) or running or not n_pending):
    start_job(store.ids_by_status(PENDING))
if b2.button(f"🔁 Chạy lại {n_failed} ảnh lỗi", disabled=bool(problems) or running or not n_failed):
    start_job(store.ids_by_status(ERROR))
if b3.button("♻️ Phân tích lại TẤT CẢ", disabled=bool(problems) or running or not store.records,
             help="Gửi lại mọi ảnh (tốn request/token). Kết quả đã chỉnh tay sẽ bị ghi đè."):
    start_job([r.id for r in store.records])
if b4.button("⏹ Dừng", disabled=not running):
    rt.job.stop()
    st.toast("Đã yêu cầu dừng – các request đang chạy sẽ kết thúc.")


def render_progress():
    @st.fragment(run_every=1.0 if running else None)
    def panel():
        job = rt.job
        if not job:
            return
        p = job.progress()
        text = f"Đã xử lý {p['finished']}/{p['total']} · ✅ {p['ok']} · ❌ {p['failed']}"
        if p["stopped"]:
            text += " · ⏹ đã dừng"
        st.progress(min(p["finished"] / max(p["total"], 1), 1.0), text=text)
        now = time.time()
        finished_now = not job.is_running() and not job.notified
        progressed = (job.is_running() and p["finished"] != st.session_state.get("_seen_finished")
                      and now - st.session_state.get("_last_refresh", 0) > 4)
        if finished_now or progressed:       # refresh gallery with new results (throttled while running)
            job.notified = job.notified or finished_now
            st.session_state["_seen_finished"] = p["finished"]
            st.session_state["_last_refresh"] = now
            st.rerun()
    panel()


render_progress()
spent = sum(r.tokens_spent for r in store.records)
if spent:
    st.caption(f"📊 Token đã dùng thực tế (theo API): **{tk.fmt(spent)}** cho "
               f"{sum(1 for r in store.records if r.tokens_spent)} ảnh.")

tab_setup, tab_lib, tab_export = st.tabs(["1️⃣ Tải ảnh & Ước tính token", "2️⃣ Thư viện & Chỉnh sửa", "3️⃣ Xuất JSON"])

# ============================================================ TAB 1: upload + lists + tokens
with tab_setup:
    st.subheader("A. Tải ảnh lên")
    files = st.file_uploader("Kéo thả hoặc chọn nhiều ảnh (JPG, JPEG, PNG, WEBP)",
                             type=["jpg", "jpeg", "png", "webp"], accept_multiple_files=True,
                             key=f"uploader_{st.session_state['uploader_rev']}")
    if files:
        added, skipped = store.add_files([(f.name, f.getvalue()) for f in files])
        st.session_state["flash"] = (added, skipped)
        st.session_state["uploader_rev"] += 1
        st.rerun()
    if "flash" in st.session_state:
        added, skipped = st.session_state.pop("flash")
        if added:
            st.success(f"Đã thêm {added} ảnh.")
        for name, why in skipped[:10]:
            st.info(f"Bỏ qua “{name}”: {why}")
        if len(skipped) > 10:
            st.info(f"… và {len(skipped) - 10} ảnh bị bỏ qua khác.")
    st.caption(f"Hiện có **{len(store.records)}** ảnh · ⏳ {n_pending} chờ · ❌ {n_failed} lỗi.")

    st.subheader("B. Danh sách tags của bạn")
    st.caption("Mode 1 bỏ qua danh sách này. Mode 2: AI kiểm tra và ưu tiên dùng, vẫn có thể đề xuất tag mới. "
               "Mode 3: chỉ chấp nhận tag trong danh sách. Giá trị trong danh sách KHÔNG mặc định là đúng – "
               "AI phải đối chiếu với ảnh.")
    for f in LIST_FIELDS:
        st.text_area(f, key=f"list_{f}", height=100, placeholder=LIST_HELP[f], on_change=save_lists,
                     help="Ngăn cách bằng dấu phẩy hoặc xuống dòng. Tự chuẩn hóa về snake_case.")

    # ---- token estimate
    st.subheader("C. Ước tính token & gợi ý cấu hình")
    sel_rec = store.get(st.session_state.get("sel_id") or "")
    scope = st.radio("Tính cho", SCOPES, horizontal=True, key="tok_scope")
    if scope == SCOPES[0]:
        scope_recs = [sel_rec] if sel_rec else []
    elif scope == SCOPES[1]:
        scope_recs = [r for r in store.records if r.status in (PENDING, ERROR)]
    else:
        scope_recs = list(store.records)

    if not scope_recs:
        st.info("Chưa có ảnh nào trong phạm vi này." if scope != SCOPES[0] else
                "Chưa chọn ảnh – hãy mở một ảnh ở tab “Thư viện & Chỉnh sửa”, hoặc chọn phạm vi khác.")
    else:
        items = dims_items(scope_recs)
        cal = tk.calibration(store.records)
        est = tk.estimate_items(items, cfg, lists, cal)
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Số request", tk.fmt(est.images))
        m2.metric("Token vào (input)", tk.fmt(est.input_tokens))
        m3.metric("Token ra (output)", tk.fmt(est.output_tokens))
        m4.metric("Tổng ước tính", tk.fmt(est.total), help="≈ trung bình "
                  f"{tk.fmt(est.total // max(est.images, 1))} token/ảnh")
        conf = {"calibrated": f"✅ Đã hiệu chỉnh theo {cal[2]} ảnh đã chạy thật (vào ×{cal[0]:.2f}, ra ×{cal[1]:.2f}).",
                "medium": "🟡 Ước tính theo công thức của nhà cung cấp – sai số có thể vài chục %.",
                "low": "🔴 Model chưa có công thức token ảnh riêng – ước tính thô. Chạy thử 1–2 ảnh để hiệu chỉnh."}[est.confidence]
        st.caption(conf + f" Mỗi request gồm ~{tk.fmt(est.prompt_tokens)} token chữ (prompt + schema). "
                   "Model có chế độ “thinking/reasoning” có thể tốn thêm token output.")

        budget = st.number_input("Ngân sách token tối đa cho phạm vi này (0 = không giới hạn)", min_value=0,
                                 step=10000, key="tok_budget")
        table = tk.scenario_table(items, cfg, lists, cal)
        best, msgs = tk.recommend(table, cfg, items, int(budget))
        for level, text in msgs:
            getattr(st, level)(text)
        if best:
            st.button(f"✨ Áp dụng gợi ý: cạnh dài {best[0]}px, mức “{tk.DETAIL_LABEL[best[1]]}”",
                      on_click=cb_apply_rec, args=best)
        with st.expander("Bảng so sánh tổng token theo cấu hình"):
            st.dataframe([{"Cạnh dài (px)": ("▶ " if s == cfg.max_side else "") + str(s),
                           **{tk.DETAIL_LABEL[d]: tk.fmt(table[(s, d)]) for d in tk.DETAIL_ORDER}}
                          for s in tk.SIDE_OPTIONS], hide_index=True)
            st.caption(f"▶ = kích thước hiện tại; mức chi tiết hiện tại: “{tk.DETAIL_LABEL[cfg.detail]}”.")

# ============================================================ TAB 2: gallery + detail
def get_filtered():
    q = st.session_state["f_search"].strip().lower()
    out = []
    for r in store.records:
        if r.status not in st.session_state["f_status"]:
            continue
        if q and q not in r.filename.lower():
            continue
        if st.session_state["f_review"] and not (r.result and needs_review(r, lists, mode)):
            continue
        if st.session_state["f_invalid"] and not (r.result and not r.result.get("valid")):
            continue
        out.append(r)
    return out


def pager(pos, page, pages):
    c = st.columns([1, 1, 2, 1, 1])
    c[0].button("⏮", key=f"pf_{pos}", on_click=cb_page, args=("first", pages), disabled=page <= 1)
    c[1].button("◀", key=f"pp_{pos}", on_click=cb_page, args=("prev", pages), disabled=page <= 1)
    c[2].markdown(f"<div style='text-align:center;padding-top:6px'>Trang <b>{page}</b>/{pages}</div>",
                  unsafe_allow_html=True)
    c[3].button("▶", key=f"pn_{pos}", on_click=cb_page, args=("next", pages), disabled=page >= pages)
    c[4].button("⏭", key=f"pl_{pos}", on_click=cb_page, args=("last", pages), disabled=page >= pages)


def render_editor(rec, busy):
    base = f"{rec.id}_{rec.rev}"
    r = rec.result
    if not r.get("valid"):
        st.info("Ảnh không đạt quality gate (valid=false) – sẽ tự động bị bỏ qua khi xuất. "
                "Bấm “Phân tích lại” nếu muốn thử lại, hoặc nhập tay bên dưới.")
        st.caption("Lý do model từ chối: " + (r.get("reject_reason") or "(không có – kết quả cũ hoặc model không nêu lý do)"))
        st.button("✍️ Đánh dấu hợp lệ & nhập tay", key=f"manual_{base}", on_click=cb_make_manual, args=(rec.id,),
                  disabled=busy, help="Tạo bản ghi trống để bạn tự điền shot / angle / support / poses / tags.")
        return
    kc = f"{base}_count"
    st.number_input("Số chủ thể (count)", 1, MAX_SUBJECTS, value=int(r["count"]), key=kc, disabled=busy,
                    on_change=cb_count, args=(rec.id, kc))
    for col, (f, vals) in zip(st.columns(3), ENUM_FIELDS.items()):
        with col:
            k = f"{base}_{f}"
            opts = list(vals) if r[f] in vals else ["", *vals]
            st.selectbox(FIELD_LABEL[f], opts, index=opts.index(r[f]), key=k, disabled=busy,
                         on_change=cb_enum, args=(rec.id, f, k))
    k = f"{base}_prop"
    st.text_input(FIELD_LABEL["prop"], value=r["prop"] or "", key=k, disabled=busy,
                  on_change=cb_prop, args=(rec.id, k), help="Để trống nếu đứng/đi không cần điểm tựa.")
    if r["count"] >= 2:
        k = f"{base}_group_prompt"
        st.text_area(FIELD_LABEL["group_prompt"], value=r["group_prompt"] or "", key=k, height=68, disabled=busy,
                     on_change=cb_text, args=(rec.id, "group_prompt", k))
    for i, pose in enumerate(r["poses"]):
        k = f"{base}_pose{i}"
        st.text_area(f"poses[{i}]", value=pose, key=k, height=68, disabled=busy,
                     on_change=cb_pose, args=(rec.id, i, k))
    if "outfit" in r:
        k = f"{base}_outfit"
        st.text_area(FIELD_LABEL["outfit"], value=r["outfit"] or "", key=k, height=68, disabled=busy,
                     on_change=cb_outfit, args=(rec.id, k))
    k = f"{base}_tags"
    st.text_input(FIELD_LABEL["tags"], value=", ".join(r["tags"]), key=k, disabled=busy,
                  on_change=cb_tags, args=(rec.id, k))
    origin = classify(rec, "tags", lists, mode)
    st.caption(BADGE[origin])
    if origin == ORIGIN_NEW:
        a, b = st.columns(2)
        a.button("✅ Chấp nhận", key=f"ok_{base}_tags", on_click=cb_accept, args=(rec.id, "tags"),
                 help="Thêm các tag mới này vào danh sách của bạn")
        b.button("❌ Từ chối", key=f"no_{base}_tags", on_click=cb_reject, args=(rec.id, "tags"),
                 help="Xóa các tag ngoài danh sách")
    unsure = uncertain_fields(rec, lists, mode)
    if unsure and not rec.reviewed:
        st.warning("Cần kiểm tra: " + ", ".join(unsure), icon="⚠️")
    kr = f"{base}_rv"
    st.checkbox("Đã kiểm tra / xác nhận ảnh này", value=rec.reviewed, key=kr, on_change=cb_review,
                args=(rec.id, kr))


def render_detail(rec, fids):
    busy = rec.status == PROCESSING
    msg = st.session_state.pop("_msg", None)
    if msg:
        (st.error if msg[0] == "error" else st.success)(msg[1])
    idx = fids.index(rec.id) if rec.id in fids else None
    n1, n2, n3, n4, n5 = st.columns([1, 1, 2, 1.3, 0.8])
    n1.button("◀ Trước", key="nav_prev", on_click=cb_nav, args=(-1, fids), disabled=idx is None or idx == 0)
    n2.button("Sau ▶", key="nav_next", on_click=cb_nav, args=(1, fids),
              disabled=idx is None or idx >= len(fids) - 1)
    n3.button("✔ Đã kiểm tra → ảnh sau", key="nav_confirm", on_click=cb_confirm_next, args=(rec.id, fids),
              disabled=not rec.result or idx is None, type="primary")
    if n4.button("🔄 Phân tích lại", key="nav_rerun", disabled=bool(problems) or running):
        start_job([rec.id])
    n5.button("🗑", key="nav_del", on_click=cb_remove, args=(rec.id,), disabled=busy, help="Xóa ảnh này")
    st.caption(f"Ảnh {idx + 1}/{len(fids)} trong danh sách lọc" if idx is not None
               else "Ảnh này đang bị ẩn bởi bộ lọc.")

    left, right = st.columns([2, 3])
    with left:
        st.image(str(store.preview_path(rec)), width=380)
        stem, ext = os.path.splitext(rec.filename)
        k = f"{rec.id}_{rec.rev}_name"
        st.text_input(f"✏️ Tên file (đuôi {ext} giữ nguyên)", value=stem, key=k, disabled=busy,
                      on_change=cb_rename, args=(rec.id, k))
        if rec.original_filename and rec.original_filename != rec.filename:
            st.caption(f"Tên gốc: {rec.original_filename}")
        w, h = store.dims(rec)
        st.caption(f"{w}×{h}px · {fmt_size(rec.size_bytes)} · {STATUS_LABEL[rec.status]}")
        est1 = tk.estimate_items([(rec.id, w, h)], cfg, lists, tk.calibration(store.records))
        line = f"Ước tính với cấu hình hiện tại: ~{tk.fmt(est1.total)} token."
        if rec.tokens_in or rec.tokens_out:
            line = (f"Thực tế lần chạy gần nhất: {tk.fmt(rec.tokens_in)} vào + {tk.fmt(rec.tokens_out)} ra "
                    f"= **{tk.fmt(rec.tokens_in + rec.tokens_out)}** token. ") + line
        st.caption(line)
    with right:
        st.markdown("**JSON của ảnh này**")
        if rec.result:
            entry = export.record_to_entry(rec, include_filename=True)
            st.code(json.dumps(entry, ensure_ascii=False, indent=2), language="json")
        elif busy:
            st.info("Đang phân tích ảnh này...")
        else:
            st.info("Chưa có kết quả cho ảnh này.")
    if rec.error:
        (st.warning if rec.result else st.error)(rec.error)
    if rec.result:
        st.markdown("**Chỉnh sửa**")
        render_editor(rec, busy)


with tab_lib:
    if not store.records:
        st.info("Chưa có ảnh nào. Hãy tải ảnh ở tab “Tải ảnh & Ước tính token”.")
    else:
        filtered = get_filtered()
        fids = [r.id for r in filtered]
        sel = store.get(st.session_state["sel_id"] or "")
        if sel is None and filtered:
            sel = filtered[0]
            st.session_state["sel_id"] = sel.id

        gal, det = st.columns([3, 5])
        with gal:
            st.markdown(f"**Thư viện: {len(filtered)}/{len(store.records)} ảnh**")
            with st.expander("🔎 Lọc & hiển thị"):
                st.multiselect("Trạng thái", list(STATUS_LABEL), key="f_status", format_func=STATUS_LABEL.get,
                               on_change=cb_reset_page)
                st.text_input("Tìm theo tên file", key="f_search", on_change=cb_reset_page)
                st.checkbox("Chỉ ảnh cần kiểm tra", key="f_review", on_change=cb_reset_page)
                st.checkbox("Chỉ ảnh không hợp lệ (🚫 valid=false)", key="f_invalid", on_change=cb_reset_page)
                st.selectbox("Số ảnh mỗi trang", [6, 9, 12, 18, 24], key="page_size", on_change=cb_reset_page)
            size = st.session_state["page_size"]
            pages = paging.page_count(len(filtered), size)
            st.session_state["gallery_page"] = paging.clamp_page(st.session_state["gallery_page"], pages)
            page = st.session_state["gallery_page"]
            if pages > 1:
                st.number_input("Đến trang", 1, pages, key="gallery_page")
            pager("top", page, pages)
            page_items = paging.slice_page(filtered, page, size)
            if not page_items:
                st.info("Không có ảnh nào khớp bộ lọc.")
            for i in range(0, len(page_items), GRID_COLS):
                for col, rec in zip(st.columns(GRID_COLS), page_items[i:i + GRID_COLS]):
                    with col:
                        with st.container(border=True):
                            st.image(str(store.thumb_path(rec)), width=THUMB_W)
                            flag = ""
                            if rec.result and not rec.result.get("valid"):
                                flag = "🚫"
                            elif rec.result and rec.reviewed:
                                flag = "✔"
                            elif rec.result and needs_review(rec, lists, mode):
                                flag = "⚠️"
                            is_sel = sel is not None and rec.id == sel.id
                            st.button(f"{'▶ ' if is_sel else ''}{STATUS_ICON[rec.status]}{flag} {short(rec.filename)}",
                                      key=f"open_{rec.id}", on_click=cb_select, args=(rec.id,), help=rec.filename,
                                      type="primary" if is_sel else "secondary")
            if len(page_items) > GRID_COLS:
                pager("bot", page, pages)
            st.caption("✅ xong · ⏳ chờ · ❌ lỗi · ⚠️ cần kiểm tra · ✔ đã xác nhận · 🚫 không hợp lệ (bỏ qua khi xuất)")
        with det:
            if sel is None:
                st.info("Chọn một ảnh ở thư viện bên trái.")
            else:
                render_detail(sel, fids)

        # ---- bulk tools
        completed = [r for r in store.records if r.status == COMPLETED and r.result]
        st.divider()
        with st.expander("🧰 Áp dụng giá trị cho nhiều ảnh"):
            bf = st.selectbox("Trường", (*ENUM_FIELDS, "prop", "tags"), key="bulk_field",
                              help="tags: danh sách phân tách bằng dấu phẩy sẽ THAY toàn bộ tags của ảnh.")
            bv = st.text_input("Giá trị mới (để trống = xóa giá trị)", key="bulk_value")
            names = [r.filename for r in completed]
            st.session_state["bulk_targets"] = [n for n in st.session_state.get("bulk_targets", []) if n in names]
            st.multiselect("Ảnh áp dụng", names, key="bulk_targets")
            done_ids = {r.id for r in completed}
            st.button("Chọn tất cả ảnh đang lọc", on_click=cb_select_all_filtered,
                      args=([r.filename for r in filtered if r.id in done_ids],))
            if st.button("Áp dụng giá trị", disabled=not st.session_state.get("bulk_targets") or running):
                chosen = set(st.session_state["bulk_targets"])
                val = to_snake_case(bv)
                if bf in ENUM_FIELDS and val not in ENUM_FIELDS[bf]:
                    st.error(f"Giá trị phải là một trong: {', '.join(ENUM_FIELDS[bf])}")
                else:
                    for r in completed:
                        if r.filename in chosen and r.result.get("valid"):
                            if bf == "tags":
                                r.result["tags"] = parse_value_list(bv)
                            elif bf == "prop":
                                r.result["prop"] = val or None
                            else:
                                r.result[bf] = val
                            r.rev += 1
                            _mark_edited(r, bf)
                    st.rerun()
            if st.button("✔️ Đánh dấu tất cả ảnh hoàn thành là đã kiểm tra", disabled=not completed):
                for r in completed:
                    r.reviewed = True
                    r.rev += 1
                store.save()
                st.rerun()

        with st.expander("✏️ Đổi tên hàng loạt"):
            rm = st.radio("Kiểu đổi tên", ["Tiền tố + số thứ tự", "Tìm & thay thế"], horizontal=True, key="br_mode")
            rs = st.radio("Áp dụng cho", ["Tất cả ảnh đang lọc", "Chỉ ảnh trong trang hiện tại"], horizontal=True,
                          key="br_scope")
            targets = filtered if rs.startswith("Tất cả") else paging.slice_page(
                filtered, st.session_state["gallery_page"], st.session_state["page_size"])
            mapping = {}
            if rm.startswith("Tiền tố"):
                p1, p2, p3 = st.columns(3)
                prefix = p1.text_input("Tiền tố", value="img_", key="br_prefix")
                start = p2.number_input("Bắt đầu từ", 0, 100000, 1, key="br_start")
                pad = p3.number_input("Số chữ số", 1, 6, 3, key="br_pad")
                mapping = {r.id: f"{prefix}{str(int(start) + i).zfill(int(pad))}" for i, r in enumerate(targets)}
            else:
                q1, q2 = st.columns(2)
                find = q1.text_input("Tìm", key="br_find")
                repl = q2.text_input("Thay bằng", key="br_repl")
                if find:
                    for r in targets:
                        stem = os.path.splitext(r.filename)[0]
                        if find in stem:
                            mapping[r.id] = stem.replace(find, repl)
            plan = {}
            if mapping:
                try:
                    plan = store.plan_rename(mapping)
                except ValueError as e:
                    st.error(str(e))
            if plan:
                st.caption(f"Sẽ đổi tên **{len(plan)}** ảnh (chỉ đổi tên hiển thị/xuất; file gốc trong .data không bị sửa). "
                           "Xem trước 8 ảnh đầu:")
                st.dataframe([{"Tên cũ": store.get(rid).filename, "Tên mới": new} for rid, new in list(plan.items())[:8]],
                             hide_index=True)
                if st.button("✅ Áp dụng đổi tên", disabled=running):
                    try:
                        n = store.bulk_rename(mapping)
                        st.session_state["_msg"] = ("success", f"Đã đổi tên {n} ảnh.")
                    except ValueError as e:
                        st.session_state["_msg"] = ("error", str(e))
                    st.rerun()
            elif mapping:
                st.info("Không có tên nào thay đổi.")

        with st.expander("🗑 Xóa tất cả ảnh"):
            if st.button("Xóa toàn bộ danh sách", disabled=running):
                store.clear()
                st.session_state["sel_id"] = None
                st.rerun()

# ============================================================ TAB 3: export
with tab_export:
    completed = [r for r in store.records if r.status == COMPLETED and r.result]
    if not completed:
        st.info("Chưa có ảnh nào hoàn thành để xuất.")
    else:
        e1, e2 = st.columns(2)
        scope_x = e1.radio("Phạm vi", ["Tất cả ảnh hoàn thành", "Chỉ ảnh đã kiểm tra"], horizontal=True)
        content = e2.radio("Nội dung", ["Đầy đủ", "Chỉ filename + trường lọc"], horizontal=True)
        o1, o2 = st.columns(2)
        inc_name = o1.checkbox("Kèm filename trong file từng ảnh", value=True,
                               help="File tổng hợp luôn có filename để biết dữ liệu thuộc ảnh nào.")
        inc_review = o2.checkbox("Kèm status + review_required", value=False)
        fields = export.FIELDS_FULL if content.startswith("Đầy đủ") else export.FIELDS_FILTER
        chosen_recs = [r for r in completed if scope_x.startswith("Tất cả") or r.reviewed]
        chosen_recs, skipped_recs = export.exportable(chosen_recs)
        if skipped_recs:
            st.info(f"Tự động bỏ qua {len(skipped_recs)} ảnh không hợp lệ (valid=false).")
        if not chosen_recs:
            st.info("Chưa có ảnh nào đủ điều kiện để xuất.")
        else:
            rr = lambda r: needs_review(r, lists, mode)
            entries = [export.record_to_entry(r, fields=fields, include_filename=True, include_review=inc_review,
                                              review_required=rr(r)) for r in chosen_recs]
            issues = export.validate_entries(entries, fields=fields)
            errors = [m for sev, m in issues if sev == "error"]
            n_unreviewed = sum(1 for r in chosen_recs if rr(r))
            st.markdown(f"**Sẽ xuất {len(chosen_recs)} ảnh.**")
            if n_unreviewed:
                st.warning(f"{n_unreviewed} ảnh vẫn có trường chưa chắc chắn và chưa được xác nhận.")
            if errors:
                st.error("Không thể xuất – dữ liệu chưa hợp lệ:\n\n" + "\n".join(f"- {m}" for m in errors[:30]) +
                         (f"\n- … và {len(errors) - 30} lỗi khác" if len(errors) > 30 else ""))
            try:
                agg_text = export.dumps(export.aggregate(entries), get_secrets()) if not errors else ""
                per_entries = [export.record_to_entry(r, fields=fields, include_filename=inc_name,
                                                      include_review=inc_review, review_required=rr(r))
                               for r in chosen_recs]
                zip_bytes = export.build_zip(export.per_image_files(chosen_recs, per_entries)) if not errors else b""
            except ValueError as e:
                st.error(str(e))
                errors = [str(e)]

            # ---- paginated preview
            st.subheader("Xem trước dữ liệu xuất")
            xsize = st.selectbox("Số dòng mỗi trang", [10, 25, 50], index=1, key="x_size")
            xpages = paging.page_count(len(entries), xsize)
            xpage = st.number_input("Trang", 1, xpages, 1, key="x_page") if xpages > 1 else 1
            sl = slice(((xpage - 1) * xsize), xpage * xsize)
            st.dataframe([{"Tên file": e.get("filename", ""), **{k: (", ".join(v) if isinstance(v, list) else v) for k, v in e.items()
                                if k in ("shot", "angle", "support", "prop", "tags", "outfit")},
                           "Cần kiểm tra": "⚠️" if rr(r) else ""} for e, r in zip(entries[sl], chosen_recs[sl])],
                         hide_index=True)
            with st.expander("Xem JSON của trang này"):
                st.code(json.dumps(export.aggregate(entries[sl]), ensure_ascii=False, indent=2), language="json")
            st.caption(f"Trang {xpage}/{xpages} · tổng {len(entries)} ảnh.")

            if not errors:
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                st.subheader("Tải về / lưu JSON")
                d1, d2 = st.columns(2)
                d1.download_button("⬇️ Tải 1 file JSON tổng hợp", agg_text.encode("utf-8"),
                                   file_name=f"tags_{stamp}.json", mime="application/json")
                d2.download_button("⬇️ Tải JSON từng ảnh (.zip)", zip_bytes, file_name=f"tags_{stamp}.zip",
                                   mime="application/zip")
                s1, s2, s3 = st.columns([3, 2, 1])
                out_dir = s1.text_input("Thư mục", value=str(EXPORT_DIR))
                out_name = s2.text_input("Tên file", value=f"tags_{stamp}.json")
                overwrite = s3.checkbox("Cho phép ghi đè")
                if st.button("💾 Lưu JSON vào thư mục"):
                    try:
                        path = export.safe_write(Path(out_dir) / out_name, agg_text, overwrite)
                        st.success(f"Đã lưu: {path}")
                    except (FileExistsError, OSError) as e:
                        st.error(str(e))

                st.subheader("Xuất bộ dữ liệu đồng bộ (ZIP: images/ + json/)")
                st.caption("Tên ảnh trong images/ và tên + trường filename trong json/ luôn lấy từ tên hiện tại trong tool. "
                           "Ảnh đã xóa không có trong gói; ảnh mới thêm có mặt khi đã phân tích xong. "
                           "Đổi tên chỉ diễn ra trong tool, không gọi AI.")
                ds_entries = [export.record_to_entry(r, fields=fields, include_filename=True,
                                                     include_review=inc_review, review_required=rr(r))
                              for r in chosen_recs]
                ds_sig = hashlib.sha1(json.dumps(ds_entries, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
                ds_mb = sum(r.size_bytes for r in chosen_recs) / 1024 / 1024
                if ds_mb > 300:
                    st.caption("⚠️ Dung lượng lớn – hãy lưu ZIP thẳng vào thư mục thay vì tải qua trình duyệt.")
                elif st.button("📦 Chuẩn bị ZIP bộ dữ liệu"):
                    st.session_state["_ds_zip"] = (ds_sig, export.build_dataset_zip(chosen_recs, ds_entries, store.image_path))
                ds_ready = st.session_state.get("_ds_zip")
                if ds_ready and ds_mb <= 300:
                    if ds_ready[0] == ds_sig:
                        st.download_button("⬇️ Tải ZIP bộ dữ liệu", ds_ready[1], file_name=f"dataset_{stamp}.zip",
                                           mime="application/zip")
                    else:
                        st.caption("Dữ liệu đã thay đổi từ lần chuẩn bị trước – bấm “Chuẩn bị ZIP bộ dữ liệu” lại.")
                z1, z2 = st.columns([4, 1])
                ds_dir = z1.text_input("Lưu ZIP vào thư mục", value=str(EXPORT_DIR), key="ds_dir")
                ds_over = z2.checkbox("Ghi đè", key="ds_over")
                if st.button(f"💾 Lưu ZIP bộ dữ liệu ({len(chosen_recs)} ảnh) vào thư mục"):
                    try:
                        path = export.write_dataset_zip(Path(ds_dir) / f"dataset_{stamp}.zip", chosen_recs,
                                                        ds_entries, store.image_path, ds_over)
                        st.success(f"Đã lưu: {path}")
                    except (FileExistsError, OSError) as e:
                        st.error(str(e))

                st.subheader("Xuất ảnh với tên mới")
                st.caption("Sao chép ảnh gốc sang tên đã đổi (file gốc trong .data không bị sửa) để khớp với JSON.")
                pairs = [(store.image_path(r), r.filename) for r in chosen_recs]
                total_mb = sum(r.size_bytes for r in chosen_recs) / 1024 / 1024
                i1, i2 = st.columns([4, 1])
                img_dir = i1.text_input("Thư mục ảnh", value=str(EXPORT_DIR / f"images_{stamp}"))
                img_over = i2.checkbox("Ghi đè", key="img_over")
                if st.button(f"📁 Sao chép {len(pairs)} ảnh ({total_mb:.0f} MB) vào thư mục"):
                    try:
                        n = export.copy_renamed_images(pairs, img_dir, img_over)
                        st.success(f"Đã sao chép {n} ảnh vào {img_dir}")
                    except (FileExistsError, OSError) as e:
                        st.error(str(e))
                if total_mb > 300:
                    st.caption("⚠️ Dung lượng lớn – nên dùng sao chép vào thư mục thay vì ZIP.")
                elif st.button("Chuẩn bị ZIP ảnh đã đổi tên"):
                    st.session_state["_img_zip"] = export.build_images_zip(pairs)
                if st.session_state.get("_img_zip") and total_mb <= 300:
                    st.download_button("⬇️ Tải ZIP ảnh", st.session_state["_img_zip"],
                                       file_name=f"images_{stamp}.zip", mime="application/zip")
