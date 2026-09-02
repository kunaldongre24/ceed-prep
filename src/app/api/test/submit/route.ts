import { NextResponse } from "next/server";
import { getAuthUser, db } from "@/lib/server/auth";
import { buildTestResult } from "@/lib/server/evaluate";

/**
 * POST /api/test/submit
 * Body: {
 *   sessionId: string,
 *   answers: { questionId: string, answer: {...}, timeMs: number }[]
 * }
 *
 * Evaluates answers server-side, stores per-question timing, and returns full
 * results (score + time analysis). Never returns hidden answers beyond the
 * authenticated owner's stored result.
 */
export async function POST(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { sessionId, answers } = body as {
    sessionId?: string;
    answers?: { questionId: string; answer: Record<string, unknown>; timeMs?: number }[];
  };

  if (!sessionId || !Array.isArray(answers)) {
    return NextResponse.json({ error: "sessionId and answers array required" }, { status: 400 });
  }

  const supabase = db();

  const { data: session, error: sessErr } = await supabase
    .from("test_sessions")
    .select("id, user_id, submitted_at")
    .eq("id", sessionId)
    .single();

  if (sessErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.user_id && session.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.submitted_at) {
    return NextResponse.json({ error: "Session already submitted" }, { status: 409 });
  }

  // Store user answers with per-question timing
  const storeAnswers = answers.map((a) => ({
    test_session_id: sessionId,
    question_id: a.questionId,
    answer_json: a.answer ?? null,
    time_spent_ms: Math.max(0, Math.round(a.timeMs ?? 0)),
    updated_at: new Date().toISOString(),
  }));
  const { error: storeErr } = await supabase.from("test_answers").upsert(storeAnswers, {
    onConflict: "test_session_id,question_id",
  });
  if (storeErr) return NextResponse.json({ error: storeErr.message }, { status: 500 });

  // Mark session as submitted
  await supabase
    .from("test_sessions")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", sessionId);

  const payload = await buildTestResult(supabase, sessionId);

  return NextResponse.json(payload);
}