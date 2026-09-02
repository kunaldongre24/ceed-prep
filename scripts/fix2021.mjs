import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
const get = (k) => { const m = new RegExp("^" + k + "=(.*)$", "m").exec(env); return m ? m[1].trim() : ""; };
const supabase = createClient(get("SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

const data = {
  "sections": {
    "I": { "name": "NAT", "questions": { "1": { "key": 72 }, "2": { "key": 3 }, "3": { "key": 68 }, "4": { "key": 55 }, "5": { "key": 34 }, "6": { "key": 5 }, "7": { "key": 94.2, "range": "94.1-94.3" }, "8": { "key": 2.25, "range": "2.24-2.26" } } },
    "II": { "name": "MSQ", "questions": { "9": { "keys": ["A", "D"] }, "10": { "keys": ["A", "C"] }, "11": { "keys": ["A", "C"] }, "12": { "keys": ["A", "C", "D"] }, "13": { "keys": ["A", "C", "D"] }, "14": { "keys": ["A", "B", "D"] }, "15": { "keys": ["A", "D"] }, "16": { "keys": ["A"] }, "17": { "keys": ["B", "C"] }, "18": { "keys": ["B", "D"] } } },
    "III": { "name": "MCQ", "questions": { "19": { "key": "C" }, "20": { "key": "D" }, "21": { "key": "C" }, "22": { "key": "B" }, "23": { "key": "D" }, "24": { "key": "A" }, "25": { "key": "A" }, "26": { "key": "A" }, "27": { "key": "B" }, "28": { "key": "B" }, "29": { "key": "C" }, "30": { "key": "C" }, "31": { "key": "D" }, "32": { "key": "B" }, "33": { "key": "C" }, "34": { "key": "C" }, "35": { "key": "B" }, "36": { "key": "B" }, "37": { "key": "D" }, "38": { "key": "C" }, "39": { "key": "D" }, "40": { "key": "B" }, "41": { "key": "A" } } }
  }
};

const typeMap = { "I": "numeric", "II": "multiple_choice", "III": "single_choice" };

async function main() {
  const { data: exam } = await supabase.from("exams").select("id").eq("year", 2021).single();
  if (!exam) { console.error("2021 exam not found"); process.exit(1); }
  console.log("exam", exam.id);
  for (const [secKey, sec] of Object.entries(data.sections)) {
    for (const [qNumStr, qData] of Object.entries(sec.questions)) {
      const qNum = Number(qNumStr);
      let answer = null;
      let qType = typeMap[secKey];
      if (sec.name === "NAT") {
        if (qData.range) {
          const [min, max] = qData.range.split("-").map(Number);
          answer = { type: "numeric", min, max };
          qType = "numeric";
        } else {
          const v = qData.key;
          answer = Number.isInteger(v) ? { type: "integer", value: v } : { type: "decimal", value: v };
          qType = Number.isInteger(v) ? "integer" : "decimal";
        }
      } else if (sec.name === "MSQ") {
        const keys = qData.keys;
        // single key array like ["A"] is still multiple_choice per MSQ section, but with one option
        answer = { type: "multiple_choice", correctOptions: keys };
        qType = "multiple_choice";
      } else if (sec.name === "MCQ") {
        answer = { type: "single_choice", correctOptions: [qData.key] };
        qType = "single_choice";
      }
      const { error } = await supabase.from("questions").update({
        correct_answer_json: answer,
        raw_answer_text: qData.range ? qData.range : (qData.keys ? qData.keys.join(",") : String(qData.key)),
        question_type: qType,
        sub_section: secKey,
        status: "approved",
        updated_at: new Date().toISOString(),
      }).eq("exam_id", exam.id).eq("question_number", qNum);
      if (error) console.error(`Q${qNum} failed:`, error.message);
      else console.log(`Q${qNum} updated:`, qType, JSON.stringify(answer));
    }
  }
  console.log("done");
}
main();
