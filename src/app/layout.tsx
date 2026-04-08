/**
 * RootLayout — ÚNIC lloc on es renderitza <html> i <body>
 *
 * IMPORTANT (anti-regressió):
 * - Cap altre layout pot renderitzar <html> ni <body>
 * - Tots els layouts fills han d'usar <div> o fragments
 * - Si cal canviar lang dinàmicament, fer-ho via document.documentElement.lang
 *
 * @see docs/DEV-SOLO-MANUAL.md secció "Arquitectura de rutes i layouts"
 */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { TranslationsProvider } from '@/i18n/provider';
import { IdleLogoutProvider } from '@/components/IdleLogoutProvider';
import { ErrorBoundaryGlobal } from '@/components/ErrorBoundaryGlobal';

// Font principal - Inter (Apple-like, molt llegible)
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Summa Social | Gestió econòmica i fiscal per a entitats',
  description:
    'Gestió econòmica, fiscal i de projectes per a entitats del Tercer Sector Social.',
  openGraph: {
    title: 'Summa Social | Gestió econòmica i fiscal per a entitats',
    description:
      'Gestió econòmica, fiscal i de projectes per a entitats del Tercer Sector Social.',
    url: 'https://summasocial.app',
    siteName: 'Summa Social',
    locale: 'ca_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Summa Social | Gestió econòmica i fiscal per a entitats',
    description:
      'Gestió econòmica, fiscal i de projectes per a entitats del Tercer Sector Social.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const isStagingEnv =
    process.env.NEXT_PUBLIC_ENV === 'staging' || projectId.includes('staging');

  return (
    <html lang="ca" className={`${inter.variable} min-h-full overflow-x-hidden`} suppressHydrationWarning>
      <body className="min-h-full overflow-x-hidden font-sans antialiased" suppressHydrationWarning>
        {isStagingEnv ? (
          <div className="w-full bg-amber-400 px-3 py-1 text-center text-xs font-semibold text-black">
            STAGING · Entorn de proves aillat · No produccio
          </div>
        ) : null}
        <FirebaseClientProvider>
          <TranslationsProvider>
            <IdleLogoutProvider idleMs={30 * 60 * 1000} warnMs={60 * 1000}>
              <ErrorBoundaryGlobal>
                {children}
              </ErrorBoundaryGlobal>
            </IdleLogoutProvider>
          </TranslationsProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
