"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setErr("");
    setLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pwd }),
    });
    if (res.ok) router.push("/admin");
    else setErr("Invalid admin credentials");
    setLoading(false);
  };

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto", padding: "2rem", background: "#1a1a1a", borderRadius: 8, color: "#fff" }}>
      <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>Admin Login</h2>
      {err && <p style={{ color: "#ef4444", marginBottom: "1rem", textAlign: "center" }}>{err}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} style={{ padding: "0.6rem", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: 6 }} />
        <input type="password" placeholder="Password" value={pwd} onChange={(e) => setPwd(e.target.value)} style={{ padding: "0.6rem", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: 6 }} />
        <button onClick={login} disabled={loading} style={{ padding: "0.6rem", background: loading ? "#555" : "#3b82f6", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600 }}>{loading ? "Signing in..." : "Login"}</button>
      </div>
    </main>
  );
}