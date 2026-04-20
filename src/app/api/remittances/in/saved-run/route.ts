import { NextRequest } from 'next/server';

import { handleSavedRemittanceLoadPost } from './handler';

export async function POST(request: NextRequest) {
  return handleSavedRemittanceLoadPost(request);
}
