import fs from "node:fs";
import path from "node:path";
import { DIRS } from "./config";
import type { ExtractedQuestion, QuestionType } from "./types";

export interface YearReport {
  year: number;
  paper: string;
  answerKey: string | null;
  pages: number;
  partAQuestions: { from: number; to: number } | null;
  detected: number;
  types: Record<string, number>;
  images: number;
  answersMatched: number;
  deterministic: number;
  llmAssisted: number;
  needsReview: number;
  dropped: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  mode: "supabase" | "dry-run";
  issues: string[];
}

export function buildYearReport(
  year: number,
  paperName: string,
  keyName: string | null,
  pages: number,
  questions: ExtractedQuestion[],
  mode: "supabase" | "dry-run",
  issues: string[]
): YearReport {
  const types: Record<string, number> = {};
  for (const q of questions) types[q.type] = (types[q.type] ?? 0) + 1;

  const numbers = questions.filter((q) => !q.labelMissing).map((q) => q.questionNumber);
  const matched = questions.filter(
    (q) => q.answer && q.answer.type !== "unknown"
  ).length;
  const llmAssisted = questions.filter((q) => q.extractionMethod.includes("llm")).length;
  const needsReview = questions.filter((q) => q.status === "needs_review").length;

  const status: YearReport["status"] =
    questions.length === 0 ? "FAILED" : needsReview > questions.length / 2 ? "PARTIAL" : "SUCCESS";

  return {
    year,
    paper: paperName,
    answerKey: keyName,
    pages,
    partAQuestions:
      numbers.length > 0 ? { from: Math.min(...numbers), to: Math.max(...numbers) } : null,
    detected: questions.length,
    types,
    images: questions.reduce((acc, q) => acc + q.images.length, 0),
    answersMatched: matched,
    deterministic: questions.length - llmAssisted,
    llmAssisted,
    needsReview,
    dropped: questions.filter((q) => q.isDropped).length,
    status,
    mode,
    issues,
  };
}

const TYPE_LABELS: Record<QuestionType, string> = {
  numeric: "Numerical",
  integer: "Integer",
  decimal: "Decimal",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  text: "Text",
  unknown: "Unknown",
};

export function printReport(reports: YearReport[]): void {
  console.log("\n========================================");
  console.log("CEED QUESTION PAPER PROCESSING");
  console.log("========================================");

  for (const r of reports) {
    console.log(`\nExam: CEED ${r.year}   [${r.mode.toUpperCase()}]`);
    console.log(`\nQuestion Paper:\n  ${r.paper}`);
    console.log(`Answer Key:\n  ${r.answerKey ?? "(none found)"}`);
    console.log(`\nPages:\n  ${r.pages}`);
    console.log(
      `\nPart A:\n  Questions: ${r.partAQuestions ? `${r.partAQuestions.from}\u2013${r.partAQuestions.to}` : "not detected"}`
    );
    console.log(`\nQuestions detected:\n  ${r.detected}`);
    console.log("\nQuestion types:");
    for (const [t, n] of Object.entries(r.types)) {
      console.log(`  ${TYPE_LABELS[t as QuestionType] ?? t}: ${n}`);
    }
    console.log(`\nImages:\n  ${r.images}`);
    console.log(`\nAnswers matched:\n  ${r.answersMatched}/${r.detected}`);
    console.log(`\nDeterministic extraction:\n  ${r.deterministic}`);
    console.log(`\nGPT-5.6-sol assisted:\n  ${r.llmAssisted}`);
    console.log(`\nNeeds review:\n  ${r.needsReview}`);
    if (r.dropped > 0) console.log(`\nDropped (per key):\n  ${r.dropped}`);
    if (r.issues.length > 0) {
      console.log("\nIssues:");
      for (const issue of r.issues) console.log(`  ! ${issue}`);
    }
    console.log(`\nStatus:\n  ${r.status}`);
    console.log("----------------------------------------");
  }
  console.log("");
}

export function writeReportFile(reports: YearReport[]): string {
  const out = path.join(DIRS.reports, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(DIRS.reports, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(reports, null, 2));
  return out;
}
