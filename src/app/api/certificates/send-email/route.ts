import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { buildCertificateEmail } from '@/lib/email/buildCertificateEmail';
import {
  getAdminDb,
  validateUserMembership,
  verifyIdToken,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import type { OrganizationLanguage } from '@/lib/data';

const MAX_RECIPIENTS_PER_REQUEST = 20;
const MAX_RECIPIENTS_PER_DAY_PER_ORG = 500;
const MAX_PDF_BASE64_CHARS = 7_000_000;
const MAX_TOTAL_BASE64_CHARS = 20_000_000;
const SEND_CONCURRENCY = 3;
const PER_RECIPIENT_TIMEOUT_MS = 12_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SingleDonationInfo {
  date: string;
  amount: string;
}

interface ValidatedDonor {
  id: string;
  name: string;
  email: string;
  pdfBase64: string;
  singleDonation?: SingleDonationInfo;
}

interface RecipientResult {
  donorId: string;
  email: string;
  status: 'sent' | 'failed' | 'skipped';
  errorCode?: string;
}

interface QuotaSnapshot {
  used: number;
  remaining: number;
  limit: number;
}

interface QuotaReservationResult {
  ok: boolean;
  used: number;
  remaining: number;
  limit: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asNonNegativeInt(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function sanitizeCounterMap(input: unknown): Record<string, number> {
  const source = asRecord(input);
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) continue;
    result[key] = Math.floor(numeric);
  }
  return result;
}

function parseString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOrganizationLanguage(value: unknown): OrganizationLanguage {
  return value === 'ca' ? 'ca' : 'es';
}

function getCertificateEmailStaticCopy(language: OrganizationLanguage) {
  if (language === 'ca') {
    return {
      donorFallback: 'Donant',
      orgFallback: 'Organització',
      singleDonationFilenamePrefix: 'certificat_donacio',
      annualFilenamePrefix: 'certificat',
    };
  }

  return {
    donorFallback: 'Donante',
    orgFallback: 'Organización',
    singleDonationFilenamePrefix: 'certificado_donacion',
    annualFilenamePrefix: 'certificado',
  };
}

function sanitizeFilename(name: string): string {
  const sanitized = (name || 'donant')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 30);
  return sanitized || 'donant';
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readResponseError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500);
  } catch {
    return 'unknown_error';
  }
}

function buildRecipientFilename(
  donorName: string,
  year: string,
  language: OrganizationLanguage,
  singleDonation?: SingleDonationInfo
) {
  const sanitizedName = sanitizeFilename(donorName);
  const copy = getCertificateEmailStaticCopy(language);
  if (singleDonation) {
    return `${copy.singleDonationFilenamePrefix}_${sanitizedName}.pdf`;
  }
  return `${copy.annualFilenamePrefix}_${year}_${sanitizedName}.pdf`;
}

function validateRequestBody(body: unknown): {
  organizationId: string;
  year: string;
  organizationLanguage: OrganizationLanguage;
  donors: ValidatedDonor[];
} | null {
  const root = asRecord(body);
  const organizationId = parseString(root.organizationId);
  const year = parseString(root.year);
  const organizationLanguage = normalizeOrganizationLanguage(root.organizationLanguage);
  const donorsRaw = root.donors;

  if (!organizationId || !year || !Array.isArray(donorsRaw)) {
    return null;
  }

  if (donorsRaw.length === 0 || donorsRaw.length > MAX_RECIPIENTS_PER_REQUEST) {
    return null;
  }

  const donors: ValidatedDonor[] = [];
  let totalBase64Chars = 0;

  for (const donorRaw of donorsRaw) {
    const donorObj = asRecord(donorRaw);
    const id = parseString(donorObj.id);
    const copy = getCertificateEmailStaticCopy(organizationLanguage);
    const name = parseString(donorObj.name) || copy.donorFallback;
    const email = parseString(donorObj.email).toLowerCase();
    const pdfBase64 = parseString(donorObj.pdfBase64);

    if (!id || !pdfBase64) {
      return null;
    }

    if (pdfBase64.length > MAX_PDF_BASE64_CHARS) {
      return null;
    }
    totalBase64Chars += pdfBase64.length;

    if (email && !EMAIL_REGEX.test(email)) {
      return null;
    }

    const singleDonationRaw = asRecord(donorObj.singleDonation);
    const singleDonationDate = parseString(singleDonationRaw.date);
    const singleDonationAmount = parseString(singleDonationRaw.amount);

    const donorEntry: ValidatedDonor = {
      id,
      name,
      email,
      pdfBase64,
    };

    if (singleDonationDate && singleDonationAmount) {
      donorEntry.singleDonation = {
        date: singleDonationDate,
        amount: singleDonationAmount,
      };
    }

    donors.push(donorEntry);
  }

  if (totalBase64Chars > MAX_TOTAL_BASE64_CHARS) {
    return null;
  }

  return { organizationId, year, organizationLanguage, donors };
}

async function reserveDailyQuota(args: {
  orgId: string;
  dayKey: string;
  requestId: string;
  requestedCount: number;
}): Promise<QuotaReservationResult> {
  const { orgId, dayKey, requestId, requestedCount } = args;
  const db = getAdminDb();
  const quotaRef = db.doc(`organizations/${orgId}/certificateEmailQuota/${dayKey}`);
  const now = Timestamp.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(quotaRef);
    const data = snap.exists ? asRecord(snap.data()) : {};

    const used = asNonNegativeInt(data.used);
    const storedLimit = asNonNegativeInt(data.limit);
    const limit = storedLimit > 0 ? storedLimit : MAX_RECIPIENTS_PER_DAY_PER_ORG;
    const reservations = sanitizeCounterMap(data.reservations);
    const applied = sanitizeCounterMap(data.applied);
    const reservationTotal = Object.values(reservations).reduce((sum, value) => sum + value, 0);

    // Request ja finalitzada prèviament: resposta idempotent.
    if (requestId in applied) {
      return {
        ok: true,
        used,
        remaining: Math.max(0, limit - used),
        limit,
      };
    }

    if (used + reservationTotal + requestedCount > limit) {
      return {
        ok: false,
        used,
        remaining: Math.max(0, limit - used),
        limit,
      };
    }

    reservations[requestId] = requestedCount;

    tx.set(
      quotaRef,
      {
        day: dayKey,
        limit,
        used,
        reservations,
        updatedAt: now,
        createdAt: snap.exists ? data.createdAt ?? now : now,
      },
      { merge: true }
    );

    return {
      ok: true,
      used,
      remaining: Math.max(0, limit - used),
      limit,
    };
  });
}

async function finalizeDailyQuota(args: {
  orgId: string;
  dayKey: string;
  requestId: string;
  sentCount: number;
}): Promise<QuotaSnapshot> {
  const { orgId, dayKey, requestId, sentCount } = args;
  const db = getAdminDb();
  const quotaRef = db.doc(`organizations/${orgId}/certificateEmailQuota/${dayKey}`);
  const now = Timestamp.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(quotaRef);
    const data = snap.exists ? asRecord(snap.data()) : {};

    const used = asNonNegativeInt(data.used);
    const storedLimit = asNonNegativeInt(data.limit);
    const limit = storedLimit > 0 ? storedLimit : MAX_RECIPIENTS_PER_DAY_PER_ORG;
    const reservations = sanitizeCounterMap(data.reservations);
    const applied = sanitizeCounterMap(data.applied);

    const alreadyApplied = asNonNegativeInt(applied[requestId]);
    if (alreadyApplied > 0 || requestId in applied) {
      if (requestId in reservations) {
        delete reservations[requestId];
        tx.set(
          quotaRef,
          { reservations, updatedAt: now },
          { merge: true }
        );
      }
      const finalUsed = used;
      return {
        used: finalUsed,
        remaining: Math.max(0, limit - finalUsed),
        limit,
      };
    }

    const reserved = asNonNegativeInt(reservations[requestId]);
    if (requestId in reservations) {
      delete reservations[requestId];
    }

    const boundedSent = Math.max(0, sentCount);
    const candidateApply = reserved > 0 ? Math.min(boundedSent, reserved) : boundedSent;
    const remainingBeforeApply = Math.max(0, limit - used);
    const applyCount = Math.min(candidateApply, remainingBeforeApply);
    const finalUsed = used + applyCount;
    applied[requestId] = applyCount;

    tx.set(
      quotaRef,
      {
        day: dayKey,
        limit,
        used: finalUsed,
        reservations,
        applied,
        updatedAt: now,
        createdAt: snap.exists ? data.createdAt ?? now : now,
      },
      { merge: true }
    );

    return {
      used: finalUsed,
      remaining: Math.max(0, limit - finalUsed),
      limit,
    };
  });
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length || 1));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: safeConcurrency }, async () => {
      while (true) {
        const current = nextIndex;
        nextIndex += 1;
        if (current >= items.length) break;
        results[current] = await task(items[current], current);
      }
    })
  );

  return results;
}

async function writeCertificateEmailLog(args: {
  orgId: string;
  requestId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { orgId, requestId, payload } = args;
  try {
    const db = getAdminDb();
    const logRef = db.doc(`organizations/${orgId}/certificateEmailLogs/${requestId}`);
    await logRef.set(payload, { merge: true });
  } catch (error) {
    // Guardrail explícit: fail-open per no bloquejar l'operativa.
    console.error('[certificates/send-email] log write failed', { orgId, requestId, error });
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  let quotaDayKey = '';
  let organizationId = '';
  let quotaFinal: QuotaSnapshot = {
    used: 0,
    remaining: MAX_RECIPIENTS_PER_DAY_PER_ORG,
    limit: MAX_RECIPIENTS_PER_DAY_PER_ORG,
  };

  try {
    const authResult = await verifyIdToken(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = validateRequestBody(body);

    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_REQUEST',
          code: 'INVALID_REQUEST',
          limits: {
            maxRecipientsPerRequest: MAX_RECIPIENTS_PER_REQUEST,
            maxPdfBase64Chars: MAX_PDF_BASE64_CHARS,
            maxTotalBase64Chars: MAX_TOTAL_BASE64_CHARS,
          },
        },
        { status: 400 }
      );
    }

    organizationId = parsed.organizationId;
    quotaDayKey = getTodayKey();

    const db = getAdminDb();
    const membership = await validateUserMembership(db, authResult.uid, organizationId);
    const accessError = requirePermission(membership, {
      code: 'FISCAL_CERTIFICATS_GENERAR_REQUIRED',
      check: (permissions) => permissions['fiscal.certificats.generar'],
    });
    if (accessError) {
      return accessError;
    }

    const orgSnap = await db.doc(`organizations/${organizationId}`).get();
    if (!orgSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'ORGANIZATION_NOT_FOUND', code: 'ORGANIZATION_NOT_FOUND' },
        { status: 404 }
      );
    }

    const orgData = asRecord(orgSnap.data());
    const requestedLanguage = parsed.organizationLanguage;
    const copy = getCertificateEmailStaticCopy(requestedLanguage);
    const orgName = parseString(orgData.name) || copy.orgFallback;
    const orgEmailRaw = parseString(orgData.email).toLowerCase();
    const orgEmail = orgEmailRaw && EMAIL_REGEX.test(orgEmailRaw) ? orgEmailRaw : '';
    const orgLanguage = requestedLanguage || normalizeOrganizationLanguage(orgData.language);

    const recipientsWithEmail = parsed.donors.filter((d) => Boolean(d.email));
    const skippedNoEmail = parsed.donors.length - recipientsWithEmail.length;

    if (recipientsWithEmail.length === 0) {
      return NextResponse.json(
        {
          success: true,
          requestId,
          sent: 0,
          errors: 0,
          skippedNoEmail,
          totals: {
            requested: parsed.donors.length,
            sent: 0,
            failed: 0,
            skippedNoEmail,
          },
          recipients: [],
          quota: {
            dailyLimit: MAX_RECIPIENTS_PER_DAY_PER_ORG,
            dailyUsed: 0,
            dailyRemaining: MAX_RECIPIENTS_PER_DAY_PER_ORG,
          },
        },
        { status: 200 }
      );
    }

    const reservation = await reserveDailyQuota({
      orgId: organizationId,
      dayKey: quotaDayKey,
      requestId,
      requestedCount: recipientsWithEmail.length,
    });

    if (!reservation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'DAILY_QUOTA_EXCEEDED',
          code: 'DAILY_QUOTA_EXCEEDED',
          quota: {
            dailyLimit: reservation.limit,
            dailyUsed: reservation.used,
            dailyRemaining: reservation.remaining,
          },
        },
        { status: 429 }
      );
    }

    await writeCertificateEmailLog({
      orgId: organizationId,
      requestId,
      payload: {
        requestId,
        status: 'processing',
        actorUid: authResult.uid,
        actorEmail: authResult.email ?? null,
        orgId: organizationId,
        year: parsed.year,
        requested: recipientsWithEmail.length,
        skippedNoEmail,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      quotaFinal = await finalizeDailyQuota({
        orgId: organizationId,
        dayKey: quotaDayKey,
        requestId,
        sentCount: 0,
      });
      return NextResponse.json(
        { success: false, error: 'EMAIL_SERVICE_NOT_CONFIGURED', code: 'EMAIL_SERVICE_NOT_CONFIGURED' },
        { status: 500 }
      );
    }

    const recipientResults = await runWithConcurrency(
      recipientsWithEmail,
      SEND_CONCURRENCY,
      async (donor): Promise<RecipientResult> => {
        try {
          const { subject, html, text } = buildCertificateEmail(
            {
              name: orgName,
              email: orgEmail,
              language: orgLanguage,
            },
            donor,
            parsed.year,
            donor.singleDonation
          );

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), PER_RECIPIENT_TIMEOUT_MS);

          try {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              signal: controller.signal,
              body: JSON.stringify({
                from: `${orgName} / Summa Social <certifica@summasocial.app>`,
                to: donor.email,
                ...(orgEmail ? { reply_to: orgEmail } : {}),
                subject,
                html,
                text,
                attachments: [
                  {
                    filename: buildRecipientFilename(donor.name, parsed.year, orgLanguage, donor.singleDonation),
                    content: donor.pdfBase64,
                  },
                ],
              }),
            });

            if (response.ok) {
              return {
                donorId: donor.id,
                email: donor.email,
                status: 'sent',
              };
            }

            const resendError = await readResponseError(response);
            console.error('[certificates/send-email] Resend error', {
              donorId: donor.id,
              email: donor.email,
              status: response.status,
              resendError,
            });

            return {
              donorId: donor.id,
              email: donor.email,
              status: 'failed',
              errorCode: 'RESEND_ERROR',
            };
          } finally {
            clearTimeout(timeout);
          }
        } catch (error) {
          const abortLike =
            error instanceof Error && error.name === 'AbortError';
          console.error('[certificates/send-email] send recipient failed', {
            donorId: donor.id,
            email: donor.email,
            error,
          });
          return {
            donorId: donor.id,
            email: donor.email,
            status: 'failed',
            errorCode: abortLike ? 'TIMEOUT' : 'SEND_ERROR',
          };
        }
      }
    );

    const sent = recipientResults.filter((item) => item.status === 'sent').length;
    const failed = recipientResults.filter((item) => item.status === 'failed').length;

    quotaFinal = await finalizeDailyQuota({
      orgId: organizationId,
      dayKey: quotaDayKey,
      requestId,
      sentCount: sent,
    });

    await writeCertificateEmailLog({
      orgId: organizationId,
      requestId,
      payload: {
        requestId,
        status: 'completed',
        actorUid: authResult.uid,
        actorEmail: authResult.email ?? null,
        orgId: organizationId,
        year: parsed.year,
        requested: recipientsWithEmail.length,
        sent,
        failed,
        skippedNoEmail,
        recipients: recipientResults,
        quota: {
          dailyLimit: quotaFinal.limit,
          dailyUsed: quotaFinal.used,
          dailyRemaining: quotaFinal.remaining,
        },
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    });

    return NextResponse.json({
      success: true,
      requestId,
      sent,
      errors: failed,
      skippedNoEmail,
      totals: {
        requested: parsed.donors.length,
        sent,
        failed,
        skippedNoEmail,
      },
      recipients: recipientResults,
      quota: {
        dailyLimit: quotaFinal.limit,
        dailyUsed: quotaFinal.used,
        dailyRemaining: quotaFinal.remaining,
      },
    });
  } catch (error) {
    console.error('[certificates/send-email] route error', { requestId, error });

    if (organizationId && quotaDayKey) {
      try {
        quotaFinal = await finalizeDailyQuota({
          orgId: organizationId,
          dayKey: quotaDayKey,
          requestId,
          sentCount: 0,
        });
      } catch (quotaError) {
        console.error('[certificates/send-email] quota finalize on error failed', {
          requestId,
          quotaError,
        });
      }
    }

    if (organizationId) {
      await writeCertificateEmailLog({
        orgId: organizationId,
        requestId,
        payload: {
          requestId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          quota: {
            dailyLimit: quotaFinal.limit,
            dailyUsed: quotaFinal.used,
            dailyRemaining: quotaFinal.remaining,
          },
          updatedAt: Timestamp.now(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'INTERNAL_SERVER_ERROR', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    );
  }
}
