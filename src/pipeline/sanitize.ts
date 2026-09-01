import type { ClientQuestion, QuestionImage, QuestionOption } from "./types";

/** DB row shape (subset) used by the test APIs. */
export interface QuestionRow {
  id: string;
  question_number: number;
  question_type: string;
  question_text: string;
  sub_section?: string | null;
  correct_answer_json?: unknown;
  raw_answer_text?: string | null;
  question_options?: { option_key: string; option_text: string; option_order: number }[];
  question_images?: { image_index: number; url: string | null; storage_path: string }[];
}

const ANSWER_FIELDS = new Set([
  "correct_answer_json",
  "correctAnswer",
  "raw_answer_text",
  "rawAnswer",
  "answer",
  "is_dropped",
]);

/**
 * Strip everything answer-related from a question row before it can reach the
 * browser. This is the single choke point for active-test responses; the
 * security tests exercise it.
 */
export function sanitizeQuestion(row: QuestionRow): ClientQuestion {
  const options: QuestionOption[] = (row.question_options ?? [])
    .slice()
    .sort((a, b) => a.option_order - b.option_order)
    .map((o) => ({ key: o.option_key, text: o.option_text, order: o.option_order }));

  const images: { imageIndex: number; url: string }[] = (row.question_images ?? [])
    .slice()
    .sort((a, b) => a.image_index - b.image_index)
    .map((i) => ({ imageIndex: i.image_index, url: publicImageUrl(i) }));

  return {
    id: row.id,
    questionNumber: row.question_number,
    type: row.question_type as ClientQuestion["type"],
    questionText: row.question_text,
    subSection: row.sub_section ?? null,
    options,
    images,
  };
}

function publicImageUrl(img: { url: string | null; storage_path: string }): string {
  if (img.url) return img.url;
  // Fallback: serve through our own proxy route so storage creds stay server-side.
  return `/api/image?path=${encodeURIComponent(img.storage_path)}`;
}

/** Assert a JSON object we are about to send contains no answer material. */
export function assertNoAnswerLeak(payload: unknown): void {
  const seen = (typeof payload === "object" && payload !== null) || Array.isArray(payload);
  if (!seen) return;
  const stack: unknown[] = [payload];
  while (stack.length) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      stack.push(...cur);
      continue;
    }
    if (cur && typeof cur === "object") {
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (ANSWER_FIELDS.has(k)) {
          throw new Error(`Answer leak detected: field "${k}" must never reach the client`);
        }
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }
}

export type { QuestionImage };
