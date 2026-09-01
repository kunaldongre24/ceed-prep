import path from "node:path";
import fs from "node:fs";

/** Project root (the folder containing the PDFs, python/, src/). */
export const ROOT = path.resolve(process.cwd());

// Load `.env` BEFORE CONFIG is built so pipeline scripts that rely on the
// module-level CONFIG snapshot see Supabase/LLM credentials. Node hoists
// imports (config is evaluated first), so a caller-side loadDotEnv() alone is
// too late — this must happen here at module scope.
(function loadEnvEarly(): void {
  try {
    const envPath = path.join(ROOT, ".env");
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env — fine */
  }
})();

export const DIRS = {
  python: path.join(ROOT, "python"),
  cache: path.join(ROOT, "extract-cache"),
  data: path.join(ROOT, "data"),
  normalized: path.join(ROOT, "data", "normalized"),
  images: path.join(ROOT, "data", "images"),
  reports: path.join(ROOT, "reports"),
};

export const CONFIG = {
  confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD ?? "0.8"),
  renderZoom: Number(process.env.RENDER_DPI_SCALE ?? "2.5"),
  maxImageWidth: Number(process.env.MAX_IMAGE_WIDTH ?? "1400"),
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "question-images",
  agentrouter: {
    baseUrl: process.env.AGENTROUTER_BASE_URL ?? "https://agentrouter.org/v1",
    apiKey: process.env.AGENTROUTER_API_KEY ?? "",
    model: process.env.AGENTROUTER_MODEL ?? "gpt-5.6-sol",
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? "",
    anonKey: process.env.SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
};

export function ensureDirs(): void {
  for (const dir of [DIRS.cache, DIRS.data, DIRS.normalized, DIRS.images, DIRS.reports]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function hasSupabase(): boolean {
  return Boolean(CONFIG.supabase.url && CONFIG.supabase.serviceRoleKey);
}

export function hasLlm(): boolean {
  return Boolean(CONFIG.agentrouter.apiKey);
}
