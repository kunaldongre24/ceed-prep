import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
function db() { return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); }
export async function POST(req: Request) {
  const { code, username } = await req.json();
  if (!code || !username) return NextResponse.json({ error: "code and username required" }, { status: 400 });
  const supabase = db();
  const { data: room, error } = await supabase.from("rooms").select("id, code, status, question_count, timer_seconds").eq("code", code.toUpperCase().trim()).single();
  if (error || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "waiting") return NextResponse.json({ error: "Room already started" }, { status: 400 });
  const { error: insErr } = await supabase.from("room_participants").insert({ room_id: room.id, username: username.trim(), score: 0 });
  if (insErr && !insErr.message.includes("duplicate")) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ code: room.code, roomId: room.id });
}