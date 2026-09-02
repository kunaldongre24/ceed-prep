import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * POST /api/test/start
 * Body: { questionCount: number }
 *
 * Creates a test session, randomly selects approved Section A questions
 * from ALL exams, and returns the session ID + sanitized questions (no answers).
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { questionCount } = body as { questionCount?: number };

  if (!questionCount || questionCount < 1 || questionCount > 100) {
    return NextResponse.json(
      { error: "questionCount (1-100) required" },
      { status: 400 }
    );
  }

  const supabase = db();

  // Count available approved Section A questions across ALL exams
  const { count, error: countErr } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("section", "A")
    .eq("status", "approved")
    .eq("is_dropped", false);

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if (!count || count === 0) {
    return NextResponse.json(
      { error: "No approved Section A questions available" },
      { status: 404 }
    );
  }

  // Fetch all approved questions with options to filter out choice Qs without options
  const { data: allQuestions, error: fetchErr } = await supabase
    .from("questions")
    .select("id, question_type, question_options (id), question_images (id)")
    .eq("section", "A")
    .eq("status", "approved")
    .eq("is_dropped", false);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  // Keep only usable questions: choice types must have options or option-images, others always usable
  const usable = (allQuestions ?? []).filter((q: any) => {
    if (q.question_type === "single_choice" || q.question_type === "multiple_choice") {
      const hasTextOpts = (q.question_options?.length ?? 0) > 0;
      const hasImgs = (q.question_images?.length ?? 0) > 0;
      return hasTextOpts || hasImgs;
    }
    return true;
  });

  if (usable.length === 0) {
    return NextResponse.json({ error: "No usable questions (with options/images) available" }, { status: 404 });
  }

  const actualUsableCount = Math.min(questionCount, usable.length);
  // Random shuffle and pick
  const shuffled = usable.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, actualUsableCount);

  // Create session (no exam_id linkage — global question bank)
  const { data: session, error: sessErr } = await supabase
    .from("test_sessions")
    .insert({ question_count: actualUsableCount })
    .select("id")
    .single();

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

  // Link questions to session
  const links = selected.map((q, i) => ({
    test_session_id: session.id,
    question_id: q.id,
    question_order: i + 1,
  }));

  const { error: linkErr } = await supabase.from("test_session_questions").insert(links);
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  // Fetch full question data (no answers)
  const questionIds = selected.map((q) => q.id);
  const { data: fullQuestions, error: qErr } = await supabase
    .from("questions")
    .select(
      `
      id, question_number, question_type, question_text, sub_section,
      question_options ( option_key, option_text, option_order ),
      question_images ( image_index, storage_path, url )
    `
    )
    .in("id", questionIds);

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  // Sanitize: strip answer fields
  const sanitized = (fullQuestions ?? []).map((q) => ({
    id: q.id,
    questionNumber: q.question_number,
    type: q.question_type,
    questionText: q.question_text,
    subSection: q.sub_section,
    options: (q.question_options ?? [])
      .slice()
      .sort((a: { option_order: number }, b: { option_order: number }) => a.option_order - b.option_order)
      .map((o: { option_key: string; option_text: string }) => ({
        key: o.option_key,
        text: o.option_text,
      })),
    images: (q.question_images ?? [])
      .slice()
      .sort((a: { image_index: number }, b: { image_index: number }) => a.image_index - b.image_index)
      .map((i: { image_index: number; url: string | null; storage_path: string }) => ({
        imageIndex: i.image_index,
        url: i.url || `/api/image?path=${encodeURIComponent(i.storage_path)}`,
      })),
  }));

  // Sort by question order
  const orderMap = new Map(links.map((l) => [l.question_id, l.question_order]));
  sanitized.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  return NextResponse.json({
    sessionId: session.id,
    questionCount: actualUsableCount,
    questions: sanitized,
  });
}