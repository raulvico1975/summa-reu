import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { middleware, resolveCanonicalPublicPath } from '@/middleware';
import {
  buildPublicProductUpdateJsonLd,
  buildPublicUpdatesCollectionJsonLd,
} from '@/lib/public-seo';
import {
  getPublicLandingBySlug,
  getPublicLandingIndexedLocales,
  getPublicLandingSlugs,
} from '@/lib/public-landings';

function request(url: string, method = 'GET', forwardedHost?: string): NextRequest {
  const parsed = new URL(url);
  return new NextRequest(url, {
    method,
    headers: {
      host: parsed.host,
      ...(forwardedHost ? { 'x-forwarded-host': forwardedHost } : {}),
    },
  });
}

test('legacy and internal updates paths resolve to one localized public URL', () => {
  assert.equal(resolveCanonicalPublicPath('/novetats'), '/ca/novetats');
  assert.equal(resolveCanonicalPublicPath('/novedades'), '/es/novetats');
  assert.equal(resolveCanonicalPublicPath('/es/novedades'), '/es/novetats');
  assert.equal(resolveCanonicalPublicPath('/public/ca/novetats'), '/ca/novetats');
  assert.equal(
    resolveCanonicalPublicPath('/public/es/novetats/millora-setmanal'),
    '/es/novetats/millora-setmanal'
  );
  assert.equal(resolveCanonicalPublicPath('/ca/novetats'), '/ca/novetats');
});

test('French and Portuguese placeholder landings permanently consolidate into Spanish', () => {
  for (const slug of getPublicLandingSlugs()) {
    const landing = getPublicLandingBySlug(slug);
    assert.ok(landing);
    assert.deepEqual(getPublicLandingIndexedLocales(landing).sort(), ['ca', 'es']);

    assert.equal(resolveCanonicalPublicPath(`/fr/${slug}`), `/es/${slug}`);
    assert.equal(resolveCanonicalPublicPath(`/pt/${slug}`), `/es/${slug}`);
    assert.equal(resolveCanonicalPublicPath(`/public/fr/${slug}`), `/es/${slug}`);
  }

  const response = middleware(
    request('https://summasocial.app/pt/model-182?utm_source=legacy')
  );
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    'https://summasocial.app/es/model-182?utm_source=legacy'
  );
});

test('middleware permanently redirects the unlocalized updates route and preserves query params', () => {
  const response = middleware(request('https://summasocial.app/novetats?utm_source=manual'));

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    'https://summasocial.app/ca/novetats?utm_source=manual'
  );
});

test('obvious legacy PHP probes return a true noindex 404 without affecting APIs', () => {
  for (const path of ['/wp-login.php', '/wp-admin/install.php', '/this_is_a_new_hello_world.php']) {
    const response = middleware(request(`https://summasocial.app${path}`));

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  }

  const apiResponse = middleware(request('https://summasocial.app/api/example.php'));
  assert.equal(apiResponse.status, 200);
  assert.equal(apiResponse.headers.get('x-middleware-next'), '1');
});

test('middleware does not leak the App Hosting runtime host in public redirects', () => {
  const response = middleware(
    request(
      'https://studio-469685881071.us-central1.run.app/novetats?utm_source=proxy',
      'GET',
      'summasocial.app'
    )
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    'https://summasocial.app/ca/novetats?utm_source=proxy'
  );
});

test('legacy public redirects still use the official domain if proxy headers are unavailable', () => {
  const response = middleware(
    request('https://studio-469685881071.us-central1.run.app/public/ca/novetats')
  );

  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://summasocial.app/ca/novetats');
});

test('local development keeps redirects on the local server', () => {
  const response = middleware(request('http://localhost:3000/novetats'));

  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'http://localhost:3000/ca/novetats');
});

test('middleware collapses the technical host and internal path into one canonical redirect', () => {
  const response = middleware(
    request(
      'https://studio--summa-social.us-central1.hosted.app/public/ca/novetats?utm_source=technical'
    )
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    'https://summasocial.app/ca/novetats?utm_source=technical'
  );
});

test('middleware keeps technical API calls on their original backend', () => {
  const response = middleware(
    request('https://studio--summa-social.us-central1.hosted.app/api/contact', 'POST')
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-middleware-next'), '1');
  assert.equal(response.headers.get('location'), null);
});

test('canonical localized updates URL still rewrites to the internal public route', () => {
  const response = middleware(request('https://summasocial.app/ca/novetats'));

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('x-middleware-rewrite'),
    'https://summasocial.app/public/ca/novetats'
  );
});

test('Firebase Hosting aliases point to the official public domain permanently', () => {
  const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
    hosting?: { redirects?: Array<{ destination?: string; type?: number }> };
  };
  const redirects = firebaseConfig.hosting?.redirects ?? [];

  assert.deepEqual(
    redirects.map(({ destination, type }) => ({ destination, type })),
    [
      { destination: 'https://summasocial.app/', type: 301 },
      { destination: 'https://summasocial.app/:path*', type: 301 },
    ]
  );
});

test('updates collection JSON-LD identifies an indexable product changelog', () => {
  const data = buildPublicUpdatesCollectionJsonLd({
    locale: 'ca',
    title: 'Novetats de Summa Social',
    description: 'Millores publicades.',
    updates: [{ slug: 'millora-setmanal', title: 'Millora setmanal' }],
  });
  const collection = data[1] as Record<string, unknown>;
  const itemList = collection.mainEntity as Record<string, unknown>;
  const items = itemList.itemListElement as Array<Record<string, unknown>>;

  assert.equal(collection['@type'], 'CollectionPage');
  assert.equal(collection.url, 'https://summasocial.app/ca/novetats');
  assert.equal(itemList.numberOfItems, 1);
  assert.equal(items[0]?.url, 'https://summasocial.app/ca/novetats/millora-setmanal');
});

test('product update JSON-LD exposes the official article URL and publication date', () => {
  const data = buildPublicProductUpdateJsonLd({
    locale: 'es',
    slug: 'mejora-semanal',
    updatesLabel: 'Novedades',
    title: 'Mejora semanal',
    description: 'Una mejora útil.',
    publishedAt: '2026-07-21',
  });
  const article = data[1] as Record<string, unknown>;

  assert.equal(article['@type'], 'Article');
  assert.equal(article.url, 'https://summasocial.app/es/novetats/mejora-semanal');
  assert.equal(article.datePublished, '2026-07-21');
  assert.deepEqual(article.publisher, { '@id': 'https://summasocial.app/#organization' });
});
