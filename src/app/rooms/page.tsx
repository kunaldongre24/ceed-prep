"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function RoomsPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [qCount, setQCount] = useState(10);
  const [timerMin, setTimerMin] = useState(10);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.username) setUsername(user.user_metadata.username);
      else supabase.from("profiles").select("username").eq("user_id", user?.id ?? "").single().then(({ data }) => { if (data?.username) setUsername(data.username); });
    });
  }, []);

  const createRoom = async () => {
    if (!username.trim()) { setErr("Enter username"); return; }
    setLoading(true); setErr("");
    const res = await fetch("/api/rooms/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionCount: qCount, timerSeconds: timerMin * 60 }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); setLoading(false); return; }
    router.push(`/rooms/${data.code}`);
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) { setErr("Enter a room code"); return; }
    setLoading(true); setErr("");
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); setLoading(false); return; }
    router.push(`/rooms/${data.code}`);
  };

  return (
    <div className="min-h-[calc(100vh-7rem)] p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-3">Realtime Multiplayer</Badge>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Battle Rooms</h1>
          <p className="mt-2 text-muted-foreground">Create a room, share the code, compete live. Same questions, same timer.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Create */}
          <Card className="border-emerald-500/20">
            <CardHeader>
              <CardTitle>🎮 Create Room</CardTitle>
              <CardDescription>You set the rules (host-only timer)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Questions</Label>
                <Input type="range" min={5} max={30} value={qCount} onChange={(e) => setQCount(Number(e.target.value))} />
                <div className="flex justify-between text-xs text-muted-foreground"><span>5</span><span className="font-bold text-primary">{qCount}</span><span>30</span></div>
              </div>
              <div className="space-y-2">
                <Label>Timer (total minutes)</Label>
                <div className="flex gap-2">
                  {[5, 10, 15, 20, 30].map(m => (
                    <button key={m} onClick={() => setTimerMin(m)} className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${timerMin === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {timerMin} min total · {qCount} Qs · ~{Math.round(timerMin * 60 / qCount)}s per Q
              </div>
              <Button onClick={createRoom} disabled={loading} className="w-full gradient-primary text-white" size="lg">
                {loading ? "Creating..." : "Create Room"}
              </Button>
            </CardContent>
          </Card>

          {/* Join */}
          <Card className="border-violet-500/20">
            <CardHeader>
              <CardTitle>🚪 Join Room</CardTitle>
              <CardDescription>Enter the 6-character room code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Room Code</Label>
                <Input
                  placeholder="e.g. AB12CD"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="text-center font-bold tracking-[0.3em] text-lg"
                  maxLength={6}
                />
              </div>
              <Button onClick={joinRoom} disabled={loading} className="w-full bg-violet-600 hover:bg-violet-700 text-white" size="lg">
                {loading ? "Joining..." : "Join Room"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {err && <p className="mt-4 text-center text-sm text-destructive">{err}</p>}

        <div className="mt-6 text-center">
          <a href="/test" className="text-sm text-primary hover:underline">← Solo practice</a> · <a href="/test/history" className="text-sm text-violet-400 hover:underline">History</a>
        </div>
      </div>
    </div>
  );
}