import type { NextRequest } from 'next/server';
import { GET as GET_ORIG } from '../export-v2/route';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Delegar para o handler v2 original mantendo uma única fonte de implementação
  return GET_ORIG(request, ctx as any);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';