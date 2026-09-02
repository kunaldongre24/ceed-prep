import { NextResponse } from "next/server";
import { getAuthUser, db } from "@/lib/server/auth";

/** POST /api/rooms/[code]/start — host starts the battle. */
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await getAuthUser(_req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { code } = await params;
  const supabase = db();
  const { data: room } = await supabase.from("rooms").select("id, host_id, status").eq("code", code.toUpperCase()).single();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.host_id && room.host_id !== auth.user.id) return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
  if (room.status !== "waiting") return NextResponse.json({ error: "Already started" }, { status: 400 });

  const { error } = await supabase.from("rooms").update({ status: "active", started_at: new Date().toISOString() }).eq("id", room.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}