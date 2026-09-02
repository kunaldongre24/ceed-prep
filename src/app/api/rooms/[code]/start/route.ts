import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
function db(){return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});}
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = db();
  const { data: room } = await supabase.from("rooms").select("id, status").eq("code", code.toUpperCase()).single();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "waiting") return NextResponse.json({ error: "Already started" }, { status: 400 });
  const { error } = await supabase.from("rooms").update({ status: "active", started_at: new Date().toISOString() }).eq("id", room.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}