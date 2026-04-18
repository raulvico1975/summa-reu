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
  const navLinkClasses =
    "rounded-md px-3 py-2 text-center text-sm leading-tight transition-colors hover:bg-slate-100";
  const publicFooter = {
    brandTagline:
      locale === "ca"
        ? "Convocatòries, reunions i actes per a entitats."
        : "Convocatorias, reuniones y actas para entidades.",
    sitemapLabel: locale === "ca" ? "Mapa del web" : "Mapa del sitio",
    contactLabel: locale === "ca" ? "Contacte" : "Contacto",
    contactBody:
      locale === "ca"
        ? "Respondrem tan aviat com puguem."
        : "Responderemos lo antes posible.",
    sitemapLinks: [
      { href: "/", label: locale === "ca" ? "Inici" : "Inicio" },
      {
        href: locale === "ca" ? "/convocatories-i-votacions" : "/convocatorias-y-votaciones",
        label: locale === "ca" ? "Convocatòries i votacions" : "Convocatorias y votaciones",
      },
      {
        href: locale === "ca" ? "/software-juntes-directives" : "/software-juntas-directivas",
        label: locale === "ca" ? "Juntes directives" : "Juntas directivas",
      },
      {
        href: locale === "ca" ? "/actes-ia-entitats" : "/actas-ia-entidades",
        label: locale === "ca" ? "Actes amb IA" : "Actas con IA",
      },
      { href: "/help", label: locale === "ca" ? "Ajuda" : "Ayuda" },
    ],
  };

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="bg-slate-50 text-slate-900 antialiased"
      >
        <I18nProvider locale={locale} i18n={i18n}>
          <SessionIdleManager enabled={Boolean(owner)} />
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
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
                    <Link
                      className="flex-1 rounded-md bg-sky-600 px-3 py-2 text-center text-sm font-medium leading-tight text-white transition-colors hover:bg-sky-700 sm:flex-none"
                      href={withLocalePath(locale, "/login")}
                    >
                      {i18n.nav.login}
                    </Link>
                    <Link
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-center text-sm leading-tight transition-colors hover:bg-slate-100 sm:flex-none"
                      href={withLocalePath(locale, "/signup")}
                    >
                      {i18n.nav.signup}
                    </Link>
                  </>
                )}
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">{children}</main>
          {!owner ? (
            <footer className="border-t bg-slate-100/70 px-4 py-10">
              <div className="mx-auto grid w-full max-w-4xl gap-10 md:grid-cols-3">
                <div className="space-y-4">
                  <Link
                    href={withLocalePath(locale, "/")}
                    className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900 transition-opacity hover:opacity-90"
                  >
                    <BrandLogo />
                  </Link>
                  <p className="max-w-sm text-sm leading-6 text-slate-600">{publicFooter.brandTagline}</p>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                    {publicFooter.sitemapLabel}
                  </p>
                  <nav className="grid gap-3 text-sm text-slate-600">
                    {publicFooter.sitemapLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={withLocalePath(locale, link.href)}
                        className="hover:text-slate-950 hover:underline"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                    {publicFooter.contactLabel}
                  </p>
                  <p className="text-sm leading-6 text-slate-600">{publicFooter.contactBody}</p>
                  <a
                    href="mailto:hola@summareu.app"
                    className="inline-flex text-sm font-medium text-sky-700 hover:underline"
                  >
                    hola@summareu.app
                  </a>
                </div>
              </div>
            </footer>
          ) : null}
          <ErrorMonitor />
        </I18nProvider>
      </body>
    </html>
  );
}
