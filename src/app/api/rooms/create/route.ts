import { NextResponse } from "next/server";
import { getAuthUser, getUserUsername, db } from "@/lib/server/auth";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export async function POST(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { questionCount = 10, timerSeconds = 600 } = await req.json();
  const qc = Math.min(30, Math.max(5, Number(questionCount) || 10));
  const timer = Math.min(3600, Math.max(60, Number(timerSeconds) || 600));

  const supabase = db();
  const username = (await getUserUsername(auth.user.id)) || `user-${auth.user.id.slice(0, 6)}`;

  // fetch usable questions
  const { data: all, error } = await supabase.from("questions").select("id, question_type, question_options(id), question_images(id)").eq("section", "A").eq("status", "approved").eq("is_dropped", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const usable = (all ?? []).filter((q: any) => {
    if (q.question_type === "single_choice" || q.question_type === "multiple_choice") return (q.question_options?.length ?? 0) > 0 || (q.question_images?.length ?? 0) > 0;
    return true;
  });
  if (usable.length < qc) return NextResponse.json({ error: `Only ${usable.length} usable questions available` }, { status: 400 });
  const shuffled = usable.sort(() => Math.random() - 0.5).slice(0, qc);
  const question_ids = shuffled.map((q: any) => q.id);

  const code = genCode();
  const { data: room, error: insErr } = await supabase.from("rooms").insert({ code, host_id: auth.user.id, host_username: username, question_count: qc, timer_seconds: timer, question_ids, status: "waiting" }).select("id, code").single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // host joins as participant
  await supabase.from("room_participants").insert({ room_id: room.id, user_id: auth.user.id, username, score: 0 });

  return NextResponse.json({ code: room.code, roomId: room.id });
}