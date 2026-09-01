import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** GET /api/admin/questions — list all Section A questions for admin review */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const examId = url.searchParams.get("examId");
  const status = url.searchParams.get("status");
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
  const offset = (page - 1) * limit;

  const supabase = db();
  let query = supabase
    .from("questions")
    .select(
      `
      id, exam_id, question_number, section, sub_section, question_type,
      question_text, raw_question_text, raw_answer_text, correct_answer_json,
      status, extraction_method, extraction_confidence, source_pdf, source_pages,
      is_dropped, created_at, updated_at,
      question_options ( option_key, option_text, option_order ),
      question_images ( image_index, storage_path, url, source_page, bounding_box )
    `,
      { count: "exact" }
    )
    .eq("section", "A")
    .order("question_number", { ascending: true })
    .range(offset, offset + limit - 1);

  if (examId) query = query.eq("exam_id", examId);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ questions: data, total: count, page, limit });
}
