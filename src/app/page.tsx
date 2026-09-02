"use client";
import Link from "next/link";
export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top, #1e293b 0%, #0f172a 50%, #020617 100%)", color: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h1 style={{ fontSize: "3rem", fontWeight: 900, background: "linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "0.5rem" }}>CEED PREP</h1>
          <p style={{ color: "#94a3b8", fontSize: "1.1rem" }}>Master Design Entrance — Practice. Compete. Win.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
          <Link href="/test" style={{ background: "linear-gradient(135deg,#1e40af,#3b82f6)", borderRadius: 16, padding: "1.5rem", textAlign: "center", boxShadow: "0 10px 30px rgba(59,130,246,0.3)" }}>
            <div style={{ fontSize: "2rem" }}>🎯</div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0.5rem 0", color: "#fff" }}>Practice</h2>
            <p style={{ color: "#dbeafe", fontSize: "0.85rem" }}>Random Qs · Instant scoring</p>
            <div style={{ marginTop: "0.75rem", display: "inline-block", padding: "0.4rem 1rem", background: "#fff", color: "#1e40af", borderRadius: 20, fontWeight: 700, fontSize: "0.8rem" }}>Start →</div>
          </Link>

          <Link href="/rooms?create=1" style={{ background: "linear-gradient(135deg,#059669,#10b981)", borderRadius: 16, padding: "1.5rem", textAlign: "center", boxShadow: "0 10px 30px rgba(16,185,129,0.3)" }}>
            <div style={{ fontSize: "2rem" }}>➕</div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0.5rem 0", color: "#fff" }}>Create Room</h2>
            <p style={{ color: "#d1fae5", fontSize: "0.85rem" }}>Host a battle · Share code</p>
            <div style={{ marginTop: "0.75rem", display: "inline-block", padding: "0.4rem 1rem", background: "#fff", color: "#059669", borderRadius: 20, fontWeight: 700, fontSize: "0.8rem" }}>Create →</div>
          </Link>

          <Link href="/rooms?join=1" style={{ background: "linear-gradient(135deg,#7e22ce,#ec4899)", borderRadius: 16, padding: "1.5rem", textAlign: "center", boxShadow: "0 10px 30px rgba(236,72,153,0.3)" }}>
            <div style={{ fontSize: "2rem" }}>🚪</div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0.5rem 0", color: "#fff" }}>Join Room</h2>
            <p style={{ color: "#fce7f3", fontSize: "0.85rem" }}>Enter code · Compete live</p>
            <div style={{ marginTop: "0.75rem", display: "inline-block", padding: "0.4rem 1rem", background: "#fff", color: "#7e22ce", borderRadius: 20, fontWeight: 700, fontSize: "0.8rem" }}>Join →</div>
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "Questions", value: "290+", sub: "7 years" },
            { label: "Accuracy", value: "Live", sub: "Realtime scoring" },
            { label: "Mode", value: "1 vs N", sub: "Solo & Multiplayer" },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "1rem", textAlign: "center", backdropFilter: "blur(10px)" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <nav style={{ display: "flex", justifyContent: "center", gap: "1.5rem", color: "#64748b", fontSize: "0.85rem" }}>
          <Link href="/test/history" style={{ color: "#94a3b8" }}>📊 History</Link>
          <Link href="/admin/login" style={{ color: "#94a3b8" }}>🔧 Admin</Link>
          <a href="https://ceed-592143120374.asia-south1.run.app" style={{ color: "#94a3b8" }}>Cloud Run</a>
        </nav>
      </div>
    </main>
  );
}