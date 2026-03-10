import { Timestamp } from 'firebase-admin/firestore';

export function generateInvitationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toMillisIfValid(raw: unknown): number | null {
  if (raw instanceof Timestamp) return raw.toMillis();
  if (raw instanceof Date) {
    const millis = raw.getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof raw === 'string') {
    const millis = Date.parse(raw);
    return Number.isNaN(millis) ? null : millis;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

export function isInvitationStillActive(rawInvitation: { usedAt?: unknown; expiresAt?: unknown }, nowIso: string): boolean {
  if (rawInvitation.usedAt) {
    return false;
  }

  if (rawInvitation.expiresAt === undefined || rawInvitation.expiresAt === null) {
    return true;
  }

  const nowMillis = Date.parse(nowIso);
  const expiresAtMillis = toMillisIfValid(rawInvitation.expiresAt);
  if (Number.isNaN(nowMillis) || expiresAtMillis === null) {
    return true;
  }

  return expiresAtMillis > nowMillis;
}
