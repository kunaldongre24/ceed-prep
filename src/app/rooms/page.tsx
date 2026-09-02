"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RoomsPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [qCount, setQCount] = useState(10);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.username) setUsername(user.user_metadata.username);
      else supabase.from("profiles").select("username").eq("user_id", user?.id ?? "").single().then(({ data }) => { if (data?.username) setUsername(data.username); });
    });
    const saved = typeof window !== "undefined" ? localStorage.getItem("ceed_username") : null;
    if (saved) setUsername(saved);
  }, []);

  const persistUsername = (u: string) => { if (typeof window !== "undefined") localStorage.setItem("ceed_username", u); };

  const createRoom = async () => {
    if (!username.trim()) { setErr("Enter username"); return; }
    persistUsername(username);
    setLoading(true); setErr("");
    const res = await fetch("/api/rooms/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username.trim(), questionCount: qCount, timerSeconds: 600 }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); setLoading(false); return; }
    router.push(`/rooms/${data.code}`);
  };

  const joinRoom = async () => {
    if (!username.trim() || !joinCode.trim()) { setErr("Username and code required"); return; }
    persistUsername(username);
    setLoading(true); setErr("");
    const res = await fetch("/api/rooms/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: joinCode.trim(), username: username.trim() }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); setLoading(false); return; }
    router.push(`/rooms/${data.code}`);
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, background: "linear-gradient(90deg,#3b82f6,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "0.5rem" }}>⚔️ Battle Rooms — Realtime CEED</h1>
      <p style={{ color: "#888", marginBottom: "2rem" }}>Create a room, share the code, compete live. Same questions, same timer.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", border: "1px solid #334155", borderRadius: 12, padding: "1.5rem" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "1rem", color: "#fff" }}>🎮 Create Room</h3>
          <input placeholder="Your username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%", padding: "0.6rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: 8, marginBottom: "0.75rem" }} />
          <label style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Questions: {qCount}</label>
          <input type="range" min={5} max={30} value={qCount} onChange={(e) => setQCount(Number(e.target.value))} style={{ width: "100%", marginBottom: "1rem" }} />
          <button onClick={createRoom} disabled={loading} style={{ width: "100%", padding: "0.75rem", background: loading ? "#334155" : "linear-gradient(90deg,#3b82f6,#8b5cf6)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700 }}>{loading ? "Creating..." : "Create Room"}</button>
        </div>

        <div style={{ background: "linear-gradient(135deg,#1e1b2e,#0f172a)", border: "1px solid #334155", borderRadius: 12, padding: "1.5rem" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "1rem", color: "#fff" }}>🚪 Join Room</h3>
          <input placeholder="Your username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%", padding: "0.6rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: 8, marginBottom: "0.75rem" }} />
          <input placeholder="Room code (e.g. AB12CD)" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} style={{ width: "100%", padding: "0.6rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: 8, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700 }} />
          <button onClick={joinRoom} disabled={loading} style={{ width: "100%", padding: "0.75rem", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700 }}>Join Room</button>
        </div>
      </div>

      {err && <p style={{ color: "#ef4444", marginTop: "1rem", textAlign: "center" }}>{err}</p>}

      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <a href="/test" style={{ color: "#3b82f6" }}>← Solo practice</a> · <a href="/test/history" style={{ color: "#8b5cf6" }}>History</a>
      </div>
    </main>
  );
}