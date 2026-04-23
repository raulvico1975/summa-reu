import { NextRequest } from 'next/server';
import {
  handleClosingBundleZipOptions,
  handleClosingBundleZipPost,
} from './handler';

export async function POST(request: NextRequest) {
  return handleClosingBundleZipPost(request);
}

export async function OPTIONS() {
  return handleClosingBundleZipOptions();
}
