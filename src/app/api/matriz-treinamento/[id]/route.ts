import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/utils/authUtils';
import { sincronizarTarefasPadrao } from '@/lib/tarefasPadraoSync';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, message: 'ID inválido' },
        { status: 400 }
      );
    }

    const matriz = await prisma.matrizTreinamento.findUnique({
      where: { id },
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

    if (!matriz) {
      return NextResponse.json(
        { success: false, message: 'Matriz de treinamento não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: matriz,
    });
  } catch (error) {
    console.error('Erro ao buscar matriz de treinamento:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, message: 'ID inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { contratoId, funcaoId, treinamentoId, tipoObrigatoriedade, ativo } = body;

    // Verificar se a matriz existe
    const matrizExistente = await prisma.matrizTreinamento.findUnique({
      where: { id },
    });

    if (!matrizExistente) {
      return NextResponse.json(
        { success: false, message: 'Matriz de treinamento não encontrada' },
        { status: 404 }
      );
    }

    // Validações
    if (contratoId && isNaN(parseInt(contratoId))) {
      return NextResponse.json(
        { success: false, message: 'ID do contrato inválido' },
        { status: 400 }
      );
    }

    if (funcaoId && isNaN(parseInt(funcaoId))) {
      return NextResponse.json(
        { success: false, message: 'ID da função inválido' },
        { status: 400 }
      );
    }

    if (treinamentoId && isNaN(parseInt(treinamentoId))) {
      return NextResponse.json(
        { success: false, message: 'ID do treinamento inválido' },
        { status: 400 }
      );
    }

    if (tipoObrigatoriedade) {
      const tiposValidos = ['RA', 'AP', 'C', 'SD', 'N/A'];
      if (!tiposValidos.includes(tipoObrigatoriedade)) {
        return NextResponse.json(
          { success: false, message: 'Tipo de obrigatoriedade inválido' },
          { status: 400 }
        );
      }
    }

    // Se estiver alterando contrato, função ou treinamento, verificar se já existe essa combinação
        if (contratoId || funcaoId || treinamentoId !== undefined) {
          const novoContratoId = contratoId ? parseInt(contratoId) : matrizExistente.contratoId;
          const novaFuncaoId = funcaoId ? parseInt(funcaoId) : matrizExistente.funcaoId;
          const novoTreinamentoId = treinamentoId ? parseInt(treinamentoId) : matrizExistente.treinamentoId;

          // Verificar se não é a mesma combinação atual
          if (
            novoContratoId !== matrizExistente.contratoId ||
            novaFuncaoId !== matrizExistente.funcaoId ||
            novoTreinamentoId !== matrizExistente.treinamentoId
          ) {
            // Only check for existing combination if treinamentoId is not null
            if (novoTreinamentoId !== null) {
              const combinacaoExistente = await prisma.matrizTreinamento.findUnique({
                where: {
                  contratoId_funcaoId_treinamentoId: {
                    contratoId: novoContratoId,
                    funcaoId: novaFuncaoId,
                    treinamentoId: novoTreinamentoId,
                  },
                },
              });

              if (combinacaoExistente) {
                return NextResponse.json(
                  { success: false, message: 'Esta combinação de contrato, função e treinamento já existe' },
                  { status: 409 }
                );
              }
            }
          }

      // Verificar se as entidades existem
      if (contratoId) {
        const contrato = await prisma.contrato.findUnique({
          where: { id: parseInt(contratoId) },
        });

        if (!contrato) {
          return NextResponse.json(
            { success: false, message: 'Contrato não encontrado' },
            { status: 404 }
          );
        }
      }

      if (funcaoId) {
        const funcao = await prisma.funcao.findUnique({
          where: { id: parseInt(funcaoId) },
        });

        if (!funcao) {
          return NextResponse.json(
            { success: false, message: 'Função não encontrada' },
            { status: 404 }
          );
        }
      }

      if (treinamentoId) {
        const treinamento = await prisma.treinamentos.findUnique({
          where: { id: parseInt(treinamentoId) },
        });

        if (!treinamento) {
          return NextResponse.json(
            { success: false, message: 'Treinamento não encontrado' },
            { status: 404 }
          );
        }
      }
    }

    // Preparar dados para atualização
    const dadosAtualizacao: {
      contratoId?: number;
      funcaoId?: number;
      treinamentoId?: number | null;
      tipoObrigatoriedade?: string;
      ativo?: boolean;
    } = {};

    if (contratoId !== undefined) {
      dadosAtualizacao.contratoId = parseInt(contratoId);
    }

    if (funcaoId !== undefined) {
      dadosAtualizacao.funcaoId = parseInt(funcaoId);
    }

    if (treinamentoId !== undefined) {
      dadosAtualizacao.treinamentoId = treinamentoId ? parseInt(treinamentoId) : null;
    }

    if (tipoObrigatoriedade !== undefined) {
      dadosAtualizacao.tipoObrigatoriedade = tipoObrigatoriedade;
    }

    if (ativo !== undefined) {
      dadosAtualizacao.ativo = Boolean(ativo);
    }

    // Atualizar matriz
    const matrizAtualizada = await prisma.matrizTreinamento.update({
      where: { id },
      data: dadosAtualizacao,
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

    // Sincronização automática após atualização da matriz
    try {
      const user = await getUserFromRequest(request);
      await sincronizarTarefasPadrao({
        setores: ['TREINAMENTO'],
        usuarioResponsavel: user?.funcionario?.nome || 'Sistema - Matriz Atualizada',
        usuarioResponsavelId: user?.id,
        equipeId: user?.equipeId,
      });
      console.log('✅ Sincronização automática de TREINAMENTO executada após atualização da matriz');
    } catch (syncError) {
      console.error('⚠️ Erro na sincronização automática após atualização da matriz:', syncError);
      // Não falha a atualização se a sincronização falhar
    }

    return NextResponse.json({
      success: true,
      message: 'Matriz de treinamento atualizada com sucesso',
      data: matrizAtualizada,
    });
  } catch (error) {
    console.error('Erro ao atualizar matriz de treinamento:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const matrizId = parseInt(id);

    if (isNaN(matrizId)) {
      return NextResponse.json(
        { success: false, error: 'ID da matriz inválido' },
        { status: 400 }
      );
    }

    // Verificar se a matriz existe
    const matrizExistente = await prisma.matrizTreinamento.findUnique({
      where: { id: matrizId },
      include: {
        treinamento: true
      }
    });

    if (!matrizExistente) {
      return NextResponse.json(
        { success: false, error: 'Matriz de treinamento não encontrada' },
        { status: 404 }
      );
    }

    // Se a matriz tem um treinamento associado
    if (matrizExistente.treinamentoId) {
      // Verificar se há outros treinamentos para a mesma função no mesmo contrato
      const outrosTreinamentos = await prisma.matrizTreinamento.count({
        where: {
          contratoId: matrizExistente.contratoId,
          funcaoId: matrizExistente.funcaoId,
          treinamentoId: { not: null },
          id: { not: matrizId }
        }
      });

      // Se há outros treinamentos, simplesmente deletar esta entrada
      if (outrosTreinamentos > 0) {
        await prisma.matrizTreinamento.delete({
          where: { id: matrizId }
        });

        return NextResponse.json({
          success: true,
          message: 'Treinamento removido da função com sucesso'
        });
      } else {
        // Se é o último treinamento, converter para "sem treinamento"
        await prisma.matrizTreinamento.update({
          where: { id: matrizId },
          data: {
            treinamentoId: null,
            tipoObrigatoriedade: 'N/A'
          }
        });

        return NextResponse.json({
          success: true,
          message: 'Último treinamento removido - função mantida sem treinamento'
        });
      }
    } else {
      // Se não tem treinamento (treinamentoId é null), deletar a entrada completamente
      // (isso remove a função da matriz)
      await prisma.matrizTreinamento.delete({
        where: { id: matrizId }
      });

      return NextResponse.json({
        success: true,
        message: 'Função removida da matriz com sucesso'
      });
    }

  } catch (error) {
    console.error('Erro ao deletar matriz de treinamento:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}