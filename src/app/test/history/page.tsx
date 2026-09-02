"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SessionRecord {
  id: string;
  question_count: number;
  timer_seconds: number;
  started_at: string;
  submitted_at: string;
}

function TestHistory() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/test/history");
        const data = await res.json();
        if (data.sessions) setSessions(data.sessions);
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  const formatAge = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const formatTime = (s: number): string => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
        <p className="text-muted-foreground">Loading history...</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-[calc(100vh-7rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Test History</CardTitle>
            <CardDescription>No completed tests yet. Start a practice to see your history here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/test")} className="gradient-primary text-white">Start Practice →</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-7rem)] p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Test History</h1>
            <p className="text-sm text-muted-foreground">{sessions.length} tests taken</p>
          </div>
          <Button onClick={() => router.push("/test")} className="gradient-primary text-white">New Test</Button>
        </div>

        <div className="grid gap-3">
          {sessions.map((s) => {
            const totalSecs = s.timer_seconds;
            const date = new Date(s.submitted_at);
            return (
              <Card key={s.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">{formatAge(s.submitted_at)}</Badge>
                    <div>
                      <div className="font-semibold text-sm">{s.question_count} questions</div>
                      <div className="text-xs text-muted-foreground">
                        {date.toLocaleDateString()} · {formatTime(totalSecs)} timer
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      sessionStorage.setItem(`result-${s.id}`, ""); // invalidate — server fetch will populate on result page
                      router.push(`/test/result?sessionId=${s.id}`);
                    }}>View Result</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TestHistoryPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-7rem)] items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <TestHistory />
    </Suspense>
  );
}