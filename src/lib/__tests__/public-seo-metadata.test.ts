import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generatePublicPageMetadata } from '@/lib/public-locale';
import {
  getPublicLandingBySlug,
  getPublicLandingContent,
  getPublicLandingIndexedLocales,
  getPublicLandingMetadata,
  getPublicLandingSitemapEntries,
} from '@/lib/public-landings';
import { getPublicHomeFeatureHref } from '@/lib/public-site-paths';
import { generateMetadata as generateFloresCaseMetadata } from '@/app/public/[lang]/casos/flores-de-kiskeya/page';
import { generateMetadata as generateTrustMetadata } from '@/app/public/[lang]/confianza/page';
import { generateMetadata as generateBankResourceMetadata } from '@/app/public/[lang]/recursos/[resourceSlug]/page';

test('public metadata limits hreflang and canonical to publishable locales', () => {
  const metadata = generatePublicPageMetadata('fr', '/model-182', {
    title: 'Modele 182 | Summa Social',
    description: 'Contenu non publie.',
    availableLocales: ['ca', 'es'],
    index: false,
  });

  assert.equal(metadata.alternates?.canonical, 'https://summasocial.app/fr/model-182');
  assert.deepEqual(metadata.alternates?.languages, {
    ca: 'https://summasocial.app/ca/model-182',
    es: 'https://summasocial.app/es/model-182',
    'x-default': 'https://summasocial.app/ca/model-182',
  });
  assert.deepEqual(metadata.robots, { index: false, follow: true });
  assert.equal(metadata.openGraph?.locale, 'fr_FR');
});

for (const slug of ['software-gestion-ong', 'programa-associacions']) {
  test(`${slug} has complete and indexable Spanish content`, () => {
    const landing = getPublicLandingBySlug(slug);
    assert.ok(landing);

    const metadata = getPublicLandingMetadata(landing, 'es');
    const content = getPublicLandingContent(landing, 'es');

    assert.ok(getPublicLandingIndexedLocales(landing).includes('es'));
    assert.match(metadata.title, /gesti[oó]n/i);
    assert.doesNotMatch(metadata.description, /preparaci[oó]n/i);
    assert.doesNotMatch(content.hero.subtitle, /preparaci[oó]n/i);
    assert.ok(content.solution.steps.length >= 5);
    assert.ok(content.includes.items.length >= 4);
    assert.equal(content.finalCta.href, '/es/contact');
  });
}

test('Flores case and trust pages publish only Catalan and Spanish alternates', async () => {
  const floresMetadata = await generateFloresCaseMetadata({
    params: Promise.resolve({ lang: 'ca' }),
  });
  const trustMetadata = await generateTrustMetadata({
    params: Promise.resolve({ lang: 'es' }),
  });

  assert.equal(
    floresMetadata.alternates?.canonical,
    'https://summasocial.app/ca/casos/flores-de-kiskeya'
  );
  assert.deepEqual(floresMetadata.alternates?.languages, {
    ca: 'https://summasocial.app/ca/casos/flores-de-kiskeya',
    es: 'https://summasocial.app/es/casos/flores-de-kiskeya',
    'x-default': 'https://summasocial.app/ca/casos/flores-de-kiskeya',
  });
  assert.equal(trustMetadata.alternates?.canonical, 'https://summasocial.app/es/confianza');
  assert.deepEqual(trustMetadata.alternates?.languages, {
    ca: 'https://summasocial.app/ca/confianza',
    es: 'https://summasocial.app/es/confianza',
    'x-default': 'https://summasocial.app/ca/confianza',
  });
});

test('free bank reconciliation resource uses localized canonical URLs', async () => {
  const caMetadata = await generateBankResourceMetadata({
    params: Promise.resolve({
      lang: 'ca',
      resourceSlug: 'plantilla-conciliacio-bancaria',
    }),
  });
  const esMetadata = await generateBankResourceMetadata({
    params: Promise.resolve({
      lang: 'es',
      resourceSlug: 'plantilla-conciliacion-bancaria',
    }),
  });

  assert.equal(
    caMetadata.alternates?.canonical,
    'https://summasocial.app/ca/recursos/plantilla-conciliacio-bancaria'
  );
  assert.equal(
    esMetadata.alternates?.canonical,
    'https://summasocial.app/es/recursos/plantilla-conciliacion-bancaria'
  );
  assert.deepEqual(caMetadata.alternates?.languages, {
    ca: 'https://summasocial.app/ca/recursos/plantilla-conciliacio-bancaria',
    es: 'https://summasocial.app/es/recursos/plantilla-conciliacion-bancaria',
    'x-default': 'https://summasocial.app/ca/recursos/plantilla-conciliacio-bancaria',
  });
  assert.deepEqual(caMetadata.robots, { index: true, follow: true });
});

test('certificate and Model 182 copy avoids absolute error-free or automatic claims', () => {
  for (const slug of ['certificats-donacio', 'model-182']) {
    const landing = getPublicLandingBySlug(slug);
    assert.ok(landing);

    for (const locale of ['ca', 'es'] as const) {
      const metadata = getPublicLandingMetadata(landing, locale);
      const content = getPublicLandingContent(landing, locale);
      const publicCopy = JSON.stringify({ metadata, content });

      assert.doesNotMatch(publicCopy, /sense errors|sin errores/i);
      assert.doesNotMatch(publicCopy, /pràcticament sol|prácticamente solo/i);
    }
  }
});

test('Catalan and Spanish public marketing sources avoid error-free guarantees', () => {
  const publicMarketingSources = [
    readFileSync('src/lib/public-landings.ts', 'utf8'),
    readFileSync('src/i18n/public.ts', 'utf8'),
  ].join('\n');

  assert.doesNotMatch(
    publicMarketingSources,
    /\b(?:sense|sin)\b[^.!?\n]{0,32}\b(?:errors|errores)\b/i
  );
  assert.doesNotMatch(
    publicMarketingSources,
    /sense esforç|sin esfuerzo|tot validat|todo validado|control absolut|control absoluto/i
  );
});

test('homepage feature cards link to their specific CA/ES commercial landing', () => {
  assert.equal(
    getPublicHomeFeatureHref('ca', 'fiscal', 'fiscal.donationCertificates'),
    '/ca/certificats-donacio'
  );
  assert.equal(
    getPublicHomeFeatureHref('es', 'payments', 'payments.bankReturns'),
    '/es/devolucions-rebuts-socis'
  );
  assert.equal(
    getPublicHomeFeatureHref('ca', 'conciliation', 'conciliation.importStatements'),
    '/ca/importar-extracte-bancari'
  );
  assert.equal(
    getPublicHomeFeatureHref('fr', 'payments', 'payments.remittanceSplitter'),
    '/es/remeses-sepa'
  );
  assert.equal(
    getPublicHomeFeatureHref('pt', 'donorsMembers'),
    '/es/gestio-donants'
  );
});

test('priority landing metadata is concise and aligned with observed search intent', () => {
  const expectedTitles = {
    'certificats-donacio': {
      ca: 'Certificats de donació per a ONG i associacions | Summa Social',
      es: 'Certificados de donación para ONG y asociaciones | Summa Social',
    },
    'gestio-donants': {
      ca: 'Programa de gestió de donants per a ONG | Summa Social',
      es: 'Programa de gestión de donantes para ONG | Summa Social',
    },
    'devolucions-rebuts-socis': {
      ca: 'Devolucions de rebuts en associacions: com gestionar-les | Summa Social',
      es: 'Devoluciones de recibos en asociaciones: cómo gestionarlas | Summa Social',
    },
  } as const;

  for (const [slug, titles] of Object.entries(expectedTitles)) {
    const landing = getPublicLandingBySlug(slug);
    assert.ok(landing);

    for (const locale of ['ca', 'es'] as const) {
      const metadata = getPublicLandingMetadata(landing, locale);
      assert.equal(metadata.title, titles[locale]);
      assert.ok(metadata.title.length <= 75);
      assert.ok(metadata.description.length >= 100);
      assert.ok(metadata.description.length <= 165);
    }
  }
});

test('high-impression Spanish landings answer their observed search intents directly', () => {
  const software = getPublicLandingBySlug('software-gestion-ong');
  const donations = getPublicLandingBySlug('control-donacions-ong');
  assert.ok(software);
  assert.ok(donations);

  const softwareMetadata = getPublicLandingMetadata(software, 'es');
  const softwareContent = getPublicLandingContent(software, 'es');
  assert.match(softwareMetadata.title, /software de gestión para ONG/i);
  assert.match(softwareMetadata.description, /software de gestión económica.*ONG y asociaciones/i);
  assert.match(softwareContent.hero.subtitle, /programa de gestión económica/i);
  assert.match(softwareContent.hero.introParagraphs[0] ?? '', /programa de gestión.*ONG o asociación/i);

  const donationsMetadata = getPublicLandingMetadata(donations, 'es');
  const donationsContent = getPublicLandingContent(donations, 'es');
  assert.match(donationsMetadata.title, /gestión de donaciones.*donantes para ONG/i);
  assert.match(donationsContent.hero.title, /gestión de donaciones.*donantes para ONG/i);
  assert.match(donationsContent.hero.introParagraphs[0] ?? '', /gestión de donaciones para ONG/i);
});

test('commercial landing sitemap stays limited to Catalan and Spanish', () => {
  const sitemapEntries = getPublicLandingSitemapEntries();

  assert.ok(sitemapEntries.length > 0);
  assert.deepEqual(
    [...new Set(sitemapEntries.map((entry) => entry.locale))].sort(),
    ['ca', 'es']
  );
});

test('subtitle files are explicitly excluded from search results', () => {
  const nextConfig = readFileSync('next.config.ts', 'utf8');

  assert.match(nextConfig, /source:\s*'\/media\/:path\*\.vtt'/);
  assert.match(nextConfig, /key:\s*'X-Robots-Tag'[\s\S]*?value:\s*'noindex'/);
});
