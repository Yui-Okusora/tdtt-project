"""Pure pagination helpers."""
import math


def page_count(n_items: int, page_size: int) -> int:
    return max(1, math.ceil(n_items / max(1, page_size)))


def clamp_page(page: int, pages: int) -> int:
    return min(max(1, int(page or 1)), pages)


def slice_page(items: list, page: int, page_size: int) -> list:
    page = clamp_page(page, page_count(len(items), page_size))
    return items[(page - 1) * page_size: page * page_size]


def page_of_index(index: int, page_size: int) -> int:
    return index // max(1, page_size) + 1
