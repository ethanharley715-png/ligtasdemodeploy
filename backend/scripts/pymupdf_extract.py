import json
import sys

import fitz


def rect_to_dict(rect):
    x0, y0, x1, y1 = rect
    return {
        "x": x0,
        "y": y0,
        "width": x1 - x0,
        "height": y1 - y0,
    }


def normalize_text(value):
    return str(value or "").replace("\r\n", "\n").strip()


def extract_blocks(page):
    blocks = []
    for block in page.get_text("blocks", sort=True):
        if len(block) < 5:
            continue

        x0, y0, x1, y1, text = block[:5]
        text = normalize_text(text)
        if not text:
            continue

        block_index = int(block[5]) if len(block) > 5 and block[5] is not None else len(blocks)
        blocks.append(
            {
                "text": text,
                "rect": rect_to_dict((x0, y0, x1, y1)),
                "block_index": block_index,
            }
        )

    return blocks


def build_page_text(blocks):
    return "\n\n".join(block["text"] for block in blocks if block["text"]).strip()


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: pymupdf_extract.py <pdf-path>")

    document = fitz.open(sys.argv[1])
    pages = []
    full_text_parts = []

    for page_index in range(document.page_count):
        page = document.load_page(page_index)
        blocks = extract_blocks(page)
        page_text = build_page_text(blocks)

        pages.append(
            {
                "page_number": page.number + 1,
                "width": page.rect.width,
                "height": page.rect.height,
                "text": page_text,
                "blocks": blocks,
            }
        )

        if page_text:
            full_text_parts.append(page_text)

    print(
        json.dumps(
            {
                "text": "\n\n".join(full_text_parts).strip(),
                "pages": pages,
            }
        )
    )


if __name__ == "__main__":
    main()
