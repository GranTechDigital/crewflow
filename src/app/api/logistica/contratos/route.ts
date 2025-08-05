import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Buscar contratos para logística
export async function GET(request: NextRequest) {
  try {
    const contratos = await prisma.contrato.findMany({
      where: {
        status: 'Ativo' // Apenas contratos ativos para logística
      },
      select: {
        id: true,
        numero: true,
        nome: true,
        cliente: true
      },
      orderBy: {
        nome: 'asc'
      }
    });

    return NextResponse.json(contratos);
  } catch (error) {
    console.error('Erro ao buscar contratos para logística:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar contratos' },
      { status: 500 }
    );
  }
}