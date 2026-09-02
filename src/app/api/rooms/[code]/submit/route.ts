import { NextResponse } from "next/server";
import { getAuthUser, db } from "@/lib/server/auth";
import { evaluateServerSide, type ServerAnswer, type UserAnswer } from "@/lib/server/evaluate";

/** POST /api/rooms/[code]/submit — authed participant submits, per-user completion, room finishes when all done. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { code } = await params;
  const { answers, timings } = (await req.json()) as {
    answers?: { questionId: string; answer: UserAnswer; timeMs?: number }[];
    timings?: Record<string, number>;
  };
  if (!Array.isArray(answers)) return NextResponse.json({ error: "answers required" }, { status: 400 });

  const supabase = db();
  const { data: room } = await supabase.from("rooms").select("id, status, question_ids").eq("code", code.toUpperCase()).single();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const { data: participant } = await supabase.from("room_participants").select("id, completed").eq("room_id", room.id).eq("user_id", auth.user.id).maybeSingle();
  if (!participant) return NextResponse.json({ error: "Not in room" }, { status: 403 });
  if (participant.completed) return NextResponse.json({ error: "Already submitted" }, { status: 409 });

  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
  const timeMap = new Map(answers.map((a) => [a.questionId, a.timeMs ?? 0]));

  const { data: qs } = await supabase.from("questions").select("id, correct_answer_json").in("id", room.question_ids ?? []);
  const cmap = new Map((qs ?? []).map((q: any) => [q.id, q.correct_answer_json as ServerAnswer]));

  let correct = 0;
  for (const qid of room.question_ids ?? []) {
    if (evaluateServerSide(cmap.get(qid) ?? null, answerMap.get(qid) ?? null) === "correct") correct++;
  }
  const totalTimeMs = Object.values(timings ?? {}).reduce((s, v) => s + (v ?? 0), 0);
  const totalTimeSeconds = Math.round(totalTimeMs / 1000);

  // store participant's answers + timings + mark completed
  await supabase.from("room_participants").update({
    score: correct,
    answers: answerMap.size > 0 ? Object.fromEntries(answers.map((a) => [a.questionId, a.answer])) : {},
    timings: timings ?? {},
    completed: true,
  }).eq("room_id", room.id).eq("user_id", auth.user.id);

  // check if all participants have submitted now
  const { data: parts } = await supabase.from("room_participants").select("completed").eq("room_id", room.id);
  const allDone = parts && parts.length > 0 && parts.every((p: any) => p.completed);
  if (allDone) {
    await supabase.from("rooms").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", room.id);
  }

  return NextResponse.json({ score: correct, total: room.question_ids?.length ?? 0, totalTimeSeconds });
}