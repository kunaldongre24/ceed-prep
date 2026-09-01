#!/usr/bin/env python3
"""
Render a page (or a clipped region of a page) of a PDF to a PNG.

Usage:
  python render_region.py <pdf_path> <page_1based> <out_png> [--zoom Z] [--x0 X0 --y0 Y0 --x1 X1 --y1 Y1]

Coordinates are PDF page points (top-left origin), as produced by
extract_structure.py. Without a clip, the full page is rendered.
Aspect ratio is always preserved.
"""
import argparse
import sys

import pymupdf


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("page", type=int)  # 1-based
    ap.add_argument("out")
    ap.add_argument("--zoom", type=float, default=2.5)
    ap.add_argument("--x0", type=float, default=None)
    ap.add_argument("--y0", type=float, default=None)
    ap.add_argument("--x1", type=float, default=None)
    ap.add_argument("--y1", type=float, default=None)
    args = ap.parse_args()

    doc = pymupdf.open(args.pdf)
    if args.page < 1 or args.page > doc.page_count:
        print(f"error: page {args.page} out of range 1..{doc.page_count}", file=sys.stderr)
        sys.exit(1)
    page = doc[args.page - 1]

    clip = None
    if None not in (args.x0, args.y0, args.x1, args.y1):
        clip = pymupdf.Rect(args.x0, args.y0, args.x1, args.y1) & page.rect

    pix = page.get_pixmap(matrix=pymupdf.Matrix(args.zoom, args.zoom), clip=clip, alpha=False)
    if pix.width < 2 or pix.height < 2:
        print("error: empty render", file=sys.stderr)
        sys.exit(1)
    pix.save(args.out)
    print(f"rendered {pix.width}x{pix.height} -> {args.out}")


if __name__ == "__main__":
    main()
