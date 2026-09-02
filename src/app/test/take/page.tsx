"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Question {
  id: string;
  questionNumber: number;
  type: string;
  questionText: string;
  subSection?: string | null;
  options: { key: string; text: string }[];
  images: { imageIndex: number; url: string; storage_path?: string }[];
}

interface UserAnswer {
  selectedOptions?: string[];
  value?: number | string;
  text?: string;
}

interface Session {
  sessionId: string;
  questionCount: number;
  timerSeconds: number;
  startedAt: string | null;
  submittedAt: string | null;
  questions: Question[];
  savedAnswers: { question_id: string; answer_json: UserAnswer; time_spent_ms: number | null }[];
}

function TestTake() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const timingRef = useRef(timings);
  timingRef.current = timings;

  const questionStartTimeRef = useRef(Date.now());
  const flushCountRef = useRef(0);

  // hydrate on mount
  useEffect(() => {
    if (!sessionId) { router.push("/test"); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/test/session?sessionId=${sessionId}`);
        if (!res.ok) { router.push("/test"); return; }
        const srv: Session = await res.json();
        if (cancelled) return;
        const serverAns: Record<string, UserAnswer> = {};
        const serverTimings: Record<string, number> = {};
        for (const sa of srv.savedAnswers) {
          if (sa.answer_json) serverAns[sa.question_id] = sa.answer_json;
          serverTimings[sa.question_id] = sa.time_spent_ms ?? 0;
        }
        setSessionData(srv);
        setAnswers(serverAns);
        setTimings(serverTimings);
        setLoading(false);
      } catch {
        if (!cancelled) router.push("/test");
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  // timer tick + auto-submit
  useEffect(() => {
    if (!sessionData?.startedAt || sessionData.submittedAt) return;
    const end = new Date(sessionData.startedAt).getTime() + sessionData.timerSeconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        handleSubmit(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.startedAt, sessionData?.timerSeconds, sessionData?.submittedAt]);

  const flushTimingDelta = useCallback((overrideIdx?: number) => {
    if (!sessionData) return;
    const idx = overrideIdx ?? currentIdx;
    const qId = sessionData.questions[idx]?.id;
    if (!qId) return;
    const delta = Math.max(0, Date.now() - questionStartTimeRef.current);
    if (delta < 200) return; // noise threshold
    setTimings(prev => ({ ...prev, [qId]: (prev[qId] ?? 0) + delta }));
    questionStartTimeRef.current = Date.now();
  }, [sessionData, currentIdx]);

  // periodic save (6s)
  useEffect(() => {
    if (!sessionData || sessionData.submittedAt) return;
    const id = setInterval(() => {
      flushTimingDelta();
      flushCountRef.current++;
      // persist to server every 2 flushes (~12s)
      if (flushCountRef.current % 2 === 0 && sessionId) {
        const payload = {
          sessionId,
          answers: sessionData.questions.map(q => ({
            questionId: q.id,
            answer: answers[q.id] ?? {},
            timeMs: timingRef.current[q.id] ?? 0,
          })),
        };
        fetch("/api/test/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
      }
    }, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData, sessionId, answers]);

  const goTo = useCallback((nextIdx: number) => {
    if (!sessionData) return;
    const max = sessionData.questions.length - 1;
    const clamped = Math.max(0, Math.min(max, nextIdx));
    flushTimingDelta();
    setCurrentIdx(clamped);
    questionStartTimeRef.current = Date.now();
  }, [sessionData, flushTimingDelta]);

  const setAnswer = useCallback((_questionId: string, answer: UserAnswer) => {
    setAnswers(prev => ({ ...prev, [_questionId]: answer }));
  }, []);

  const toggleFlag = useCallback((_questionId: string) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(_questionId)) next.delete(_questionId); else next.add(_questionId);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async (_auto = false) => {
    if (!sessionId || !sessionData || submitting) return;
    flushTimingDelta();
    setSubmitting(true);
    const finalTimings = { ...timingRef.current };
    // flush current question timing
    const currentId = sessionData.questions[currentIdx]?.id;
    if (currentId) {
      const delta = Math.max(0, Date.now() - questionStartTimeRef.current);
      finalTimings[currentId] = (finalTimings[currentId] ?? 0) + delta;
    }
    const payload = {
      sessionId,
      answers: sessionData.questions.map(q => ({
        questionId: q.id,
        answer: answers[q.id] ?? {},
        timeMs: finalTimings[q.id] ?? 0,
      })),
    };
    try {
      const res = await fetch("/api/test/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.error) { setSubmitting(false); return; }
      sessionStorage.setItem(`result-${sessionId}`, JSON.stringify(data));
      router.push(`/test/result?sessionId=${sessionId}`);
    } catch { setSubmitting(false); }
  }, [sessionId, sessionData, submitting, answers, flushTimingDelta, currentIdx, router]);

  if (loading || !sessionData) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
        <Card><CardContent className="py-10 text-center"><p className="text-muted-foreground">{loading ? "Loading test..." : "Session not found"}</p></CardContent></Card>
      </div>
    );
  }

  const questions = sessionData.questions;
  const answeredCount = Object.keys(answers).length;
  const q = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;
  const mins = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const secs = timeLeft !== null ? timeLeft % 60 : 0;

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pb-20 lg:pb-0">
      {/* sticky top bar */}
      <div className="sticky top-14 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 text-sm">
          <span className="font-medium text-muted-foreground">Q {currentIdx + 1} / {questions.length}</span>
          <span className={`tabular-nums font-bold ${timeLeft !== null && timeLeft < 60 ? "text-destructive" : "text-primary"}`}>
            ⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <span className="text-muted-foreground">{answeredCount} answered</span>
        </div>
        <div className="h-1 bg-secondary">
          <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 p-4">
        {/* main content column */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Q{q.questionNumber}</span>
            {q.subSection && <Badge variant="secondary">Section {q.subSection}</Badge>}
            {q.type === "multiple_choice" && <Badge variant="secondary">MSQ</Badge>}
            {q.type !== "single_choice" && q.type !== "multiple_choice" && q.type !== "multiple_choice" && <Badge variant="secondary">{q.type}</Badge>}
          </div>

          <div className="mb-4 whitespace-pre-wrap leading-relaxed text-foreground">{q.questionText}</div>

          {q.images.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-3">
              {q.images.map((img) => (
                <div key={`${q.id}-${img.imageIndex}`} className="relative flex min-h-[12rem] min-w-[16rem] max-w-lg items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
                  <img src={img.url} alt="" className="max-h-[24rem] w-auto object-contain" />
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card/50 p-4">
            <AnswerInput question={q} answer={answers[q.id]} onChange={(a) => setAnswer(q.id, a)} />
          </div>
        </div>

        {/* palette sidebar — lg+ only */}
        <aside className="hidden w-56 flex-shrink-0 lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-32 lg:self-start">
          <Card className="glass">
            <CardHeader className="px-3 pt-4 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Palette</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-7 gap-1.5 px-3 pb-4">
              {questions.map((qq, i) => (
                <button
                  key={qq.id}
                  onClick={() => goTo(i)}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                    i === currentIdx ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                    : !!answers[qq.id] ? "bg-emerald-600 text-white"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {i + 1}
                  {flagged.has(qq.id) && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-pink-500" />}
                </button>
              ))}
            </CardContent>
          </Card>
          <div className="space-y-1.5 px-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-600" /> Answered</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-primary ring-2 ring-primary/50" /> Current</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-secondary" /> Unanswered</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pink-500" /> Marked for Review</div>
          </div>
        </aside>
      </div>

      {/* sticky bottom nav */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}>← Prev</Button>
            <Button variant={flagged.has(q.id) ? "destructive" : "outline"} size="sm" onClick={() => toggleFlag(q.id)}>
              {flagged.has(q.id) ? "Remove Review" : "⚑ Review"}
            </Button>
          </div>
          <span className="hidden sm:inline text-sm font-medium text-muted-foreground">Q {currentIdx + 1} / {questions.length}</span>
          <div className="flex items-center gap-2">
            {isLast ? (
              <Button onClick={() => handleSubmit()} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                {submitting ? "Submitting..." : "Submit Test"}
              </Button>
            ) : (
              <Button onClick={() => goTo(currentIdx + 1)}>Next →</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- AnswerInput ---------- */
function AnswerInput({ question, answer, onChange }: { question: Question; answer?: UserAnswer; onChange: (a: UserAnswer) => void }) {
  const displayOptions =
    question.options.length > 0
      ? question.options
      : (question.type === "single_choice" || question.type === "multiple_choice"
          ? [{ key: "A", text: "Option A" }, { key: "B", text: "Option B" }, { key: "C", text: "Option C" }, { key: "D", text: "Option D" }]
          : []);

  switch (question.type) {
    case "single_choice":
      return (
        <div className="space-y-2">
          {question.images.length > 0 && displayOptions.length === 4 && question.options.length === 0 && (
            <p className="text-xs text-muted-foreground">Options shown in image above — select your answer.</p>
          )}
          {displayOptions.map((o) => {
            const selected = answer?.selectedOptions?.[0] === o.key;
            return (
              <label key={o.key} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selected ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"}`}>
                <input type="radio" name={`q-${question.id}`} checked={selected} onChange={() => onChange({ selectedOptions: [o.key] })} className="mt-0.5 accent-primary" />
                <span className="text-sm"><strong className="font-semibold">{o.key}.</strong> {o.text}</span>
              </label>
            );
          })}
        </div>
      );
    case "multiple_choice":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Select all that apply{question.options.length === 0 && question.images.length > 0 ? " — see image" : ""}</p>
          {displayOptions.map((o) => {
            const selected = answer?.selectedOptions?.includes(o.key) ?? false;
            return (
              <label key={o.key} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selected ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"}`}>
                <input type="checkbox" checked={selected} onChange={() => {
                  const cur = new Set(answer?.selectedOptions ?? []);
                  if (selected) cur.delete(o.key); else cur.add(o.key);
                  onChange({ selectedOptions: [...cur].sort() });
                }} className="mt-0.5 accent-primary" />
                <span className="text-sm"><strong className="font-semibold">{o.key}.</strong> {o.text}</span>
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
          <label className="mb-2 block text-sm text-muted-foreground">Enter {question.type === "integer" ? "integer" : "value"}:</label>
          <input type="text" inputMode="decimal" value={answer?.value?.toString() ?? ""} onChange={(e) => {
            const v = e.target.value.trim();
            if (v === "") onChange({});
            else { const n = Number(v); onChange({ value: Number.isFinite(n) ? n : v }); }
          }} className="w-48 rounded-md border border-border bg-secondary px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
      );
    case "text":
      return (
        <div>
          <label className="mb-2 block text-sm text-muted-foreground">Enter answer:</label>
          <input type="text" value={answer?.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} className="w-full max-w-sm rounded-md border border-border bg-secondary px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
      );
    default:
      return <p className="text-sm text-muted-foreground">This question type cannot be attempted in a live test.</p>;
  }
}

export default function TestTakePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-7rem)] items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <TestTake />
    </Suspense>
  );
}