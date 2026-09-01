/**
 * Initialize Supabase database: apply schema + load normalized JSON data.
 *
 *   pnpm db:init
 *
 * Idempotent: safe to run multiple times. Upserts exams and questions.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ROOT, DIRS } from "../src/pipeline/config";
import type { ExtractedQuestion } from "../src/pipeline/types";

function loadDotEnv(): void {
  const envPath = path.join(ROOT, ".env");
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env — fine */
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
    process.exit(1);
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Apply schema
  const schemaPath = path.join(ROOT, "supabase", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  const { error: schemaErr } = await db.rpc("exec_sql" as never, { sql: schema } as never);
  if (schemaErr) {
    // Fallback: split by semicolons and execute individually
    console.log("Direct exec_sql not available, applying schema via individual statements...");
    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    for (const stmt of statements) {
      const { error } = await db.rpc("exec_sql" as never, { sql: stmt + ";" } as never);
      if (error) {
        console.warn(`  Statement warning: ${error.message}`);
      }
    }
  }
  console.log("Schema applied.");

  // Load normalized JSON files
  const normalizedDir = DIRS.normalized;
  if (!fs.existsSync(normalizedDir)) {
    console.log("No normalized data directory found. Run `pnpm process-papers` first.");
    return;
  }

  const files = fs.readdirSync(normalizedDir).filter((f) => f.endsWith(".json"));
  let totalUpserted = 0;
  let totalExams = 0;

  for (const file of files) {
    const filePath = path.join(normalizedDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
      year: number;
      questions: ExtractedQuestion[];
    };

    if (!data.questions || data.questions.length === 0) {
      console.log(`  ${file}: 0 questions — skipping.`);
      continue;
    }

    // Upsert exam
    const { data: examRow, error: examErr } = await db
      .from("exams")
      .upsert(
        {
          name: `CEED ${data.year}`,
          year: data.year,
          paper_identifier: "main",
          question_paper_path: `${data.year}-question-paper.pdf`,
          answer_key_path: `${data.year}-answer-key.pdf`,
        },
        { onConflict: "year,paper_identifier" }
      )
      .select("id")
      .single();

    if (examErr) {
      console.error(`  ${file}: exam upsert failed — ${examErr.message}`);
      continue;
    }

    const examId = examRow.id as string;
    totalExams++;

    let yearCount = 0;
    for (const q of data.questions) {
      const { data: qRow, error: qErr } = await db
        .from("questions")
        .upsert(
          {
            exam_id: examId,
            question_number: q.questionNumber,
            section: q.section,
            sub_section: q.subSection ?? null,
            question_type: q.type,
            question_text: q.questionText,
            raw_question_text: q.rawQuestionText,
            raw_answer_text: q.rawAnswer ?? null,
            correct_answer_json: q.answer,
            status: q.status,
            extraction_method: q.extractionMethod,
            extraction_confidence: q.extractionConfidence,
            source_pdf: q.sourcePdf,
            source_pages: q.sourcePages,
            is_dropped: q.isDropped,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "exam_id,section,question_number" }
        )
        .select("id")
        .single();

      if (qErr) {
        console.warn(`  Q${q.questionNumber}: ${qErr.message}`);
        continue;
      }

      const questionId = qRow.id as string;

      // Upsert options
      await db.from("question_options").delete().eq("question_id", questionId);
      if (q.options.length > 0) {
        await db.from("question_options").insert(
          q.options.map((o) => ({
            question_id: questionId,
            option_key: o.key,
            option_text: o.text,
            option_order: o.order,
          }))
        );
      }

      yearCount++;
    }

    totalUpserted += yearCount;
    console.log(`  ${file}: ${yearCount} questions upserted for CEED ${data.year}.`);
  }

  console.log(`\nDone. ${totalExams} exams, ${totalUpserted} questions loaded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
