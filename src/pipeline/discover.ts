import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DIRS, ensureDirs } from "./config";
import { runPython } from "./pyrun";
import type { PdfStructure } from "./pdfjson";

export type PdfRole = "question_paper" | "answer_key" | "combined" | "unknown";
export type TextQuality = "clean" | "scanned" | "corrupt";

export interface DiscoveredPdf {
  filePath: string;
  fileName: string;
  year: number | null;
  role: PdfRole;
  keyVariant: "final" | "draft" | null;
  /** PDF page (1-based) where the answer key table starts, for combined/key files. */
  keyPage?: number;
  structurePath: string;
  structure: PdfStructure;
  textQuality: TextQuality;
  charsPerPage: number;
}

export interface PaperPair {
  year: number;
  paper: DiscoveredPdf;
  /** Standalone key file if present. */
  standaloneKey?: DiscoveredPdf;
}

/** Extract structure JSON for every PDF (cached by content hash), then classify. */
export async function discoverPdfs(rootDir: string): Promise<DiscoveredPdf[]> {
  ensureDirs();
  const files = fs
    .readdirSync(rootDir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join(rootDir, f))
    .filter((p) => fs.statSync(p).isFile());

  const results: DiscoveredPdf[] = [];
  for (const filePath of files) {
    const structure = await loadStructureCached(filePath);
    results.push(classify(filePath, structure));
  }
  return results;
}

async function loadStructureCached(filePath: string): Promise<PdfStructure> {
  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
  const cachePath = path.join(DIRS.cache, `${hash}.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf-8")) as PdfStructure;
  }
  const out = path.join(DIRS.cache, `${hash}.json`);
  await runPython("extract_structure.py", [filePath, out], 600_000);
  return JSON.parse(fs.readFileSync(out, "utf-8")) as PdfStructure;
}

function classify(filePath: string, structure: PdfStructure): DiscoveredPdf {
  const fileName = path.basename(filePath);
  const name = fileName.toLowerCase();

  const yearMatch = name.match(/20\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : detectYearFromContent(structure);

  const firstPagesText = structure.pages
    .slice(0, 2)
    .map((p) => p.text)
    .join("\n");

  // Answer keys: standalone 1-page tables OR explicit "answer key" naming.
  const nameSaysKey = /answer/.test(name) && !/question/.test(name);
  const contentSaysKey = /answer\s*key/i.test(firstPagesText) && structure.pageCount <= 2;
  const nameSaysPaper = /paper/.test(name) && structure.pageCount >= 5;
  const role: PdfRole =
    nameSaysKey || contentSaysKey
      ? "answer_key"
      : /question/.test(name) ||
          nameSaysPaper ||
          /question paper/i.test(firstPagesText)
        ? "question_paper"
        : "unknown";

  const keyVariant = /draft/.test(name) ? "draft" : /final/.test(name) ? "final" : null;

  const charsPerPage = structure.textStats.chars / Math.max(1, structure.pageCount);
  const textQuality = detectTextQuality(structure, charsPerPage);

  // Locate embedded answer-key pages inside question-paper files (2024/2025 final pages).
  let keyPage: number | undefined;
  if (role === "question_paper") {
    for (let i = structure.pages.length - 1; i >= Math.max(0, structure.pages.length - 3); i--) {
      if (/answer\s*key/i.test(structure.pages[i].text)) {
        keyPage = structure.pages[i].page;
        break;
      }
    }
  }
  if (role === "answer_key") {
    keyPage = 1;
  }
  const combined = role === "question_paper" && keyPage !== undefined;

  return {
    filePath,
    fileName,
    year,
    role: combined ? "combined" : role,
    keyVariant,
    keyPage,
    structurePath: "",
    structure,
    textQuality,
    charsPerPage,
  };
}

function detectYearFromContent(structure: PdfStructure): number | null {
  for (const page of structure.pages.slice(0, 3)) {
    const m = page.text.match(/CEED\s*(20\d{2})/i);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * 2015 is a scan (junk glyph text); 2016–2019 have broken font→unicode maps that
 * extract as gibberish. Score how much of the text looks like real content
 * (words, letters, or numbers — answer-key tables are mostly numeric cells).
 */
function detectTextQuality(structure: PdfStructure, charsPerPage: number): TextQuality {
  if (charsPerPage < 120) return "scanned";
  const sample = structure.pages
    .slice(0, Math.min(8, structure.pages.length))
    .map((p) => p.text)
    .join(" ");
  const words = sample.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "scanned";
  const realWords = words.filter(
    (w) =>
      /^[A-Za-z][a-zA-Z'-]{1,}$/.test(w) ||
      /^[A-D][.,;]?$/.test(w) ||
      /^\d+([.,]\d+)?$/.test(w)
  ).length;
  const ratio = realWords / words.length;
  return ratio > 0.45 ? "clean" : "corrupt";
}

/** Pair question papers with their answer keys by year (prefer Final over Draft). */
export function pairPdfs(discovered: DiscoveredPdf[]): PaperPair[] {
  const papers = discovered.filter((d) => d.role === "question_paper" || d.role === "combined");
  const keys = discovered.filter((d) => d.role === "answer_key");
  const pairs: PaperPair[] = [];

  for (const paper of papers) {
    if (paper.year === null) continue;
    const candidates = keys.filter((k) => k.year === paper.year);
    const best = pickBestKey(candidates);
    pairs.push({ year: paper.year, paper, standaloneKey: best });
  }
  pairs.sort((a, b) => a.year - b.year);
  return pairs;
}

function pickBestKey(candidates: DiscoveredPdf[]): DiscoveredPdf | undefined {
  if (candidates.length === 0) return undefined;
  const score = (k: DiscoveredPdf) =>
    (k.keyVariant === "final" ? 2 : k.keyVariant === "draft" ? 1 : 0) + (k.textQuality === "clean" ? 1 : 0);
  return candidates.sort((a, b) => score(b) - score(a))[0];
}
