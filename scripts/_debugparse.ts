import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT } from "../src/pipeline/config";
import { runPython } from "../src/pipeline/pyrun";
import { parseAnswerKey } from "../src/pipeline/answers";
import type { PdfStructure } from "../src/pipeline/pdfjson";

const root = ROOT;
const cacheDir = path.join(root, "extract-cache");

async function loadStructure(filePath: string): Promise<PdfStructure> {
  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
  const cachePath = path.join(cacheDir, `${hash}.json`);
  if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  const out = path.join(cacheDir, `${hash}.json`);
  await runPython("extract_structure.py", [filePath, out], 600000);
  return JSON.parse(fs.readFileSync(out, "utf-8"));
}

async function main() {
  const keys = [
    "CEED-2020-answer-key.pdf",
    "CEED-2023-answer-key.pdf",
    "CEED-2026-Answer-key.pdf",
    "ceed-2017-answer.pdf",
    "ceed-2018-answer.pdf",
  ];
  for (const k of keys) {
    const fp = path.join(root, k);
    if (!fs.existsSync(fp)) continue;
    const struct = await loadStructure(fp);
    const key = parseAnswerKey(struct, 1);
    const nums = [...key.entries.keys()].sort((a, b) => a - b);
    console.log(`\n=== ${k} ===`);
    console.log(`matched: ${key.entries.size}`);
    console.log(`numbers: ${nums.join(",")}`);
    const samples = [...key.entries.entries()].slice(0, 8);
    for (const [n, e] of samples) {
      console.log(`  Q${n}: raw=${JSON.stringify(e.raw)} kind=${e.kind} sec=${e.keySection?.key}/${e.keySection?.typeHint ?? "-"}`);
    }
    if (key.issues.length) console.log(`issues: ${key.issues.slice(0, 5).join(" | ")}`);
  }
}

main();
