import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** GET /api/image?path=... — proxy storage images (keeps credentials server-side) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  const supabase = db();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "question-images";

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const arrayBuffer = await data.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
