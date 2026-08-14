import { NextRequest } from 'next/server';
import { handleModel347Post } from './handler';

export async function POST(request: NextRequest) {
  return handleModel347Post(request);
}
