import fs from "node:fs";
import path from "node:path";
for (const f of fs.readdirSync("extract-cache").filter(f => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join("extract-cache", f), "utf-8"));
  if (/2026-Answer-key/.test(j.file)) {
    console.log("cache file:", f, "size:", fs.statSync(path.join("extract-cache", f)).size);
    const p = j.pages[0];
    // print raw lines with digits in y 110..170
    for (const l of p.lines) {
      if (l.bbox[1] > 105 && l.bbox[1] < 170) console.log(`y=${l.bbox[1].toFixed(0)} :: ${JSON.stringify(l.text)}`);
    }
  }
}
