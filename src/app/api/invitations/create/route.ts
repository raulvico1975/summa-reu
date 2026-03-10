import { NextRequest, NextResponse } from 'next/server';
import { handleInvitationCreate, type CreateInvitationResponse } from './handler';

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateInvitationResponse>> {
  return handleInvitationCreate(request);
}
