import { NextResponse } from "next/server";
import { getAuthUser, db } from "@/lib/server/auth";

/** GET /api/test/history — list the authed user's submitted tests with scores + timing. */
export async function GET(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = db();
  const { data: sessions, error } = await supabase
    .from("test_sessions")
    .select("id, question_count, timer_seconds, started_at, submitted_at")
    .eq("user_id", auth.user.id)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessions: sessions ?? [] });
}