import "./globals.css";

export const metadata = {
  title: "CEED Practice Test",
  description: "CEED examination practice tests",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}