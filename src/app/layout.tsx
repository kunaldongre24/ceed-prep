import "./globals.css";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export const metadata = {
  title: "CEED Practice Test",
  description: "CEED examination practice tests",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the session from the server side
  const cookieStore = cookies();
  const supa = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data: { user } } = await supa.auth.getUser();

  return (
    <html lang="en">
      <body>
        {children}
        {/* We don't render auth state here; the middleware handles redirects. */}
        {/* The user's username can be fetched in individual pages via useSupabase() or server actions. */}
      </body>
    </html>
  );
}