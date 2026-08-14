import { type NextRequest } from 'next/server';
import { handleOrganizationSubscriptionPost } from './handler';

export async function POST(request: NextRequest) {
  return handleOrganizationSubscriptionPost(request);
}
