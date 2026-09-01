import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CONFIG, DIRS, hasSupabase } from "./config";
import { renderFigureLocal } from "./images";
import type { ExtractedQuestion } from "./types";

/**
 * Persistence: Supabase (service role, server-side only) with idempotent
 * upserts, or a dry-run JSON/local-image mode when Supabase env is absent.
 * Running the importer multiple times never duplicates questions or images.
 */

export interface ImportOutcome {
  year: number;
  mode: "supabase" | "dry-run";
  questionsUpserted: number;
  imagesUploaded: number;
  exams: string[];
}

function serviceClient(): SupabaseClient {
  return createClient(CONFIG.supabase.url, CONFIG.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function persistYear(
  year: number,
  questions: ExtractedQuestion[],
  pdfPath: string,
  paperName: string | null,
  keyName: string | null
): Promise<ImportOutcome> {
  if (!hasSupabase()) return dryRunPersist(year, questions);

  const db = serviceClient();
  const outcome: ImportOutcome = {
    year,
    mode: "supabase",
    questionsUpserted: 0,
    imagesUploaded: 0,
    exams: [],
  };

  // --- exam upsert (unique (year, paper_identifier)) ---
  const { data: examRow, error: examErr } = await db
    .from("exams")
    .upsert(
      {
        name: `CEED ${year}`,
        year,
        paper_identifier: "main",
        question_paper_path: paperName,
        answer_key_path: keyName,
      },
      { onConflict: "year,paper_identifier" }
    )
    .select("id")
    .single();
  if (examErr) throw new Error(`exam upsert failed: ${examErr.message}`);
  const examId = examRow.id as string;
  outcome.exams.push(examId);

  await ensureBucket(db);

  for (const q of questions) {
    // --- question upsert (unique (exam_id, section, question_number)) ---
    const { data: qRow, error: qErr } = await db
      .from("questions")
      .upsert(
        {
          exam_id: examId,
          question_number: q.questionNumber,
          section: q.section,
          sub_section: q.subSection,
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
    if (qErr) throw new Error(`question upsert failed (Q${q.questionNumber}): ${qErr.message}`);
    const questionId = qRow.id as string;
    outcome.questionsUpserted++;

    // --- options: replace ---
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

    // --- images: deterministic storage paths → overwrite; rows replaced ---
    await db.from("question_images").delete().eq("question_id", questionId);
    let imgIndex = 0;
    for (const fig of q.images) {
      const storagePath = `${examId}/q${String(q.questionNumber).padStart(2, "0")}/${imgIndex}.png`;
      const local = await renderFigureLocal(year, q.questionNumber, imgIndex, pdfPath, {
        page: fig.sourcePage ?? 1,
        bbox: [
          fig.boundingBox!.x,
          fig.boundingBox!.y,
          fig.boundingBox!.x + fig.boundingBox!.width,
          fig.boundingBox!.y + fig.boundingBox!.height,
        ],
      });
      if (!local) continue;
      const buf = fs.readFileSync(local);
      const { error: upErr } = await db.storage
        .from(CONFIG.storageBucket)
        .upload(storagePath, buf, { contentType: "image/png", upsert: true });
      if (upErr && !String(upErr.message).includes("exists")) {
        console.warn(`    ! upload failed for Q${q.questionNumber} img${imgIndex}: ${upErr.message}`);
        continue;
      }
      const { data: pub } = db.storage.from(CONFIG.storageBucket).getPublicUrl(storagePath);
      await db.from("question_images").insert({
        question_id: questionId,
        image_index: imgIndex,
        storage_path: storagePath,
        url: pub?.publicUrl ?? null,
        source_page: fig.sourcePage,
        bounding_box: fig.boundingBox,
      });
      imgIndex++;
      outcome.imagesUploaded++;
    }
  }

  return outcome;
}

async function ensureBucket(db: SupabaseClient): Promise<void> {
  const { data: buckets } = await db.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === CONFIG.storageBucket);
  if (!exists) {
    const { error } = await db.storage.createBucket(CONFIG.storageBucket, {
      public: true,
      fileSizeLimit: "10MB",
    });
    if (error && !String(error.message).toLowerCase().includes("exist")) {
      throw new Error(`bucket create failed: ${error.message}`);
    }
  }
}

/** No Supabase configured: write normalized JSON + local PNGs so the whole
 *  pipeline is verifiable offline; a later run with creds flips to DB mode. */
async function dryRunPersist(year: number, questions: ExtractedQuestion[]): Promise<ImportOutcome> {
  fs.mkdirSync(DIRS.normalized, { recursive: true });
  fs.mkdirSync(DIRS.images, { recursive: true });
  const out = path.join(DIRS.normalized, `${year}.json`);
  fs.writeFileSync(out, JSON.stringify({ year, questions }, null, 2));
  return {
    year,
    mode: "dry-run",
    questionsUpserted: questions.length,
    imagesUploaded: questions.reduce((acc, q) => acc + q.images.length, 0),
    exams: [`dry-run:${out}`],
  };
}
