/**
 * Core domain model for the CEED question bank.
 *
 * CEED papers label the parts "Part A" (Sections I/II/III: NAT, MSQ, MCQ) and "Part B".
 * The product spec calls the target bank "Section A" — we normalize that to section="A"
 * (meaning the paper's Part A) and keep the paper's own sub-section in sub_section.
 * Question/response formats are NOT assumed to be only 4-option MCQs.
 */

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "numeric"
  | "integer"
  | "decimal"
  | "text"
  | "unknown";

/**
 * Flexible answer schema. The answer key is the source of truth; we never invent values.
 * - numeric supports exact values AND key-provided ranges (min/max, e.g. "24.0 to 25.5")
 *   and (rare) key-provided tolerances. We never invent tolerance ourselves.
 * - multiple_choice supports alternate correct sets (e.g. "B or B, D").
 */
export type AnswerSchema =
  | { type: "single_choice"; correctOptions: string[] }
  | {
      type: "multiple_choice";
      correctOptions: string[];
      /** Additional accepted correct sets, e.g. [["B"]] for "B or B, D" with primary ["B","D"]. */
      alternateSets?: string[][];
    }
  | {
      type: "numeric";
      value?: number;
      min?: number;
      max?: number;
      tolerance?: number;
    }
  | { type: "integer"; value: number }
  | { type: "decimal"; value: number; tolerance?: number }
  | { type: "text"; value: string }
  | { type: "unknown"; rawAnswer: string };

export type QuestionStatus = "needs_review" | "approved" | "rejected";

export type ExtractionMethod = "pdf_text" | "pdf_image" | "ocr" | "llm" | "mixed";

export interface QuestionOption {
  key: string; // "A" | "B" | "C" | "D" | ...
  text: string;
  order: number;
}

/** An image/diagram associated with a specific question. */
export interface QuestionImage {
  imageIndex: number;
  /** Supabase storage path, set at import time: {examId}/q{NN}/{i}.png */
  storagePath?: string;
  url?: string;
  sourcePage?: number; // 1-based PDF page
  /** Bounding box in PDF page points (72dpi): x, y are top-left (PyMuPDF convention). */
  boundingBox?: { x: number; y: number; width: number; height: number };
  /** Temporary local file path produced by the extractor (not persisted to DB). */
  localPath?: string;
}

/** A question as produced by the extraction pipeline (pre-DB). */
export interface ExtractedQuestion {
  examYear: number;
  questionNumber: number;
  section: "A";
  subSection?: string | null;
  type: QuestionType;
  questionText: string;
  rawQuestionText: string;
  options: QuestionOption[];
  answer: AnswerSchema | null;
  rawAnswer?: string;
  images: QuestionImage[];
  status: QuestionStatus;
  extractionMethod: ExtractionMethod;
  extractionConfidence: number;
  sourcePdf: string;
  sourcePages: number[];
  isDropped: boolean;
  labelMissing?: boolean;
  reviewNotes: string[];
}

/** The question shape safe to send to the browser during an active test. */
export interface ClientQuestion {
  id: string;
  questionNumber: number;
  type: QuestionType;
  questionText: string;
  subSection?: string | null;
  options: QuestionOption[];
  images: { imageIndex: number; url: string }[];
}

/** User response stored/evaluated, shaped like AnswerSchema by the client. */
export interface UserAnswer {
  selectedOptions?: string[];
  value?: number | string;
  text?: string;
}

export type EvaluationResult = "correct" | "incorrect" | "unattempted";
