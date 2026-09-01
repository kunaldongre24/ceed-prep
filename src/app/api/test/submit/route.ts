import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * POST /api/test/submit
 * Body: {
 *   sessionId: string,
 *   answers: { questionId: string, answer: { selectedOptions?: string[], value?: number | string, text?: string } }[]
 * }
 *
 * Evaluates answers server-side and returns results.
 * NEVER returns correct_answer_json to the client.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId, answers } = body as {
    sessionId?: string;
    answers?: { questionId: string; answer: Record<string, unknown> }[];
  };

  if (!sessionId || !Array.isArray(answers)) {
    return NextResponse.json({ error: "sessionId and answers array required" }, { status: 400 });
  }

  const supabase = db();

  // Verify session exists and is not already submitted
  const { data: session, error: sessErr } = await supabase
    .from("test_sessions")
    .select("id, submitted_at")
    .eq("id", sessionId)
    .single();

  if (sessErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.submitted_at) {
    return NextResponse.json({ error: "Session already submitted" }, { status: 409 });
  }

  // Get the session's questions with correct answers
  const { data: sessionQuestions, error: sqErr } = await supabase
    .from("test_session_questions")
    .select(
      `
      question_id, question_order,
      questions (
        id, question_number, question_type, question_text, sub_section,
        correct_answer_json, raw_answer_text,
        question_options ( option_key, option_text, option_order ),
        question_images ( image_index, url, storage_path )
      )
    `
    )
    .eq("test_session_id", sessionId)
    .order("question_order");

  if (sqErr) return NextResponse.json({ error: sqErr.message }, { status: 500 });

  // Store user answers
  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
  const storeAnswers = (sessionQuestions ?? []).map((sq: { question_id: string }) => ({
    test_session_id: sessionId,
    question_id: sq.question_id,
    answer_json: answerMap.get(sq.question_id) ?? null,
  }));
  await supabase.from("test_answers").upsert(storeAnswers, {
    onConflict: "test_session_id,question_id",
  });

  // Mark session as submitted
  await supabase
    .from("test_sessions")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Evaluate each question
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;

  const results = (sessionQuestions ?? []).map((sq: Record<string, unknown>) => {
    const q = sq.questions as Record<string, unknown>;
    const userAnswer = answerMap.get(sq.question_id as string) ?? null;
    const correctAnswer = (q.correct_answer_json as ServerAnswer) ?? null;

    const result = evaluateServerSide(correctAnswer, userAnswer);
    if (result === "correct") correct++;
    else if (result === "incorrect") incorrect++;
    else unattempted++;

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
    };
  });

  const total = correct + incorrect + unattempted;

  return NextResponse.json({
    sessionId,
    score: correct,
    total,
    correct,
    incorrect,
    unattempted,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    results,
  });
}

type ServerAnswer = {
  type: string;
  correctOptions?: string[];
  alternateSets?: string[][];
  value?: number;
  min?: number;
  max?: number;
  tolerance?: number;
  rawAnswer?: string;
} | null;

function evaluateServerSide(
  correct: ServerAnswer,
  user: { selectedOptions?: string[]; value?: number | string; text?: string } | null
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
