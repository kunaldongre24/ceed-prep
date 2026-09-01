import type { ParsedKey, ParsedKeyEntry } from "./answers";
import type { ParsedPaper, ParsedQuestion } from "./structure";
import { CONFIG } from "./config";
import type {
  AnswerSchema,
  ExtractionMethod,
  ExtractedQuestion,
  QuestionStatus,
  QuestionType,
} from "./types";

/**
 * Marries paper questions with answer-key entries, assigns final types and
 * answers, computes confidence and review status. The answer key is the only
 * source of truth for answers; a missing/ambiguous key never yields a guessed
 * answer, only needs_review.
 */
export function matchPaperWithKey(
  paper: ParsedPaper,
  key: ParsedKey | null,
  sourcePdfName: string,
  keyPdfName: string | null
): ExtractedQuestion[] {
  const out: ExtractedQuestion[] = [];

  for (const q of paper.questions) {
    const keyEntry = key?.entries.get(q.number) ?? null;
    const eq = buildExtracted(q, keyEntry, paper, sourcePdfName, keyPdfName);
    out.push(eq);
  }
  return out;
}

/**
 * Skeleton questions for papers whose question labels/section headers are
 * rendered as images (e.g. CEED 2025): the answer key tells us which Part A
 * numbers exist, so we create needs_review placeholders carrying the known
 * answers, ready for LLM extraction or manual admin entry. No content is
 * invented.
 */
export function skeletonQuestionsFromKey(
  year: number,
  key: ParsedKey,
  sourcePdfName: string
): ExtractedQuestion[] {
  return [...key.entries.values()]
    .sort((a, b) => a.number - b.number)
    .map((e) => {
      const type: QuestionType =
        e.keySection?.typeHint === "numeric"
          ? numericKind(e, null)
          : (e.keySection?.typeHint ?? "unknown");
      const answer: AnswerSchema | null =
        e.kind === "letters"
          ? e.acceptedSets.length === 1
            ? { type: "single_choice", correctOptions: e.acceptedSets[0] }
            : {
                type: "multiple_choice",
                correctOptions: e.acceptedSets[0],
                alternateSets: e.acceptedSets.slice(1),
              }
          : e.kind === "range"
            ? { type: "numeric", min: e.min, max: e.max }
            : e.kind === "number" && typeof e.value === "number"
              ? { type: Number.isInteger(e.value) ? "integer" : "decimal", value: e.value }
              : e.dropped
                ? null
                : { type: "unknown", rawAnswer: e.raw };

      return {
        examYear: year,
        questionNumber: e.number,
        section: "A" as const,
        subSection: e.keySection?.key ?? undefined,
        type,
        questionText: `[Q${e.number} — question labels are images in this paper; content not extracted yet]`,
        rawQuestionText: "",
        options: [],
        answer,
        rawAnswer: e.raw,
        images: [],
        status: "needs_review" as const,
        extractionMethod: "pdf_text" as const,
        extractionConfidence: 0.1,
        sourcePdf: sourcePdfName,
        sourcePages: [],
        isDropped: Boolean(e.dropped),
        reviewNotes: [
          "Question label and section headers are images in this paper; deterministic extraction impossible. Content requires LLM extraction or manual admin entry.",
        ],
      };
    });
}

function buildExtracted(
  q: ParsedQuestion,
  keyEntry: ParsedKeyEntry | null,
  paper: ParsedPaper,
  sourcePdfName: string,
  keyPdfName: string | null
): ExtractedQuestion {
  const notes = [...q.notes];
  let type = reconcileType(q, keyEntry, notes);
  let answer = buildAnswer(q, keyEntry, type, notes);
  let extractionMethod: ExtractionMethod = "pdf_text";
  let confidence = scoreConfidence(q, type, answer);

  // Dropped questions (e.g. CEED 2025 final key "DROPPED")
  const isDropped = Boolean(keyEntry?.dropped);
  if (isDropped) notes.push("Marked DROPPED in the official answer key.");

  // Answer absence forces review (we never invent answers).
  if (!answer && !isDropped) {
    notes.push(
      keyPdfName
        ? `No answer found in key (${keyPdfName}) for this question number.`
        : "No usable answer key available for this paper."
    );
    if (keyEntry) {
      answer = { type: "unknown", rawAnswer: keyEntry.raw };
      type = "unknown";
    }
  }

  // Question content absent (image-rendered label) always requires review.
  if (q.labelMissing) {
    confidence = Math.min(confidence, 0.2);
    type = "unknown";
  }

  const status: QuestionStatus =
    isDropped || confidence < CONFIG.confidenceThreshold || !answer || type === "unknown"
      ? "needs_review"
      : "approved";

  const questionText = q.stem || (q.labelMissing ? `[Q${q.number} — content not extracted]` : q.stem);
  if (!q.stem && !q.labelMissing) notes.push("Empty stem after extraction.");

  return {
    examYear: paper.year ?? 0,
    questionNumber: q.number,
    section: "A",
    subSection: q.subSection ?? undefined,
    type,
    questionText,
    rawQuestionText: q.rawText,
    options: q.options.map((o, idx) => ({ key: o.key, text: o.text, order: idx })),
    answer,
    rawAnswer: keyEntry?.raw ?? q.rawAnswer ?? undefined,
    images: q.figures.map((f, idx) => ({
      imageIndex: idx,
      sourcePage: f.page,
      boundingBox: { x: f.bbox[0], y: f.bbox[1], width: f.bbox[2] - f.bbox[0], height: f.bbox[3] - f.bbox[1] },
    })),
    status,
    extractionMethod,
    extractionConfidence: Math.round(confidence * 100) / 100,
    sourcePdf: sourcePdfName,
    sourcePages: q.sourcePages,
    isDropped,
    reviewNotes: notes,
  };
}

function reconcileType(
  q: ParsedQuestion,
  keyEntry: ParsedKeyEntry | null,
  notes: string[]
): QuestionType {
  const sectionType = q.typeHint;
  const hasOptions = q.options.length >= 2;

  if (sectionType === "numeric" && hasOptions) {
    notes.push("NAT section question has options — treating as choice question.");
    return "single_choice";
  }
  if (sectionType === "numeric") return numericKind(keyEntry, q.rawAnswer);
  if (sectionType === "multiple_choice") return "multiple_choice";
  if (sectionType === "single_choice") return "single_choice";

  // No paper-side section hint: fall back to the answer key's own section
  // attribution (NAT/MSQ/MCQ blocks in the key table).
  if (keyEntry?.keySection) {
    switch (keyEntry.keySection.typeHint) {
      case "numeric":
        return numericKind(keyEntry, q.rawAnswer);
      case "multiple_choice":
        return "multiple_choice";
      case "single_choice":
        return "single_choice";
    }
  }

  // No section hint: infer from content
  if (hasOptions) {
    const multiSet = keyEntry && keyEntry.acceptedSets[0]?.length > 1;
    return multiSet ? "multiple_choice" : "single_choice";
  }
  return numericKind(keyEntry, q.rawAnswer);
}

function numericKind(keyEntry: ParsedKeyEntry | null, rawAnswer: string | null): QuestionType {
  const value = keyEntry?.value ?? tryNumber(rawAnswer);
  if (value === null || value === undefined) return "numeric";
  return Number.isInteger(value) ? "integer" : "decimal";
}

function tryNumber(raw: string | null): number | null {
  if (!raw) return null;
  const m = /^-?\d+(?:\.\d+)?$/.exec(raw.trim().replace(/,/g, ""));
  return m ? Number(m[0]) : null;
}

function buildAnswer(
  q: ParsedQuestion,
  keyEntry: ParsedKeyEntry | null,
  type: QuestionType,
  notes: string[]
): AnswerSchema | null {
  // 2022-style inline answers in the paper itself
  const inlineRaw = q.rawAnswer;

  if (type === "single_choice" || type === "multiple_choice") {
    const sets =
      keyEntry && keyEntry.kind === "letters"
        ? keyEntry.acceptedSets
        : inlineRaw
          ? [lettersOf(inlineRaw)]
          : null;
    if (!sets || sets.length === 0 || sets[0].length === 0) return null;
    const [primary, ...alts] = sets;
    const missingOptions = primary.filter(
      (k) => !q.options.some((o) => o.key.toUpperCase() === k)
    );
    if (missingOptions.length > 0) {
      notes.push(`Key references option(s) ${missingOptions.join(",")} not found in parsed options.`);
    }
    return type === "single_choice"
      ? { type: "single_choice", correctOptions: primary }
      : { type: "multiple_choice", correctOptions: primary, alternateSets: alts.length ? alts : undefined };
  }

  if (type === "numeric" || type === "integer" || type === "decimal") {
    if (keyEntry?.kind === "range") {
      return { type: "numeric", min: keyEntry.min, max: keyEntry.max };
    }
    const value = keyEntry?.value ?? tryNumber(inlineRaw);
    if (value === null || value === undefined) return null;
    if (type === "integer") return { type: "integer", value };
    if (type === "decimal") return { type: "decimal", value };
    return { type: "numeric", value };
  }

  if (keyEntry && keyEntry.kind !== "unknown") {
    // key present but type unknown — keep raw for admin
    return { type: "unknown", rawAnswer: keyEntry.raw };
  }
  if (inlineRaw) return { type: "unknown", rawAnswer: inlineRaw };
  return null;
}

function lettersOf(raw: string): string[] {
  return [...new Set(raw.toUpperCase().replace(/[^A-D]/g, "").split(""))].sort();
}

function scoreConfidence(
  q: ParsedQuestion,
  type: QuestionType,
  answer: AnswerSchema | null
): number {
  let c = 0.4;
  const isChoice = type === "single_choice" || type === "multiple_choice";
  if (q.stem.length >= 25) c += 0.15;
  if (q.typeHint !== "unknown") c += 0.1;
  if (isChoice) {
    const keys = q.options.map((o) => o.key);
    const fourOrdered =
      keys.length === 4 && keys.every((k, i) => k.charCodeAt(0) === 65 + i);
    c += fourOrdered ? 0.15 : 0.05;
  } else {
    c += 0.05;
  }
  if (answer && answer.type !== "unknown") c += 0.15;
  if (answer && answer.type === "unknown") c -= 0.05;
  if (/shown (below|above)|given below|figure|image of/i.test(q.stem) && q.figures.length > 0) c += 0.05;
  if (q.notes.some((n) => n.includes("suspect") || n.includes("not found"))) c -= 0.2;
  if (q.notes.some((n) => n.includes("image-rendered label"))) c -= 0.3;
  return Math.max(0.05, Math.min(0.99, c));
}
