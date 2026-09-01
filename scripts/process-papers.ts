/**
 * CEED question paper import pipeline.
 *
 *   pnpm process-papers
 *
 * Pipeline: find PDFs → classify → pair → analyze structure → detect Part A →
 * extract questions/options/figures → parse answer keys → match → validate →
 * (GPT-5.6-sol only where deterministic extraction fails) → persist to Supabase
 * (or dry-run JSON when Supabase env is absent) → print a processing report.
 */

import fs from "node:fs";
import path from "node:path";
import { CONFIG, ROOT, ensureDirs, hasLlm, hasSupabase } from "../src/pipeline/config";
import { discoverPdfs, pairPdfs, type DiscoveredPdf, type PaperPair } from "../src/pipeline/discover";
import { parsePaper, type ParsedPaper } from "../src/pipeline/structure";
import { parseAnswerKey, parseValueText } from "../src/pipeline/answers";
import { matchPaperWithKey, skeletonQuestionsFromKey } from "../src/pipeline/match";
import { renderPageB64 } from "../src/pipeline/images";
import { extractQuestionsFromPage, parseKeyFromPage, type LlmQuestion } from "../src/pipeline/llm";
import { persistYear } from "../src/pipeline/upsert";
import { buildYearReport, printReport, writeReportFile, type YearReport } from "../src/pipeline/report";
import type { AnswerSchema, ExtractedQuestion } from "../src/pipeline/types";

function loadDotEnv(): void {
  const envPath = path.join(ROOT, ".env");
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env — fine */
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  ensureDirs();

  console.log("Discovering PDFs…");
  const discovered = await discoverPdfs(ROOT);
  const pairs = pairPdfs(discovered);

  console.log(
    `Found ${discovered.length} PDFs; paired ${pairs.length} question papers: ` +
      pairs.map((p) => p.year).join(", ")
  );
  for (const d of discovered) {
    console.log(
      `  - ${d.fileName} → ${d.role}${d.year ? ` (${d.year})` : ""} [${d.textQuality}]${
        d.keyPage && d.role === "combined" ? ` key on page ${d.keyPage}` : ""
      }`
    );
  }

  const reports: YearReport[] = [];
  const keyFiles = new Set(discovered.filter((d) => d.role === "answer_key").map((d) => d.filePath));

  for (const pair of pairs) {
    try {
      reports.push(await processPair(pair, discovered, keyFiles));
    } catch (err) {
      console.error(`\n!! CEED ${pair.year} failed: ${(err as Error).message}`);
      reports.push({
        year: pair.year,
        paper: pair.paper.fileName,
        answerKey: pair.standaloneKey?.fileName ?? null,
        pages: pair.paper.structure.pageCount,
        partAQuestions: null,
        detected: 0,
        types: {},
        images: 0,
        answersMatched: 0,
        deterministic: 0,
        llmAssisted: 0,
        needsReview: 0,
        dropped: 0,
        status: "FAILED",
        mode: hasSupabase() ? "supabase" : "dry-run",
        issues: [(err as Error).message],
      });
    }
  }

  // Orphan keys (a key without its paper) are reported, not imported.
  const pairedKeyNames = new Set(pairs.map((p) => p.standaloneKey?.fileName).filter(Boolean));
  for (const d of discovered) {
    if (d.role === "answer_key" && !pairedKeyNames.has(d.fileName)) {
      console.log(`\n! Unpaired answer key: ${d.fileName} (no question paper for year ${d.year})`);
    }
  }

  printReport(reports);
  const out = writeReportFile(reports);
  console.log(`Report written to ${out}`);
  console.log(
    hasSupabase()
      ? "Mode: Supabase (questions/options/images persisted)."
      : "Mode: DRY-RUN (no Supabase env found) — normalized JSON in data/normalized/, images in data/images/. Add .env and re-run to persist."
  );
  if (!hasLlm()) {
    console.log(
      "LLM fallback: DISABLED (no AGENTROUTER_API_KEY). Ambiguous/scanned items are marked needs_review."
    );
  }
}

async function processPair(
  pair: PaperPair,
  discovered: DiscoveredPdf[],
  _keyFiles: Set<string>
): Promise<YearReport> {
  const { year, paper, standaloneKey } = pair;
  console.log(`\n=== CEED ${year} — ${paper.fileName} ===`);

  const parsedPaper = parsePaper(paper.structure, year);
  let questions: ExtractedQuestion[];
  let keyName: string | null = standaloneKey?.fileName ?? null;

  if (parsedPaper.textQuality === "clean") {
    questions = deterministicExtract(parsedPaper, paper, standaloneKey, year);
  } else {
    questions = await llmExtractPaper(paper, standaloneKey, discovered);
    if (standaloneKey) keyName = standaloneKey.fileName;
  }

  const outcome = await persistYear(
    year,
    questions,
    paper.filePath,
    paper.fileName,
    keyName
  );

  const issues = [...parsedPaper.issues];
  if (parsedPaper.textQuality !== "clean" && !hasLlm()) {
    issues.push("Scanned/corrupt paper requires AGENTROUTER_API_KEY for LLM-vision extraction.");
  }

  return buildYearReport(
    year,
    paper.fileName,
    keyName,
    paper.structure.pageCount,
    questions,
    outcome.mode,
    issues
  );
}

function deterministicExtract(
  parsedPaper: ParsedPaper,
  paper: DiscoveredPdf,
  standaloneKey: DiscoveredPdf | undefined,
  year: number
): ExtractedQuestion[] {
  // Answer key resolution priority:
  //  1. key page embedded in a combined paper file (2024/2025 final pages)
  //  2. standalone key file (2020/2022/2023/2025 draft/2026)
  //  3. 2022-style inline "Answer:" lines (handled inside structure.ts)
  let key = null as ReturnType<typeof parseAnswerKey> | null;

  if (paper.role === "combined" && paper.keyPage) {
    key = parseAnswerKey(paper.structure, paper.keyPage);
    console.log(`  key: embedded answer key on page ${paper.keyPage}`);
  } else if (standaloneKey && standaloneKey.textQuality === "clean") {
    key = parseAnswerKey(standaloneKey.structure, standaloneKey.keyPage ?? 1);
    console.log(`  key: ${standaloneKey.fileName}`);
  } else if (standaloneKey) {
    console.log(`  key: ${standaloneKey.fileName} is scanned/corrupt — key needs LLM/manual review`);
  } else {
    console.log("  key: none found; relying on inline answers if present");
  }

  const questions = matchPaperWithKey(parsedPaper, key, paper.fileName, standaloneKey?.fileName ?? null);

  // Papers whose labels are images (2025): seed needs_review skeletons from the
  // answer key's question numbers so nothing silently disappears.
  let finalQuestions = questions;
  if (finalQuestions.length === 0 && key && key.entries.size > 0) {
    finalQuestions = skeletonQuestionsFromKey(year, key, paper.fileName);
    console.log(
      `  labels not extractable — created ${finalQuestions.length} needs_review skeletons from the key`
    );
  }

  const approved = finalQuestions.filter((q) => q.status === "approved").length;
  console.log(
    `  extracted ${finalQuestions.length} Part A questions (${approved} approved, ` +
      `${finalQuestions.reduce((a, q) => a + q.images.length, 0)} figures)`
  );
  return finalQuestions;
}

/** LLM-vision path for scanned (2015) and corrupt-font (2016–2019) papers. */
async function llmExtractPaper(
  paper: DiscoveredPdf,
  standaloneKey: DiscoveredPdf | undefined,
  _discovered: DiscoveredPdf[]
): Promise<ExtractedQuestion[]> {
  if (!hasLlm()) {
    console.log(`  ${paper.textQuality} paper — no LLM key configured; marking exam for review.`);
    return [];
  }

  console.log(`  LLM-vision extraction (${paper.textQuality} text)…`);
  const keyEntries = new Map<number, string>();
  if (standaloneKey) {
    for (const page of standaloneKey.structure.pages.slice(0, 2)) {
      const b64 = await renderPageB64(standaloneKey.filePath, page.page);
      const entries = await parseKeyFromPage(page.text, b64);
      for (const e of entries ?? []) keyEntries.set(e.number, e.raw);
    }
    console.log(`  LLM key entries: ${keyEntries.size}`);
  }

  const questions: ExtractedQuestion[] = [];
  const seen = new Set<number>();

  for (const page of paper.structure.pages) {
    const b64 = await renderPageB64(paper.filePath, page.page);
    let llmQs: LlmQuestion[] | null = null;
    try {
      llmQs = await extractQuestionsFromPage(page.text, b64);
    } catch (err) {
      console.warn(`    ! LLM page ${page.page} failed: ${(err as Error).message}`);
      continue;
    }
    for (const lq of llmQs ?? []) {
      if (!lq.questionNumber || seen.has(lq.questionNumber)) continue;
      seen.add(lq.questionNumber);
      const rawKey = keyEntries.get(lq.questionNumber);
      const keyEntry = rawKey ? parseValueText(rawKey, [], lq.questionNumber) : null;

      const type = mapLlmType(lq.type);
      const answer: AnswerSchema | null = keyEntry
        ? keyEntry.kind === "letters"
          ? keyEntry.acceptedSets.length === 1
            ? { type: "single_choice", correctOptions: keyEntry.acceptedSets[0] }
            : { type: "multiple_choice", correctOptions: keyEntry.acceptedSets[0], alternateSets: keyEntry.acceptedSets.slice(1) }
          : keyEntry.kind === "range"
            ? { type: "numeric", min: keyEntry.min, max: keyEntry.max }
            : keyEntry.kind === "number" && typeof keyEntry.value === "number"
              ? { type: (Number.isInteger(keyEntry.value) ? "integer" : "decimal") as "integer" | "decimal", value: keyEntry.value }
              : null
        : null;

      const confident =
        (lq.confidence ?? 0) >= 0.9 && !lq.needsReview && Boolean(answer);
      questions.push({
        examYear: paper.year ?? 0,
        questionNumber: lq.questionNumber,
        section: "A",
        subSection: lq.subSection ?? undefined,
        type,
        questionText: lq.questionText ?? `[Q${lq.questionNumber} — LLM extraction]`,
        rawQuestionText: page.text.slice(0, 4000),
        options: (lq.options ?? []).map((o, i) => ({ key: o.key, text: o.text, order: i })),
        answer,
        rawAnswer: rawKey,
        images: lq.imageHint
          ? [{ imageIndex: 0, sourcePage: page.page }]
          : [],
        status: confident ? "approved" : "needs_review",
        extractionMethod: "llm",
        extractionConfidence: lq.confidence ?? 0.3,
        sourcePdf: paper.fileName,
        sourcePages: [page.page],
        isDropped: Boolean(keyEntry?.dropped),
        reviewNotes: lq.needsReview ? [lq.reason ?? "LLM flagged for review"] : [],
      });
    }
  }

  console.log(`  LLM extracted ${questions.length} questions`);
  return questions.sort((a, b) => a.questionNumber - b.questionNumber);
}

function mapLlmType(t?: string): ExtractedQuestion["type"] {
  switch (t) {
    case "numeric":
    case "integer":
    case "decimal":
    case "single_choice":
    case "multiple_choice":
    case "text":
      return t;
    default:
      return "unknown";
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
