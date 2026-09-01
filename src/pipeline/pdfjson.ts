/** Types for the JSON produced by python/extract_structure.py. */

export interface Span {
  text: string;
  bbox: [number, number, number, number]; // x0,y0,x1,y1 (top-left origin)
  font: string;
  size: number;
}

export interface Line {
  bbox: [number, number, number, number];
  text: string;
  spans: Span[];
}

export interface Block {
  index: number;
  bbox: [number, number, number, number];
  text: string;
}

export interface PageInfo {
  page: number; // 1-based
  width: number;
  height: number;
  text: string;
  blocks: Block[];
  lines: Line[];
  images: {
    xref: number;
    bbox: [number, number, number, number];
    pxWidth: number;
    pxHeight: number;
  }[];
}

export interface PdfStructure {
  file: string;
  pageCount: number;
  textStats: { chars: number };
  pages: PageInfo[];
}

export function bboxArea(b: [number, number, number, number]): number {
  return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
}

export function bboxesOverlapY(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  return a[1] < b[3] && b[1] < a[3];
}

export function bboxContainsY(
  outer: [number, number, number, number],
  y0: number,
  y1: number
): boolean {
  return outer[1] <= y0 + 2 && outer[3] >= y1 - 2;
}
