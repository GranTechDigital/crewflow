import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Listar todas as funções
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const regime = searchParams.get('regime') || '';

    const skip = (page - 1) * limit;

    // Construir filtros
    const where: Prisma.FuncaoWhereInput = {};
    
    if (search) {
      where.funcao = {
        contains: search,
      };
    }

    if (regime) {
      where.regime = regime;
    }

    // Buscar funções com paginação
    const [funcoes, total] = await Promise.all([
      prisma.funcao.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { funcao: 'asc' },
          { regime: 'asc' },
        ],
      }),
      prisma.funcao.count({ where }),
    ]);

    // Buscar regimes únicos para filtro
    const regimes = await prisma.funcao.findMany({
      select: { regime: true },
      distinct: ['regime'],
      orderBy: { regime: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: funcoes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      regimes: regimes.map(r => r.regime),
    });

  } catch (error) {
    console.error('Erro ao buscar funções:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao buscar funções',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST - Criar nova função
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { funcao, regime } = body;

    // Validações
    if (!funcao || !regime) {
      return NextResponse.json(
        {
          success: false,
          message: 'Função e regime são obrigatórios',
        },
        { status: 400 }
      );
    }

    // Verificar se já existe uma função com o mesmo nome
    const funcaoExistente = await prisma.funcao.findFirst({
      where: {
        funcao: funcao.trim(),
        regime: regime.trim(),
      },
    });

    if (funcaoExistente) {
      return NextResponse.json(
        {
          success: false,
          message: 'Função com este regime já existe',
        },
        { status: 409 }
      );
    }

    // Criar função
    const novaFuncao = await prisma.funcao.create({
      data: {
        funcao: funcao.trim(),
        regime: regime.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Função criada com sucesso',
      data: novaFuncao,
    });

  } catch (error) {
    console.error('Erro ao criar função:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao criar função',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}