#!/usr/bin/env python3
"""Image Scraper - cào ảnh về máy kèm metadata JSON + CSV để nạp vào database / train AI.

Mỗi KẾ HOẠCH là một bộ tag; ảnh phải khớp TẤT CẢ tag của kế hoạch đó.

Chạy tương tác:    python main.py
Chạy bằng tham số: python main.py -c "casual, 1 person=100" -c "fashion, 2 person=50" -b "logo"
Xem thêm:          python main.py --help
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from scraper.engines import ENGINES
from scraper.http import HttpClient
from scraper.pipeline import Config, Job, Scraper
from scraper.store import Store

YES = ("y", "yes", "c", "co", "có")


def split_csv(s: str) -> list[str]:
    return [p.strip() for p in s.replace(";", ",").split(",") if p.strip()]


def ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    try:
        v = input(f"{prompt}{suffix}: ").strip()
    except EOFError:
        v = ""
    return v or default


def ask_int(prompt: str, default: int) -> int:
    while True:
        v = ask(prompt, str(default))
        if v.isdigit() and int(v) > 0:
            return int(v)
        print("  Nhập một số nguyên dương.")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Cào ảnh từ internet + xuất metadata JSON/CSV")
    p.add_argument("-c", "--plan", action="append", default=[], metavar="PLAN",
                   help='một kế hoạch = các tag cách nhau dấu phẩy, ảnh phải có TẤT CẢ tag. '
                        'Thêm "=N" để đặt số ảnh riêng, vd: -c "casual, 1 person=100". '
                        'Lặp -c để tạo nhiều kế hoạch')
    p.add_argument("-n", "--count", type=int, default=50,
                   help="số ảnh mặc định cho kế hoạch không có '=N' (mặc định 50)")
    p.add_argument("-b", "--ban", action="append", default=[],
                   help="từ khoá cấm (loại ảnh có từ này trong tiêu đề/alt/URL), dùng chung mọi kế hoạch")
    p.add_argument("-l", "--link", action="append", default=[],
                   help="link trang/ảnh để cào. 'url' = dùng cho mọi kế hoạch; "
                        "'N::url' = chỉ cho kế hoạch số N")
    p.add_argument("-o", "--out", help="thư mục đầu ra (mặc định: output)")
    p.add_argument("--match", choices=["auto", "strict", "loose"], default="auto",
                   help="auto (mặc định): có CLIP thì CLIP kiểm tra nội dung ảnh, không có thì kiểm tra chữ; "
                        "strict: mọi tag phải có trong tiêu đề/alt/URL; "
                        "loose: không kiểm tra chữ (chỉ dựa vào câu tìm kiếm và CLIP)")
    p.add_argument("--clip", choices=["auto", "on", "off"], default="auto",
                   help="lọc ảnh rác bằng CLIP chạy local: auto = dùng nếu đã cài (pip install -r requirements-clip.txt), "
                        "on = bắt buộc, off = tắt")
    p.add_argument("--clip-model", default="openai/clip-vit-base-patch32", help="model CLIP (Hugging Face)")
    p.add_argument("--clip-threshold", type=float, default=0.22,
                   help="ngưỡng cosine ảnh-tag để coi là khớp (mặc định 0.22; thấp = dễ tính, cao = khắt khe). "
                        "Điểm từng ảnh được lưu ở cột clip_scores để bạn chỉnh ngưỡng")
    p.add_argument("--no-clip-junk", action="store_true",
                   help="tắt lọc 'ảnh rác' (logo/banner/ảnh chụp màn hình) của CLIP, vd. khi cào meme có chữ")
    p.add_argument("--max-aspect", type=float, default=4.0,
                   help="bỏ ảnh có tỉ lệ cạnh dài/ngắn lớn hơn mức này (banner), mặc định 4")
    p.add_argument("--time-limit", type=int, default=900,
                   help="giới hạn thời gian (giây) cho MỖI kế hoạch, 0 = không giới hạn (mặc định 900)")
    p.add_argument("--cookies", metavar="FILE",
                   help="file cookie xuất từ trình duyệt đã đăng nhập (cookies.txt Netscape hoặc JSON) "
                        "để vào Reddit/diễn đàn cần đăng nhập và giảm bị chặn")
    p.add_argument("--aliases", action="append", default=[], metavar="FILE",
                   help="file đồng nghĩa của bạn (xem aliases.txt); có thể lặp. "
                        "Tự nạp aliases.txt cạnh main.py hoặc ở thư mục hiện tại")
    p.add_argument("--no-synonyms", action="store_true",
                   help="tắt bảng đồng nghĩa, dùng đúng tag như đã nhập")
    p.add_argument("--no-expand", action="store_true",
                   help="tắt mở rộng truy vấn (chỉ dùng đúng 1 câu tìm kiếm, nên bị giới hạn bởi trần kết quả của engine)")
    p.add_argument("--no-split", action="store_true",
                   help="tắt bước tách lẻ tag; chỉ nhận ảnh khớp TẤT CẢ tag (có thể ít ảnh hơn số yêu cầu)")
    p.add_argument("--max-queries", type=int, default=80,
                   help="tối đa số câu truy vấn mở rộng mỗi kế hoạch (mặc định 80)")
    p.add_argument("--engines", default="bing,duckduckgo,reddit,google",
                   help="nguồn tìm ảnh, theo thứ tự: bing,duckduckgo,reddit,google")
    p.add_argument("--proxy-file", help="file proxy, mỗi dòng 1 proxy (http://user:pass@host:port)")
    p.add_argument("--workers", type=int, default=8, help="số luồng tải ảnh song song (mặc định 8)")
    p.add_argument("--min-size", type=int, default=200, help="cạnh ngắn nhất của ảnh, px (mặc định 200)")
    p.add_argument("--hash-threshold", type=int, default=5,
                   help="ngưỡng giống nhau perceptual hash 0-64; 0 = chỉ loại ảnh y hệt, "
                        "càng lớn càng loại tay (mặc định 5)")
    p.add_argument("--safesearch", choices=["off", "moderate", "strict"], default="moderate")
    p.add_argument("--fallback-search", action="store_true",
                   help="khi link không đủ ảnh thì tự tìm thêm bằng search engine")
    p.add_argument("--depth", type=int, default=0, help="độ sâu theo link con cùng domain (mặc định 0)")
    p.add_argument("--max-pages", type=int, default=30, help="tối đa số trang duyệt mỗi link")
    p.add_argument("--delay", default="0.3,1.2", help="giãn cách ngẫu nhiên giữa request, giây: min,max")
    p.add_argument("-y", "--yes", action="store_true", help="không hỏi xác nhận")
    return p


def parse_plan(text: str, default_count: int) -> tuple[list[str], int]:
    count = default_count
    if "=" in text:
        left, right = text.rsplit("=", 1)
        if right.strip().isdigit():
            text, count = left, int(right)
    return split_csv(text), count


def attach_links(jobs: list[Job], links: list[str]) -> None:
    for l in links:
        head, sep, rest = l.partition("::")
        if sep and head.strip().isdigit() and not l.lower().startswith(("http://", "https://")):
            idx = int(head) - 1
            if 0 <= idx < len(jobs):
                jobs[idx].links.append(rest.strip())
            else:
                print(f"Bỏ qua link '{l}': không có kế hoạch số {head}", file=sys.stderr)
        else:
            for j in jobs:
                j.links.append(l)


def interactive_plans() -> list[Job]:
    print("=== IMAGE SCRAPER ===")
    print("Mỗi kế hoạch là một bộ tag. Ảnh phải khớp TẤT CẢ tag của kế hoạch.\n")
    plans: list[list[str]] = []
    while True:
        tags = split_csv(ask(f"Kế hoạch {len(plans) + 1} - các tag cách nhau dấu phẩy (vd: casual, 1 person)"))
        if not tags:
            print("  Cần ít nhất 1 tag.")
            continue
        plans.append(tags)
        if ask("Tạo kế hoạch tiếp theo? (y/N)", "n").lower() not in YES:
            break
    print()
    jobs = []
    for i, tags in enumerate(plans, 1):
        label = " + ".join(tags)
        count = ask_int(f"Số ảnh cho kế hoạch {i} [{label}]", 50)
        raw = ask("  Link trang/ảnh để cào (cách nhau dấu cách, Enter = tự cào bằng search engine)")
        jobs.append(Job(tags, count, raw.replace(",", " ").split()))
    return jobs


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass

    args = build_parser().parse_args()
    interactive = not args.plan
    banned = [x for b in args.ban for x in split_csv(b)]
    out = args.out

    if interactive:
        jobs = interactive_plans()
        banned = split_csv(ask("Từ khoá cấm (cách nhau dấu phẩy, Enter = bỏ qua)"))
        out = ask("Thư mục lưu", "output")
    else:
        jobs = []
        for p in args.plan:
            tags, count = parse_plan(p, args.count)
            if tags:
                jobs.append(Job(tags, count))
        attach_links(jobs, [x for l in args.link for x in l.replace(",", " ").split()])
    out = out or "output"

    if not jobs:
        print("Cần ít nhất 1 kế hoạch (tag).", file=sys.stderr)
        return 2
    engines = [e.strip() for e in args.engines.split(",") if e.strip() in ENGINES]
    if not engines:
        print(f"Engine không hợp lệ. Chọn trong: {', '.join(ENGINES)}", file=sys.stderr)
        return 2

    proxies: list[str] = []
    if args.proxy_file:
        proxies = [l.strip() for l in Path(args.proxy_file).read_text(encoding="utf-8").splitlines()
                   if l.strip() and not l.startswith("#")]
    dmin, dmax = (float(x) for x in args.delay.split(","))

    alias_files = list(args.aliases)
    for cand in (Path(__file__).with_name("aliases.txt"), Path("aliases.txt")):
        if cand.exists() and str(cand.resolve()) not in {str(Path(a).resolve()) for a in alias_files}:
            alias_files.append(str(cand))
    cfg = Config(
        synonyms=not args.no_synonyms, expand=not args.no_expand, split=not args.no_split, max_queries=args.max_queries, alias_files=alias_files,
        out_dir=out, engines=engines, banned=banned, workers=args.workers,
        min_size=args.min_size, hash_threshold=args.hash_threshold,
        safesearch=args.safesearch, fallback_search=args.fallback_search,
        depth=args.depth, max_pages=args.max_pages, match=args.match,
        clip=args.clip, clip_model=args.clip_model, clip_threshold=args.clip_threshold,
        clip_junk=not args.no_clip_junk, max_aspect=args.max_aspect, max_seconds=args.time_limit,
    )

    syn = Scraper(cfg, HttpClient(), Store.__new__(Store)).syn
    print("\nKế hoạch (ảnh phải có TẤT CẢ tag):")
    for i, j in enumerate(jobs, 1):
        src = f"{len(j.links)} link" if j.links else "search: " + ", ".join(engines)
        print(f"  {i}. [{j.category}] {j.count} ảnh ({src})")
        q = syn.query(j.tags)
        if q.lower() != j.query.lower() or q != " ".join(j.tags):
            print(f"       tìm bằng: {q}")
    if banned:
        print(f"  Từ khoá cấm: {', '.join(banned)}")
    if args.clip != "off":
        import importlib.util
        have = importlib.util.find_spec("torch") and importlib.util.find_spec("transformers")
        print("  Lọc ảnh rác: " + ("CLIP (local)" if have else
              "chưa cài CLIP -> lọc theo chữ (cài bằng: pip install -r requirements-clip.txt)"))
    print(f"  Lưu tại: {Path(out).resolve()}")
    if interactive and not args.yes:
        if ask("Bắt đầu? (Y/n)", "y").lower() not in YES:
            return 0
    print()

    http = HttpClient(proxies=proxies, min_delay=dmin, max_delay=dmax)
    if args.cookies:
        try:
            print(f"Đã nạp {http.load_cookies(args.cookies)} cookie từ {args.cookies}")
        except (OSError, ValueError) as e:
            print(f"Không đọc được file cookie: {e}", file=sys.stderr)
            return 2
    store = Store(out, hash_threshold=cfg.hash_threshold)
    scraper = Scraper(cfg, http, store)

    total = 0
    try:
        for job in jobs:
            total += scraper.run_job(job).saved
    except KeyboardInterrupt:
        print("\nĐã dừng (Ctrl+C). Dữ liệu đã tải vẫn được lưu.")
    finally:
        store.save()

    print(f"\nXong: +{total} ảnh mới, tổng {store.count()} ảnh trong {store.out.resolve()}")
    print(f"  JSON: {store.json_path}\n  CSV : {store.csv_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
