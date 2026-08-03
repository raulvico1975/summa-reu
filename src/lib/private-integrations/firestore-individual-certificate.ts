import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { AnyContact, Organization, Transaction } from '@/lib/data';
import { safeSet, safeUpdate } from '@/lib/safe-write';
import { individualDonationCertificateFilename, individualDonationCertificatePdfBytes } from '@/lib/fiscal/individual-donation-certificate-pdf';
import { buildIndividualDonationCertificatePreparation } from './prepare-only';
import {
  certificatePrecondition,
  validateIndividualCertificateClaim,
  type IndividualCertificateGenerator,
  type IndividualCertificatePlan,
  type IndividualCertificatePlanStore,
} from './individual-certificate-plan';

const COLLECTION = 'integrationActionPlans';
const MAX_IMAGE_BYTES = 5_000_000;

function asPlan(planId: string, raw: FirebaseFirestore.DocumentData | undefined): IndividualCertificatePlan | null {
  return raw?.planId === planId && raw.type === 'individual_donation_certificate' ? raw as IndividualCertificatePlan : null;
}

export function createFirestoreIndividualCertificatePlanStore(db: Firestore): IndividualCertificatePlanStore {
  const ref = (planId: string) => db.doc(`${COLLECTION}/${planId}`);
  return {
    async create(plan) {
      await safeSet({
        data: plan as unknown as Record<string, unknown>,
        context: {
          updatedBy: plan.tokenId, source: 'system', updatedAtFactory: () => FieldValue.serverTimestamp(),
          requiredFields: ['planId', 'type', 'status', 'orgId', 'tokenId', 'transactionId', 'donorId', 'preconditionToken', 'confirmationText', 'expiresAt'],
          amountFields: ['amount'],
        },
        write: (payload) => ref(plan.planId).create(payload),
      });
    },
    async claim(args) {
      return db.runTransaction(async (transaction) => {
        const planRef = ref(args.planId);
        const snapshot = await transaction.get(planRef);
        const plan = asPlan(args.planId, snapshot.data());
        if (!plan) return { ok: false as const, code: 'PLAN_NOT_FOUND' };
        const code = validateIndividualCertificateClaim(plan, args);
        if (code) return { ok: false as const, code };
        transaction.update(planRef, { status: 'processing', processingAt: args.now, confirmationRecorded: true, updatedAt: FieldValue.serverTimestamp() });
        return { ok: true as const, plan: { ...plan, status: 'processing' as const } };
      });
    },
    async complete(args) {
      await safeUpdate({
        data: { status: 'consumed', consumedAt: args.now, blockedAt: null, blockedReason: null, pdfSha256: args.pdfSha256, pdfSizeBytes: args.pdfSizeBytes },
        context: { source: 'system', updatedAtFactory: () => FieldValue.serverTimestamp(), requiredFields: ['status', 'consumedAt', 'pdfSha256', 'pdfSizeBytes'] },
        write: (payload) => ref(args.planId).set(payload, { merge: true }),
      });
    },
    async block(args) {
      await safeUpdate({
        data: { status: 'blocked', blockedAt: args.now, blockedReason: args.reason },
        context: { source: 'system', updatedAtFactory: () => FieldValue.serverTimestamp(), requiredFields: ['status', 'blockedAt', 'blockedReason'] },
        write: (payload) => ref(args.planId).set(payload, { merge: true }),
      });
    },
  };
}

async function loadOptionalImageDataUrl(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  const response = await fetch(parsed, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!['image/png', 'image/jpeg'].includes(contentType)) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`;
}

export function createFirestoreIndividualCertificateGenerator(db: Firestore): IndividualCertificateGenerator {
  return {
    async generate(plan, issueDate) {
      const [orgSnap, txSnap, donorSnap] = await Promise.all([
        db.doc(`organizations/${plan.orgId}`).get(),
        db.doc(`organizations/${plan.orgId}/transactions/${plan.transactionId}`).get(),
        db.doc(`organizations/${plan.orgId}/contacts/${plan.donorId}`).get(),
      ]);
      const organization = orgSnap.exists ? { id: orgSnap.id, ...orgSnap.data() } as Organization : null;
      const movement = txSnap.exists ? { id: txSnap.id, ...txSnap.data() } as Transaction : null;
      const donor = donorSnap.exists ? { id: donorSnap.id, ...donorSnap.data() } as AnyContact : null;
      const preparation = buildIndividualDonationCertificatePreparation(
        { orgId: plan.orgId, transactionId: plan.transactionId, donorId: plan.donorId },
        organization, movement, donor
      );
      if (!preparation.prepared || !organization || !movement || !donor) {
        return { ok: false as const, code: preparation.blockers[0] ?? 'CERTIFICATE_BLOCKED' };
      }
      if (certificatePrecondition({ organization, transaction: movement, donor }) !== plan.preconditionToken) {
        return { ok: false as const, code: 'PRECONDITION_DRIFT' };
      }
      const [logoDataUrl, signatureDataUrl] = await Promise.all([
        loadOptionalImageDataUrl(organization.logoUrl), loadOptionalImageDataUrl(organization.signatureUrl),
      ]);
      const language = organization.language === 'ca' ? 'ca' : 'es';
      const pdfInput = {
        language, issueDate,
        organization: {
          name: organization.name, taxId: organization.taxId, address: organization.address!,
          zipCode: organization.zipCode!, city: organization.city!, province: organization.province ?? null,
          signatoryName: organization.signatoryName!, signatoryRole: organization.signatoryRole!,
        },
        donor: {
          name: donor.name, taxId: donor.taxId,
          address: 'address' in donor ? donor.address ?? null : null,
          zipCode: donor.zipCode, city: donor.city ?? null, province: donor.province ?? null,
          donorType: 'donorType' in donor ? donor.donorType : null,
        },
        movement: { date: movement.date, amount: movement.amount }, logoDataUrl, signatureDataUrl,
      } as const;
      const bytes = individualDonationCertificatePdfBytes(pdfInput);
      const pdfSha256 = createHash('sha256').update(bytes).digest('hex');
      const warnings = [
        ...(organization.logoUrl && !logoDataUrl ? ['LOGO_NOT_INCLUDED'] : []),
        ...(organization.signatureUrl && !signatureDataUrl ? ['SIGNATURE_IMAGE_NOT_INCLUDED'] : []),
      ];
      return {
        ok: true as const, pdfBase64: Buffer.from(bytes).toString('base64'), pdfSha256,
        pdfSizeBytes: bytes.byteLength, filename: individualDonationCertificateFilename(pdfInput), warnings,
      };
    },
  };
}
