import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/src/i18n/client";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { LogoutButton } from "@/src/components/logout-button";
import { ErrorMonitor } from "@/src/components/error-monitor";
import { BrandLogo } from "@/src/components/brand-logo";
import { SessionIdleManager } from "@/src/components/session/session-idle-manager";
import { getMarketingContent } from "@/src/lib/marketing";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("https://summareu.app"),
  title: "Summa Reu",
  description: "Votacions, convocatòries i actes per a entitats socials",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, i18n } = await getRequestI18n();
  const owner = await getOwnerFromServerCookies();
  const marketing = getMarketingContent(locale);
  const navLinkClasses = owner
    ? "rounded-md px-3 py-2 text-center text-sm leading-tight transition-colors hover:bg-slate-100"
    : "rounded-full px-4 py-2 text-center text-sm leading-tight text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950";
  const headerClasses = owner
    ? "border-b border-slate-200 bg-white"
    : "border-b border-slate-200/80 bg-white/88 backdrop-blur supports-[backdrop-filter]:bg-white/76";
  const mainClasses = owner
    ? "mx-auto w-full max-w-4xl px-4 py-6 sm:py-8"
    : "w-full";
  const headerContainerClasses = owner
    ? "mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4"
    : "mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8";

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} bg-slate-50 text-slate-900 antialiased`}
      >
        <I18nProvider locale={locale} i18n={i18n}>
          <SessionIdleManager enabled={Boolean(owner)} />
          <header className={headerClasses}>
            <div className={headerContainerClasses}>
              <Link
                href={withLocalePath(locale, "/")}
                className="w-fit shrink-0 text-lg font-semibold text-sky-600"
              >
                <span className="sm:hidden">
                  <BrandLogo compact />
                </span>
                <span className="hidden sm:inline-flex">
                  <BrandLogo />
                </span>
              </Link>

              <nav className="flex w-full flex-wrap items-center gap-2 text-sm sm:w-auto sm:justify-end">
                {owner ? (
                  <>
                    <Link
                      className={`${navLinkClasses} flex-1 sm:flex-none`}
                      href={withLocalePath(locale, "/dashboard")}
                    >
                      {i18n.nav.dashboard}
                    </Link>
                    <Link
                      className={`${navLinkClasses} flex-1 sm:flex-none`}
                      href={withLocalePath(locale, "/polls/new")}
                    >
                      {i18n.nav.newPoll}
                    </Link>
                    <Link
                      className={`${navLinkClasses} flex-1 sm:flex-none`}
                      href={withLocalePath(locale, "/settings")}
                    >
                      {i18n.nav.settings}
                    </Link>
                    <Link
                      className={`${navLinkClasses} flex-1 sm:flex-none`}
                      href={withLocalePath(locale, "/help")}
                    >
                      {i18n.nav.help}
                    </Link>
                    <LogoutButton className="w-full sm:w-auto" label={i18n.nav.logout} />
                  </>
                ) : (
                  <>
                    {marketing.headerLinks.map((link) => (
                      <Link
                        key={link.href}
                        className={`${navLinkClasses} hidden md:inline-flex`}
                        href={withLocalePath(locale, link.href)}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <Link
                      className="flex-1 rounded-full px-4 py-2 text-center text-sm font-medium leading-tight text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 sm:flex-none"
                      href={withLocalePath(locale, "/login")}
                    >
                      {i18n.nav.login}
                    </Link>
                    <Link
                      className="flex-1 rounded-full bg-slate-950 px-4 py-2 text-center text-sm font-medium leading-tight text-white transition-colors hover:bg-slate-800 sm:flex-none"
                      href={withLocalePath(locale, "/signup")}
                    >
                      {i18n.nav.signup}
                    </Link>
                  </>
                )}
              </nav>
            </div>
          </header>
          <main className={mainClasses}>{children}</main>
          <ErrorMonitor />
        </I18nProvider>
      </body>
    </html>
  );
}
