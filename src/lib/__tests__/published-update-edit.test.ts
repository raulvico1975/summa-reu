import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublishedUpdatePatch,
  createPublishedUpdateEditState,
} from '@/lib/product-updates/published-update-edit';

test('createPublishedUpdateEditState carrega els camps editables d’una peça publicada', () => {
  const state = createPublishedUpdateEditState({
    title: 'Millores setmanals',
    description: 'Resum curt',
    link: 'https://summasocial.app/ca/novetats/millores',
    contentLong: 'Contingut llarg',
    isActive: true,
    web: {
      enabled: true,
      slug: 'millores-setmanals',
      excerpt: 'Extracte',
      content: 'Contingut web',
    },
  });

  assert.deepEqual(state, {
    title: 'Millores setmanals',
    description: 'Resum curt',
    link: 'https://summasocial.app/ca/novetats/millores',
    contentLong: 'Contingut llarg',
    webExcerpt: 'Extracte',
    webContent: 'Contingut web',
    webEnabled: true,
    isActive: true,
  });
});

test('buildPublishedUpdatePatch manté el model existent i aplica els canvis editables', () => {
  const patch = buildPublishedUpdatePatch(
    {
      title: 'Millores setmanals',
      description: 'Resum curt',
      link: null,
      contentLong: 'Contingut llarg',
      isActive: true,
      locale: 'ca',
      web: {
        enabled: true,
        slug: 'millores-setmanals',
        locale: 'ca',
        title: 'Millores setmanals',
        excerpt: 'Extracte',
        content: 'Contingut web',
        locales: {
          es: {
            title: 'Mejoras semanales',
            excerpt: 'Resumen',
            content: 'Contenido web',
          },
        },
      },
    },
    {
      title: 'Millores setmanals revisades',
      description: 'Resum revisat',
      link: 'https://summasocial.app/ca/novetats/millores-setmanals',
      contentLong: 'Contingut revisat',
      webExcerpt: 'Extracte revisat',
      webContent: 'Contingut web revisat',
      webEnabled: true,
      isActive: false,
    }
  );

  assert.deepEqual(patch, {
    title: 'Millores setmanals revisades',
    description: 'Resum revisat',
    link: 'https://summasocial.app/ca/novetats/millores-setmanals',
    contentLong: 'Contingut revisat',
    isActive: false,
    web: {
      enabled: true,
      slug: 'millores-setmanals',
      locale: 'ca',
      title: 'Millores setmanals revisades',
      excerpt: 'Extracte revisat',
      content: 'Contingut web revisat',
      locales: {
        es: {
          title: 'Mejoras semanales',
          excerpt: 'Resumen',
          content: 'Contenido web',
        },
      },
    },
  });
});
