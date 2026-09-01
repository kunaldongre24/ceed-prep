/**
 * Apply supabase/schema.sql to a Supabase project via the Management API.
 * Requires a Supabase personal access token (SUPABASE_PAT) and SUPABASE_URL.
 * Usage: node scripts/apply-schema.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadDotEnv() {
  try {
    const content = fs.readFileSync(path.join(ROOT, ".env"), "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch { /* ignore */ }
}

function projectRef(url) {
  const m = /^https?:\/\/([^.]+)\./.exec(url);
  if (!m) throw new Error(`Cannot derive project ref from URL: ${url}`);
  return m[1];
}

async function main() {
  loadDotEnv();
  const url = process.env.SUPABASE_URL;
  const pat = process.env.SUPABASE_PAT;
  if (!url || !pat) {
    console.error("SUPABASE_URL and SUPABASE_PAT must be set in .env");
    process.exit(1);
  }

  const ref = projectRef(url);
  const schema = fs.readFileSync(path.join(ROOT, "supabase", "schema.sql"), "utf-8");

  // Strip SQL comments before splitting so a semicolon inside a `--` comment
  // doesn't fragment a statement.
  const noComments = schema
    .split(/\r?\n/)
    .map((l) => l.replace(/\s*--.*$/, ""))
    .join("\n");

  const query = noComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(";\n") + ";";

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Management API error ${res.status}: ${text}`);
    process.exit(1);
  }
  console.log(`Schema applied to project ${ref}.`);
  try {
    console.log("Response:", JSON.stringify(JSON.parse(text)));
  } catch {
    console.log("Response:", text);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
