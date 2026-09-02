import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
function db(){return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});}
function evalAnswer(correct:any, user:any){
  if(!user) return "unattempted";
  if(!correct) return "incorrect";
  if(correct.type==="single_choice"||correct.type==="multiple_choice"){
    const sel=new Set((user.selectedOptions??[]).map((o:string)=>o.trim().toUpperCase()));
    if(sel.size===0) return "unattempted";
    const cand=[correct.correctOptions ?? [], ...(correct.type==="multiple_choice"? (correct.alternateSets??[]):[])];
    for(const set of cand){ const tgt=new Set(set.map((o:string)=>o.trim().toUpperCase())); if(sel.size===tgt.size && [...sel].every(v=>tgt.has(v))) return "correct"; }
    return "incorrect";
  }
  if(correct.type==="numeric"||correct.type==="integer"||correct.type==="decimal"){
    const parsed=typeof user.value==="number"?user.value:Number.isFinite(Number(user.value))?Number(user.value):null;
    if(parsed===null) return "unattempted";
    if(typeof correct.min==="number" && typeof correct.max==="number") return parsed>=correct.min && parsed<=correct.max ? "correct":"incorrect";
    if(typeof correct.value!=="number") return "incorrect";
    const tol=typeof correct.tolerance==="number"?correct.tolerance:0;
    return Math.abs(parsed-correct.value)<=tol+1e-9?"correct":"incorrect";
  }
  return "incorrect";
}
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { username, answers } = await req.json() as { username:string, answers: {questionId:string, answer:any}[] };
  if(!username || !Array.isArray(answers)) return NextResponse.json({error:"username and answers required"},{status:400});
  const supabase=db();
  const { data: room } = await supabase.from("rooms").select("id, question_ids").eq("code", code.toUpperCase()).single();
  if(!room) return NextResponse.json({error:"Room not found"},{status:404});
  const { data: qs } = await supabase.from("questions").select("id, correct_answer_json").in("id", room.question_ids ?? []);
  const cmap=new Map((qs??[]).map((q:any)=>[q.id, q.correct_answer_json]));
  let correct=0;
  const amap=new Map(answers.map(a=>[a.questionId, a.answer]));
  for(const qid of room.question_ids ?? []){
    const res=evalAnswer(cmap.get(qid), amap.get(qid));
    if(res==="correct") correct++;
  }
  const score=correct;
  await supabase.from("room_participants").update({ score, answers: Object.fromEntries(answers.map(a=>[a.questionId, a.answer])) }).eq("room_id", room.id).eq("username", username);
  // check if all participants submitted -> mark finished
  const { data: parts } = await supabase.from("room_participants").select("score").eq("room_id", room.id);
  const allDone = parts && parts.length>0 && parts.every((p:any)=>p.score!==null);
  // not auto-finishing, just return score
  return NextResponse.json({ score, correct, total: room.question_ids?.length ?? 0 });
}