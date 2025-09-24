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

    const where: any = {};

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
        { cc: { contains: search, mode: 'insensitive' } },
        { nomeCc: { contains: search, mode: 'insensitive' } },
        { projeto: { contains: search, mode: 'insensitive' } },
        { grupo1: { contains: search, mode: 'insensitive' } },
        { grupo2: { contains: search, mode: 'insensitive' } }
      ];
    }

    const centrosCusto = await prisma.centroCustoProjeto.findMany({
      where,
      orderBy: { cc: 'asc' }
    });

    // Buscar valores únicos para filtros
    const projetos = await prisma.centroCustoProjeto.findMany({
      select: { projeto: true },
      distinct: ['projeto'],
      orderBy: { projeto: 'asc' }
    });

    const grupos1 = await prisma.centroCustoProjeto.findMany({
      select: { grupo1: true },
      distinct: ['grupo1'],
      orderBy: { grupo1: 'asc' }
    });

    const grupos2 = await prisma.centroCustoProjeto.findMany({
      select: { grupo2: true },
      distinct: ['grupo2'],
      orderBy: { grupo2: 'asc' }
    });

    return NextResponse.json({
      centrosCusto,
      filtros: {
        projetos: projetos.map(p => p.projeto),
        grupos1: grupos1.map(g => g.grupo1),
        grupos2: grupos2.map(g => g.grupo2)
      }
    });

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
    const { cc, ccProjeto, nomeCc, ccNome, projeto, grupo1, grupo2, ativo = true } = body;

    if (!cc || !nomeCc) {
      return NextResponse.json(
        { error: 'CC e Nome CC são obrigatórios' },
        { status: 400 }
      );
    }

    const centroCusto = await prisma.centroCustoProjeto.create({
      data: {
        cc,
        ccProjeto: ccProjeto || cc,
        nomeCc,
        ccNome: ccNome || `${cc} | ${nomeCc}`,
        projeto: projeto || '',
        grupo1: grupo1 || '',
        grupo2: grupo2 || '',
        ativo
      }
    });

    return NextResponse.json(centroCusto, { status: 201 });

  } catch (error: any) {
    console.error('Erro ao criar centro de custo:', error);
    
    if (error.code === 'P2002') {
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