"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Result {
  sessionId: string;
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  results: {
    questionId: string;
    questionNumber: number;
    questionType: string;
    questionText: string;
    subSection?: string;
    options: { key: string; text: string }[];
    images: { imageIndex: number; url: string }[];
    userAnswer: Record<string, unknown> | null;
    correctAnswer: Record<string, unknown> | null;
    result: "correct" | "incorrect" | "unattempted";
  }[];
}

function TestResult() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [data, setData] = useState<Result | null>(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      router.push("/test");
      return;
    }
    const stored = sessionStorage.getItem(`result-${sessionId}`);
    if (!stored) {
      router.push("/test");
      return;
    }
    setData(JSON.parse(stored));
  }, [sessionId, router]);

  if (!data) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <p style={{ color: "#888" }}>Loading results...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Test Results
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {[
          { label: "Score", value: `${data.score}/${data.total}`, color: "#3b82f6" },
          { label: "Correct", value: data.correct, color: "#22c55e" },
          { label: "Incorrect", value: data.incorrect, color: "#ef4444" },
          { label: "Unattempted", value: data.unattempted, color: "#888" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "1rem",
              border: "1px solid #333",
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#888" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <span style={{ color: "#aaa" }}>Accuracy: </span>
        <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{data.accuracy}%</span>
      </div>

      <button
        onClick={() => setShowReview(!showReview)}
        style={{
          padding: "0.5rem 1.25rem",
          background: "#333",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          marginBottom: "1.5rem",
        }}
      >
        {showReview ? "Hide Review" : "Show Detailed Review"}
      </button>

      {showReview && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {data.results.map((r, i) => (
            <div
              key={r.questionId}
              style={{
                border: "1px solid #333",
                borderRadius: 8,
                padding: "1rem 1.25rem",
                background: r.result === "correct" ? "#0a1a0a" : r.result === "incorrect" ? "#1a0a0a" : "#111",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontWeight: 600 }}>
                  Q{i + 1} (Paper Q{r.questionNumber})
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: r.result === "correct" ? "#166534" : r.result === "incorrect" ? "#991b1b" : "#555",
                    color: "#fff",
                  }}
                >
                  {r.result}
                </span>
              </div>

              <p style={{ marginBottom: "0.75rem", lineHeight: 1.6 }}>{r.questionText}</p>

              {r.images.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                  {r.images.map((img) => (
                    <img
                      key={img.imageIndex}
                      src={img.url}
                      alt={`Figure ${img.imageIndex + 1}`}
                      style={{ maxWidth: 400, maxHeight: 300, border: "1px solid #333", borderRadius: 4 }}
                    />
                  ))}
                </div>
              )}

              {r.options.length > 0 && (
                <div style={{ marginBottom: "0.5rem", marginLeft: "1rem" }}>
                  {r.options.map((o) => (
                    <div key={o.key} style={{ fontSize: "0.9rem" }}>
                      {o.key}. {o.text}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                <div>
                  <span style={{ color: "#888" }}>Your answer: </span>
                  <span style={{ color: r.result === "correct" ? "#22c55e" : "#ef4444" }}>
                    {formatUserAnswer(r)}
                  </span>
                </div>
                {r.result !== "correct" && (
                  <div>
                    <span style={{ color: "#888" }}>Correct answer: </span>
                    <span style={{ color: "#22c55e" }}>
                      {formatCorrectAnswer(r.correctAnswer)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <button
          onClick={() => router.push("/test")}
          style={{
            padding: "0.5rem 1.25rem",
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 4,
          }}
        >
          Take Another Test
        </button>
        <a
          href="/test/history"
          style={{
            padding: "0.5rem 1.25rem",
            background: "#8b5cf6",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            marginLeft: "0.5rem",
          }}
        >
          History
        </a>
      </div>
    </main>
  );
}

function formatUserAnswer(r: { result: string; userAnswer: Record<string, unknown> | null; questionType: string }): string {
  if (!r.userAnswer) return "Unattempted";
  const ua = r.userAnswer;
  if (ua.selectedOptions) return (ua.selectedOptions as string[]).join(", ");
  if (ua.value !== undefined && ua.value !== null) return String(ua.value);
  if (ua.text) return String(ua.text);
  return "Unattempted";
}

function formatCorrectAnswer(ca: Record<string, unknown> | null): string {
  if (!ca) return "—";
  switch (ca.type as string) {
    case "single_choice":
    case "multiple_choice":
      return (ca.correctOptions as string[])?.join(", ") ?? "—";
    case "numeric":
      if (ca.min !== undefined && ca.max !== undefined) return `${ca.min} to ${ca.max}`;
      return String(ca.value ?? "—");
    case "integer":
    case "decimal":
      return String(ca.value ?? "—");
    case "text":
      return String(ca.value ?? "—");
    default:
      return JSON.stringify(ca);
  }
}

export default function TestResultPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem" }}><p style={{ color: "#888" }}>Loading...</p></main>}>
      <TestResult />
    </Suspense>
  );
}
