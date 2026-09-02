"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");
    setLoading(true);

    // 1. Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Failed to create user");
      setLoading(false);
      return;
    }

    // 2. Create the profile with username
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: authData.user.id,
      username,
    });
    if (profileError) {
      setError(profileError.message);
      console.error("Profile creation error:", profileError);
    }

    // 3. Sign in automatically and redirect to home
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
    } else {
      document.cookie = "ceed_auth=1; path=/; max-age=86400; SameSite=Lax";
      localStorage.setItem("ceed_username", username);
      router.push("/");
    }
    setLoading(false);
  };

  return (
    <main style={{ maxWidth: 400, margin: "2rem auto", padding: "2rem", background: "#1a1a1a", borderRadius: 8, color: "#fff" }}>
      <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>Sign Up</h2>
      {error && <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSignup();
        }}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: "0.6rem",
            background: "#333",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: 6,
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: "0.6rem",
            background: "#333",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: 6,
          }}
        />
        <input
          type="text"
          placeholder="Username (will be shown on results)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{
            padding: "0.6rem",
            background: "#333",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: 6,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.6rem",
            background: loading ? "#555" : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
      <p style={{ textAlign: "center", marginTop: "1.5rem", color: "#888" }}>
        Already have an account? <a href="/auth/signin" style={{ color: "#3b82f6" }}>Sign in</a>
      </p>
    </main>
  );
}