import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Listar centros de custo com filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projeto = searchParams.get('projeto');
    const grupo1 = searchParams.get('grupo1');
    const grupo2 = searchParams.get('grupo2');
    const ativo = searchParams.get('ativo');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (projeto) {
      where.projeto = projeto;
    }

    if (grupo1) {
      where.grupo1 = grupo1;
    }

    if (grupo2) {
      where.grupo2 = grupo2;
    }

    if (ativo !== null) {
      where.ativo = ativo === 'true';
    }

    if (search) {
      where.OR = [
        { centroCusto: { contains: search, mode: 'insensitive' } },
        { nomeCentroCusto: { contains: search, mode: 'insensitive' } }
      ];
    }

    const centrosCusto = await prisma.centroCustoProjeto.findMany({
      where,
      orderBy: { centroCusto: 'asc' }
    });

    // Buscar valores únicos para filtros - removido pois não existem esses campos no modelo
    const response = {
      data: centrosCusto,
      total: centrosCusto.length
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro ao buscar centros de custo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo centro de custo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cc, nomeCc, projetoId, ativo = true } = body;

    if (!cc || !nomeCc || !projetoId) {
      return NextResponse.json(
        { error: 'CC, Nome CC e Projeto ID são obrigatórios' },
        { status: 400 }
      );
    }

    const centroCusto = await prisma.centroCustoProjeto.create({
      data: {
        centroCusto: cc,
        nomeCentroCusto: nomeCc,
        projetoId: parseInt(projetoId),
        ativo
      }
    });

    return NextResponse.json(centroCusto, { status: 201 });

  } catch (error: unknown) {
    console.error('Erro ao criar centro de custo:', error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'CC já existe' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}