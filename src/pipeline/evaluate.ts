import type { AnswerSchema, EvaluationResult, UserAnswer } from "./types";

/**
 * Server-side evaluation engine. The answer key is the source of truth and we
 * never invent grading rules: numeric ranges only exist when the key provides
 * them; tolerance only when the key provides it. Unattempted answers are
 * reported as "unattempted" rather than guessed at.
 */
export function evaluateAnswer(
  correct: AnswerSchema | null,
  user: UserAnswer | null | undefined
): EvaluationResult {
  if (!user || isUnattempted(user, correct)) return "unattempted";
  if (!correct) return "incorrect";

  switch (correct.type) {
    case "single_choice":
    case "multiple_choice":
      return evaluateChoice(correct, user);
    case "numeric":
    case "decimal":
    case "integer":
      return evaluateNumeric(correct, user);
    case "text":
      return normalizeText(user.text ?? optionValueText(user)) === normalizeText(correct.value)
        ? "correct"
        : "incorrect";
    case "unknown":
      // Unknown answers must not appear in live tests (admin review required).
      return "incorrect";
  }
}

function isUnattempted(user: UserAnswer, correct: AnswerSchema | null): boolean {
  const kind = correct?.type;
  if (kind === "single_choice" || kind === "multiple_choice") {
    return !user.selectedOptions || user.selectedOptions.length === 0;
  }
  if (kind === "numeric" || kind === "integer" || kind === "decimal") {
    const v = user.value;
    return v === undefined || v === null || String(v).trim() === "";
  }
  if (kind === "text") {
    return (user.text ?? "").trim() === "";
  }
  // unknown / missing key: anything goes unattempted-safe
  return false;
}

function evaluateChoice(
  correct: { type: "single_choice" | "multiple_choice"; correctOptions: string[]; alternateSets?: string[][] },
  user: UserAnswer
): EvaluationResult {
  const selected = new Set((user.selectedOptions ?? []).map((o) => o.trim().toUpperCase()));
  if (selected.size === 0) return "unattempted";

  const candidateSets: string[][] = [
    correct.correctOptions,
    ...(correct.type === "multiple_choice" ? (correct.alternateSets ?? []) : []),
  ];

  for (const set of candidateSets) {
    const target = new Set(set.map((o) => o.trim().toUpperCase()));
    if (setsEqual(selected, target)) return "correct";
  }
  return "incorrect";
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function evaluateNumeric(
  correct: { type: "numeric" | "integer" | "decimal"; value?: number; min?: number; max?: number; tolerance?: number },
  user: UserAnswer
): EvaluationResult {
  const parsed = parseNumber(user.value);
  if (parsed === null) return "incorrect";

  // Range answers come straight from the key (e.g. CEED 2026 "24.0 to 25.5").
  if (typeof correct.min === "number" && typeof correct.max === "number") {
    return parsed >= correct.min && parsed <= correct.max ? "correct" : "incorrect";
  }
  if (typeof correct.value !== "number") return "incorrect";

  // Tolerance only when the key/config explicitly provides one — never invented.
  const tolerance = typeof correct.tolerance === "number" ? correct.tolerance : 0;
  return Math.abs(parsed - correct.value) <= tolerance + 1e-9 ? "correct" : "incorrect";
}

/** Parse "42", "42.0", "042", " 41.4 ", "1,690" → number; else null. */
export function parseNumber(input: number | string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const cleaned = input.trim().replace(/,/g, "").replace(/^\+/, "");
  if (cleaned === "" || !/^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Some UIs may submit a choice-type answer as {value: "B"} — accept that too. */
function optionValueText(user: UserAnswer): string {
  if (typeof user.value === "string" && user.selectedOptions === undefined) return user.value;
  return "";
}
