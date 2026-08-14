import { NextRequest } from 'next/server';
import { handleArchiveExpenseReportPost } from './handler';

export async function POST(request: NextRequest) {
  return handleArchiveExpenseReportPost(request);
}
