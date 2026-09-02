import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "CEED Prep — Practice & Battle",
  description: "CEED examination practice platform — 290+ questions, solo & realtime multiplayer",
};

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-white text-sm">C</span>
          <span className="hidden sm:inline">CEED PREP</span>
          <span className="ml-2 hidden rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline">7 years · 290 Qs</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/test" className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors">Practice</Link>
          <Link href="/rooms" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90 transition-colors">Rooms ⚔️</Link>
          <Link href="/test/history" className="hidden sm:inline rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors">History</Link>
          <Link href="/admin/login" className="hidden sm:inline rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors">Admin</Link>
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Header />
        <main>{children}</main>
        <footer className="border-t py-6 text-center text-xs text-muted-foreground">
          <div className="mx-auto max-w-6xl px-4">CEED Prep — Solo & Realtime Battle · <span className="text-primary">ceed-592143120374.asia-south1.run.app</span></div>
        </footer>
      </body>
    </html>
  );
}