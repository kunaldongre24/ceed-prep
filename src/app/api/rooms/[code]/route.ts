import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
function db() { return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); }
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = db();
  const { data: room, error } = await supabase.from("rooms").select("id, code, host_username, question_count, timer_seconds, status, question_ids, created_at, started_at").eq("code", code.toUpperCase()).single();
  if (error || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const { data: participants } = await supabase.from("room_participants").select("username, score, joined_at").eq("room_id", room.id).order("joined_at");
  let questions: any[] = [];
  if (room.question_ids?.length) {
    const { data: qs } = await supabase.from("questions").select("id, question_number, question_type, question_text, sub_section, question_options(option_key, option_text, option_order), question_images(image_index, url, storage_path)").in("id", room.question_ids);
    questions = (qs ?? []).map((q: any) => ({
      id: q.id, questionNumber: q.question_number, type: q.question_type, questionText: q.question_text, subSection: q.sub_section,
      options: (q.question_options ?? []).sort((a:any,b:any)=>a.option_order-b.option_order).map((o:any)=>({key:o.option_key, text:o.option_text})),
      images: (q.question_images ?? []).sort((a:any,b:any)=>a.image_index-b.image_index).map((i:any)=>({imageIndex:i.image_index, url:i.url || `/api/image?path=${encodeURIComponent(i.storage_path)}`}))
    }));
    // keep order as in question_ids
    const order = new Map(room.question_ids.map((id:string,i:number)=>[id,i]));
    questions.sort((a,b)=>(order.get(a.id)??0)-(order.get(b.id)??0));
  }
  return NextResponse.json({ room, participants, questions: room.status === "waiting" ? [] : questions });
}