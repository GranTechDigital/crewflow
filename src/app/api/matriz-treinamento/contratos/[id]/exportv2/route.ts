import type { NextRequest } from 'next/server';
import { GET as GET_ORIG, runtime as runtime_ORIG, dynamic as dynamic_ORIG } from '../export-v2/route';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Delegate to the original v2 handler to keep a single implementation source
  return GET_ORIG(request, ctx as any);
}

export const runtime = runtime_ORIG;
export const dynamic = dynamic_ORIG;