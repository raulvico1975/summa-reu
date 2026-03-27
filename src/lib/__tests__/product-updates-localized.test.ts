import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEffectiveProductUpdateLocale,
  resolveAppProductUpdateCopy,
  resolvePublicProductUpdateCopy,
} from '@/lib/product-updates/localized';

test('getEffectiveProductUpdateLocale maps es, fr and pt to spanish content', () => {
  assert.equal(getEffectiveProductUpdateLocale('ca'), 'ca');
  assert.equal(getEffectiveProductUpdateLocale('es'), 'es');
  assert.equal(getEffectiveProductUpdateLocale('fr'), 'es');
  assert.equal(getEffectiveProductUpdateLocale('pt'), 'es');
});

test('resolveAppProductUpdateCopy prefers app localized spanish copy', () => {
  const copy = resolveAppProductUpdateCopy({
    locale: 'ca',
    title: 'Millora base',
    description: 'Base en català',
    contentLong: 'Detall en català',
    locales: {
      es: {
        title: 'Mejora base',
        description: 'Base en castellano',
        contentLong: 'Detalle en castellano',
      },
    },
  }, 'es');

  assert.equal(copy?.title, 'Mejora base');
  assert.equal(copy?.body, 'Base en castellano');
  assert.equal(copy?.contentLong, 'Detalle en castellano');
});

test('resolveAppProductUpdateCopy falls back to web localized copy for spanish surfaces', () => {
  const copy = resolveAppProductUpdateCopy({
    locale: 'ca',
    title: 'Millora projectes',
    description: 'Base app en català',
    contentLong: 'Detall app en català',
    web: {
      enabled: true,
      slug: 'millora-projectes',
      title: 'Millora projectes',
      excerpt: 'Base web en català',
      content: 'Detall web en català',
      locales: {
        es: {
          title: 'Mejora proyectos',
          excerpt: 'Resumen web en español',
          content: 'Detalle web en español',
        },
      },
    },
  }, 'fr');

  assert.equal(copy?.title, 'Mejora proyectos');
  assert.equal(copy?.body, 'Resumen web en español');
  assert.equal(copy?.contentLong, 'Detalle web en español');
});

test('resolvePublicProductUpdateCopy uses spanish variant for fr and pt pages', () => {
  const copy = resolvePublicProductUpdateCopy({
    locale: 'ca',
    title: 'Millora projectes',
    description: 'Base en català',
    contentLong: 'Detall en català',
    web: {
      enabled: true,
      locale: 'ca',
      slug: 'millora-projectes',
      title: 'Millora projectes',
      excerpt: 'Base en català',
      content: 'Detall en català',
      locales: {
        es: {
          title: 'Mejora proyectos',
          excerpt: 'Resumen en español',
          content: 'Detalle en español',
        },
      },
    },
  }, 'pt');

  assert.equal(copy?.title, 'Mejora proyectos');
  assert.equal(copy?.excerpt, 'Resumen en español');
  assert.equal(copy?.content, 'Detalle en español');
});
