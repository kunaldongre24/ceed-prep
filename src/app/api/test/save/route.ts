import { NextResponse } from "next/server";
import { getAuthUser, db } from "@/lib/server/auth";

/** POST /api/test/save — debounced mid-test persistence (answers + per-question time). */
export async function POST(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { sessionId, answers } = body as {
    sessionId?: string;
    answers?: { questionId: string; answer: Record<string, unknown>; timeMs: number }[];
  };
  if (!sessionId || !Array.isArray(answers)) {
    return NextResponse.json({ error: "sessionId and answers required" }, { status: 400 });
  }

  const supabase = db();
  const { data: session, error: sessErr } = await supabase
    .from("test_sessions")
    .select("id, user_id, submitted_at")
    .eq("id", sessionId)
    .single();
  if (sessErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.submitted_at) return NextResponse.json({ error: "Session already submitted" }, { status: 409 });
  if (session.user_id && session.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = answers.map((a) => ({
    test_session_id: sessionId,
    question_id: a.questionId,
    answer_json: a.answer ?? null,
    time_spent_ms: Math.max(0, Math.round(a.timeMs || 0)),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("test_answers").upsert(rows, {
    onConflict: "test_session_id,question_id",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}