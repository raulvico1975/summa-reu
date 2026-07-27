import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RotatingHeroPhrase } from '@/components/public/RotatingHeroPhrase';

test('rotating homepage phrase exposes one semantic phrase in server HTML', () => {
  const html = renderToStaticMarkup(
    createElement(RotatingHeroPhrase, {
      items: ['donacions', 'quotes', 'informes fiscals'],
    })
  );

  assert.match(html, />donacions</);
  assert.doesNotMatch(html, />quotes</);
  assert.doesNotMatch(html, />informes fiscals</);
  assert.equal((html.match(/donacions/g) || []).length, 1);
});
