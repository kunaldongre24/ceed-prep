"use client";

import { useEffect, useState, useCallback } from "react";

interface Exam {
  id: string;
  name: string;
  year: number;
}

interface QuestionOption {
  option_key: string;
  option_text: string;
  option_order: number;
}

interface QuestionImage {
  image_index: number;
  storage_path: string;
  url: string | null;
  source_page: number;
  bounding_box: { x: number; y: number; width: number; height: number } | null;
}

interface Question {
  id: string;
  exam_id: string;
  question_number: number;
  section: string;
  sub_section: string | null;
  question_type: string;
  question_text: string;
  raw_question_text: string;
  raw_answer_text: string | null;
  correct_answer_json: unknown;
  status: string;
  extraction_method: string;
  extraction_confidence: number;
  source_pdf: string;
  source_pages: number[];
  is_dropped: boolean;
  created_at: string;
  updated_at: string;
  question_options: QuestionOption[];
  question_images: QuestionImage[];
}

const TYPE_LABELS: Record<string, string> = {
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  numeric: "Numeric",
  integer: "Integer",
  decimal: "Decimal",
  text: "Text",
  unknown: "Unknown",
};

export default function AdminPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/exams")
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .catch(() => {});
  }, []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (selectedExam) params.set("examId", selectedExam);
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/admin/questions?${params}`);
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setQuestions([]);
    }
    setLoading(false);
  }, [page, selectedExam, statusFilter]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const updateQuestion = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    fetchQuestions();
  };

  const approve = async (id: string) => updateQuestion(id, { status: "approved" });
  const reject = async (id: string) => updateQuestion(id, { status: "rejected" });

  const formatAnswer = (q: Question) => {
    const a = q.correct_answer_json as Record<string, unknown> | null;
    if (!a) return "No answer";
    switch (a.type as string) {
      case "single_choice":
      case "multiple_choice":
        return (a.correctOptions as string[])?.join(", ") ?? "—";
      case "numeric":
        if (a.min !== undefined && a.max !== undefined) return `${a.min} to ${a.max}`;
        return String(a.value ?? "—");
      case "integer":
      case "decimal":
        return String(a.value ?? "—");
      case "text":
        return String(a.value ?? "—");
      case "unknown":
        return a.rawAnswer ? `Raw: ${a.rawAnswer}` : "—";
      default:
        return JSON.stringify(a);
    }
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Admin — Question Review
      </h1>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <select
          value={selectedExam}
          onChange={(e) => { setSelectedExam(e.target.value); setPage(1); }}
          style={{ padding: "0.5rem", background: "#1a1a1a", color: "#fff", border: "1px solid #333", borderRadius: 6 }}
        >
          <option value="">All Exams</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: "0.5rem", background: "#1a1a1a", color: "#fff", border: "1px solid #333", borderRadius: 6 }}
        >
          <option value="">All Statuses</option>
          <option value="needs_review">Needs Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <span style={{ color: "#888", alignSelf: "center", fontSize: "0.875rem" }}>
          {total} questions
        </span>
      </div>

      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : questions.length === 0 ? (
        <p style={{ color: "#888" }}>No questions found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {questions.map((q) => (
            <div
              key={q.id}
              style={{
                border: "1px solid #333",
                borderRadius: 8,
                padding: "1rem 1.25rem",
                background: q.status === "approved" ? "#0a1a0a" : q.status === "rejected" ? "#1a0a0a" : "#111",
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
                onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>Q{q.question_number}</span>
                  <span style={{ marginLeft: "0.75rem", color: "#888", fontSize: "0.85rem" }}>
                    {TYPE_LABELS[q.question_type] ?? q.question_type}
                  </span>
                  {q.sub_section && (
                    <span style={{ marginLeft: "0.5rem", color: "#666", fontSize: "0.8rem" }}>
                      Sec {q.sub_section}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: q.status === "approved" ? "#166534" : q.status === "rejected" ? "#991b1b" : "#854d0e",
                      color: "#fff",
                    }}
                  >
                    {q.status}
                  </span>
                  <span style={{ color: "#666", fontSize: "0.8rem" }}>
                    {Math.round((q.extraction_confidence ?? 0) * 100)}%
                  </span>
                </div>
              </div>

              {expandedId === q.id && (
                <div style={{ marginTop: "1rem", borderTop: "1px solid #333", paddingTop: "1rem" }}>
                  <p style={{ marginBottom: "0.75rem", lineHeight: 1.7 }}>{q.question_text}</p>

                  {q.question_images.length > 0 && (
                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                      {q.question_images.map((img) => (
                        <img
                          key={img.image_index}
                          src={img.url || `/api/image?path=${encodeURIComponent(img.storage_path)}`}
                          alt={`Q${q.question_number} figure ${img.image_index}`}
                          style={{ maxWidth: 400, maxHeight: 300, border: "1px solid #333", borderRadius: 4 }}
                        />
                      ))}
                    </div>
                  )}

                  {q.question_options.length > 0 && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      {q.question_options.map((o) => (
                        <div key={o.option_key} style={{ marginLeft: "1rem" }}>
                          <strong>{o.option_key}.</strong> {o.option_text}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: "0.9rem", color: "#aaa", marginBottom: "0.5rem" }}>
                    <strong>Answer:</strong> {formatAnswer(q)}
                  </div>
                  {q.raw_answer_text && (
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                      Raw: {q.raw_answer_text}
                    </div>
                  )}
                  <div style={{ fontSize: "0.8rem", color: "#555", marginBottom: "0.75rem" }}>
                    Method: {q.extraction_method} | Source: {q.source_pdf} | Pages: {q.source_pages?.join(",")}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => approve(q.id)}
                      style={{ padding: "0.4rem 1rem", background: "#166534", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.85rem" }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reject(q.id)}
                      style={{ padding: "0.4rem 1rem", background: "#991b1b", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.85rem" }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 30 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "1.5rem" }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{ padding: "0.4rem 1rem", background: "#333", color: "#fff", border: "none", borderRadius: 4, opacity: page <= 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span style={{ color: "#888", alignSelf: "center" }}>Page {page}</span>
          <button
            disabled={page * 30 >= total}
            onClick={() => setPage((p) => p + 1)}
            style={{ padding: "0.4rem 1rem", background: "#333", color: "#fff", border: "none", borderRadius: 4, opacity: page * 30 >= total ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}
