"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface SessionRecord {
  sessionId: string;
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  timestamp: string;
  year?: number; // inferred from questions
}

function TestHistory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Load history from sessionStorage on every render
    const records: SessionRecord[] = [];
    const totalDays = Math.floor(Date.now() / 86400000);
    for (let i = 0; i < totalDays + 1; i++) {
      const key = `result-${i}`;
      const stored = sessionStorage.getItem(key);
      if (stored) {
        try {
          const rec = JSON.parse(stored);
          // Normalize: if no timestamp, infer approximate year from session count
          records.push({
            sessionId: key,
            score: rec.score,
            total: rec.total,
            correct: rec.correct,
            incorrect: rec.incorrect,
            unattempted: rec.unattempted,
            accuracy: rec.accuracy,
            timestamp: rec.timestamp || new Date(Date.now() - i * 86400000).toISOString(),
          });
        } catch {
          // skip malformed entries
        }
      }
    }
    setHistory(records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }, []);

  const deleteSession = (sid: string) => {
    sessionStorage.removeItem(sid);
    // refresh history
    setHistory((prev) => prev.filter((r) => r.sessionId !== sid));
  };

  const formatAge = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (history.length === 0) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          Test History
        </h1>
        <p style={{ color: "#888", marginBottom: "1.5rem" }}>
          No completed tests yet. Start a test above to generate results.
        </p>
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
          Start a New Test
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Test History
      </h1>

      <div style={{ marginBottom: "1.5rem" }}>
        <span style={{ color: "#888", fontSize: "0.875rem" }}>
          {history.length} tests taken
        </span>
      </div>

      <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#1a1a1a", color: "#fff", fontSize: "0.8rem" }}>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Date</th>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Score</th>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Accuracy</th>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((rec, i) => (
              <tr
                key={rec.sessionId}
                style={{
                  background: i % 2 === 0 ? "#111" : "#1a1a1a",
                  color: "#fff",
                }}
              >
                <td style={{ padding: "0.75rem" }}>{formatAge(rec.timestamp)}</td>
                <td style={{ padding: "0.75rem" }}>{rec.score}/{rec.total}</td>
                <td style={{ padding: "0.75rem", color: rec.accuracy >= 80 ? "#22c55e" : rec.accuracy >= 50 ? "#f59e0b" : "#ef4444" }}>
                  {rec.accuracy}%
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <button
                    onClick={() => setViewingSessionId(rec.sessionId)}
                    style={{
                      padding: "0.25rem 0.5rem",
                      background: "#3b82f6",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      fontSize: "0.7rem",
                    }}
                  >
                    Review
                  </button>
                  <button
                    onClick={() => deleteSession(rec.sessionId)}
                    style={{
                      marginLeft: "0.5rem",
                      padding: "0.25rem 0.5rem",
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      fontSize: "0.7rem",
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingSessionId && (
        <div style={{ marginTop: "2rem", padding: "1.5rem", background: "#1a1a1a", borderRadius: 8 }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
            Review: {formatAge(viewingSessionId)}
          </h2>
          <button
            onClick={() => setViewingSessionId(null)}
            style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              padding: "0.25rem 0.5rem",
              background: "#6b7280",
              color: "#fff",
              border: "none",
              borderRadius: 3,
              fontSize: "0.7rem",
            }}
          >
            Close
          </button>
          {/* Show the result details - we'd need to fetch from sessionStorage */}
          <p style={{ color: "#888", fontSize: "0.875rem" }}>
            Select a session from history to review details. (Full detail view coming)
          </p>
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <button
          onClick={() => router.push("/test")}
          style={{
            width: "100%",
            padding: "0.5rem 1.25rem",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: 4,
          }}
        >
          Take Another Test
        </button>
      </div>
    </main>
  );
}

export default function TestHistoryPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem" }}><p style={{ color: "#888" }}>Loading...</p></main>}>
      <TestHistory />
    </Suspense>
  );
}