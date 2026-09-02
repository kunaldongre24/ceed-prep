"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-7rem)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3">Production Ready · Asia-South1 · Realtime</Badge>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 bg-clip-text text-transparent">CEED PREP</h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">Master Design Entrance — 290+ curated questions from 7 years. Practice solo or battle friends live.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
            <Badge variant="outline">7 years</Badge>
            <Badge variant="outline">290 Qs</Badge>
            <Badge variant="outline">Solo & 1 vs N</Badge>
            <Badge variant="outline">Realtime</Badge>
          </div>
        </div>

        {/* Primary actions — Practice / Create / Join */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
            <CardHeader className="pb-2">
              <div className="text-3xl">🎯</div>
              <CardTitle className="text-white">Practice</CardTitle>
              <CardDescription className="text-blue-100">Random Qs · Instant scoring · History</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/test"><Button variant="secondary" className="w-full bg-white text-blue-600 hover:bg-white/90">Start Practice →</Button></Link>
            </CardContent>
            <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
            <CardHeader className="pb-2">
              <div className="text-3xl">➕</div>
              <CardTitle className="text-white">Create Room</CardTitle>
              <CardDescription className="text-emerald-100">Host a battle · Share 6-char code</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/rooms"><Button variant="secondary" className="w-full bg-white text-emerald-600 hover:bg-white/90">Create Room →</Button></Link>
            </CardContent>
            <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-violet-600 to-pink-500 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
            <CardHeader className="pb-2">
              <div className="text-3xl">🚪</div>
              <CardTitle className="text-white">Join Room</CardTitle>
              <CardDescription className="text-pink-100">Enter code · Compete live</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/rooms"><Button variant="secondary" className="w-full bg-white text-violet-600 hover:bg-white/90">Join Room →</Button></Link>
            </CardContent>
            <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { k: "Questions", v: "290+", d: "Approved · 7 yrs" },
            { k: "Modes", v: "Solo & Battle", d: "Practice or 1 vs N" },
            { k: "Realtime", v: "Live", d: "Timer + Leaderboard" },
          ].map((s) => (
            <Card key={s.k} className="glass text-center">
              <CardContent className="pt-6">
                <div className="text-xl font-black">{s.v}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</div>
                <div className="text-xs text-muted-foreground/70">{s.d}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>Solo practice or realtime battle — same question bank.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border p-4">
              <div className="font-semibold mb-1">1. Practice</div>
              <p className="text-muted-foreground">Pick 5–30 Qs. Filtered to only usable Qs (with options/images). Images show with loader.</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="font-semibold mb-1">2. Battle Room</div>
              <p className="text-muted-foreground">Create → share 6-char code → friends join → host starts → same timer for all.</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="font-semibold mb-1">3. Results</div>
              <p className="text-muted-foreground">Instant scoring, leaderboard 🥇🥈🥉, and history.</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <Link href="/test/history"><Button variant="outline">📊 History</Button></Link>
          <Link href="/admin/login"><Button variant="ghost">🔧 Admin</Button></Link>
        </div>
      </div>
    </div>
  );
}