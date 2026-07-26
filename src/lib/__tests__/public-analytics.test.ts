import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPublicContactMethod,
  isValidGaMeasurementId,
  trackPublicAnalyticsEvent,
} from '@/lib/public-analytics';

test('GA4 measurement IDs must use the public G- format', () => {
  assert.equal(isValidGaMeasurementId('G-ABC123DEF4'), true);
  assert.equal(isValidGaMeasurementId(' G-ABC123DEF4 '), true);
  assert.equal(isValidGaMeasurementId('UA-123-1'), false);
  assert.equal(isValidGaMeasurementId(''), false);
  assert.equal(isValidGaMeasurementId(undefined), false);
});

test('contact links are classified without reading personal form data', () => {
  assert.equal(getPublicContactMethod('/ca/contact'), 'contact_page');
  assert.equal(getPublicContactMethod('https://summasocial.app/es/contact?plan=initial'), 'contact_page');
  assert.equal(getPublicContactMethod('mailto:hola@summasocial.app'), 'email');
  assert.equal(getPublicContactMethod('tel:+34684765359'), 'phone');
  assert.equal(getPublicContactMethod('https://wa.me/34684765359'), 'whatsapp');
  assert.equal(getPublicContactMethod('/ca/privacy'), null);
  assert.equal(getPublicContactMethod('https://example.com/contact'), null);
});

test('analytics events are inert during server rendering', () => {
  assert.equal(trackPublicAnalyticsEvent('generate_lead', { form_id: 'public_contact' }), false);
});
