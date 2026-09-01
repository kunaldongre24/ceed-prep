"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Exam {
  id: string;
  name: string;
  year: number;
}

export default function HomePage() {
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    fetch("/api/exams")
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .catch(() => {});
  }, []);

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        CEED Question Bank
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Common Entrance Examination for Design — practice platform
      </p>

      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
          Start a Practice Test
        </h2>
        {exams.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No exams available yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {exams.map((e) => (
              <Link
                key={e.id}
                href={`/test?examId=${e.id}`}
                style={{
                  display: "block",
                  padding: "1rem 1.25rem",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  transition: "border-color 0.15s",
                }}
              >
                <strong>{e.name}</strong>
              </Link>
            ))}
          </div>
        )}
      </section>

      <nav style={{ display: "flex", gap: "1.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
        <Link href="/admin">Admin Review</Link>
      </nav>
    </main>
  );
}
