import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const validadeUnidade = searchParams.get('validadeUnidade') || '';

    const skip = (page - 1) * limit;

    const normalizeText = (s: string) => s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    const baseWhere: Prisma.TreinamentosWhereInput = {};
    if (validadeUnidade) {
      baseWhere.validadeUnidade = validadeUnidade;
    }

    if (search) {
      const searchNorm = normalizeText(search);
      const baseResults = await prisma.treinamentos.findMany({
        where: {
          ...baseWhere,
          treinamento: { contains: search, mode: 'insensitive' },
        },
        orderBy: [{ treinamento: 'asc' }],
      });
      const filtered = baseResults.filter(t => normalizeText(t.treinamento).includes(searchNorm));
      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);

      const unidadesValidade = await prisma.treinamentos.findMany({
        select: { validadeUnidade: true },
        distinct: ['validadeUnidade'],
        orderBy: { validadeUnidade: 'asc' },
      });

      return NextResponse.json({
        success: true,
        data: paginated,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        unidadesValidade: unidadesValidade.map(u => u.validadeUnidade),
      });
    } else {
      const where: Prisma.TreinamentosWhereInput = { ...baseWhere };
      const [treinamentos, total] = await Promise.all([
        prisma.treinamentos.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ treinamento: 'asc' }],
        }),
        prisma.treinamentos.count({ where }),
      ]);

      const unidadesValidade = await prisma.treinamentos.findMany({
        select: { validadeUnidade: true },
        distinct: ['validadeUnidade'],
        orderBy: { validadeUnidade: 'asc' },
      });

      return NextResponse.json({
        success: true,
        data: treinamentos,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        unidadesValidade: unidadesValidade.map(u => u.validadeUnidade),
      });
    }
  } catch (error) {
    console.error('Erro ao buscar treinamentos:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao buscar treinamentos',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { treinamento, cargaHoraria, validadeValor, validadeUnidade } = body;

    // Validações
    if (!treinamento || !cargaHoraria || validadeValor === undefined || !validadeUnidade) {
      return NextResponse.json(
        {
          success: false,
          message: 'Todos os campos são obrigatórios',
        },
        { status: 400 }
      );
    }

    if (cargaHoraria <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Carga horária deve ser maior que zero',
        },
        { status: 400 }
      );
    }

    if (validadeValor < 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Valor de validade não pode ser negativo',
        },
        { status: 400 }
      );
    }

    // Verificar se já existe um treinamento com o mesmo nome
    const treinamentoExistente = await prisma.treinamentos.findFirst({
      where: {
        treinamento: treinamento.trim(),
      },
    });

    if (treinamentoExistente) {
      return NextResponse.json(
        {
          success: false,
          message: 'Já existe um treinamento com este nome',
        },
        { status: 409 }
      );
    }

    // Criar treinamento
    const novoTreinamento = await prisma.treinamentos.create({
      data: {
        treinamento: treinamento.trim(),
        cargaHoraria: parseInt(cargaHoraria),
        validadeValor: parseInt(validadeValor),
        validadeUnidade: validadeUnidade.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Treinamento criado com sucesso',
      data: novoTreinamento,
    });
  } catch (error) {
    console.error('Erro ao criar treinamento:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao criar treinamento',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}