import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
const env = fs.readFileSync(envPath, "utf-8");
const get = (k) => {
  const m = new RegExp("^" + k + "=(.*)$", "m").exec(env);
  return m ? m[1].trim() : "";
};
const url = get("SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.auth.admin.listUsers();
if (error) { console.error(error); process.exit(1); }
console.log("found", data.users.length, "users");
for (const u of data.users) {
  const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
  console.log(delErr ? "failed "+u.id+": "+delErr.message : "deleted "+(u.email||u.id));
}
