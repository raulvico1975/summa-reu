import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPublicTranslations } from '@/i18n/public';
import { parsePublicPlanId, PUBLIC_PLAN_IDS } from '@/lib/public-plans';
import { NextRequest } from 'next/server';
import { POST as submitContact } from '@/app/api/contact/route';

const LOCALES = ['ca', 'es', 'fr', 'pt'] as const;

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

test('pricing públic usa IDs canònics i preus 49/79/119 en tots els idiomes', () => {
  for (const locale of LOCALES) {
    const translations = getPublicTranslations(locale);
    const plans = translations.pricing.plans;
    assert.deepEqual(plans.map((plan) => plan.id), [...PUBLIC_PLAN_IDS], locale);
    assert.deepEqual(plans.map((plan) => Number(plan.price.match(/\d+/)?.[0])), [49, 79, 119], locale);
    assert.deepEqual(Object.keys(translations.contact.form.planMessages), [...PUBLIC_PLAN_IDS], locale);
  }
});

test('distribució comercial manté Control comú, Gestió documental i Complet avançat', () => {
  const planMarkers = {
    ca: [
      [/extractes bancaris/i, /SEPA/i, /devolucions/i, /182/],
      [/documents/i, /IA/i, /347/],
      [/documents previs|pendents/i, /extracció assistida/i, /projectes/i, /multidivisa/i, /XLSX/i],
    ],
    es: [
      [/extractos bancarios/i, /SEPA/i, /devoluciones/i, /182/],
      [/documentos/i, /IA/i, /347/],
      [/documentos previos|pendientes/i, /extracción asistida/i, /proyectos/i, /multidivisa/i, /XLSX/i],
    ],
    fr: [
      [/relevés bancaires/i, /SEPA/i, /rejets/i, /182/],
      [/documents/i, /IA/i, /347/],
      [/documents préalables|en attente/i, /extraction assistée/i, /projets/i, /multidevise/i, /XLSX/i],
    ],
    pt: [
      [/extratos bancários/i, /SEPA/i, /devoluções/i, /182/],
      [/documentos/i, /IA/i, /347/],
      [/documentos prévios|pendentes/i, /extração assistida/i, /projetos/i, /multidivisa/i, /XLSX/i],
    ],
  } as const;

  for (const locale of LOCALES) {
    const pricing = getPublicTranslations(locale).pricing;
    for (const [index, patterns] of planMarkers[locale].entries()) {
      const features = pricing.plans[index].features.join(' ');
      for (const pattern of patterns) assert.match(features, pattern, `${locale}/${pricing.plans[index].id}`);
    }
    assert.deepEqual(
      pricing.comparisonRows.map(({ control, management, complete }) => [control, management, complete]),
      [
        [true, true, true],
        [true, true, true],
        [false, true, true],
        [false, true, true],
        [false, false, true],
        [false, false, true],
      ],
      locale,
    );
  }
});

test('queries públiques no accepten aliases legacy de facturació', () => {
  for (const id of PUBLIC_PLAN_IDS) assert.equal(parsePublicPlanId(id), id);
  for (const alias of ['initial', 'fiscal_documents', 'fiscal-documents', 'gestio', 'complet', '', 'CONTROL']) {
    assert.equal(parsePublicPlanId(alias), null, alias);
  }
});

test('API de contacte rebutja un planId legacy abans d’enviar cap correu', async () => {
  const response = await submitContact(new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Entitat prova',
      email: 'prova@example.org',
      organization: 'Entitat',
      message: 'Voldria informació sobre el pla.',
      website: '',
      language: 'ca',
      planId: 'initial',
    }),
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, code: 'INVALID_PAYLOAD' });
});

test('CTA de pricing conserva locale i envia exclusivament plan.id al formulari', () => {
  const pricingPage = source('src/app/public/[lang]/preus/page.tsx');
  assert.match(pricingPage, /href=\{`\/\$\{locale\}\/contact\?plan=\$\{plan\.id\}`\}/);
  assert.doesNotMatch(pricingPage, /initial|fiscal_documents/);
});

test('formulari i analytics només propaguen plan_id canònic', () => {
  const contactPage = source('src/app/public/[lang]/contact/page.tsx');
  const form = source('src/components/public/PublicContactForm.tsx');
  assert.match(contactPage, /parsePublicPlanId\(resolvedSearchParams\.plan\)/);
  assert.match(contactPage, /planId=\{planId \?\? undefined\}/);
  assert.match(form, /plan_id: planId/);
  assert.match(form, /language: locale,\s*planId,/);
  const contactRoute = source('src/app/api/contact/route.ts');
  assert.match(contactRoute, /planId: z\.enum\(PUBLIC_PLAN_IDS\)\.optional\(\)/);
});

test('copy de plans no conté claims comercials prohibits', () => {
  const forbidden = [
    /cobraments en línia/i,
    /cobros en línea/i,
    /paiements en ligne/i,
    /cobranças online/i,
    /pujada il·limitada/i,
    /subida ilimitada/i,
    /chargement illimité/i,
    /carregamento ilimitado/i,
    /assignació automàtica de documents pendents/i,
    /asignación automática de documentos pendientes/i,
    /attribution automatique des documents en attente/i,
    /atribuição automática de documentos pendentes/i,
  ];
  for (const locale of LOCALES) {
    const copy = JSON.stringify(getPublicTranslations(locale).pricing.plans);
    for (const pattern of forbidden) assert.doesNotMatch(copy, pattern, `${locale}: ${pattern}`);
  }
});

test('superfícies comercials no reintrodueixen claims fora del contracte', () => {
  const pricingCopy = LOCALES.map((locale) => JSON.stringify(getPublicTranslations(locale).pricing)).join('\n');
  const commercialTranslations = LOCALES.map((locale) => {
    const { pricing, home, features } = getPublicTranslations(locale);
    return {
      pricing,
      home: {
        metaTitle: home.metaTitle,
        metaDescription: home.metaDescription,
        heroTagline: home.heroTagline,
        hero: home.hero,
        blocks: home.blocks,
        howWeWork: home.howWeWork,
        systemOverview: home.systemOverview,
      },
      features: {
        metaTitle: features.metaTitle,
        metaDescription: features.metaDescription,
      },
    };
  });
  const publicCopy = commercialTranslations.map((copy) => JSON.stringify(copy)).join('\n');
  const commercialSources = [
    'src/app/public/[lang]/page.tsx',
    'src/app/public/[lang]/preus/page.tsx',
    'src/app/public/[lang]/funcionalitats/page.tsx',
    'src/app/public/[lang]/gestio-economica-ong/page.tsx',
  ].map(source).join('\n');
  const copy = `${publicCopy}\n${commercialSources}`;
  const forbidden = [
    /cobraments en línia|cobros en línea|paiements en ligne|cobranças online/i,
    /pujada il·limitada|subida ilimitada|chargement illimité|carregamento ilimitado/i,
    /assignació automàtica de documents pendents|asignación automática de documentos pendientes|(?:attribution|affectation) automatique des documents en attente|atribuição automática de documentos pendentes/i,
    /conciliació automàtica|conciliación automática|rapprochement automatique|reconciliação automática/i,
    /devolucions? (?:automatitzad(?:a|es)|massiv(?:a|es))|devoluciones? (?:automatizad(?:a|as)|masiv(?:a|as))|rejets? (?:automatisés?|massifs?)|devoluções? (?:automatizadas?|massivas?)/i,
    /justificació automàtica|justificación automática|justification automatique|justificação automática/i,
    /model(?:o|e)? 347 autom[aà]tic(?:o|a)?|modèle 347 automatique/i,
    /gestió fiscal automatitzada|gestión fiscal automatizada|gestion fiscale automatisée|gestão fiscal automatizada/i,
    /extracció automàtica de dades amb IA|extracción automática de datos con IA|extraction automatique des données par IA|extração automática de dados com IA/i,
  ];
  assert.equal(/\bStripe\b/i.test(pricingCopy), false, 'Stripe no forma part del copy de plans o preus');
  for (const pattern of forbidden) assert.equal(pattern.test(copy), false, String(pattern));

  const fxTerms = {
    ca: /multidivisa/i,
    es: /multidivisa/i,
    fr: /multidevise/i,
    pt: /multidivisa|multi-moeda/i,
  } as const;
  for (const [index, locale] of LOCALES.entries()) {
    const mentions = collectStrings(commercialTranslations[index]).filter((text) => fxTerms[locale].test(text));
    for (const mention of mentions) {
      assert.match(mention, /project|proyect|projet/i, `${locale}: ${mention}`);
    }
  }
});

test('pricing publica FAQPage des del copy visible i cap Product/Offer divergent', () => {
  const pricingPage = source('src/app/public/[lang]/preus/page.tsx');
  assert.match(pricingPage, /type="application\/ld\+json"/);
  assert.match(pricingPage, /['"]@type['"]:\s*['"]FAQPage['"]/);
  assert.match(pricingPage, /t\.pricing\.faqItems\.map/);
  assert.match(pricingPage, /name:\s*item\.question/);
  assert.match(pricingPage, /text:\s*item\.answer/);
  assert.doesNotMatch(pricingPage, /priceCurrency|['"]Offer['"]|['"]Product['"]/);
});
