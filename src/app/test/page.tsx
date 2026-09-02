"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function TestSetupPage() {
  const router = useRouter();
  const [questionCount, setQuestionCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/auth/signin");
    });
  }, [router]);

  const startTest = async () => {
    if (questionCount < 5 || questionCount > 30) { setError("Choose 5–30 questions"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/test/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionCount }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to start test"); setLoading(false); return; }
      sessionStorage.setItem(`test-${data.sessionId}`, JSON.stringify({ sessionId: data.sessionId, questions: data.questions, timerSeconds: data.timerSeconds }));
      router.push(`/test/take?sessionId=${data.sessionId}`);
    } catch { setError("Network error"); setLoading(false); }
  };

  const totalTime = questionCount * 60;
  const mins = Math.floor(totalTime / 60);

  return (
    <div className="min-h-[calc(100vh-7rem)] flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Badge variant="secondary" className="mx-auto mb-2">Solo Practice</Badge>
          <CardTitle className="text-2xl">Start Practice Test</CardTitle>
          <CardDescription>Random Section A questions · 60 seconds per question · auto-submit on expiry</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Number of Questions</Label>
            <Input type="range" min={5} max={30} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
            <div className="flex justify-between text-xs text-muted-foreground"><span>5</span><span className="font-bold text-primary text-base">{questionCount}</span><span>30</span></div>
          </div>
          <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm space-y-1.5">
            <div className="text-foreground font-medium">⏱ {mins} minutes total ({questionCount} × 60s)</div>
            <div className="text-muted-foreground text-xs">• Only questions with options/images included</div>
            <div className="text-muted-foreground text-xs">• Auto-submit when timer expires</div>
            <div className="text-muted-foreground text-xs">• Full time analysis + breakdown on results</div>
          </div>
          {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</div>}
          <Button onClick={startTest} disabled={loading} className="w-full gradient-primary text-white" size="lg">
            {loading ? "Starting..." : `Start Practice → ${mins} min`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Or <a href="/rooms" className="text-primary hover:underline">battle friends</a> in a room</p>
        </CardContent>
      </Card>
    </div>
  );
}