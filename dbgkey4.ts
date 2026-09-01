import fs from "node:fs";
import path from "node:path";
// Replicate the EXACT internal path of parseAnswerKeyPage with logging
import { HEADER_BAND, FOOTER_BAND } from "./src/pipeline/structure";

for (const f of fs.readdirSync("extract-cache").filter(f => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join("extract-cache", f), "utf-8"));
  if (!/2026-Answer-key/.test(j.file)) continue;
  const page = j.pages[0];

  // import internals via a build of the module? Instead replicate:
  const frags: any[] = [];
  for (const l of page.lines) {
    if (l.bbox[1] <= HEADER_BAND || l.bbox[3] >= page.height - FOOTER_BAND) continue;
    for (const s of l.spans) {
      const text = s.text.replace(/\u00a0/g, " ");
      const textLen = Math.max(1, s.text.length);
      const charW = (s.bbox[2] - s.bbox[0]) / textLen;
      const parts = text.split(/\s{3,}/);
      let charPos = 0;
      for (const part of parts) {
        const lead = part.length - part.trimStart().length;
        const t = part.trim();
        if (t) frags.push({ text: t, x0: s.bbox[0] + charW * (charPos + lead), x1: s.bbox[0] + charW * (charPos + part.length), y0: s.bbox[1], y1: s.bbox[3] });
        charPos += part.length;
      }
    }
  }
  console.log("fragments:", frags.length);
  const qCols: {x0:number,x1:number}[] = [];
  for (const l of page.lines) {
    if (l.bbox[1] <= HEADER_BAND || l.bbox[3] >= page.height - FOOTER_BAND) continue;
    for (const s of l.spans) {
      if (/^(Q\.?\s*No\.?|Q)$/i.test(s.text.trim())) qCols.push({ x0: s.bbox[0], x1: s.bbox[2] });
    }
  }
  qCols.sort((a,b)=>a.x0-b.x0);
  console.log("qCols:", qCols.length);

  const nums = frags.filter((f) => /^\d{1,2}$/.test(f.text));
  let found = 0, noCol = 0, noVal = 0;
  for (const num of nums) {
    const n = Number(num.text);
    if (n < 1 || n > 60) continue;
    const cx = (num.x0 + num.x1)/2;
    const col = qCols.find((c) => cx >= c.x0 - 8 && cx <= c.x1 + 8);
    if (!col) { noCol++; continue; }
    const nextQStart = qCols.find((c) => c.x0 > col.x1 + 4)?.x0 ?? Infinity;
    const cand = frags.filter((f) => f !== num && f.x0 >= col.x1 - 6 && f.x0 < nextQStart - 4 && (Math.abs(f.y0 - num.y0) <= 8 || (f.y0 >= num.y1 - 2 && f.y0 <= num.y1 + 14)));
    if (cand.length === 0) { noVal++; if (noVal < 5) console.log(`Q${n}: no candidates (col ${col.x0.toFixed(0)}-${col.x1.toFixed(0)}, num ${num.x0.toFixed(0)}-${num.x1.toFixed(0)} y${num.y0.toFixed(0)})`); continue; }
    found++;
    if (found <= 5) console.log(`Q${n}: ${cand.map(c=>c.text).join("|")}`);
  }
  console.log({found, noCol, noVal});
  break;
}
