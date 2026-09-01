import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** PATCH /api/admin/questions/[id] — update question fields */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const supabase = db();

  // Whitelist updatable fields
  const allowed: Record<string, unknown> = {};
  const fields = [
    "question_type",
    "question_text",
    "status",
    "sub_section",
    "correct_answer_json",
    "is_dropped",
  ];
  for (const f of fields) {
    if (f in body) allowed[f] = body[f];
  }
  allowed.updated_at = new Date().toISOString();

  const { error } = await supabase.from("questions").update(allowed).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If options were provided, replace them
  if (Array.isArray(body.options)) {
    await supabase.from("question_options").delete().eq("question_id", id);
    if (body.options.length > 0) {
      await supabase.from("question_options").insert(
        body.options.map((o: { key: string; text: string; order: number }) => ({
          question_id: id,
          option_key: o.key,
          option_text: o.text,
          option_order: o.order,
        }))
      );
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/questions/[id] — delete a question */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = db();
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
