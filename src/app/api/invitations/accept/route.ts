/**
 * POST /api/invitations/accept
 *
 * Accepta una invitació: crea el membre a l'organització i marca la invitació com usada.
 * Requereix autenticació (Bearer token) — l'usuari ja s'ha creat a Firebase Auth.
 * Usa Admin SDK per bypass de Firestore Rules (evita problemes de token.email timing).
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleInvitationAccept, type AcceptResponse } from './handler';

export async function POST(
  request: NextRequest
): Promise<NextResponse<AcceptResponse>> {
  return handleInvitationAccept(request);
}
