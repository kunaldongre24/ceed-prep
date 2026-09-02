import { NextResponse } from "next/server";
import { getAuthUser, db } from "@/lib/server/auth";

/** POST /api/rooms/[code]/save — debounced progress persistence for the authed participant. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { code } = await params;
  const body = await req.json();
  const { answers, timings, currentIndex, timeRemaining, markedForReview } = body as {
    answers?: Record<string, unknown>;
    timings?: Record<string, number>;
    currentIndex?: number;
    timeRemaining?: number | null;
    markedForReview?: string[];
  };

  const supabase = db();
  const { data: room } = await supabase.from("rooms").select("id, status").eq("code", code.toUpperCase()).single();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (answers) update.answers = answers;
  if (timings) update.timings = timings;
  if (typeof currentIndex === "number") update.current_index = currentIndex;
  if (typeof timeRemaining === "number") update.time_remaining = Math.max(0, timeRemaining);
  if (markedForReview) update.marked_for_review = markedForReview;

  const { error } = await supabase
    .from("room_participants")
    .update(update)
    .eq("room_id", room.id)
    .eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}