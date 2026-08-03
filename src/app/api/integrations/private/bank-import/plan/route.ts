import { type NextRequest } from 'next/server';
import { handlePrivateBankImportPlan } from './handler';

export async function POST(request: NextRequest) {
  return handlePrivateBankImportPlan(request);
}
