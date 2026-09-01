import fs from "node:fs";
import path from "node:path";
import { CONFIG, DIRS } from "./config";
import { runPython } from "./pyrun";
import type { FigureCandidate } from "./structure";

/**
 * Figure rendering: crop each question's figure region from the PDF page at a
 * zoom that preserves readability (aspect ratio always preserved). Vector and
 * raster content render identically since we rasterize the page region.
 */
export async function renderFigure(
  pdfPath: string,
  fig: FigureCandidate,
  outPath: string
): Promise<void> {
  const [x0, y0, x1, y1] = fig.bbox;
  const widthPt = Math.max(4, x1 - x0);
  const zoom = Math.min(CONFIG.renderZoom, Math.max(0.5, CONFIG.maxImageWidth / widthPt));
  const args = [
    pdfPath,
    String(fig.page),
    outPath,
    "--zoom",
    zoom.toFixed(3),
    "--x0",
    x0.toFixed(2),
    "--y0",
    y0.toFixed(2),
    "--x1",
    x1.toFixed(2),
    "--y1",
    y1.toFixed(2),
  ];
  await runPython("render_region.py", args);
}

export async function renderPage(
  pdfPath: string,
  page: number,
  outPath: string
): Promise<void> {
  await runPython("render_region.py", [pdfPath, String(page), outPath, "--zoom", "2"]);
}

/** Render a full page to a base64 PNG (for LLM vision on scanned pages). */
export async function renderPageB64(pdfPath: string, page: number): Promise<string> {
  const out = path.join(DIRS.cache, `page-${path.basename(pdfPath)}-${page}.png`);
  await renderPage(pdfPath, page, out);
  return fs.readFileSync(out).toString("base64");
}

/** Render a figure into the dry-run image dir; returns relative local path. */
export async function renderFigureLocal(
  year: number,
  questionNumber: number,
  imageIndex: number,
  pdfPath: string,
  fig: FigureCandidate
): Promise<string | null> {
  const dir = path.join(DIRS.images, String(year));
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `q${String(questionNumber).padStart(2, "0")}-${imageIndex}.png`);
  try {
    await renderFigure(pdfPath, fig, out);
    return out;
  } catch (err) {
    console.warn(`    ! figure render failed for Q${questionNumber} img${imageIndex}: ${(err as Error).message}`);
    return null;
  }
}
