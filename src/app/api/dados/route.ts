// src/app/api/dados/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const dados = await prisma.funcionario.findMany();
    return NextResponse.json(dados);
  } catch (error) {
    console.error('Erro ao buscar dados do banco:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 });
  }
}
