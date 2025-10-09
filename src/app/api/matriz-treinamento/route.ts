import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const contratoId = searchParams.get('contratoId');
    const funcaoId = searchParams.get('funcaoId');
    const treinamentoId = searchParams.get('treinamentoId');
    const tipoObrigatoriedade = searchParams.get('tipoObrigatoriedade');

    const skip = (page - 1) * limit;

    // Construir filtros
    const where: Prisma.MatrizTreinamentoWhereInput = {
      ativo: true,
    };

    if (contratoId) {
      where.contratoId = parseInt(contratoId);
    }

    if (funcaoId) {
      where.funcaoId = parseInt(funcaoId);
    }

    if (treinamentoId) {
      where.treinamentoId = parseInt(treinamentoId);
    }

    if (tipoObrigatoriedade) {
      where.tipoObrigatoriedade = tipoObrigatoriedade;
    }

    if (search) {
      where.OR = [
        {
          contrato: {
            nome: {
              contains: search,
            },
          },
        },
        {
          funcao: {
            funcao: {
              contains: search,
            },
          },
        },
        {
          treinamento: {
            treinamento: {
              contains: search,
            },
          },
        },
      ];
    }

    // Buscar registros com paginação
    const [matrizes, total] = await Promise.all([
      prisma.matrizTreinamento.findMany({
        where,
        include: {
          contrato: {
            select: {
              id: true,
              nome: true,
              numero: true,
              cliente: true,
            },
          },
          funcao: {
            select: {
              id: true,
              funcao: true,
              regime: true,
            },
          },
          treinamento: {
            select: {
              id: true,
              treinamento: true,
              cargaHoraria: true,
              validadeValor: true,
              validadeUnidade: true,
            },
          },
        },
        orderBy: [
          { contrato: { nome: 'asc' } },
          { funcao: { funcao: 'asc' } },
          { treinamento: { treinamento: 'asc' } },
        ],
        skip,
        take: limit,
      }),
      prisma.matrizTreinamento.count({ where }),
    ]);

    // Buscar opções para filtros
    const [contratos, funcoes, treinamentos] = await Promise.all([
      prisma.contrato.findMany({
        select: {
          id: true,
          nome: true,
          numero: true,
          cliente: true,
        },
        orderBy: { nome: 'asc' },
      }),
      prisma.funcao.findMany({
        where: { ativo: true },
        select: {
          id: true,
          funcao: true,
          regime: true,
        },
        orderBy: { funcao: 'asc' },
      }),
      prisma.treinamentos.findMany({
        select: {
          id: true,
          treinamento: true,
          cargaHoraria: true,
          validadeValor: true,
          validadeUnidade: true,
        },
        orderBy: { treinamento: 'asc' },
      }),
    ]);

    const tiposObrigatoriedade = [
      { value: 'RA', label: 'REQUISITO INICIAL OU ADMISSIONAL' },
      { value: 'AP', label: 'NECESSÁRIO / OBRIGATÓRIO' },
      { value: 'C', label: 'COMPLEMENTAR - APÓS O CADASTRO' },
      { value: 'SD', label: 'SOLICITAÇÃO OU DEMANDA' },
      { value: 'N/A', label: 'NÃO APLICÁVEL' },
    ];

    return NextResponse.json({
      success: true,
      data: matrizes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        contratos,
        funcoes,
        treinamentos,
        tiposObrigatoriedade,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar matriz de treinamento:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contratoId, funcaoId, treinamentoId, tipoObrigatoriedade } = body;

    // Validações
    if (!contratoId || !funcaoId || !treinamentoId || !tipoObrigatoriedade) {
      return NextResponse.json(
        { success: false, message: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    const tiposValidos = ['OB', 'AP', 'RC', 'AD'];
    if (!tiposValidos.includes(tipoObrigatoriedade)) {
      return NextResponse.json(
        { success: false, message: 'Tipo de obrigatoriedade inválido' },
        { status: 400 }
      );
    }

    // Verificar se contrato existe
    const contrato = await prisma.contrato.findUnique({
      where: { id: parseInt(contratoId) },
    });

    if (!contrato) {
      return NextResponse.json(
        { success: false, message: 'Contrato não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se função existe
    const funcao = await prisma.funcao.findUnique({
      where: { id: parseInt(funcaoId) },
    });

    if (!funcao) {
      return NextResponse.json(
        { success: false, message: 'Função não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se treinamento existe
    const treinamento = await prisma.treinamentos.findUnique({
      where: { id: parseInt(treinamentoId) },
    });

    if (!treinamento) {
      return NextResponse.json(
        { success: false, message: 'Treinamento não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existe uma matriz para esta combinação específica
    const matrizExistente = await prisma.matrizTreinamento.findFirst({
      where: {
        contratoId: parseInt(contratoId),
        funcaoId: parseInt(funcaoId),
        treinamentoId: parseInt(treinamentoId),
      },
    });

    if (matrizExistente) {
      return NextResponse.json(
        { success: false, message: 'Esta combinação já existe na matriz' },
        { status: 400 }
      );
    }

    // Verificar se existe uma entrada sem treinamento (treinamentoId: null) para esta função/contrato
    const entradaSemTreinamento = await prisma.matrizTreinamento.findFirst({
      where: {
        contratoId: parseInt(contratoId),
        funcaoId: parseInt(funcaoId),
        treinamentoId: null,
      },
    });

    let novaMatriz;

    if (entradaSemTreinamento) {
      // Atualizar a entrada existente sem treinamento
      novaMatriz = await prisma.matrizTreinamento.update({
        where: {
          id: entradaSemTreinamento.id,
        },
        data: {
          treinamentoId: parseInt(treinamentoId),
          tipoObrigatoriedade,
        },
        include: {
          contrato: {
            select: {
              id: true,
              nome: true,
              numero: true,
              cliente: true,
            },
          },
          funcao: {
            select: {
              id: true,
              funcao: true,
              regime: true,
            },
          },
          treinamento: {
            select: {
              id: true,
              treinamento: true,
              cargaHoraria: true,
              validadeValor: true,
              validadeUnidade: true,
            },
          },
        },
      });
    } else {
      // Criar nova entrada na matriz
      novaMatriz = await prisma.matrizTreinamento.create({
        data: {
          contratoId: parseInt(contratoId),
          funcaoId: parseInt(funcaoId),
          treinamentoId: parseInt(treinamentoId),
          tipoObrigatoriedade,
        },
        include: {
          contrato: {
            select: {
              id: true,
              nome: true,
              numero: true,
              cliente: true,
            },
          },
          funcao: {
            select: {
              id: true,
              funcao: true,
              regime: true,
            },
          },
          treinamento: {
            select: {
              id: true,
              treinamento: true,
              cargaHoraria: true,
              validadeValor: true,
              validadeUnidade: true,
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Matriz de treinamento criada com sucesso',
      data: novaMatriz,
    });
  } catch (error) {
    console.error('Erro ao criar matriz de treinamento:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}