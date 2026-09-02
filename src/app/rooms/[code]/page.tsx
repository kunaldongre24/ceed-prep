"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RoomPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();
  const router = useRouter();
  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [username] = useState(() => typeof window !== "undefined" ? localStorage.getItem("ceed_username") || "" : "");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const fetchRoom = useCallback(async () => {
    const res = await fetch(`/api/rooms/${code}`);
    const data = await res.json();
    if (data.room) setRoom(data.room);
    if (data.participants) setParticipants(data.participants);
    if (data.questions?.length) setQuestions(data.questions);
  }, [code]);

  useEffect(() => { fetchRoom(); }, [fetchRoom]);

  // realtime via Supabase
  useEffect(() => {
    const ch = supabase.channel(`room-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${room?.id ?? ""}` }, () => fetchRoom())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [code, room?.id, fetchRoom]);

  // timer
  useEffect(() => {
    if (room?.status !== "active" || !room?.started_at || timeLeft === 0) return;
    const end = new Date(room.started_at).getTime() + (room.timer_seconds * 1000);
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0 && !done) handleSubmit();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [room?.started_at, room?.status]);

  const startGame = async () => {
    await fetch(`/api/rooms/${code}/start`, { method: "POST" });
    fetchRoom();
  };

  const handleSubmit = async () => {
    if (submitting || done) return;
    setSubmitting(true);
    const payload = { username, answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })) };
    // also include unanswered as {}
    const allAnswers = questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? {} }));
    const res = await fetch(`/api/rooms/${code}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, answers: allAnswers }) });
    const data = await res.json();
    setScore(data.score ?? 0);
    setDone(true);
    setSubmitting(false);
    fetchRoom();
  };

  if (!room) return <main style={{ maxWidth: 800, margin: "0 auto", padding: "3rem", color: "#888" }}>Loading room {code}...</main>;

  const isHost = username && room.host_username === username;
  const q = questions[idx];

  if (room.status === "waiting") {
    return (
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", border: "1px solid #334155", borderRadius: 16, padding: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff" }}>Lobby — {code}</h2>
          <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>{room.question_count} Qs · {Math.floor(room.timer_seconds / 60)} min timer</p>
          <div style={{ margin: "1.5rem 0", display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            {participants.map((p) => (
              <span key={p.username} style={{ padding: "0.4rem 0.8rem", background: p.username === room.host_username ? "#3b82f6" : "#334155", color: "#fff", borderRadius: 20, fontSize: "0.85rem" }}>{p.username} {p.username === room.host_username && "👑"}</span>
            ))}
          </div>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "1rem" }}>Share code <b style={{ color: "#fff", letterSpacing: "0.2em" }}>{code}</b> with friends</p>
          {isHost ? <button onClick={startGame} style={{ padding: "0.75rem 2rem", background: "linear-gradient(90deg,#22c55e,#16a34a)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: "1rem" }}>▶ Start Battle</button> : <p style={{ color: "#f59e0b" }}>Waiting for host to start...</p>}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <button onClick={() => navigator.clipboard.writeText(code)} style={{ color: "#3b82f6", background: "none", border: "none", cursor: "pointer" }}>Copy code</button>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", textAlign: "center" }}>🏆 Results</h2>
        <p style={{ textAlign: "center", color: "#22c55e", fontSize: "1.25rem", fontWeight: 700, marginTop: "0.5rem" }}>Your score: {score}/{questions.length}</p>
        <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {participants.sort((a, b) => b.score - a.score).map((p, i) => (
            <div key={p.username} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: p.username === username ? "linear-gradient(90deg,#1e3a5f,#1e293b)" : "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}>
              <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {p.username} {p.username === username && "(you)"}</span>
              <span style={{ fontWeight: 800, color: p.score === Math.max(...participants.map((x: any) => x.score)) ? "#f59e0b" : "#fff" }}>{p.score} pts</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <button onClick={() => router.push("/rooms")} style={{ padding: "0.6rem 1.5rem", background: "#334155", color: "#fff", border: "none", borderRadius: 8, marginRight: "0.5rem" }}>Back to Rooms</button>
          <button onClick={() => router.push("/test")} style={{ padding: "0.6rem 1.5rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8 }}>Solo Test</button>
        </div>
      </main>
    );
  }

  if (!q) return <main style={{ padding: "3rem", color: "#888", textAlign: "center" }}>Loading questions...</main>;

  const mins = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const secs = timeLeft !== null ? timeLeft % 60 : 0;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", background: "linear-gradient(90deg,#0f172a,#1e293b)", padding: "0.75rem 1rem", borderRadius: 8, border: "1px solid #334155" }}>
        <span style={{ color: "#fff", fontWeight: 700 }}>{code} · Q {idx + 1}/{questions.length}</span>
        <span style={{ color: timeLeft !== null && timeLeft < 60 ? "#ef4444" : "#f59e0b", fontWeight: 800, fontSize: "1.1rem" }}>⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
        <span style={{ color: "#22c55e", fontSize: "0.85rem" }}>{participants.length} players</span>
      </div>

      <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden", marginBottom: "1.5rem" }}>
        <div style={{ width: `${((idx + 1) / questions.length) * 100}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#8b5cf6)", transition: "width 0.3s" }} />
      </div>

      <div style={{ marginBottom: "0.5rem", color: "#64748b", fontSize: "0.8rem" }}>Q{q.questionNumber} {q.subSection && `· Sec ${q.subSection}`}</div>
      <div style={{ marginBottom: "1rem", lineHeight: 1.7, color: "#fff", fontSize: "1.05rem" }}>{q.questionText}</div>
      {q.images.length > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          {q.images.map((img: any) => (
            <img key={img.imageIndex} src={img.url} alt="" style={{ maxWidth: 500, maxHeight: 350, border: "1px solid #334155", borderRadius: 8 }} />
          ))}
        </div>
      )}
      <div style={{ marginBottom: "1.5rem" }}>
        {(q.type === "single_choice" || q.type === "multiple_choice") ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {(q.options.length ? q.options : [{ key: "A", text: "Option A" }, { key: "B", text: "Option B" }, { key: "C", text: "Option C" }, { key: "D", text: "Option D" }]).map((o: any) => {
              const sel = q.type === "single_choice" ? answers[q.id]?.selectedOptions?.[0] === o.key : answers[q.id]?.selectedOptions?.includes(o.key);
              return (
                <label key={o.key} style={{ display: "flex", gap: "0.5rem", padding: "0.7rem 1rem", background: sel ? "linear-gradient(90deg,#1e3a5f,#1e293b)" : "#0f172a", border: sel ? "1px solid #3b82f6" : "1px solid #334155", borderRadius: 8, cursor: "pointer", color: "#fff", transition: "all 0.15s" }}>
                  <input type={q.type === "single_choice" ? "radio" : "checkbox"} name={`rq-${q.id}`} checked={!!sel} onChange={() => {
                    if (q.type === "single_choice") setAnswers((p) => ({ ...p, [q.id]: { selectedOptions: [o.key] } }));
                    else {
                      const cur = new Set(answers[q.id]?.selectedOptions ?? []);
                      if (cur.has(o.key)) cur.delete(o.key); else cur.add(o.key);
                      setAnswers((p) => ({ ...p, [q.id]: { selectedOptions: [...cur].sort() } }));
                    }
                  }} />
                  <span><b>{o.key}.</b> {o.text}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div>
            <label style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Enter value:</label>
            <input value={answers[q.id]?.value ?? ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: { value: e.target.value === "" ? undefined : isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) } }))} style={{ width: 200, padding: "0.6rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: 8, marginTop: "0.3rem" }} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} style={{ padding: "0.6rem 1.2rem", background: "#334155", color: "#fff", border: "none", borderRadius: 8, opacity: idx === 0 ? 0.5 : 1 }}>Previous</button>
        {idx === questions.length - 1 ? <button onClick={handleSubmit} disabled={submitting} style={{ padding: "0.6rem 1.5rem", background: submitting ? "#334155" : "linear-gradient(90deg,#22c55e,#16a34a)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800 }}>{submitting ? "Submitting..." : "Submit"}</button> : <button onClick={() => setIdx((i) => i + 1)} style={{ padding: "0.6rem 1.2rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8 }}>Next →</button>}
      </div>

      <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "center" }}>
        {questions.map((_, i) => (
          <div key={i} onClick={() => setIdx(i)} style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: answers[questions[i].id] ? "#22c55e" : "#1e293b", color: "#fff", fontSize: "0.7rem", cursor: "pointer", border: i === idx ? "2px solid #3b82f6" : "1px solid #334155" }}>{i + 1}</div>
        ))}
      </div>
    </main>
  );
}