import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Building2, GitBranch, Network, ShieldCheck } from 'lucide-react';
import { PublicEditorialMark } from '@/components/public/PublicEditorialMark';
import { PUBLIC_SHELL_X } from '@/components/public/public-shell';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { Button } from '@/components/ui/button';
import {
  PUBLIC_LOCALES,
  generatePublicPageMetadata,
  isValidPublicLocale,
  type PublicLocale,
} from '@/lib/public-locale';
import { getPublicFeaturesHref } from '@/lib/public-site-paths';
import { getPublicTranslations } from '@/i18n/public';

interface PageProps {
  params: Promise<{ lang: string }>;
}

const ABOUT_COPY: Record<
  PublicLocale,
  {
    originEyebrow: string;
    originTitle: string;
    originBody: string[];
    panelTitle: string;
    panelItems: string[];
    semillaTitle: string;
    semillaBody: string;
    entitiesTitle: string;
    entitiesBody: string;
    relationTitle: string;
    relationEyebrow: string;
    relationLead: string;
    gongLabel: string;
    gongText: string;
    summaLabel: string;
    summaText: string;
    closing: string;
    footerNote: string;
  }
> = {
  ca: {
    originEyebrow: 'Origen',
    originTitle: 'Summa Social neix de la gestió real de les entitats',
    originBody: [
      'Summa Social neix del treball directe amb entitats socials que gestionen socis, donants, subvencions, justificacions econòmiques, documents i moviments bancaris cada mes.',
      'No parteix d’una idea abstracta de programari, sinó de necessitats observades en l’acompanyament administratiu, econòmic i tècnic d’organitzacions que necessiten menys dispersió, menys Excel i més control sobre la seva informació.',
    ],
    panelTitle: 'Trajectòria aplicada a una necessitat concreta',
    panelItems: [
      'Programari pensat per a entitats socials',
      'Necessitats detectades acompanyant entitats',
      'Bancs, donants, fiscalitat, documents i subvencions',
    ],
    semillaTitle: 'Dins l’ecosistema de Semilla de Software Libre',
    semillaBody:
      'Summa Social forma part de l’oferta de Semilla de Software Libre, una organització amb trajectòria en el desenvolupament de solucions digitals per al tercer sector. Aquesta experiència inclou GONG, un sistema integral de gestió utilitzat per entitats socials i de cooperació amb necessitats complexes de projectes, pressupostos, execució i justificació.',
    entitiesTitle: 'Experiència acumulada amb entitats de referència',
    entitiesBody:
      'L’ecosistema de Semilla ha acumulat experiència amb entitats de referència en cooperació, acció social i justícia global, com Justícia Alimentària Global, Mundubat, CODESPA, l’Organització d’Estats Iberoamericans, Fundació Vicente Ferrer, Brigades Internacionals de Pau, International Action for Peace, Baruma i Flores de Kiskeya. Aquesta trajectòria ha ajudat a entendre millor necessitats que apareixen una vegada i una altra en la gestió econòmica de les entitats: conciliació bancària, seguiment de donants, fiscalitat, justificació documental i informes per a finançadors.',
    relationTitle: 'Necessitats diferents dins d’una mateixa trajectòria',
    relationEyebrow: 'Context de producte',
    relationLead:
      'GONG i Summa Social formen part d’una mateixa trajectòria de treball amb entitats socials, però responen a realitats organitzatives diferents.',
    gongLabel: 'GONG',
    gongText:
      'Sistema integral per a entitats amb gestió complexa de projectes, pressupostos, finançadors, execució tècnica i justificació.',
    summaLabel: 'Summa Social',
    summaText:
      'Aplicació enfocada a la gestió econòmica quotidiana: moviments bancaris, socis, donants, remeses, certificats fiscals, documents justificatius i informes per a subvencions.',
    closing:
      'Comparteixen una mateixa experiència de treball amb entitats socials i l’apliquen a realitats organitzatives diferents.',
    footerNote: 'Desenvolupada dins l’ecosistema de Semilla de Software Libre.',
  },
  es: {
    originEyebrow: 'Origen',
    originTitle: 'Summa Social nace de la gestión real de las entidades',
    originBody: [
      'Summa Social nace del trabajo directo con entidades sociales que gestionan socios, donantes, subvenciones, justificaciones económicas, documentos y movimientos bancarios cada mes.',
      'No parte de una idea abstracta de software, sino de necesidades observadas en el acompañamiento administrativo, económico y técnico de organizaciones que necesitan menos dispersión, menos Excel y más control sobre su información.',
    ],
    panelTitle: 'Trayectoria aplicada a una necesidad concreta',
    panelItems: [
      'Software pensado para entidades sociales',
      'Necesidades detectadas acompañando a entidades',
      'Bancos, donantes, fiscalidad, documentos y subvenciones',
    ],
    semillaTitle: 'Dentro del ecosistema de Semilla de Software Libre',
    semillaBody:
      'Summa Social forma parte de la oferta de Semilla de Software Libre, una organización con trayectoria en el desarrollo de soluciones digitales para el tercer sector. Esta experiencia incluye GONG, un sistema integral de gestión utilizado por entidades sociales y de cooperación con necesidades complejas de proyectos, presupuestos, ejecución y justificación.',
    entitiesTitle: 'Experiencia acumulada con entidades de referencia',
    entitiesBody:
      'El ecosistema de Semilla ha acumulado experiencia con entidades de referencia en cooperación, acción social y justicia global, como Justícia Alimentària Global, Mundubat, CODESPA, la Organización de Estados Iberoamericanos, Fundación Vicente Ferrer, Brigadas Internacionales de Paz, International Action for Peace, Baruma y Flores de Kiskeya. Esta trayectoria ha ayudado a entender mejor necesidades que aparecen una y otra vez en la gestión económica de las entidades: conciliación bancaria, seguimiento de donantes, fiscalidad, justificación documental e informes para financiadores.',
    relationTitle: 'Necesidades distintas dentro de una misma trayectoria',
    relationEyebrow: 'Contexto de producto',
    relationLead:
      'GONG y Summa Social forman parte de una misma trayectoria de trabajo con entidades sociales, pero responden a realidades organizativas distintas.',
    gongLabel: 'GONG',
    gongText:
      'Sistema integral para entidades con gestión compleja de proyectos, presupuestos, financiadores, ejecución técnica y justificación.',
    summaLabel: 'Summa Social',
    summaText:
      'Aplicación enfocada en la gestión económica cotidiana: movimientos bancarios, socios, donantes, remesas, certificados fiscales, documentos justificativos e informes para subvenciones.',
    closing:
      'Comparten una misma experiencia de trabajo con entidades sociales y la aplican a realidades organizativas diferentes.',
    footerNote: 'Desarrollada dentro del ecosistema de Semilla de Software Libre.',
  },
  fr: {
    originEyebrow: 'Origine',
    originTitle: 'Summa Social naît de la gestion réelle des organisations',
    originBody: [
      'Summa Social naît du travail direct avec des organisations sociales qui gèrent chaque mois membres, donateurs, subventions, justificatifs économiques, documents et mouvements bancaires.',
      'L’outil ne part pas d’une idée abstraite de logiciel, mais de besoins observés dans l’accompagnement administratif, économique et technique d’organisations qui ont besoin de moins de dispersion, moins d’Excel et plus de contrôle sur leur information.',
    ],
    panelTitle: 'Une trajectoire appliquée à un besoin concret',
    panelItems: [
      'Logiciel pensé pour les organisations sociales',
      'Besoins identifiés en accompagnant des organisations',
      'Banques, donateurs, fiscalité, documents et subventions',
    ],
    semillaTitle: 'Au sein de l’écosystème de Semilla de Software Libre',
    semillaBody:
      'Summa Social fait partie de l’offre de Semilla de Software Libre, une organisation expérimentée dans le développement de solutions numériques pour le troisième secteur. Cette expérience inclut GONG, un système intégral de gestion utilisé par des organisations sociales et de coopération avec des besoins complexes de projets, budgets, exécution et justification.',
    entitiesTitle: 'Expérience accumulée avec des organisations de référence',
    entitiesBody:
      'L’écosystème de Semilla a accumulé de l’expérience avec des organisations de référence dans la coopération, l’action sociale et la justice globale, comme Justícia Alimentària Global, Mundubat, CODESPA, l’Organisation des États ibéro-américains, Fundación Vicente Ferrer, Brigades Internationales de Paix, International Action for Peace, Baruma et Flores de Kiskeya. Cette trajectoire a aidé à mieux comprendre des besoins récurrents dans la gestion économique des organisations : rapprochement bancaire, suivi des donateurs, fiscalité, justificatifs documentaires et rapports pour les financeurs.',
    relationTitle: 'Des besoins différents dans une même trajectoire',
    relationEyebrow: 'Contexte produit',
    relationLead:
      'GONG et Summa Social font partie d’une même trajectoire de travail avec des organisations sociales, mais répondent à des réalités organisationnelles différentes.',
    gongLabel: 'GONG',
    gongText:
      'Système intégral pour organisations avec gestion complexe de projets, budgets, financeurs, exécution technique et justification.',
    summaLabel: 'Summa Social',
    summaText:
      'Application centrée sur la gestion économique quotidienne : mouvements bancaires, membres, donateurs, prélèvements, certificats fiscaux, justificatifs et rapports pour subventions.',
    closing:
      'Ils partagent une même expérience de travail avec des organisations sociales et l’appliquent à des réalités organisationnelles différentes.',
    footerNote: 'Développée au sein de l’écosystème de Semilla de Software Libre.',
  },
  pt: {
    originEyebrow: 'Origem',
    originTitle: 'O Summa Social nasce da gestão real das entidades',
    originBody: [
      'O Summa Social nasce do trabalho direto com entidades sociais que gerem sócios, doadores, subsídios, justificações económicas, documentos e movimentos bancários todos os meses.',
      'Não parte de uma ideia abstrata de software, mas de necessidades observadas no acompanhamento administrativo, económico e técnico de organizações que precisam de menos dispersão, menos Excel e mais controlo sobre a sua informação.',
    ],
    panelTitle: 'Trajetória aplicada a uma necessidade concreta',
    panelItems: [
      'Software pensado para entidades sociais',
      'Necessidades detetadas acompanhando entidades',
      'Bancos, doadores, fiscalidade, documentos e subsídios',
    ],
    semillaTitle: 'Dentro do ecossistema da Semilla de Software Libre',
    semillaBody:
      'O Summa Social faz parte da oferta da Semilla de Software Libre, uma organização com trajetória no desenvolvimento de soluções digitais para o terceiro setor. Esta experiência inclui o GONG, um sistema integral de gestão utilizado por entidades sociais e de cooperação com necessidades complexas de projetos, orçamentos, execução e justificação.',
    entitiesTitle: 'Experiência acumulada com entidades de referência',
    entitiesBody:
      'O ecossistema da Semilla acumulou experiência com entidades de referência em cooperação, ação social e justiça global, como Justícia Alimentària Global, Mundubat, CODESPA, a Organização de Estados Ibero-Americanos, Fundação Vicente Ferrer, Brigadas Internacionais de Paz, International Action for Peace, Baruma e Flores de Kiskeya. Esta trajetória ajudou a compreender melhor necessidades que aparecem repetidamente na gestão económica das entidades: reconciliação bancária, acompanhamento de doadores, fiscalidade, justificação documental e relatórios para financiadores.',
    relationTitle: 'Necessidades diferentes dentro de uma mesma trajetória',
    relationEyebrow: 'Contexto de produto',
    relationLead:
      'GONG e Summa Social fazem parte de uma mesma trajetória de trabalho com entidades sociais, mas respondem a realidades organizativas diferentes.',
    gongLabel: 'GONG',
    gongText:
      'Sistema integral para entidades com gestão complexa de projetos, orçamentos, financiadores, execução técnica e justificação.',
    summaLabel: 'Summa Social',
    summaText:
      'Aplicação focada na gestão económica quotidiana: movimentos bancários, sócios, doadores, remessas, certificados fiscais, documentos justificativos e relatórios para subsídios.',
    closing:
      'Partilham uma mesma experiência de trabalho com entidades sociais e aplicam-na a realidades organizativas diferentes.',
    footerNote: 'Desenvolvida dentro do ecossistema da Semilla de Software Libre.',
  },
};

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidPublicLocale(lang)) return {};

  const t = getPublicTranslations(lang);

  return {
    title: t.about.metaTitle,
    description: t.about.metaDescription,
    ...generatePublicPageMetadata(lang, '/qui-som'),
  };
}

export default async function AboutPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const featuresHref = getPublicFeaturesHref(locale);
  const copy = ABOUT_COPY[locale];

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <PublicSiteHeader locale={locale} currentSection="about" />

      <section className={`relative overflow-hidden py-16 lg:py-20 ${PUBLIC_SHELL_X}`}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-4rem] top-[-2rem] h-44 w-44 rounded-full bg-sky-100 blur-3xl" />
          <div className="absolute right-0 top-8 h-56 w-56 rounded-full bg-amber-100/70 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full border border-sky-200 bg-background/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t.home.whoWeAre.status}
              </span>
              <h1 className="max-w-2xl text-3xl font-bold tracking-tight lg:text-5xl">
                {t.home.whoWeAre.title}
              </h1>
              <PublicEditorialMark size="xs" className="-mt-2 opacity-65" />
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                {t.home.whoWeAre.lead}
              </p>
              <p className="max-w-2xl text-muted-foreground">{t.home.whoWeAre.description}</p>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-background via-background to-sky-50/90 p-8 shadow-[0_28px_80px_-50px_rgba(14,165,233,0.45)]">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-100/80 blur-3xl" />
              <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-amber-100/80 blur-3xl" />

              <div className="relative space-y-5">
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/90 px-4 py-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">{copy.panelTitle}</span>
                </div>

                <div className="grid gap-3">
                  {copy.panelItems.map((item) => (
                    <div key={item} className="flex gap-3 rounded-2xl border border-border/60 bg-background/80 p-4">
                      <Network className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/90 p-4">
                  <p className="text-sm leading-6 text-muted-foreground">{copy.closing}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`pb-16 lg:pb-20 ${PUBLIC_SHELL_X}`}>
        <div className="mx-auto max-w-6xl space-y-6">
          <article className="rounded-[1.75rem] border border-border/60 bg-muted/20 p-7 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
              {copy.originEyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{copy.originTitle}</h2>
            <div className="mt-5 grid gap-4 text-base leading-7 text-muted-foreground lg:grid-cols-2">
              {copy.originBody.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-[1.75rem] border border-border/60 bg-background p-7 shadow-sm sm:p-8">
              <GitBranch className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-2xl font-semibold">{copy.semillaTitle}</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">{copy.semillaBody}</p>
            </article>

            <article className="rounded-[1.75rem] border border-border/60 bg-background p-7 shadow-sm sm:p-8">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-2xl font-semibold">{copy.entitiesTitle}</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">{copy.entitiesBody}</p>
            </article>
          </div>

          <article className="rounded-[1.75rem] border border-border/60 bg-white p-7 shadow-sm sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
              {copy.relationEyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{copy.relationTitle}</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{copy.relationLead}</p>
            <div className="mt-7 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[1.35rem] border border-border/60 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-foreground">{copy.gongLabel}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.gongText}</p>
              </div>
              <div className="rounded-[1.35rem] border border-sky-100 bg-sky-50/60 p-5">
                <p className="text-sm font-semibold text-foreground">{copy.summaLabel}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.summaText}</p>
              </div>
            </div>
            <p className="mt-5 rounded-[1.15rem] border border-border/60 bg-background px-4 py-4 text-sm leading-6 text-muted-foreground">
              {copy.closing}
            </p>
          </article>

          <div className="rounded-[1.75rem] border border-border/60 bg-background p-8 shadow-sm">
            <p className="text-sm font-medium text-primary">{t.cta.secondary}</p>
            <h2 className="mt-2 text-2xl font-semibold">{t.contact.title}</h2>
            <p className="mt-3 text-muted-foreground">{t.contact.description}</p>
            <div className="mt-6">
              <Button asChild size="lg">
                <Link href={`/${locale}/contact`}>
                  {t.cta.primary}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-6 border-t border-border/60 pt-6">
              <PublicDirectContact locale={locale} />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center text-sm text-muted-foreground">
          <p>{copy.footerNote}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={featuresHref} className="hover:underline">
              {t.common.features}
            </Link>
            <span>·</span>
            <Link href={`/${locale}/blog`} className="hover:underline">
              {t.common.blog}
            </Link>
            <span>·</span>
            <Link href={`/${locale}/privacy`} className="hover:underline">
              {t.common.privacy}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
