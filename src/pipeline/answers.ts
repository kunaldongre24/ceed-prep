import type { Line, PageInfo, PdfStructure, Span } from "./pdfjson";
import { HEADER_BAND, FOOTER_BAND } from "./structure";

/**
 * Answer-key extraction from key pages.
 *
 * Formats observed in the actual PDFs (all handled by one coordinate-based
 * number→value pairer, with section attribution from the table headers):
 * - 2020/2022/2023/2025/2026: 1-page tables, "Q.No | KEY(RANGE)" column pairs
 *   under "SECTION – I (NAT)" / "II (MSQ)" / "III (MCQ)" blocks; NAT values as
 *   exact numbers or ranges ("126 to 128"), MSQ as "A, B, C", alternates like
 *   "B or B, D", plus a "DROPPED" entry (2025 final key).
 * - 2017: three side-by-side column lists ("Section I: NAT" ...), MSQ keys
 *   concatenated ("11 AD"), NAT ranges ("10 250.5 to 251.5").
 * - 2018: flat "Q / Answer" list, semicolon sets ("9 C;D"), alternates
 *   ("11 A;B;D or B;D", "33 A or B").
 * - 2022: answers embedded inline in the paper ("Answer: B, D") — captured by
 *   structure.ts, not here.
 * - 2015/2016/2019/2021 keys are scans/images → not parseable as text.
 */

export interface ParsedKeyEntry {
  number: number;
  raw: string;
  kind: "letters" | "number" | "range" | "dropped" | "unknown";
  /** For letters: every accepted correct set (primary first). */
  acceptedSets: string[][];
  value?: number;
  min?: number;
  max?: number;
  dropped?: boolean;
  /** Key-table section this entry came from ("I"/"II"/"III" + NAT/MSQ/MCQ). */
  keySection?: { key: string; typeHint: "numeric" | "multiple_choice" | "single_choice" } | null;
}

export interface ParsedKey {
  entries: Map<number, ParsedKeyEntry>;
  issues: string[];
}

interface Fragment {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface SectionHeader {
  key: string;
  typeHint: "numeric" | "multiple_choice" | "single_choice";
  x: number;
  y: number;
}

interface ColumnRange {
  x0: number;
  x1: number;
}

/** Locate "Q. No." / "KEY" column-header spans to derive column roles. */
function findColumnHeaders(page: PageInfo): { qCols: ColumnRange[]; headerY: number[] } {
  const qCols: ColumnRange[] = [];
  const headerY: number[] = [];

  // Column headers appear in several observed forms:
  //  - merged single span  "Q.No." / "Q.No" / "Q No."  (2020+ MCQ/MSQ, 2023+)
  //  - lone "Q" / "Q." with a "No." span directly below  (2020/2023 NAT)
  //  - lone "Q" with number rows directly below  (2018 flat 2-col list)
  const isQHeader = (t: string) => /^(Q\s*[.]?\s*No\.?|Question\s*No\.?|Q)$/i.test(t.trim());

  const headers: { x0: number; x1: number; y: number; text: string }[] = [];
  for (const line of page.lines) {
    if (line.bbox[1] <= HEADER_BAND || line.bbox[3] >= page.height - FOOTER_BAND) continue;
    for (const span of line.spans) {
      const t = span.text.trim();
      if (isQHeader(t)) headers.push({ x0: span.bbox[0], x1: span.bbox[2], y: line.bbox[1], text: t });
    }
  }

  const isLoneQ = (t: string) => /^Q\.?$/i.test(t);
  const hasNoBelow = (h: { x0: number; x1: number; y: number }): boolean => {
    for (const other of page.lines) {
      if (other.bbox[1] <= h.y) continue;
      if (other.bbox[1] > h.y + 40) break;
      for (const span of other.spans) {
        if (/^No\.?$/i.test(span.text.trim()) && h.x0 < span.bbox[2] && span.bbox[0] < h.x1) {
          return true;
        }
      }
    }
    return false;
  };
  // A lone "Q"/"Q." is a header if a "No." is below it OR if it has numeric
  // rows below it in the same column (2018 flat list).
  const hasNumberRowsBelow = (h: { x0: number; x1: number; y: number }): boolean => {
    let count = 0;
    for (const line of page.lines) {
      if (line.bbox[1] <= h.y + 8) continue;
      if (count >= 2) return true;
      for (const span of line.spans) {
        const t = span.text.trim();
        if (/^\d{1,2}$/.test(t)) {
          const cx = (span.bbox[0] + span.bbox[2]) / 2;
          if (h.x0 < span.bbox[2] && span.bbox[0] < h.x1) {
            count++;
            break;
          }
        }
      }
    }
    return count >= 2;
  };

  for (const h of headers) {
    if (isLoneQ(h.text)) {
      if (!hasNoBelow(h) && !hasNumberRowsBelow(h)) continue;
    }
    qCols.push({ x0: h.x0, x1: h.x1 });
    headerY.push(h.y);
  }

  qCols.sort((a, b) => a.x0 - b.x0);
  // Deduplicate columns sharing the same x-range (repeated header rows).
  const deduped: ColumnRange[] = [];
  for (const c of qCols) {
    if (!deduped.some((d) => Math.abs(d.x0 - c.x0) < 6 && Math.abs(d.x1 - c.x1) < 6)) {
      deduped.push(c);
    }
  }

  return { qCols: deduped.length > 0 ? deduped : qCols, headerY };
}

export function parseAnswerKeyPage(page: PageInfo): ParsedKey {
  const issues: string[] = [];
  const fragments = collectFragments(page);
  const entries = new Map<number, ParsedKeyEntry>();
  const sectionHeaders = findSectionHeaders(page);
  const { qCols } = findColumnHeaders(page);

  if (process.env.KEY_DEBUG) {
    for (const f of fragments.filter((x) => x.y0 < 160)) {
      console.log(`[kf] '${f.text}' x=${f.x0.toFixed(0)}-${f.x1.toFixed(0)} y=${f.y0.toFixed(0)}-${f.y1.toFixed(0)}`);
    }
  }
  const isPureNumber = (f: Fragment) => /^\d{1,2}$/.test(f.text);
  const numberFrags = fragments.filter(
    (f) => isPureNumber(f) && f.y0 > HEADER_BAND && f.y1 < page.height - FOOTER_BAND
  );
  const centerIn = (f: Fragment, c: ColumnRange, pad = 8) => {
    const cx = (f.x0 + f.x1) / 2;
    return cx >= c.x0 - pad && cx <= c.x1 + pad;
  };

  const { values: gridValues, labels: gridLabels } = pairByGrid(fragments);

  // When a Q-column grid is detected, iterate only over genuine question
  // numbers (their labels sit in Q columns). This prevents a numeric VALUE
  // that happens to equal a question number from spawning a spurious entry.
  const gridQs = [...gridValues.keys()].sort((a, b) => a - b);
  const iterateLabels = gridQs.length > 0;
  const candidateNums = iterateLabels
    ? gridQs
    : numberFrags.map((f) => Number(f.text)).filter((x) => x >= 1 && x <= 60);

  const seen = new Set<number>();
  for (const n of candidateNums) {
    if (seen.has(n)) continue;
    seen.add(n);
    // Locate a fragment carrying this number (prefer the genuine Q label).
    const num =
      gridLabels.get(n) ??
      numberFrags.find((f) => Number(f.text) === n) ??
      null;
    if (!num) continue;

    // Primary: row + column aware grid pairing (handles 2017 headerless grids,
    // 2018 single-column lists, and 2020/2023/2026 header-driven tables).
    let value: Fragment[] | null = gridValues.get(n) ?? null;

    // Fallback for values that hang directly beneath the Q number (e.g.
    // DROPPED notes) or layouts the grid pairing misses.
    if (!value) {
      value = findValueForNumber(fragments, num, n);
      if (!value && qCols.length >= 1) {
        const col = qCols.find((c) => centerIn(num, c));
        if (col) {
          value = valueUnderCol(fragments, num, col);
        }
      }
    }
    if (!value) continue;

    const raw = value.map((f) => f.text).join(" ").trim();
    if (!raw) continue;
    if (/^(Q|No|KEY|Key Range|Answer)$/i.test(raw)) continue;

    const parsed = parseValueText(raw, issues, n);
    const header = sectionForPair(sectionHeaders, num);
    if (header) {
      parsed.keySection = { key: header.key, typeHint: header.typeHint };
    }
    const existing = entries.get(n);
    if (existing && existing.raw === raw) continue;
    entries.set(n, parsed);
  }

  return { entries, issues };
}

/** "SECTION – I (NAT)" (2020+ tables) and "Section I: NAT" (2017) headers. */
function findSectionHeaders(page: PageInfo): SectionHeader[] {
  const headers: SectionHeader[] = [];
  for (const line of page.lines) {
    // Section titles may sit at the top of the page (e.g. "SECTION - I (NAT)"
    // near y68 in 2023), so only the footer is excluded here; the running page
    // header never matches the section regex below.
    if (line.bbox[3] >= page.height - FOOTER_BAND) continue;
    const text = line.text;
    const m =
      /SECTION\s*[-–¡|]?\s*([IVX0-9]+)\s*\(?\s*(NAT|MSQ|MCQ|Numerical|Multiple\s*Select|Multiple\s*Choice)?/i.exec(
        text
      ) ??
      /^Section\s+([IVX0-9]+)\s*:\s*(NAT|MSQ|MCQ|Numerical|Multiple\s*Select|Multiple\s*Choice)/i.exec(
        text
      );
    if (!m) continue;
    const label = (m[2] ?? "").trim();
    const typeHint = /NAT|Numerical/i.test(label)
      ? "numeric"
      : /MSQ|Multiple\s*Select/i.test(label)
        ? "multiple_choice"
        : /MCQ|Multiple\s*Choice/i.test(label)
          ? "single_choice"
          : null;

    // x position of where the match starts (approximate via spans)
    const spanStartX = spanXForCharIndex(line, m.index);

    headers.push({
      key: m[1].toUpperCase(),
      // Type unknown from the label alone: infer from roman numeral order
      // (I=NAT, II=MSQ, III=MCQ holds in every observed key table).
      typeHint:
        typeHint ??
        (m[1].toUpperCase() === "I"
          ? "numeric"
          : m[1].toUpperCase() === "II"
            ? "multiple_choice"
            : "single_choice"),
      x: spanStartX,
      y: line.bbox[1],
    });
  }
  return headers;
}

function spanXForCharIndex(line: Line, charIndex: number): number {
  let offset = 0;
  for (const span of line.spans) {
    if (charIndex >= offset && charIndex <= offset + span.text.length) {
      const rel = (charIndex - offset) / Math.max(1, span.text.length);
      return span.bbox[0] + rel * (span.bbox[2] - span.bbox[0]);
    }
    offset += span.text.length;
  }
  return line.bbox[0];
}

/** Nearest section header governing a pair. Sections are anchored by their
 *  horizontal position and vertical order.
 *  - 2020+ tables: all section titles sit at ~the same x at distinct y; a
 *    question takes the highest (nearest above) header in that x-group.
 *  - 2017 grid: headers are anchored to different column bands ("Section I:
 *    NAT" left, "Section III: MCQ" right) at possibly different y; a question
 *    belongs to the x-group it falls in and takes the highest header there. */
function sectionForPair(headers: SectionHeader[], num: Fragment): SectionHeader | null {
  if (headers.length === 0) return null;

  // Group headers by horizontal anchor.
  const numCx = (num.x0 + num.x1) / 2;
  const groups: { cx: number; items: SectionHeader[] }[] = [];
  for (const h of [...headers].sort((a, b) => a.x - b.x)) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g.cx - h.x) <= 60) {
      g.items.push(h);
      g.cx = (g.cx * (g.items.length - 1) + h.x) / g.items.length;
    } else {
      groups.push({ cx: h.x, items: [h] });
    }
  }

  // Find the x-group nearest the question's horizontal center.
  let nearest = groups[0];
  let bestDist = Infinity;
  for (const g of groups) {
    const d = Math.abs(g.cx - numCx);
    if (d < bestDist) {
      bestDist = d;
      nearest = g;
    }
  }

  // Within the question's x-group, take the highest header above/left-aligned.
  const cands = nearest.items.filter(
    (h) => h.y < num.y0 - 2 || (Math.abs(h.y - num.y0) <= 10 && h.x <= num.x0 + 5)
  );
  if (cands.length === 0) return null;
  cands.sort((a, b) => a.y - b.y);
  return cands[cands.length - 1];
}

function collectFragments(page: PageInfo): Fragment[] {
  const frags: Fragment[] = [];
  for (const line of page.lines) {
    if (line.bbox[1] <= HEADER_BAND || line.bbox[3] >= page.height - FOOTER_BAND) continue;
    for (const span of line.spans) {
      frags.push(...splitSpanIntoFragments(span));
    }
  }
  return frags;
}

/**
 * Split span text into fragments: runs of ≥3 spaces (table cell padding)
 * split fragments; single spaces (within "126 to 128") do not.
 */
function splitSpanIntoFragments(span: Span): Fragment[] {
  const out: Fragment[] = [];
  const text = span.text.replace(/\u00a0/g, " ");
  const textLen = Math.max(1, span.text.length);
  const charW = (span.bbox[2] - span.bbox[0]) / textLen;

  let start = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === " ") {
      let j = i;
      while (j < text.length && text[j] === " ") j++;
      if (j - i >= 3) {
        pushFrag(out, text.slice(start, i), span, start, charW);
        start = j;
      }
      i = j;
    } else {
      i++;
    }
  }
  pushFrag(out, text.slice(start), span, start, charW);
  return out.filter((f) => f.text.trim().length > 0);
}

function pushFrag(out: Fragment[], raw: string, span: Span, charStart: number, charW: number): void {
  const lead = raw.length - raw.trimStart().length;
  const s = raw.trim();
  if (!s) return;
  const x0 = span.bbox[0] + charW * (charStart + lead);
  const x1 = x0 + charW * s.length;
  out.push({ text: s, x0, x1, y0: span.bbox[1], y1: span.bbox[3] });
}

/**
 * Value that hangs directly beneath a Q number within its own column (e.g.
 * multi-line or note text in a header-driven table).
 */
function valueUnderCol(
  all: Fragment[],
  num: Fragment,
  col: ColumnRange
): Fragment[] | null {
  const below = all
    .filter(
      (f) =>
        f !== num &&
        f.y0 >= num.y1 - 2 &&
        f.y0 <= num.y1 + 16 &&
        f.x0 >= num.x0 - 40 &&
        f.x0 <= num.x1 + 45
    )
    .sort((a, b) => a.x0 - b.x0);
  if (below.length === 0) return null;
  const run: Fragment[] = [];
  let cursor = below[0].x0 - 1;
  for (const f of below) {
    if (f.x0 - cursor > 18) break;
    run.push(f);
    cursor = f.x1;
  }
  return run.length > 0 ? run : null;
}

/**
 * Row- and column-aware grid pairing. Fragments are grouped into rows by
 * vertical position; Q columns are detected by clustering the pure-number
 * question labels that must form an increasing, mostly-consecutive sequence.
 * Within a row, walking left to right, everything between one Q label and the
 * next Q label (or the end of the row) becomes that question's value. This
 * robustly handles wide values (e.g. "250.5 to 251.5") and values that are
 * themselves small numbers, because they are captured by position between
 * Q columns, not by matching the Q number.
 */
function pairByGrid(all: Fragment[]): { values: Map<number, Fragment[]>; labels: Map<number, Fragment> } {
  const values = new Map<number, Fragment[]>();
  const labels = new Map<number, Fragment>();
  const rows = groupRows(all);
  const qCols = detectQColumns(all);

  if (qCols.length === 0) return { values, labels };

  const inQCol = (f: Fragment) =>
    qCols.some((c) => {
      const cx = (f.x0 + f.x1) / 2;
      return cx >= c.x0 - 8 && cx <= c.x1 + 8;
    });

  for (const row of rows) {
    const sorted = [...row].sort((a, b) => a.x0 - b.x0);
    let curQ: Fragment | null = null;
    let accum: Fragment[] = [];
    for (const f of sorted) {
      // Wait to swallow a Q label's own number: a Q label marks a new slot.
      if (inQCol(f) && /^\d{1,2}$/.test(f.text) && Number(f.text) >= 1 && Number(f.text) <= 60) {
        if (curQ && accum.length > 0) values.set(Number(curQ.text), accum);
        curQ = f;
        labels.set(Number(f.text), f);
        accum = [];
      } else if (curQ) {
        // A fragment in another Q column but not a number (e.g. a value column)
        // still belongs to the current Q unless it is itself a Q label. Skip
        // fragments that sit in a Q column's x-range (those are other slots).
        if (!qCols.some((c) => {
          const cx = (f.x0 + f.x1) / 2;
          return cx >= c.x0 - 4 && cx <= c.x1 + 4;
        })) {
          accum.push(f);
        }
      }
    }
    if (curQ && accum.length > 0) values.set(Number(curQ.text), accum);
  }
  return { values, labels };
}

/** Group fragments into rows by vertical center (tolerance ~9pt). */
function groupRows(all: Fragment[]): Fragment[][] {
  const rows: Fragment[][] = [];
  const sortable = [...all].sort((a, b) => a.y0 - b.y0);
  for (const f of sortable) {
    const cy = (f.y0 + f.y1) / 2;
    let placed = false;
    for (const row of rows) {
      const rcy = (row[0].y0 + row[0].y1) / 2;
      if (Math.abs(rcy - cy) <= 9) {
        row.push(f);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([f]);
  }
  return rows;
}

/** Detect Q columns from clusters of question-number labels. A column is a Q
 *  column when its numbers increase as you move down the page (row position).
 *  This holds both for consecutive runs (2017: 1..20, 21..45) and for table
 *  layouts where each column steps by the number of columns (2020: 1,6,11,..).
 *  Value columns contain numbers that jump around, so they are rejected. */
function detectQColumns(all: Fragment[]): ColumnRange[] {
  const nums = all.filter(
    (f) => /^\d{1,2}$/.test(f.text) && Number(f.text) >= 1 && Number(f.text) <= 60
  );
  if (nums.length === 0) return [];

  // Cluster by x-center (compact labels cluster cleanly).
  const CLUSTER = 24;
  const bands: { cx: number; frags: Fragment[] }[] = [];
  for (const f of nums) {
    const cx = (f.x0 + f.x1) / 2;
    let placed = false;
    for (const b of bands) {
      if (Math.abs(b.cx - cx) <= CLUSTER) {
        b.frags.push(f);
        b.cx = (b.cx + cx) / 2;
        placed = true;
        break;
      }
    }
    if (!placed) bands.push({ cx, frags: [f] });
  }

  const out: ColumnRange[] = [];
  for (const b of bands) {
    if (b.frags.length < 6) continue;
    const byY = [...b.frags].sort((a, c) => a.y0 - c.y0);
    const vals = byY.map((f) => Number(f.text));
    let monotonic = true;
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] < vals[i - 1]) {
        monotonic = false;
        break;
      }
    }
    if (!monotonic) continue;
    const x0 = Math.min(...b.frags.map((f) => f.x0));
    const x1 = Math.max(...b.frags.map((f) => f.x1));
    out.push({ x0, x1 });
  }
  return out;
}

/**
 * Legacy fallback (2017/2018 plain lists): contiguous right-hand run, but a
 * lone number that looks like the NEXT question's label is not a value.
 */
function findValueForNumber(all: Fragment[], num: Fragment, n: number): Fragment[] | null {
  const yOverlap = (a: Fragment, b: Fragment) =>
    Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.4 * Math.min(a.y1 - a.y0, b.y1 - b.y0);

  // Same-line run to the right
  const sameLine = all
    .filter((f) => f !== num && f.x0 >= num.x1 - 2 && f.x0 <= num.x1 + 45 && yOverlap(num, f))
    .sort((a, b) => a.x0 - b.x0);
  const run: Fragment[] = [];
  let cursor = num.x1;
  for (const f of sameLine) {
    if (f.x0 - cursor > 16) break;
    run.push(f);
    cursor = f.x1;
  }
  // A single pure number one-to-eight above n is the next column's Q label.
  if (run.length === 1 && /^\d{1,2}$/.test(run[0].text)) {
    const m = Number(run[0].text);
    if (m > n && m <= n + 8) return null;
  }
  if (run.length > 0) return run;

  // Hanging run below (wrapped value / DROPPED note). Must NOT capture a
  // pure number that is, by geometry, the NEXT question's label (a value that
  // is itself a question number sits in a DISTINCT column from the Q labels).
  const below = all
    .filter(
      (f) =>
        f !== num &&
        f.y0 >= num.y1 - 2 &&
        f.y0 <= num.y1 + 16 &&
        f.x0 >= num.x0 - 40 &&
        f.x0 <= num.x1 + 45
    )
    .sort((a, b) => a.x0 - b.x0);
  const run2: Fragment[] = [];
  let cursor2 = num.x0 - 40;
  for (const f of below) {
    if (run2.length > 0 && f.x0 - cursor2 > 16) break;
    run2.push(f);
    cursor2 = f.x1;
  }
  // Filter out a below-fragment that is a pure number 1..60 whose x-center is
  // aligned with the Q-label column (it is the next question's number, not a
  // value). A genuine numeric value sits in a different column band (>= 30pt
  // to the right of the Q column in 2017/2018).
  const valueRun = run2.filter((f) => {
    if (!/^\d{1,2}$/.test(f.text)) return true;
    const n2 = Number(f.text);
    if (n2 <= n || n2 > n + 8) return true;
    const cx = (f.x0 + f.x1) / 2;
    const numCx = (num.x0 + num.x1) / 2;
    // If it overlaps the Q column x-band, it is a label, not a value.
    return !(f.x0 < num.x1 + 6 && num.x0 - 6 < f.x1) && cx - numCx >= 25;
  });
  return valueRun.length > 0 ? valueRun : null;
}

export function parseValueText(raw: string, issues: string[], n: number): ParsedKeyEntry {
  const base: ParsedKeyEntry = { number: n, raw, kind: "unknown", acceptedSets: [] };

  if (/dropped/i.test(raw)) return { ...base, kind: "dropped", dropped: true };

  // Alternate sets split on "or"
  const parts = raw
    .split(/\bor\b/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    const sets = parts.map((p) => lettersOf(p));
    if (sets.every((s) => s.length > 0)) {
      return { ...base, kind: "letters", acceptedSets: sets };
    }
  }

  // Numeric range: "126 to 128", "250.5 to 251.5", "6-6.5"
  const range = /^(-?\d+(?:\.\d+)?)\s*(?:to|-|–|—)\s*(-?\d+(?:\.\d+)?)$/i.exec(raw);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return { ...base, kind: "range", min: Math.min(min, max), max: Math.max(min, max) };
  }

  // Single number
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    return { ...base, kind: "number", value: Number(raw) };
  }

  // Letters ("A, B, C" / "A,B,C" / "AD" / "C;D")
  const letters = lettersOf(raw);
  if (letters.length > 0) {
    return { ...base, kind: "letters", acceptedSets: [letters] };
  }

  issues.push(`Q${n}: unrecognized answer-key value "${raw}" — needs review.`);
  return base;
}

/** "A, B, C" | "A,B,C" | "C;D" | "AD" → ["A","B","C"] */
function lettersOf(text: string): string[] {
  const cleaned = text.toUpperCase().replace(/[^A-D]/g, "");
  return [...new Set(cleaned.split(""))].sort();
}

export function parseAnswerKey(structure: PdfStructure, keyPage: number): ParsedKey {
  const page = structure.pages.find((p) => p.page === keyPage) ?? structure.pages[0];
  return parseAnswerKeyPage(page);
}
