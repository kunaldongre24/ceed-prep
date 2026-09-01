import fs from "node:fs";
import path from "node:path";
for (const f of fs.readdirSync("extract-cache").filter(f => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join("extract-cache", f), "utf-8"));
  if (/2026-Answer-key/.test(j.file)) {
    console.log("pageCount:", j.pageCount);
    j.pages.forEach((p: any) => {
      console.log(`--- page ${p.page} h=${p.height} lines=${p.lines.length} ---`);
      for (const l of p.lines.slice(0, 8)) console.log(`  y=${l.bbox[1].toFixed(0)} ${JSON.stringify(l.text.slice(0,40))}`);
    });
  }
}
