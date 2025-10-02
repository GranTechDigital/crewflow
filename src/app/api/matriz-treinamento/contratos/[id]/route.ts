import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/utils/authUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const contratoId = parseInt(id);

    if (isNaN(contratoId)) {
      return NextResponse.json(
        { success: false, error: 'ID do contrato inválido' },
        { status: 400 }
      );
    }

    // Buscar contrato
    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: {
        id: true,
        nome: true,
        numero: true,
        cliente: true
      }
    });

    if (!contrato) {
      return NextResponse.json(
        { success: false, error: 'Contrato não encontrado' },
        { status: 404 }
      );
    }

    // Buscar funções associadas ao contrato com seus treinamentos
    const funcoes = await prisma.funcao.findMany({
      where: {
        matrizTreinamento: {
          some: {
            contratoId: contratoId
          }
        }
      },
      select: {
        id: true,
        funcao: true,
        regime: true,
        matrizTreinamento: {
          where: {
            contratoId: contratoId
          },
          select: {
            id: true,
            tipoObrigatoriedade: true,
            treinamentoId: true,
            treinamento: {
              select: {
                id: true,
                treinamento: true,
                cargaHoraria: true,
                validadeValor: true,
                validadeUnidade: true
              }
            }
          }
        }
      },
      orderBy: {
        funcao: 'asc'
      }
    });

    // Buscar todos os treinamentos disponíveis para o modal
    const treinamentos = await prisma.treinamentos.findMany({
      select: {
        id: true,
        treinamento: true,
        cargaHoraria: true,
        validadeValor: true,
        validadeUnidade: true
      },
      orderBy: {
        treinamento: 'asc'
      }
    });

    // Tipos de obrigatoriedade
    const tiposObrigatoriedade = [
      { value: 'OB', label: 'Obrigatório' },
      { value: 'AP', label: 'Aplicável' },
      { value: 'RC', label: 'Recomendado' },
      { value: 'AD', label: 'Adicional' }
    ];

    return NextResponse.json({
      success: true,
      data: {
        contrato,
        funcoes
      },
      filters: {
        treinamentos,
        tiposObrigatoriedade
      }
    });

  } catch (error) {
    console.error('Erro ao buscar detalhes do contrato:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}