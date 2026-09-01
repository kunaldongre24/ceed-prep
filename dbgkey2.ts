import fs from "node:fs";
import path from "node:path";
for (const f of fs.readdirSync("extract-cache").filter(f => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join("extract-cache", f), "utf-8"));
  if (!/2026-Answer-key/.test(j.file)) continue;
  const p = j.pages[0];
  console.log(`page ${p.page} h=${p.height} lines:`);
  for (const l of p.lines) {
    console.log(`y=${l.bbox[1].toFixed(0)}-${l.bbox[3].toFixed(0)} :: ${JSON.stringify(l.text)}`);
    for (const s of l.spans) console.log(`    span x=${s.bbox[0].toFixed(0)}-${s.bbox[2].toFixed(0)} ${JSON.stringify(s.text.slice(0,40))}`);
  }
  break;
}
