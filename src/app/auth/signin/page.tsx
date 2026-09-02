"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    document.cookie = "ceed_auth=1; path=/; max-age=86400; SameSite=Lax";
    router.push("/");
    setLoading(false);
  };

  return (
    <main style={{ maxWidth: 400, margin: "2rem auto", padding: "2rem", background: "#1a1a1a", borderRadius: 8, color: "#fff" }}>
      <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>Sign In</h2>
      {error && <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: "0.6rem", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: 6 }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: "0.6rem", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: 6 }} />
        <button type="submit" disabled={loading} style={{ padding: "0.6rem", background: loading ? "#555" : "#3b82f6", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600 }}>{loading ? "Signing in..." : "Sign In"}</button>
      </form>
      <p style={{ textAlign: "center", marginTop: "1.5rem", color: "#888" }}>
        Don't have an account? <a href="/auth/signup" style={{ color: "#3b82f6" }}>Sign up</a>
      </p>
    </main>
  );
}