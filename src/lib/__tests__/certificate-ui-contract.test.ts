import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('mass certificate generator uses scoped API instead of client ledger reads', () => {
  const source = readProjectFile('src/components/donation-certificate-generator.tsx');

  assert.equal(source.includes("from '@/lib/fiscal/getUnifiedFiscalDonations'"), false);
  assert.equal(source.includes('getUnifiedFiscalDonationsWithClient'), false);
  assert.equal(source.includes("collection(firestore, 'organizations', organizationId, 'transactions')"), false);
  assert.equal(source.includes("collection(firestore, 'organizations', organizationId, 'donations')"), false);
  assert.equal(source.includes("fetch('/api/fiscal/certificates/summary'"), true);
});

test('donor drawer does not subscribe to movement history for certificate-only profiles', () => {
  const source = readProjectFile('src/components/donor-detail-drawer.tsx');

  assert.equal(source.includes("fetch('/api/fiscal/certificates/summary'"), true);
  assert.equal(source.includes('if (!canReadMovements)'), true);
  assert.equal(source.includes('loadRestrictedAnnualCertificateScope'), true);
});

test('individual certificate UI and private generator use the same canonical PDF builder', () => {
  const drawer = readProjectFile('src/components/donor-detail-drawer.tsx');
  const privateGenerator = readProjectFile('src/lib/private-integrations/firestore-individual-certificate.ts');
  assert.equal(drawer.includes("from '@/lib/fiscal/individual-donation-certificate-pdf'"), true);
  assert.equal(drawer.includes('buildIndividualDonationCertificatePdf(input).save'), true);
  assert.equal(privateGenerator.includes("from '@/lib/fiscal/individual-donation-certificate-pdf'"), true);
  assert.equal(privateGenerator.includes('individualDonationCertificatePdfBytes(pdfInput)'), true);
});

test('annual certificate exposes only the net amount in its PDF body', () => {
  const mass = readProjectFile('src/components/donation-certificate-generator.tsx');
  const drawer = readProjectFile('src/components/donor-detail-drawer.tsx');

  assert.equal(mass.includes('donorNetBodyWithAddress'), true);
  assert.equal(mass.includes('Resum fiscal:'), false);
  assert.equal(drawer.includes('donorNetBodyWithAddress'), true);
  assert.equal(drawer.includes('donorBodyWithAddress(donor.name'), false);
  assert.equal(drawer.includes('donorBody(donor.name'), false);
  assert.equal(drawer.includes('donationsCount)'), false);
  assert.equal(drawer.includes('BLOC DE RESUM FISCAL'), false);
});
