import { NextResponse } from "next/server";
import { getAuthUser, db } from "@/lib/server/auth";

/** GET /api/test/session?sessionId= — hydrate a test in progress (refresh-safe resume). */
export async function GET(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const supabase = db();

  const { data: session, error: sessErr } = await supabase
    .from("test_sessions")
    .select("id, user_id, question_count, timer_seconds, started_at, submitted_at")
    .eq("id", sessionId)
    .single();
  if (sessErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.user_id && session.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: sessionQuestions, error: sqErr } = await supabase
    .from("test_session_questions")
    .select("question_id, question_order")
    .eq("test_session_id", sessionId)
    .order("question_order");
  if (sqErr) return NextResponse.json({ error: sqErr.message }, { status: 500 });

  const ids = (sessionQuestions ?? []).map((sq) => sq.question_id);
  const { data: fullQuestions, error: qErr } = await supabase
    .from("questions")
    .select(
      `
      id, question_number, question_type, question_text, sub_section,
      question_options ( option_key, option_text, option_order ),
      question_images ( image_index, storage_path, url )
    `
    )
    .in("id", ids);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const sanitized = (fullQuestions ?? []).map((q) => ({
    id: q.id,
    questionNumber: q.question_number,
    type: q.question_type,
    questionText: q.question_text,
    subSection: q.sub_section,
    options: (q.question_options ?? [])
      .slice()
      .sort((a: { option_order: number }, b: { option_order: number }) => a.option_order - b.option_order)
      .map((o: { option_key: string; option_text: string }) => ({ key: o.option_key, text: o.option_text })),
    images: (q.question_images ?? [])
      .slice()
      .sort((a: { image_index: number }, b: { image_index: number }) => a.image_index - b.image_index)
      .map((i: { image_index: number; url: string | null; storage_path: string }) => ({
        imageIndex: i.image_index,
        url: i.url || `/api/image?path=${encodeURIComponent(i.storage_path)}`,
      })),
  }));

  const orderMap = new Map((sessionQuestions ?? []).map((sq) => [sq.question_id, sq.question_order]));
  sanitized.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  const { data: saved } = await supabase
    .from("test_answers")
    .select("question_id, answer_json, time_spent_ms")
    .eq("test_session_id", sessionId);

  return NextResponse.json({
    sessionId,
    questionCount: session.question_count,
    timerSeconds: session.timer_seconds ?? session.question_count * 60,
    startedAt: session.started_at,
    submittedAt: session.submitted_at,
    questions: sanitized,
    savedAnswers: saved ?? [],
  });
}