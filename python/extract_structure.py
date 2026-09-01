#!/usr/bin/env python3
"""
Extract per-page structure from a PDF as JSON for the TS import pipeline.

Usage:
  python extract_structure.py <pdf_path> <out_json_path>

Output JSON shape:
{
  "file": str,
  "pageCount": int,
  "textStats": {"chars": int},
  "pages": [
    {
      "page": 1,                       # 1-based
      "width": float, "height": float, # page rect in points
      "text": str,                     # plain text of the page
      "blocks": [{"index": int, "bbox": [x0,y0,x1,y1], "text": str}],
      "lines": [
        {
          "bbox": [x0,y0,x1,y1],
          "text": str,
          "spans": [{"text": str, "bbox": [x0,y0,x1,y1], "font": str, "size": float}]
        }
      ],
      "images": [
        {"xref": int, "bbox": [x0,y0,x1,y1], "pxWidth": int, "pxHeight": int}
      ]
    }
  ]
}

Coordinates are PyMuPDF page-space points with origin at top-left.
"""
import json
import sys

import pymupdf


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: extract_structure.py <pdf_path> <out_json>", file=sys.stderr)
        sys.exit(2)

    pdf_path, out_path = sys.argv[1], sys.argv[2]
    doc = pymupdf.open(pdf_path)

    pages = []
    total_chars = 0
    for pno in range(doc.page_count):
        page = doc[pno]
        rect = page.rect

        text_dict = page.get_text("dict")
        blocks = []
        lines = []
        for block in text_dict.get("blocks", []):
            if block.get("type") != 0:  # 0 = text block
                continue
            bbox = [round(v, 2) for v in block["bbox"]]
            block_text_parts = []
            for line in block.get("lines", []):
                spans = []
                line_text_parts = []
                for span in line.get("spans", []):
                    spans.append(
                        {
                            "text": span["text"],
                            "bbox": [round(v, 2) for v in span["bbox"]],
                            "font": span.get("font", ""),
                            "size": round(span.get("size", 0.0), 2),
                        }
                    )
                    line_text_parts.append(span["text"])
                line_text = "".join(line_text_parts)
                if not line_text.strip():
                    continue
                total_chars += len(line_text)
                lines.append(
                    {
                        "bbox": [round(v, 2) for v in line["bbox"]],
                        "text": line_text,
                        "spans": spans,
                    }
                )
                block_text_parts.append(line_text)
            block_text = "\n".join(block_text_parts)
            if block_text.strip():
                blocks.append({"index": len(blocks), "bbox": bbox, "text": block_text})

        images = []
        try:
            for info in page.get_image_info(xrefs=True):
                if info.get("bbox") is None:
                    continue
                x0, y0, x1, y1 = info["bbox"]
                # Skip hairline artifacts / zero-size rects
                if (x1 - x0) < 4 or (y1 - y0) < 4:
                    continue
                images.append(
                    {
                        "xref": info.get("xref", 0),
                        "bbox": [round(v, 2) for v in (x0, y0, x1, y1)],
                        "pxWidth": info.get("width", 0),
                        "pxHeight": info.get("height", 0),
                    }
                )
        except Exception as exc:  # keep going; images are best-effort
            print(f"warn: page {pno + 1} image info failed: {exc}", file=sys.stderr)

        pages.append(
            {
                "page": pno + 1,
                "width": round(rect.width, 2),
                "height": round(rect.height, 2),
                "text": page.get_text("text"),
                "blocks": blocks,
                "lines": lines,
                "images": images,
            }
        )

    result = {
        "file": pdf_path,
        "pageCount": doc.page_count,
        "textStats": {"chars": total_chars},
        "pages": pages,
    }

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False)
    print(f"extracted {doc.page_count} pages, {total_chars} chars -> {out_path}")


if __name__ == "__main__":
    main()
