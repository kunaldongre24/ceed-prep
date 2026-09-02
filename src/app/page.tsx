"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Sparkles = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2l1.8 5.4L19 9.2l-5.2 1.8L12 16.4l-1.8-5.4L5 9.2l5.2-1.8L12 2zM19 14l.9 2.7L22.6 17.6l-2.7.9L19 21.2l-.9-2.7-2.7-.9 2.7-.9L19 14z" />
  </svg>
);

const Icon = ({ name }: { name: "target" | "swords" | "users" | "book" | "timer" | "trophy" | "arrow" }) => {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (name) {
    case "target":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" {...p}>
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "swords":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" {...p}>
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" />
          <path d="M16 16l4 4" /><path d="M19 21l2-2" /><path d="M6.5 12.5l3 3" />
        </svg>
      );
    case "users":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" {...p}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "book":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...p}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "timer":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...p}>
          <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M9 2h6" />
        </svg>
      );
    case "trophy":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...p}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
        </svg>
      );
    case "arrow":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
        </svg>
      );
  }
};

const stats = [
  { k: "Questions", v: "373", d: "Approved · 8 years" },
  { k: "Modes", v: "Solo & Battle", d: "Practice or 1 vs N" },
  { k: "Realtime", v: "Live", d: "Timer + Leaderboard" },
];

const actions = [
  {
    href: "/test",
    title: "Practice",
    desc: "Random Qs · Instant scoring · History",
    icon: "target",
    grad: "from-blue-600 to-cyan-500",
    cta: "bg-white text-blue-600 hover:bg-white/90",
  },
  {
    href: "/rooms",
    title: "Create Room",
    desc: "Host a battle · Share 6-char code",
    icon: "swords",
    grad: "from-emerald-600 to-teal-500",
    cta: "bg-white text-emerald-600 hover:bg-white/90",
  },
  {
    href: "/rooms",
    title: "Join Room",
    desc: "Enter code · Compete live",
    icon: "users",
    grad: "from-violet-600 to-pink-500",
    cta: "bg-white text-violet-600 hover:bg-white/90",
  },
];

const steps = [
  {
    icon: "book",
    title: "Practice",
    desc: "Pick 5–30 Qs. Filtered to only usable Qs (with options/images). Images show with loader.",
  },
  {
    icon: "swords",
    title: "Battle Room",
    desc: "Create → share 6-char code → friends join → host starts → same timer for all.",
  },
  {
    icon: "trophy",
    title: "Results",
    desc: "Instant scoring, leaderboard 🥇🥈🥉, and history.",
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-[calc(100vh-7rem)] overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-violet-600/20 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 -left-16 h-72 w-72 rounded-full bg-pink-600/10 blur-[120px]" />

      <div className="relative mx-auto max-w-5xl px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 px-3 py-1.5 text-xs tracking-wide">
            <Sparkles /> <span className="ml-1.5">Production · Asia-South1 · Realtime</span>
          </Badge>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-transparent drop-shadow">
            CEED PREP
          </h1>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
            Master Design Entrance — <span className="text-foreground font-semibold">373 curated questions</span> across 8 years.
            Practice solo or battle friends live.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
            <Badge variant="outline">8 years</Badge>
            <Badge variant="outline">373 Qs</Badge>
            <Badge variant="outline">Solo & 1 vs N</Badge>
            <Badge variant="outline">Realtime</Badge>
          </div>
        </div>

        {/* Primary actions — Practice / Create / Join */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          {actions.map((a) => {
            return (
              <Card
                key={a.title}
                className={`group relative overflow-hidden border-0 bg-gradient-to-br ${a.grad} text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer`}
              >
                <CardHeader className="pb-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur mb-1">
                    <Icon name={a.icon as "target"} />
                  </div>
                  <CardTitle className="text-white text-lg">{a.title}</CardTitle>
                  <CardDescription className="text-white/80">{a.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={a.href} className="block">
                    <Button
                      variant="secondary"
                      className={`w-full ${a.cta} group-hover:translate-x-0.5 transition-transform`}
                    >
                      {a.title === "Practice" ? "Start Practice" : a.title} <Icon name="arrow" />
                    </Button>
                  </Link>
                </CardContent>
                <div className="absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-white/10 blur-2xl transition-all group-hover:scale-125" />
              </Card>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {stats.map((s) => (
            <Card key={s.k} className="glass text-center border-0">
              <CardContent className="pt-6 pb-5">
                <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {s.v}
                </div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{s.k}</div>
                <div className="mt-0.5 text-xs text-muted-foreground/70">{s.d}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How it works */}
        <Card className="border-0 glass">
          <CardHeader className="text-center">
            <CardTitle>
              <Icon name="timer" /> <span className="ml-1.5 align-middle">How it works</span>
            </CardTitle>
            <CardDescription>Solo practice or realtime battle — same question bank.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
            {steps.map((st, i) => {
              return (
                <div key={st.title} className="relative rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-primary/40 transition-colors">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full gradient-primary text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <Icon name={st.icon as "book"} />
                    <span className="font-semibold">{st.title}</span>
                  </div>
                  <p className="text-muted-foreground">{st.desc}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm">
          <Link href="/test/history">
            <Button variant="outline">📊 History</Button>
          </Link>
          <Link href="/admin/login">
            <Button variant="ghost">🔧 Admin</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}