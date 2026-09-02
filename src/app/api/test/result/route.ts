import { NextResponse } from "next/server";
import { getAuthUser, db } from "@/lib/server/auth";
import { buildTestResult } from "@/lib/server/evaluate";

/** GET /api/test/result?sessionId= — fetch a submitted test's full result. */
export async function GET(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const supabase = db();
  const { data: session, error: sessErr } = await supabase
    .from("test_sessions")
    .select("id, user_id, submitted_at")
    .eq("id", sessionId)
    .single();
  if (sessErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.user_id && session.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.submitted_at) {
    return NextResponse.json({ error: "Session not submitted" }, { status: 409 });
  }

  const payload = await buildTestResult(supabase, sessionId);
  return NextResponse.json(payload);
}