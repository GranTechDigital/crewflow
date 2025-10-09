import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '@/utils/authUtils';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
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

    const body = await request.json();
    const { funcaoIds } = body;

    if (!Array.isArray(funcaoIds) || funcaoIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lista de funções é obrigatória' },
        { status: 400 }
      );
    }

    // Verificar se o contrato existe
    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
    });

    if (!contrato) {
      return NextResponse.json(
        { success: false, error: 'Contrato não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se todas as funções existem
    const funcoes = await prisma.funcao.findMany({
      where: {
        id: { in: funcaoIds.map(id => parseInt(id)) },
        ativo: true
      },
    });

    if (funcoes.length !== funcaoIds.length) {
      return NextResponse.json(
        { success: false, error: 'Uma ou mais funções não foram encontradas' },
        { status: 404 }
      );
    }

    // Buscar funções que já existem na matriz para este contrato
    const funcoesExistentes = await prisma.funcao.findMany({
      where: {
        id: { in: funcaoIds.map(id => parseInt(id)) },
        matrizTreinamento: {
          some: {
            contratoId: contratoId
          }
        }
      },
      select: { id: true }
    });

    const idsExistentes = funcoesExistentes.map(f => f.id);
    const novasFuncoes = funcaoIds.filter(id => !idsExistentes.includes(parseInt(id)));

    const resultado = {
      adicionadas: 0,
      jaExistentes: idsExistentes.length,
      total: funcaoIds.length
    };

    // Se há novas funções para adicionar, criar entradas básicas na matriz
    // (sem treinamentos - serão adicionados posteriormente pelo usuário)
    if (novasFuncoes.length > 0) {
      // Para cada nova função, criar uma entrada básica na matriz individualmente
      // para evitar problemas com duplicatas
      for (const funcaoId of novasFuncoes) {
        try {
          await prisma.matrizTreinamento.create({
            data: {
              contratoId: contratoId,
              funcaoId: parseInt(funcaoId),
              treinamentoId: null, // Sem treinamento inicial
              tipoObrigatoriedade: 'N/A'
            }
          });
        } catch (error: unknown) {
          // Se já existe, ignorar o erro (duplicata)
          if (error instanceof Error && error.message?.includes('Unique constraint')) {
            // Ignorar erro de duplicata
          } else {
            throw error;
          }
        }
      }

      resultado.adicionadas = novasFuncoes.length;
    }

    return NextResponse.json({
      success: true,
      message: `${resultado.adicionadas} função(ões) adicionada(s) com sucesso. ${resultado.jaExistentes} já existiam na matriz.`,
      data: resultado
    });

  } catch (error) {
    console.error('Erro ao adicionar funções ao contrato:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
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

    const body = await request.json();
    const { funcaoIds } = body;

    if (!Array.isArray(funcaoIds) || funcaoIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lista de funções é obrigatória' },
        { status: 400 }
      );
    }

    // Remover todas as entradas da matriz para essas funções neste contrato
    const resultado = await prisma.matrizTreinamento.deleteMany({
      where: {
        contratoId: contratoId,
        funcaoId: { in: funcaoIds.map(id => parseInt(id)) }
      }
    });

    return NextResponse.json({
      success: true,
      message: `${resultado.count} entrada(s) removida(s) da matriz`,
      data: { removidas: resultado.count }
    });

  } catch (error) {
    console.error('Erro ao remover funções do contrato:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}