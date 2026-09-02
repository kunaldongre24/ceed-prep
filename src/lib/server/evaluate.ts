import type { SupabaseClient } from "@supabase/supabase-js";

export type ServerAnswer = {
  type?: string;
  correctOptions?: string[];
  alternateSets?: string[][];
  value?: number;
  min?: number;
  max?: number;
  tolerance?: number;
  rawAnswer?: string;
} | null;

export type UserAnswer = {
  selectedOptions?: string[];
  value?: number | string;
  text?: string;
} | null;

export function evaluateServerSide(
  correct: ServerAnswer,
  user: UserAnswer
): "correct" | "incorrect" | "unattempted" {
  if (!user) return "unattempted";
  if (!correct) return "incorrect";

  switch (correct.type) {
    case "single_choice":
    case "multiple_choice": {
      const selected = new Set((user.selectedOptions ?? []).map((o) => o.trim().toUpperCase()));
      if (selected.size === 0) return "unattempted";

      const candidateSets: string[][] = [
        correct.correctOptions ?? [],
        ...(correct.type === "multiple_choice" ? (correct.alternateSets ?? []) : []),
      ];

      for (const set of candidateSets) {
        const target = new Set(set.map((o) => o.trim().toUpperCase()));
        if (setsEqual(selected, target)) return "correct";
      }
      return "incorrect";
    }

    case "numeric":
    case "decimal":
    case "integer": {
      const parsed = parseNumber(user.value);
      if (parsed === null) return "unattempted";

      if (typeof correct.min === "number" && typeof correct.max === "number") {
        return parsed >= correct.min && parsed <= correct.max ? "correct" : "incorrect";
      }
      if (typeof correct.value !== "number") return "incorrect";

      const tolerance = typeof correct.tolerance === "number" ? correct.tolerance : 0;
      return Math.abs(parsed - correct.value) <= tolerance + 1e-9 ? "correct" : "incorrect";
    }

    case "text": {
      const u = (user.text ?? "").trim().toLowerCase();
      if (!u) return "unattempted";
      return u === (correct.rawAnswer ?? "").trim().toLowerCase() ? "correct" : "incorrect";
    }

    default:
      return "incorrect";
  }
}

export async function buildTestResult(supabase: SupabaseClient, sessionId: string) {
  const { data: sessionQuestions, error: sqErr } = await supabase
    .from("test_session_questions")
    .select(
      `
      question_id, question_order,
      questions (
        id, question_number, question_type, question_text, sub_section,
        correct_answer_json,
        question_options ( option_key, option_text, option_order ),
        question_images ( image_index, url, storage_path )
      )
    `
    )
    .eq("test_session_id", sessionId)
    .order("question_order");

  if (sqErr) throw sqErr;

  const { data: storedAnswers } = await supabase
    .from("test_answers")
    .select("question_id, answer_json, time_spent_ms")
    .eq("test_session_id", sessionId);

  const answerMap = new Map((storedAnswers ?? []).map((a) => [a.question_id, a.answer_json as UserAnswer]));
  const timeMap = new Map((storedAnswers ?? []).map((a) => [a.question_id, a.time_spent_ms as number | null]));

  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let totalTimeSeconds = 0;

  const results = (sessionQuestions ?? []).map((sq: Record<string, unknown>) => {
    const q = sq.questions as Record<string, unknown>;
    const userAnswer = answerMap.get(sq.question_id as string) ?? null;
    const correctAnswer = (q.correct_answer_json as ServerAnswer) ?? null;

    const result = evaluateServerSide(correctAnswer, userAnswer);
    if (result === "correct") correct++;
    else if (result === "incorrect") incorrect++;
    else unattempted++;

    const timeAhms = timeMap.get(sq.question_id as string) ?? 0;
    const timeSeconds = Math.max(0, Math.round((timeAhms ?? 0) / 1000));
    totalTimeSeconds += timeSeconds;

    const options = (q.question_options as { option_key: string; option_text: string; option_order: number }[] ?? [])
      .slice()
      .sort((a, b) => a.option_order - b.option_order)
      .map((o) => ({ key: o.option_key, text: o.option_text }));

    const images = (q.question_images as { image_index: number; url: string | null; storage_path: string }[] ?? [])
      .slice()
      .sort((a, b) => a.image_index - b.image_index)
      .map((i) => ({
        imageIndex: i.image_index,
        url: i.url || `/api/image?path=${encodeURIComponent(i.storage_path)}`,
      }));

    return {
      questionId: sq.question_id,
      questionNumber: q.question_number,
      questionType: q.question_type,
      questionText: q.question_text,
      subSection: q.sub_section,
      options,
      images,
      userAnswer,
      correctAnswer,
      result,
      timeSeconds,
    };
  });

  const total = correct + incorrect + unattempted;

  return {
    sessionId,
    score: correct,
    total,
    correct,
    incorrect,
    unattempted,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    totalTimeSeconds,
    avgTimeSeconds: total > 0 ? Math.round(totalTimeSeconds / total) : 0,
    results,
  };
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function parseNumber(input: number | string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const cleaned = input.trim().replace(/,/g, "").replace(/^\+/, "");
  if (cleaned === "" || !/^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}