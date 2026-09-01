import type { Line, PageInfo, PdfStructure } from "./pdfjson";
import type { QuestionType } from "./types";

/**
 * Parses a question paper's extracted structure into Part A questions.
 *
 * Ground rules derived from the actual PDFs:
 * - Top-level parts are "Part A"/"Part B"; Part A contains "Section I/II/III"
 *   (NAT / MSQ / MCQ; 2018 has five sections incl. NAT2/MSQ2).
 * - Question labels: "Q.01", "Q.9", "Q 22"; occasionally two labels share a line
 *   ("Q.34 Q.35") and occasionally the label is an image (2022/2025).
 * - Options are labeled "A." "B." "C." "D.", inline on one line when short or
 *   wrapped across lines when long. We never assume a fixed option count.
 * - 2022 embeds "Answer: X" lines under each question.
 * - Footers ("CEED 2026 | Question Paper |4 of 29") and header bands must not
 *   leak into stems.
 */

export interface FigureCandidate {
  page: number; // 1-based
  bbox: [number, number, number, number];
}

export interface ParsedQuestion {
  number: number;
  subSection: string | null;
  typeHint: QuestionType | "unknown";
  stem: string;
  rawText: string;
  options: { key: string; text: string }[];
  rawAnswer: string | null; // 2022-style inline "Answer: X"
  sourcePages: number[];
  pageYRanges: { page: number; y0: number; y1: number }[];
  figures: FigureCandidate[];
  notes: string[];
  labelMissing: boolean;
}

export interface SectionInfo {
  key: string; // "I" | "II" | ...
  label: string;
  typeHint: QuestionType;
  page: number;
  y: number;
}

export interface ParsedPaper {
  year: number | null;
  pageCount: number;
  textQuality: "clean" | "scanned" | "corrupt";
  partAStartPage: number | null;
  partBStartPage: number | null;
  sections: SectionInfo[];
  questions: ParsedQuestion[];
  issues: string[];
}

export const HEADER_BAND = 72; // pt from top: running header zone
export const FOOTER_BAND = 58; // pt from bottom: running footer zone

interface FlatLine {
  page: PageInfo;
  line: Line;
}

export function parsePaper(structure: PdfStructure, year: number | null): ParsedPaper {
  rangePageCache = new Map(structure.pages.map((p) => [p.page, p]));
  const charsPerPage = structure.textStats.chars / Math.max(1, structure.pageCount);
  const textQuality: ParsedPaper["textQuality"] =
    charsPerPage < 120 ? "scanned" : looksCorrupt(structure) ? "corrupt" : "clean";

  const paper: ParsedPaper = {
    year,
    pageCount: structure.pageCount,
    textQuality,
    partAStartPage: null,
    partBStartPage: null,
    sections: [],
    questions: [],
    issues: [],
  };

  if (textQuality !== "clean") {
    paper.issues.push(
      textQuality === "scanned"
        ? "Paper appears to be scanned images — deterministic text extraction impossible."
        : "Paper text is corrupt (broken font→unicode maps) — deterministic extraction unreliable."
    );
    return paper;
  }

  const pages = structure.pages;

  // --- Pass 1: section headers & part boundaries ---
  let partAStarted = false;
  for (const page of pages) {
    for (const line of contentLines(page)) {
      const text = cleanText(line.text);

      // Instruction pages mention "Part A"/"Part B" in prose; a real Part B
      // boundary only exists after actual section headers were found.
      if (/^Part\s+B\b/i.test(text) && paper.sections.length > 0 && paper.partBStartPage === null) {
        paper.partBStartPage = page.page;
      }
      const sec =
        /^Part\s+A\s*\S?\s*Section\s+([IVX0-9]+)\s*[:\-]?\s*(.*)$/i.exec(text) ??
        (partAStarted ? /^Section\s+([IVX0-9]+)\s*[:\-]\s*(.*)$/i.exec(text) : null);
      if (sec && paper.partBStartPage === null) {
        if (!partAStarted) paper.partAStartPage = page.page;
        partAStarted = true;
        if (!paper.sections.some((s) => s.key === sec[1].toUpperCase() && s.page === page.page)) {
          paper.sections.push({
            key: sec[1].toUpperCase(),
            label: sec[2].trim(),
            typeHint: sectionTypeHint(sec[2]),
            page: page.page,
            y: line.bbox[1],
          });
        }
      }
      if (/^Part\s+A\b/i.test(text) && !partAStarted) partAStarted = true;
    }
  }

  if (paper.sections.length === 0) {
    paper.issues.push("No Part A section headers detected.");
    return paper;
  }
  if (paper.partBStartPage === null) {
    paper.issues.push("No Part B boundary detected — using end of document.");
  }

  // --- Pass 2: question label starts within Part A ---
  const partAEndPage = paper.partBStartPage ?? pages.length + 1;
  const partAPages = pages.filter(
    (p) => p.page >= (paper.partAStartPage ?? 1) && p.page < partAEndPage
  );

  interface QStart {
    page: number;
    flatIndex: number;
    number: number;
  }
  const flatLines: FlatLine[] = [];
  for (const page of partAPages) {
    for (const line of contentLines(page)) flatLines.push({ page, line });
  }

  const starts: QStart[] = [];
  flatLines.forEach((f, flatIndex) => {
    for (const m of findAllQuestionLabels(f.line.text)) {
      starts.push({ page: f.page.page, flatIndex, number: m });
    }
  });

  // Monotonic sequence: drop out-of-order labels (stems referencing "Q.5" etc.)
  const validStarts: QStart[] = [];
  for (const s of starts) {
    const last = validStarts[validStarts.length - 1];
    if (last && s.number <= last.number) continue;
    validStarts.push(s);
  }

  if (validStarts.length === 0) {
    paper.issues.push("No question labels detected inside Part A.");
    return paper;
  }

  // --- Build question blocks ---
  for (let i = 0; i < validStarts.length; i++) {
    const start = validStarts[i];
    const next = validStarts[i + 1];
    const fromIdx = start.flatIndex;
    const toIdx = next ? next.flatIndex : flatLines.length;
    const block = flatLines.slice(fromIdx, toIdx);
    paper.questions.push(
      buildQuestion(start.number, block, paper, next ? flatLines[next.flatIndex] : undefined)
    );
  }

  // --- Labels rendered as images (e.g. CEED 2022 Q.22) → detect gaps ---
  const present = new Set(paper.questions.map((q) => q.number));
  const min = Math.min(...present);
  const max = Math.max(...present);
  for (let n = min; n <= max; n++) {
    if (!present.has(n)) {
      paper.questions.push(missingQuestion(n, paper));
      paper.issues.push(
        `Q${n}: question label likely rendered as an image — needs manual/LLM review.`
      );
    }
  }
  paper.questions.sort((a, b) => a.number - b.number);

  return paper;
}

function contentLines(page: PageInfo): Line[] {
  return page.lines.filter((l) => !isChromeLine(l.bbox, page));
}

function isChromeLine(bbox: [number, number, number, number], page: PageInfo): boolean {
  const [, y0, , y1] = bbox;
  if (y1 <= HEADER_BAND) return true;
  if (y0 >= page.height - FOOTER_BAND) return true;
  return false;
}

function missingQuestion(n: number, paper: ParsedPaper): ParsedQuestion {
  return {
    number: n,
    subSection: null,
    typeHint: "unknown",
    stem: "",
    rawText: "",
    options: [],
    rawAnswer: null,
    sourcePages: [],
    pageYRanges: [],
    figures: [],
    notes: ["Question label not present as text (image-rendered label); content not extracted."],
    labelMissing: true,
  };
}

function buildQuestion(
  number: number,
  block: FlatLine[],
  paper: ParsedPaper,
  nextBlockStart?: FlatLine
): ParsedQuestion {
  const notes: string[] = [];

  // First line: strip the Q-label prefix
  const firstLine = block[0].line;
  const firstText = cleanText(firstLine.text.replace(/^Q\s*[.]?\s*\d{1,2}\s*/i, ""));

  // Body lines; capture 2022-style inline answers
  let rawAnswer: string | null = null;
  const bodyLines: string[] = [firstText];
  for (let i = 1; i < block.length; i++) {
    const text = cleanText(block[i].line.text);
    const ans = /^Answer\s*[:\-]\s*(.+)$/i.exec(text);
    if (ans) {
      rawAnswer = ans[1].trim();
      continue;
    }
    bodyLines.push(text);
  }

  // --- Option splitting (line-start labels and inline single-line sets) ---
  const { stem, options } = splitStemAndOptions(bodyLines, notes);

  const subSection = sectionForQuestion(paper, block[0]);
  const typeHint = paper.sections.find((s) => s.key === subSection)?.typeHint ?? "unknown";

  // --- Per-page y ranges + figure association ---
  // A question owns its region down to where the NEXT question starts (its
  // label line), so figures printed below the stem are inside the range.
  const pageYRanges = computePageYRanges(block, nextBlockStart);
  const figures = associateFigures(pageYRanges);

  if (
    /\b(shown|given)\s+(below|above)\b|following (figure|image|diagram)|image of/i.test(stem) &&
    figures.length === 0
  ) {
    notes.push("Stem references a figure but no embedded image was found in its region.");
  }

  const sourcePages = [...new Set(pageYRanges.map((r) => r.page))].sort((a, b) => a - b);
  const rawText = block.map((f) => cleanText(f.line.text)).join("\n");

  return {
    number,
    subSection,
    typeHint,
    stem,
    rawText,
    options,
    rawAnswer,
    sourcePages,
    pageYRanges,
    figures,
    notes,
    labelMissing: false,
  };
}

interface OptionStart {
  lineIdx: number;
  charIdx: number; // index of the label letter itself
  textIdx: number; // index where the option's text begins (after "A. ")
  key: string;
}

function findOptionStartsInLine(text: string): OptionStart[] {
  const starts: OptionStart[] = [];
  // Label = start-of-line or space, letter A-D, dot, then spaces or end-of-line.
  const re = /(^|\s)([A-D])\s*[.](?:\s+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const labelIdx = m.index + m[1].length;
    starts.push({
      lineIdx: -1,
      charIdx: labelIdx,
      textIdx: m.index + m[0].length,
      key: m[2].toUpperCase(),
    });
  }
  for (const s of starts) s.lineIdx = 0;
  return starts;
}

function splitStemAndOptions(
  bodyLines: string[],
  notes: string[]
): { stem: string; options: { key: string; text: string }[] } {
  // Mark each line's option starts
  const perLine: OptionStart[][] = bodyLines.map((t) => findOptionStartsInLine(t));
  const totalStarts = perLine.reduce((acc, arr) => acc + arr.length, 0);

  if (totalStarts < 2) {
    return { stem: cleanText(bodyLines.join(" ")), options: [] };
  }

  const options: { key: string; text: string }[] = [];
  let stemParts: string[] = [];
  let current: { key: string; text: string } | null = null;

  bodyLines.forEach((lineText, lineIdx) => {
    const starts = perLine[lineIdx];
    if (starts.length === 0) {
      if (current) current.text += " " + lineText;
      else stemParts.push(lineText);
      return;
    }
    // Text before the first label belongs to stem or the open option
    const first = starts[0];
    const pre = lineText.slice(0, first.charIdx).trim();
    if (pre) {
      if (current) current.text += " " + pre;
      else stemParts.push(pre);
    }
    starts.forEach((s, i) => {
      const next = starts[i + 1];
      const text = lineText.slice(s.textIdx, next ? next.charIdx : lineText.length).trim();
      current = { key: s.key, text };
      options.push(current);
    });
  });

  // Sanity: keys strictly increasing
  const keys = options.map((o) => o.key);
  const ordered = keys.every((k, idx) => idx === 0 || k.charCodeAt(0) > keys[idx - 1].charCodeAt(0));
  if (!ordered) {
    notes.push(`Option keys not in expected order (${keys.join(", ")}) — parse suspect.`);
  }
  if (options.length === 1) {
    notes.push("Only one option label found — treating as no-options question.");
    return { stem: cleanText(bodyLines.join(" ")), options: [] };
  }

  return { stem: cleanText(stemParts.join(" ")), options };
}

function sectionForQuestion(paper: ParsedPaper, start: FlatLine): string | null {
  let current: string | null = null;
  for (const sec of paper.sections) {
    if (sec.page < start.page.page) current = sec.key;
    else if (sec.page === start.page.page && sec.y <= start.line.bbox[1]) current = sec.key;
    else break;
  }
  return current;
}

function sectionTypeHint(label: string): QuestionType {
  if (/NAT|Numerical/i.test(label)) return "numeric";
  if (/MSQ|Multiple Select/i.test(label)) return "multiple_choice";
  if (/MCQ|Multiple Choice/i.test(label)) return "single_choice";
  return "unknown";
}

export function findAllQuestionLabels(text: string): number[] {
  const out: number[] = [];
  const re = /(?:^|\s)Q\s*[.]?\s*(\d{1,2})(?=[\s.:)]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 60) out.push(n);
  }
  return out;
}

/**
 * Per-page y-interval owned by the question: from its label line (or content top
 * on continuation pages) down to the next question's label (or content bottom).
 * Figures "shown below" a stem fall inside this interval.
 */
function computePageYRanges(
  block: FlatLine[],
  nextBlockStart?: FlatLine
): { page: number; y0: number; y1: number }[] {
  const byPage = new Map<number, { page: PageInfo; first: Line; last: Line; count: number }>();
  for (const f of block) {
    const cur = byPage.get(f.page.page);
    if (!cur) byPage.set(f.page.page, { page: f.page, first: f.line, last: f.line, count: 1 });
    else {
      cur.last = f.line;
      cur.count++;
    }
  }

  // Where the next question begins on each page (its label y), if any.
  const nextPageY = new Map<number, number>();
  if (nextBlockStart) {
    nextPageY.set(nextBlockStart.page.page, nextBlockStart.line.bbox[1]);
  }

  return [...byPage.values()].map(({ page, first, count }) => {
    const startsMidPage = first.bbox[1] > HEADER_BAND + 8;
    const y0 = startsMidPage ? first.bbox[1] - 2 : HEADER_BAND;
    const y1ByPage = nextPageY.get(page.page);
    let y1: number;
    if (y1ByPage !== undefined) {
      y1 = y1ByPage - 2; // stop just above the next question's label
    } else {
      y1 = page.height - FOOTER_BAND; // last block on the page: own until footer
    }
    void count;
    return { page: page.page, y0, y1 };
  });
}

function associateFigures(ranges: { page: number; y0: number; y1: number }[]): FigureCandidate[] {
  const candidates: FigureCandidate[] = [];
  for (const range of ranges) {
    const page = rangePageCache.get(range.page);
    if (!page) continue;
    const figures = page.images.filter((img) => {
      const [x0, y0, x1, y1] = img.bbox;
      if (y1 <= HEADER_BAND || y0 >= page.height - FOOTER_BAND) return false; // header/footer art
      const area = (x1 - x0) * (y1 - y0);
      if (area >= 0.85 * page.width * page.height) return false; // full-page scan
      if (x1 - x0 < 20 && y1 - y0 < 20) return false; // tiny icons
      return y1 > range.y0 && y0 < range.y1; // intersects the question interval
    });
    for (const group of mergeAdjacent(figures.map((f) => f.bbox))) {
      candidates.push({ page: range.page, bbox: group });
    }
  }
  return candidates;
}

// Per-parse page lookup for image association (set at the top of parsePaper).
let rangePageCache: Map<number, PageInfo> = new Map();

function mergeAdjacent(
  boxes: [number, number, number, number][],
  gap = 8
): [number, number, number, number][] {
  const items = boxes.map((b) => ({ b, used: false }));
  const groups: [number, number, number, number][] = [];
  for (const item of items) {
    if (item.used) continue;
    item.used = true;
    let [x0, y0, x1, y1] = item.b;
    let grew = true;
    while (grew) {
      grew = false;
      for (const other of items) {
        if (other.used) continue;
        const [ox0, oy0, ox1, oy1] = other.b;
        const intersects =
          x0 - gap < ox1 && ox0 - gap < x1 && y0 - gap < oy1 && oy0 - gap < y1;
        if (intersects) {
          other.used = true;
          x0 = Math.min(x0, ox0);
          y0 = Math.min(y0, oy0);
          x1 = Math.max(x1, ox1);
          y1 = Math.max(y1, oy1);
          grew = true;
        }
      }
    }
    groups.push([x0, y0, x1, y1]);
  }
  return groups.sort((a, b) => a[1] - b[1]);
}

export function cleanText(text: string): string {
  return text
    .replace(/[¡]/g, "-")
    .replace(/[╖]/g, "•")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksCorrupt(structure: PdfStructure): boolean {
  const sample = structure.pages
    .slice(0, Math.min(8, structure.pages.length))
    .map((p) => p.text)
    .join(" ");
  const words = sample.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const realWords = words.filter(
    (w) =>
      /^[A-Za-z][a-zA-Z'-]{1,}$/.test(w) || // normal words (table titles, option text)
      /^[A-D][.,;]?$/.test(w) || // key-table cells ("A,", "B", "D")
      /^\d+([.,]\d+)?$/.test(w) // numeric cells
  ).length;
  return realWords / words.length <= 0.45;
}

