import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function db(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function looksLikeJwt(v: string): boolean {
  return v.split(".").length === 3;
}

function extractAccessToken(cookieValue: string): string | null {
  if (!cookieValue) return null;
  const candidates = new Set<string>();
  candidates.add(cookieValue);
  try {
    candidates.add(decodeURIComponent(cookieValue));
  } catch {
    /* ignore */
  }
  try {
    const b64 = cookieValue.replace(/%3D/gi, "=");
    candidates.add(Buffer.from(b64, "base64").toString("utf-8"));
  } catch {
    /* ignore */
  }
  for (const c of candidates) {
    if (looksLikeJwt(c)) return c;
    try {
      const parsed = JSON.parse(c);
      if (typeof parsed === "string") {
        if (looksLikeJwt(parsed)) return parsed;
      } else if (parsed && typeof parsed === "object" && typeof parsed.access_token === "string") {
        return parsed.access_token;
      }
    } catch {
      /* not json */
    }
  }
  return null;
}

export async function getAuthUser(req: Request): Promise<{ user: { id: string } } | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = parseCookies(cookieHeader);
  const key = Object.keys(cookies).find(
    (k) => k.startsWith("sb-") && k.includes("auth-token")
  );
  if (!key) return null;
  const token = extractAccessToken(cookies[key]);
  if (!token) return null;
  const supabase = db();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: { id: data.user.id } };
}

export async function getUserUsername(userId: string): Promise<string | null> {
  const supabase = db();
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.username ?? null;
}