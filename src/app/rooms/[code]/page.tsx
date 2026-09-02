"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Question {
  id: string;
  questionNumber: number;
  type: string;
  questionText: string;
  subSection?: string | null;
  options: { key: string; text: string }[];
  images: { imageIndex: number; url: string }[];
}
interface Participant {
  username: string;
  score: number;
  completed?: boolean;
  timings?: Record<string, number>;
  answers?: Record<string, unknown>;
}
interface Me {
  user_id: string;
  username: string;
  answers: Record<string, unknown> | null;
  timings: Record<string, number> | null;
  completed: boolean;
  current_index: number | null;
  marked_for_review: string[] | null;
  score: number;
}

export default function RoomPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();
  const router = useRouter();
  const [room, setRoom] = useState<any>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [myScore, setMyScore] = useState<number | null>(null);

  const timingsRef = useRef(timings);
  timingsRef.current = timings;
  const questionStartTimeRef = useRef(Date.now());

  // fetch room + me
  const fetchRoom = useCallback(async () => {
    const [roomRes, meRes] = await Promise.all([
      fetch(`/api/rooms/${code}`),
      fetch(`/api/rooms/${code}/me`),
    ]);
    const roomData = await roomRes.json();
    const meData = await meRes.json();
    if (roomData.room) setRoom(roomData.room);
    if (roomData.participants) setParticipants(roomData.participants);
    if (roomData.questions?.length) setQuestions(roomData.questions);
    if (meData.me) {
      setMe(meData.me);
      if (meData.me.current_index != null && meData.me.current_index >= 0) setIdx(meData.me.current_index);
      if (meData.me.answers) setAnswers(meData.me.answers);
      if (meData.me.timings) setTimings(meData.me.timings);
      if (meData.me.completed) setMyScore(meData.me.score);
      if (meData.me.marked_for_review) setFlagged(new Set(meData.me.marked_for_review));
    }
  }, [code]);

  useEffect(() => { fetchRoom(); }, [fetchRoom]);

  // realtime
  useEffect(() => {
    const ch = supabase.channel(`room-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants" }, () => fetchRoom())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [code, fetchRoom]);

  // timer
  useEffect(() => {
    if (room?.status !== "active" || !room?.started_at || myScore !== null) return;
    const end = new Date(room.started_at).getTime() + room.timer_seconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) handleSubmit();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.started_at, room?.timer_seconds, myScore]);

  // periodic save (6s)
  useEffect(() => {
    if (room?.status !== "active" || myScore !== null) return;
    const id = setInterval(() => flushTimingDelta(), 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, myScore]);

  const flushTimingDelta = useCallback(() => {
    if (questions.length === 0) return;
    const qId = questions[idx]?.id;
    if (!qId) return;
    const delta = Math.max(0, Date.now() - questionStartTimeRef.current);
    if (delta < 300) return;
    const newTimings = { ...timingsRef.current, [qId]: (timingsRef.current[qId] ?? 0) + delta };
    timingsRef.current = newTimings;
    setTimings(newTimings);
    questionStartTimeRef.current = Date.now();
    // persist
    const body = {
      answers,
      timings: newTimings,
      currentIndex: idx,
      timeRemaining: timeLeft,
      markedForReview: [...flagged],
    };
    fetch(`/api/rooms/${code}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  }, [questions, idx, answers, flagged, timeLeft, code]);

  const goTo = useCallback((nextIdx: number) => {
    if (questions.length === 0) return;
    const clamped = Math.max(0, Math.min(questions.length - 1, nextIdx));
    flushTimingDelta();
    setIdx(clamped);
    questionStartTimeRef.current = Date.now();
  }, [questions.length, flushTimingDelta]);

  const handleSubmit = useCallback(async () => {
    if (submitting || myScore !== null || !questions.length) return;
    flushTimingDelta();
    setSubmitting(true);
    const finalTimings = { ...timingsRef.current };
    const qId = questions[idx]?.id;
    if (qId) {
      const delta = Math.max(0, Date.now() - questionStartTimeRef.current);
      finalTimings[qId] = (finalTimings[qId] ?? 0) + delta;
    }
    const payload = {
      answers: questions.map(q => ({
        questionId: q.id,
        answer: answers[q.id] ?? {},
        timeMs: finalTimings[q.id] ?? 0,
      })),
      timings: finalTimings,
    };
    try {
      const res = await fetch(`/api/rooms/${code}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      setMyScore(data.score ?? 0);
      fetchRoom();
    } catch { setSubmitting(false); }
  }, [submitting, myScore, questions, answers, flushTimingDelta, idx, code, fetchRoom]);

  const startGame = async () => {
    await fetch(`/api/rooms/${code}/start`, { method: "POST" });
    fetchRoom();
  };

  if (!room || !me) {
    return <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center"><p className="text-muted-foreground">Loading room {code}...</p></div>;
  }

  const isHost = room.host_username === me.username;

  /* ---- LOBBY ---- */
  if (room.status === "waiting") {
    return (
      <div className="min-h-[calc(100vh-7rem)] flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-3xl font-black">Lobby</CardTitle>
            <CardDescription>Share code <span className="font-bold text-foreground tracking-widest">{code}</span> with friends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div>{room.question_count} questions · {Math.floor(room.timer_seconds / 60)} min total</div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {participants.map((p) => (
                <Badge key={p.username} variant={p.username === room.host_username ? "default" : "secondary"} className="text-sm">
                  {p.username} {p.username === room.host_username && "👑"}
                </Badge>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(code)}>Copy Code</Button>
            {isHost ? (
              <Button onClick={startGame} className="w-full gradient-primary text-white font-semibold" size="lg">▶ Start Battle</Button>
            ) : (
              <p className="text-sm text-amber-400 font-medium">Waiting for host to start...</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---- ACTIVE: COMPLETED (waiting for others) ---- */
  if (room.status === "active" && myScore !== null) {
    const sorted = [...participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const maxScore = sorted[0]?.score ?? 0;
    return (
      <div className="min-h-[calc(100vh-7rem)] flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-black">Submitted ✓</CardTitle>
            <CardDescription>Your score: <span className="text-emerald-400 font-bold">{myScore}/{questions.length}</span></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {sorted.map((p, i) => (
                <div key={p.username} className={`flex items-center justify-between rounded-lg border p-3 ${p.username === me.username ? "border-primary bg-primary/10" : "border-border"}`}>
                  <span className="text-sm">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                    {" "}{p.username}
                    {p.username === me.username && " (you)"}
                    {p.completed ? "" : <span className="ml-2 text-xs text-amber-400">...</span>}
                  </span>
                  <span className={`font-bold ${p.score === maxScore ? "text-amber-400" : ""}`}>{p.score ?? "?"}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Waiting for others to submit...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---- FINISHED: full results ---- */
  if (room.status === "finished") {
    const sorted = [...participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const maxScore = sorted[0]?.score ?? 0;
    return (
      <div className="min-h-[calc(100vh-7rem)] p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        <div className="mx-auto max-w-2xl text-center">
          <Card className="mb-6 border-0 bg-gradient-to-br from-slate-800 to-slate-900">
            <CardHeader>
              <CardTitle className="text-3xl font-black">🏆 Results — {code}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                {sorted.map((p, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const totalTimeMs = Object.values(p.timings ?? {}).reduce((s, v) => s + (v ?? 0), 0);
                  const totalTimeSecs = Math.round(totalTimeMs / 1000);
                  return (
                    <div key={p.username} className={`flex items-center justify-between rounded-lg border p-4 ${p.username === me.username ? "border-primary bg-primary/10" : "border-border bg-card/60"}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold">{i < 3 ? medals[i] : `${i + 1}.`}</span>
                        <div>
                          <div className="font-semibold">{p.username}{p.username === me.username && " (you)"}</div>
                          <div className="text-xs text-muted-foreground">{totalTimeSecs > 0 ? `avg ${Math.round(totalTimeSecs / (room.question_count || 1))}s/q` : ""}</div>
                        </div>
                      </div>
                      <span className={`text-2xl font-black ${p.score === maxScore ? "text-amber-400" : "text-foreground"}`}>{p.score ?? 0}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-center gap-3 pb-10">
            <Button onClick={() => router.push("/rooms")} variant="outline">Back to Rooms</Button>
            <Button onClick={() => router.push("/test")} className="gradient-primary text-white">Solo Test</Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- ACTIVE: in-progress test ---- */
  if (questions.length === 0) {
    return <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center"><p className="text-muted-foreground">Loading questions...</p></div>;
  }

  const q = questions[idx];
  const answeredCount = Object.keys(answers).length;
  const mins = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const secs = timeLeft !== null ? timeLeft % 60 : 0;

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pb-20 lg:pb-0">
      {/* top bar */}
      <div className="sticky top-14 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 text-sm">
          <span className="font-medium text-muted-foreground">
            <span className="text-foreground font-semibold">{code}</span> · Q {idx + 1}/{questions.length}
          </span>
          <span className={`tabular-nums font-bold ${timeLeft !== null && timeLeft < 60 ? "text-destructive" : "text-primary"}`}>
            ⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <span className="text-muted-foreground">{answeredCount}/{questions.length} answered · {participants.length} players</span>
        </div>
        <div className="h-1 bg-secondary">
          <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 p-4">
        {/* main */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Q{q.questionNumber}</span>
            {q.subSection && <Badge variant="secondary">Section {q.subSection}</Badge>}
            {q.type === "multiple_choice" && <Badge variant="secondary">MSQ</Badge>}
            {q.type !== "single_choice" && q.type !== "multiple_choice" && <Badge variant="secondary">{q.type}</Badge>}
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
            <AnswerInput question={q} answer={answers[q.id]} onChange={(a) => setAnswers(prev => ({ ...prev, [q.id]: a }))} />
          </div>
        </div>

        {/* palette */}
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
                    i === idx ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
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
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-secondary" /> Unanswered</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pink-500" /> Flagged</div>
          </div>
        </aside>
      </div>

      {/* footer nav */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => goTo(idx - 1)} disabled={idx === 0}>← Prev</Button>
            <Button variant={flagged.has(q.id) ? "destructive" : "outline"} size="sm" onClick={() => { const next = new Set(flagged); if (next.has(q.id)) next.delete(q.id); else next.add(q.id); setFlagged(next); }}>
              {flagged.has(q.id) ? "Remove Flag" : "⚑ Flag"}
            </Button>
          </div>
          <span className="hidden sm:inline text-sm font-medium text-muted-foreground">Q {idx + 1} / {questions.length}</span>
          <div className="flex items-center gap-2">
            {idx === questions.length - 1 ? (
              <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                {submitting ? "Submitting..." : "Submit Battle"}
              </Button>
            ) : (
              <Button onClick={() => goTo(idx + 1)}>Next →</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- shared AnswerInput ---------- */
function AnswerInput({ question, answer, onChange }: { question: Question; answer?: unknown; onChange: (a: unknown) => void }) {
  const ans = answer as { selectedOptions?: string[]; value?: number | string } | undefined;
  const displayOptions = question.options.length > 0
    ? question.options
    : [{ key: "A", text: "Option A" }, { key: "B", text: "Option B" }, { key: "C", text: "Option C" }, { key: "D", text: "Option D" }];

  if (question.type === "single_choice") {
    return (
      <div className="space-y-2">
        {question.images.length > 0 && question.options.length === 0 && <p className="text-xs text-muted-foreground">Options shown in image above.</p>}
        {displayOptions.map(o => {
          const sel = ans?.selectedOptions?.[0] === o.key;
          return (
            <label key={o.key} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"}`}>
              <input type="radio" checked={sel} onChange={() => onChange({ selectedOptions: [o.key] })} className="mt-0.5 accent-primary" />
              <span className="text-sm"><strong className="font-semibold">{o.key}.</strong> {o.text}</span>
            </label>
          );
        })}
      </div>
    );
  }
  if (question.type === "multiple_choice") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Select all that apply.</p>
        {displayOptions.map(o => {
          const sel = ans?.selectedOptions?.includes(o.key) ?? false;
          return (
            <label key={o.key} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"}`}>
              <input type="checkbox" checked={sel} onChange={() => { const cur = new Set(ans?.selectedOptions ?? []); if (sel) cur.delete(o.key); else cur.add(o.key); onChange({ selectedOptions: [...cur].sort() }); }} className="mt-0.5 accent-primary" />
              <span className="text-sm"><strong className="font-semibold">{o.key}.</strong> {o.text}</span>
            </label>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <label className="mb-2 block text-sm text-muted-foreground">Enter value:</label>
      <input type="text" inputMode="decimal" value={ans?.value?.toString() ?? ""} onChange={(e) => { const v = e.target.value.trim(); if (v === "") onChange({}); else { const n = Number(v); onChange({ value: Number.isFinite(n) ? n : v }); } }} className="w-48 rounded-md border border-border bg-secondary px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary" />
    </div>
  );
}