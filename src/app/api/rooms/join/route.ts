import { NextResponse } from "next/server";
import { getAuthUser, getUserUsername, db } from "@/lib/server/auth";

export async function POST(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const supabase = db();
  const username = (await getUserUsername(auth.user.id)) || `user-${auth.user.id.slice(0, 6)}`;

  const { data: room, error } = await supabase.from("rooms").select("id, code, status, question_count, timer_seconds").eq("code", code.toUpperCase().trim()).single();
  if (error || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "waiting") return NextResponse.json({ error: "Room already started" }, { status: 400 });

  // Idempotent join: inserting (room_id, user_id) twice is a no-op success.
  const { error: insErr } = await supabase.from("room_participants").insert({ room_id: room.id, user_id: auth.user.id, username, score: 0 });
  if (insErr && !insErr.message.includes("duplicate")) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ code: room.code, roomId: room.id });
}