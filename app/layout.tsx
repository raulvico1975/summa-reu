import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";
import { ca } from "@/src/i18n/ca";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { LogoutButton } from "@/src/components/logout-button";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SummaBoard",
  description: "Votacions i actes per entitats socials",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const owner = await getOwnerFromServerCookies();

  return (
    <html lang="ca" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} bg-slate-50 text-slate-900 antialiased`}
      >
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-sky-600">
              {ca.appName}
            </Link>

            <nav className="flex items-center gap-2 text-sm">
              {owner ? (
                <>
                  <Link className="rounded-md px-3 py-1.5 hover:bg-slate-100" href="/dashboard">
                    {ca.nav.dashboard}
                  </Link>
                  <Link className="rounded-md px-3 py-1.5 hover:bg-slate-100" href="/polls/new">
                    {ca.nav.newPoll}
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <Link className="rounded-md px-3 py-1.5 hover:bg-slate-100" href="/login">
                  {ca.nav.login}
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
