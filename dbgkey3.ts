import fs from "node:fs";
import path from "node:path";
for (const f of fs.readdirSync("extract-cache").filter(f => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join("extract-cache", f), "utf-8"));
  if (!/2026-Answer-key/.test(j.file)) continue;
  const p = j.pages[0];
  // replicate collectFragments quickly
  const frags: {text:string,x0:number,y0:number,x1:number,y1:number}[] = [];
  for (const l of p.lines) {
    if (l.bbox[1] <= 72 || l.bbox[3] >= p.height - 58) continue;
    for (const s of l.spans) frags.push({ text: s.text.trim(), x0: s.bbox[0], y0: s.bbox[1], x1: s.bbox[2], y1: s.bbox[3] });
  }
  console.log("total fragments:", frags.length);
  const qhdr = frags.filter(f => /^Q\.?\s*No\.?$/i.test(f.text));
  console.log("Q headers:", JSON.stringify(qhdr.map(h => [h.text, h.x0, h.x1])));
  const nums = frags.filter(f => /^\d{1,2}$/.test(f.text));
  console.log("pure numbers:", nums.length, JSON.stringify(nums.slice(0, 12).map(n => [n.text, n.x0.toFixed(0), n.y0.toFixed(0)])));
  break;
}
