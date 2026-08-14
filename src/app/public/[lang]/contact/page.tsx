import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { PublicContactForm } from '@/components/public/PublicContactForm';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { PUBLIC_SHELL_X } from '@/components/public/public-shell';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Mail } from 'lucide-react';
import { SUPPORT_EMAIL } from '@/lib/constants';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import { getPublicTranslations } from '@/i18n/public';
import { parsePublicPlanId, type PublicPlanId } from '@/lib/public-plans';

interface PageProps {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ plan?: string }>;
}

const CONTACT_MANUAL_COPY = {
  ca: {
    title: 'Consulta el manual',
    description: "Abans d'escriure'ns, pots consultar el manual d'usuari.",
    cta: 'Obrir el manual',
  },
  es: {
    title: 'Consulta el manual',
    description: 'Antes de escribirnos, puedes consultar el manual de usuario.',
    cta: 'Abrir el manual',
  },
} as const;

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidPublicLocale(lang)) return {};

  const t = getPublicTranslations(lang);
  const title = `${t.contact.title} | Summa Social`;
  const description = t.contact.subtitle;
  const seoMeta = generatePublicPageMetadata(lang, '/contact', { title, description });

  return {
    title,
    description,
    ...seoMeta,
  };
}

export default async function ContactPage({ params, searchParams }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const planId = parsePublicPlanId(resolvedSearchParams.plan);
  const planMessages = t.contact.form.planMessages as Partial<Record<PublicPlanId, string>>;
  const planMessage = planId ? planMessages[planId] : undefined;
  const manualCopy = locale === 'ca' || locale === 'es' ? CONTACT_MANUAL_COPY[locale] : null;

  return (
    <main className="flex min-h-screen flex-col">
      <div className={`flex flex-1 flex-col items-center justify-center bg-background py-16 ${PUBLIC_SHELL_X}`}>
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
                locale={locale}
                labels={{
                  nameLabel: t.contact.form.nameLabel,
                  emailLabel: t.contact.form.emailLabel,
                  organizationLabel: t.contact.form.organizationLabel,
                  messageLabel: t.contact.form.messageLabel,
                  submit: t.contact.form.submit,
                  sending: t.contact.form.sending,
                  success: t.contact.form.success,
                  error: t.contact.form.error,
                  invalidName: t.contact.form.invalidName,
                  invalidEmail: t.contact.form.invalidEmail,
                  invalidMessage: t.contact.form.invalidMessage,
                  helper: t.contact.form.helper,
                  messagePlaceholder: t.contact.form.messagePlaceholder,
                }}
                initialMessage={planMessage}
                planId={planId ?? undefined}
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
              {manualCopy && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 h-5 w-5 text-primary" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{manualCopy.title}</p>
                      <p className="text-sm leading-6 text-muted-foreground">{manualCopy.description}</p>
                      <Link href={`/${locale}/manual`} className="text-sm font-medium text-primary hover:underline">
                        {manualCopy.cta}
                      </Link>
                    </div>
                  </div>
                </div>
              )}
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
      <footer className={`border-t py-6 ${PUBLIC_SHELL_X}`}>
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
