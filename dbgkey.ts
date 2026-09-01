import fs from "node:fs";
import path from "node:path";
import { parseAnswerKey } from "./src/pipeline/answers";

for (const f of fs.readdirSync("extract-cache").filter(f => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join("extract-cache", f), "utf-8"));
  const name = j.file;
  if (!/2026-Answer-key|2023-answer-key|2020-answer-key/.test(name)) continue;
  const key = parseAnswerKey(j, 1);
  console.log(`\n=== ${path.basename(name)}: ${key.entries.size} entries ===`);
  const nums = [...key.entries.keys()].sort((a,b)=>a-b);
  console.log("numbers:", nums.join(","));
  for (const n of [1,2,9,10,19,25,30,41,44]) {
    const e = key.entries.get(n);
    console.log(`  Q${n}: ${e ? JSON.stringify({raw: e.raw, kind: e.kind, sec: e.keySection?.key ?? e.keySection}) : "MISSING"}`);
  }
  console.log("issues:", key.issues.slice(0,5));
}
