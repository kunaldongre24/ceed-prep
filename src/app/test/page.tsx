"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function TestSetupPage() {
  const router = useRouter();
  const [questionCount, setQuestionCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/auth/signin");
    });
  }, [router]);

  const startTest = async () => {
    if (questionCount < 1 || questionCount > 100) {
      setError("questionCount must be between 1 and 100");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/test/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start test");
        setLoading(false);
        return;
      }

      sessionStorage.setItem(
        `test-${data.sessionId}`,
        JSON.stringify({ sessionId: data.sessionId, questions: data.questions })
      );
      router.push(`/test/take?sessionId=${data.sessionId}`);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Start Practice Test
      </h1>
      <p style={{ color: "#888", marginBottom: "2rem" }}>
        Random Section A questions from the question bank
      </p>

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", color: "#aaa" }}>
          Number of Questions
        </label>
        <input
          type="number"
          min={1}
          max={100}
          value={questionCount}
          onChange={(e) => setQuestionCount(Number(e.target.value))}
          style={{
            width: "100%",
            padding: "0.6rem",
            background: "#1a1a1a",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: 6,
          }}
        />
      </div>

      {error && (
        <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>
      )}

      <button
        onClick={startTest}
        disabled={loading}
        style={{
          width: "100%",
          padding: "0.75rem",
          background: loading ? "#333" : "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: "1rem",
          fontWeight: 600,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Starting..." : "Start Test"}
      </button>
    </main>
  );
}