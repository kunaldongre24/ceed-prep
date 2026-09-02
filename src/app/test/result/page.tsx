"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ResultItem {
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
  timeSeconds: number;
}

interface Result {
  sessionId: string;
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  totalTimeSeconds: number;
  avgTimeSeconds: number;
  results: ResultItem[];
}

function TestResult() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [data, setData] = useState<Result | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionId) { router.push("/test"); return; }
    (async () => {
      // try sessionStorage first
      const cached = sessionStorage.getItem(`result-${sessionId}`);
      if (cached) { try { setData(JSON.parse(cached)); } catch { /* ignore */ } }
      // fetch from server for accuracy
      try {
        const res = await fetch(`/api/test/result?sessionId=${sessionId}`);
        if (res.ok) setData(await res.json());
      } catch { /* rely on cache */ }
    })();
  }, [sessionId, router]);

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  const fastedQ = data.results.reduce((best, r) => best.timeSeconds <= r.timeSeconds ? best : r, data.results[0]);
  const slowestQ = data.results.reduce((worst, r) => worst.timeSeconds >= r.timeSeconds ? worst : r, data.results[0]);
  const maxTime = Math.max(...data.results.map((r) => r.timeSeconds), 1);

  const toggle = (id: string) => setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4">
      <div className="mx-auto max-w-4xl">
        {/* hero */}
        <Card className="mb-6 border-0 bg-gradient-to-br from-slate-800 to-slate-900 text-center">
          <CardHeader>
            <CardTitle className="text-3xl font-black">Test Results</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Score", value: `${data.score}/${data.total}`, color: "text-blue-400" },
              { label: "Accuracy", value: `${data.accuracy}%`, color: data.accuracy >= 70 ? "text-emerald-400" : data.accuracy >= 40 ? "text-amber-400" : "text-red-400" },
              { label: "Total Time", value: formatTime(data.totalTimeSeconds), color: "text-violet-400" },
              { label: "Avg / Question", value: formatTime(data.avgTimeSeconds), color: "text-cyan-400" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* breakdown cards */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card className="text-center">
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold text-emerald-400">{data.correct}</div>
              <div className="text-xs uppercase text-muted-foreground">Correct</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold text-red-400">{data.incorrect}</div>
              <div className="text-xs uppercase text-muted-foreground">Incorrect</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold text-muted-foreground">{data.unattempted}</div>
              <div className="text-xs uppercase text-muted-foreground">Unattempted</div>
            </CardContent>
          </Card>
        </div>

        {/* time insights */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>⏱ Time Analysis</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-muted/30 p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Fastest</div>
              <div className="font-semibold text-emerald-400">Q{fastedQ.questionNumber}</div>
              <div className="text-xs text-muted-foreground">{formatTime(fastedQ.timeSeconds)}</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Slowest</div>
              <div className="font-semibold text-amber-400">Q{slowestQ.questionNumber}</div>
              <div className="text-xs text-muted-foreground">{formatTime(slowestQ.timeSeconds)}</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Total Time</div>
              <div className="font-semibold text-blue-400">{formatTime(data.totalTimeSeconds)}</div>
              <div className="text-xs text-muted-foreground">for {data.total} questions</div>
            </div>
          </CardContent>
        </Card>

        {/* per-question breakdown */}
        <h2 className="mb-3 text-lg font-bold">Question Breakdown</h2>
        <div className="space-y-3 mb-10">
          {data.results.map((r, i) => {
            const isOpen = expanded.has(r.questionId);
            const timeRatio = r.timeSeconds / maxTime;
            const userStr = formatUserAnswer(r);
            const correctStr = formatCorrectAnswer(r.correctAnswer);
            return (
              <div
                key={r.questionId}
                onClick={() => toggle(r.questionId)}
                className="cursor-pointer rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={r.result === "correct" ? "default" : r.result === "incorrect" ? "destructive" : "secondary"}>
                      {r.result}
                    </Badge>
                    <span className="text-sm font-semibold">Q{i + 1} <span className="text-muted-foreground">(Paper Q{r.questionNumber})</span></span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums font-medium">{formatTime(r.timeSeconds)}</span>
                    {/* time bar */}
                    <div className="hidden sm:block h-1.5 w-24 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full ${r.result === "correct" ? "bg-emerald-500" : r.result === "incorrect" ? "bg-red-500" : "bg-muted-foreground/40"}`}
                        style={{ width: `${Math.max(timeRatio * 100, 4)}%` }}
                      />
                    </div>
                    <span>{isOpen ? "▾" : "▸"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 border-t border-border pt-4 space-y-3">
                    {r.questionType === "multiple_choice" && <p className="text-xs text-muted-foreground italic">Select all that apply.</p>}
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{r.questionText}</p>

                    {r.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {r.images.map((img) => (
                          <img key={img.imageIndex} src={img.url} alt="" className="max-w-xs max-h-48 rounded-md border border-border" />
                        ))}
                      </div>
                    )}

                    {r.options.length > 0 && (
                      <div className="ml-2 space-y-1 text-sm text-muted-foreground">
                        {r.options.map((o) => <div key={o.key}><strong>{o.key}.</strong> {o.text}</div>)}
                      </div>
                    )}

                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-muted-foreground">Your answer: </span>
                        <span className={r.result === "correct" ? "text-emerald-400 font-semibold" : "text-red-400"}>{userStr}</span>
                      </div>
                      {r.result !== "correct" && (
                        <div>
                          <span className="text-muted-foreground">Correct answer: </span>
                          <span className="text-emerald-400 font-semibold">{correctStr}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-3 pb-10">
          <Button onClick={() => router.push("/test")} className="gradient-primary text-white">Take Another Test</Button>
          <Button variant="outline" onClick={() => router.push("/test/history")}>History</Button>
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
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
    <Suspense fallback={<div className="flex min-h-[calc(100vh-7rem)] items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <TestResult />
    </Suspense>
  );
}