"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Question {
  id: string;
  questionNumber: number;
  type: string;
  questionText: string;
  subSection?: string | null;
  options: { key: string; text: string }[];
  images: { imageIndex: number; url: string; storage_path: string }[];
}

interface UserAnswer {
  selectedOptions?: string[];
  value?: number | string;
  text?: string;
}

function TestTake() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      router.push("/test");
      return;
    }
    const stored = sessionStorage.getItem(`test-${sessionId}`);
    if (!stored) {
      router.push("/test");
      return;
    }
    const data = JSON.parse(stored);
    setQuestions(data.questions);
  }, [sessionId, router]);

  const [loadedImgs, setLoadedImgs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoadedImgs({});
  }, [currentIdx]);

  const setAnswer = useCallback(
    (questionId: string, answer: UserAnswer) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    },
    []
  );

  const submit = async () => {
    if (!sessionId) return;
    setSubmitting(true);

    const payload = {
      sessionId,
      answers: questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] ?? {},
      })),
    };

    try {
      const res = await fetch("/api/test/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      sessionStorage.setItem(`result-${sessionId}`, JSON.stringify(data));
      router.push(`/test/result?sessionId=${sessionId}`);
    } catch {
      setSubmitting(false);
    }
  };

  if (questions.length === 0) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <p style={{ color: "#888" }}>Loading test...</p>
      </main>
    );
  }

  const q = questions[currentIdx];
  const answered = Object.keys(answers).length;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem", color: "#888", fontSize: "0.875rem" }}>
        <span>Question {currentIdx + 1} of {questions.length}</span>
        <span>{answered} answered</span>
      </div>

      <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {questions.map((_, i) => {
          const aId = questions[i].id;
          const hasAnswer = !!answers[aId];
          return (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                border: i === currentIdx ? "2px solid #3b82f6" : "1px solid #333",
                background: hasAnswer ? "#166534" : "#1a1a1a",
                color: "#fff",
                fontSize: "0.75rem",
                fontWeight: i === currentIdx ? 700 : 400,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: "0.5rem", color: "#888", fontSize: "0.8rem" }}>
        Q{q.questionNumber}
        {q.subSection && <span style={{ marginLeft: "0.5rem" }}>Section {q.subSection}</span>}
      </div>

      <div style={{ marginBottom: "1rem", lineHeight: 1.7 }}>{q.questionText}</div>

      {q.images.length > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {q.images.map((img) => {
            const key = `${q.id}-${img.imageIndex}`;
            const loaded = loadedImgs[key];
            return (
              <div key={key} style={{ position: "relative", minWidth: 200, minHeight: 150, maxWidth: 500, maxHeight: 400, border: "1px solid #333", borderRadius: 4, overflow: "hidden", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {!loaded && <div style={{ position: "absolute", color: "#888", fontSize: "0.85rem" }}>Loading image...</div>}
                <img
                  src={img.url}
                  alt={`Figure ${img.imageIndex + 1}`}
                  onLoad={() => setLoadedImgs((prev) => ({ ...prev, [key]: true }))}
                  onError={() => setLoadedImgs((prev) => ({ ...prev, [key]: true }))}
                  style={{ maxWidth: "100%", maxHeight: 400, opacity: loaded ? 1 : 0, transition: "opacity 0.2s" }}
                />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginBottom: "1.5rem" }}>
        <AnswerInput question={q} answer={answers[q.id]} onChange={(a) => setAnswer(q.id, a)} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => i - 1)}
          style={{
            padding: "0.5rem 1.25rem",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            opacity: currentIdx === 0 ? 0.5 : 1,
          }}
        >
          Previous
        </button>
        {currentIdx === questions.length - 1 ? (
          <button
            onClick={submit}
            disabled={submitting}
            style={{
              padding: "0.5rem 1.5rem",
              background: submitting ? "#333" : "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            {submitting ? "Submitting..." : "Submit Test"}
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx((i) => i + 1)}
            style={{
              padding: "0.5rem 1.25rem",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: 4,
            }}
          >
            Next
          </button>
        )}
      </div>
    </main>
  );
}

function AnswerInput({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer?: UserAnswer;
  onChange: (a: UserAnswer) => void;
}) {
  // Fallback for image-based options where text extraction failed
  const displayOptions =
    question.options.length > 0
      ? question.options
      : (question.type === "single_choice" || question.type === "multiple_choice"
          ? [{ key: "A", text: "Option A" }, { key: "B", text: "Option B" }, { key: "C", text: "Option C" }, { key: "D", text: "Option D" }]
          : []);

  switch (question.type) {
    case "single_choice":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {question.images.length > 0 && displayOptions.length === 4 && question.options.length === 0 && (
            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>Options shown in image above — select your answer:</p>
          )}
          {displayOptions.map((o, idx) => (
            <label
              key={o.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                border: "1px solid #333",
                borderRadius: 6,
                cursor: "pointer",
                background: answer?.selectedOptions?.[0] === o.key ? "#1e3a5f" : "#111",
              }}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={answer?.selectedOptions?.[0] === o.key}
                onChange={() => onChange({ selectedOptions: [o.key] })}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>{o.key}.</strong> {o.text}
              </span>
            </label>
          ))}
        </div>
      );

    case "multiple_choice":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>
            Select all that apply {question.options.length === 0 && question.images.length > 0 ? "(see image)" : ""}
          </p>
          {displayOptions.map((o) => {
            const selected = answer?.selectedOptions?.includes(o.key) ?? false;
            return (
              <label
                key={o.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #333",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: selected ? "#1e3a5f" : "#111",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const current = new Set(answer?.selectedOptions ?? []);
                    if (selected) current.delete(o.key);
                    else current.add(o.key);
                    onChange({ selectedOptions: [...current].sort() });
                  }}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong>{o.key}.</strong> {o.text}
                </span>
              </label>
            );
          })}
        </div>
      );

    case "numeric":
    case "integer":
    case "decimal":
      return (
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", color: "#aaa" }}>
            Enter {question.type === "integer" ? "integer" : "value"}:
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={answer?.value?.toString() ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === "") {
                onChange({});
              } else {
                const n = Number(v);
                onChange({ value: Number.isFinite(n) ? n : v });
              }
            }}
            style={{
              width: 200,
              padding: "0.6rem",
              background: "#1a1a1a",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: 6,
            }}
          />
        </div>
      );

    case "text":
      return (
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", color: "#aaa" }}>
            Enter answer:
          </label>
          <input
            type="text"
            value={answer?.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value })}
            style={{
              width: "100%",
              maxWidth: 400,
              padding: "0.6rem",
              background: "#1a1a1a",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: 6,
            }}
          />
        </div>
      );

    default:
      return (
        <p style={{ color: "#888" }}>
          This question type requires manual review and cannot be attempted in a live test.
        </p>
      );
  }
}

export default function TestTakePage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem" }}><p style={{ color: "#888" }}>Loading...</p></main>}>
      <TestTake />
    </Suspense>
  );
}