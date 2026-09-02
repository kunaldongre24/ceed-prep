import { NextResponse } from "next/server";
import { getAuthUser, db } from "@/lib/server/auth";

/** GET /api/rooms/[code]/me — the authed user's role + saved progress in a room (refresh-safe resume). */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { code } = await params;
  const supabase = db();

  const { data: room } = await supabase.from("rooms").select("id, host_id, status, timer_seconds, started_at, ended_at, question_count").eq("code", code.toUpperCase()).single();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const { data: me } = await supabase
    .from("room_participants")
    .select("user_id, username, score, answers, timings, completed, current_index, time_remaining, marked_for_review")
    .eq("room_id", room.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({
    room,
    isHost: room.host_id === auth.user.id,
    me: me ?? null,
  });
}