import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { PublicContactForm } from '@/components/public/PublicContactForm';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail } from 'lucide-react';
import { SUPPORT_EMAIL } from '@/lib/constants';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import { getPublicTranslations } from '@/i18n/public';

interface PageProps {
  params: Promise<{ lang: string }>;
}

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidPublicLocale(lang)) return {};

  const t = getPublicTranslations(lang);
  const seoMeta = generatePublicPageMetadata(lang, '/contact');

  return {
    title: `${t.contact.title} | Summa Social`,
    description: t.contact.subtitle,
    ...seoMeta,
  };
}

export default async function ContactPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-3xl space-y-8">
          <Logo className="h-12 w-12 mx-auto text-primary" />

          <div className="space-y-4 text-center">
            <h1 className="text-3xl font-bold tracking-tight">{t.contact.title}</h1>
            <p className="text-muted-foreground">{t.contact.subtitle}</p>
            <p className="text-muted-foreground">{t.contact.description}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg bg-muted/50 p-6">
              <PublicContactForm
                email={SUPPORT_EMAIL}
                labels={{
                  nameLabel: t.contact.form.nameLabel,
                  emailLabel: t.contact.form.emailLabel,
                  organizationLabel: t.contact.form.organizationLabel,
                  messageLabel: t.contact.form.messageLabel,
                  submit: t.contact.form.submit,
                  helper: t.contact.form.helper,
                }}
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-background p-6 space-y-5">
              <div>
                <p className="text-sm font-medium text-primary">{t.contact.directEmailLabel}</p>
                <div className="mt-3 flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-lg font-medium hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{t.contact.responseTime}</p>
              <div className="border-t border-border/60 pt-4">
                <div className="flex justify-center text-left">
                  <PublicDirectContact locale={locale} />
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/${locale}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t.common.backToHome}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href={`/${locale}/privacy`} className="hover:underline">
            {t.common.privacy}
          </Link>
          <span>·</span>
          <span>{t.common.appName}</span>
        </div>
      </footer>
    </main>
  );
}
