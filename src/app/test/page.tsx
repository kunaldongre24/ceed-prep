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
    if (questionCount < 1 || questionCount > 30) { setError("Choose 5–30 questions"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/test/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionCount }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to start test"); setLoading(false); return; }
      sessionStorage.setItem(`test-${data.sessionId}`, JSON.stringify({ sessionId: data.sessionId, questions: data.questions }));
      router.push(`/test/take?sessionId=${data.sessionId}`);
    } catch { setError("Network error"); setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4 flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Badge variant="secondary" className="mx-auto mb-2">Solo Practice</Badge>
          <CardTitle className="text-2xl">Start Practice Test</CardTitle>
          <CardDescription>Random Section A questions — filtered to only usable Qs (with options/images)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Number of Questions</Label>
            <Input type="range" min={5} max={30} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
            <div className="flex justify-between text-xs text-muted-foreground"><span>5</span><span className="font-bold text-primary text-base">{questionCount}</span><span>30</span></div>
          </div>
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <div>✓ Only Qs with options/images</div>
            <div>✓ Instant scoring after submit</div>
            <div>✓ Images with loader</div>
          </div>
          {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</div>}
          <Button onClick={startTest} disabled={loading} className="w-full" size="lg">{loading ? "Starting..." : "Start Test →"}</Button>
          <div className="text-center text-xs text-muted-foreground">Or <a href="/rooms" className="text-primary hover:underline">battle friends</a> in a room</div>
        </CardContent>
      </Card>
    </div>
  );
}