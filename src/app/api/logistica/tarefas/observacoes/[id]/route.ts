import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Atualizar observação
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { texto, modificadoPor } = body;

    if (!texto || !modificadoPor) {
      return NextResponse.json(
        { error: 'Texto e modificador são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a observação existe e buscar dados para histórico
    const observacaoExistente = await prisma.observacaoTarefaRemanejamento.findUnique({
      where: { id: parseInt(id) },
      include: {
        tarefa: {
          include: {
            remanejamentoFuncionario: {
              include: {
                funcionario: {
                  select: {
                    id: true,
                    nome: true,
                    matricula: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!observacaoExistente) {
      return NextResponse.json(
        { error: 'Observação não encontrada' },
        { status: 404 }
      );
    }

    const observacao = await prisma.observacaoTarefaRemanejamento.update({
      where: {
        id: parseInt(id)
      },
      data: {
        texto,
        modificadoPor,
        dataModificacao: new Date()
      }
    });

    // Registrar no histórico se o texto foi alterado
    if (observacaoExistente.texto !== texto) {
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: observacaoExistente.tarefa.remanejamentoFuncionario.solicitacaoId,
            remanejamentoFuncionarioId: observacaoExistente.tarefa.remanejamentoFuncionarioId,
            tipoAcao: 'ATUALIZACAO',
            entidade: 'OBSERVACAO',
            descricaoAcao: `Observação da tarefa "${observacaoExistente.tarefa.tipo}" atualizada para ${observacaoExistente.tarefa.remanejamentoFuncionario.funcionario.nome} (${observacaoExistente.tarefa.remanejamentoFuncionario.funcionario.matricula})`,
            campoAlterado: 'texto',
            valorAnterior: observacaoExistente.texto,
            valorNovo: texto,
            usuarioResponsavel: modificadoPor,
            observacoes: `Observação atualizada`
          }
        });
      } catch (historicoError) {
        console.error('Erro ao registrar histórico:', historicoError);
        // Não falha a atualização se o histórico falhar
      }
    }

    return NextResponse.json(observacao);
  } catch (error) {
    console.error('Erro ao atualizar observação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir observação
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verificar se a observação existe e buscar dados para histórico
    const observacao = await prisma.observacaoTarefaRemanejamento.findUnique({
      where: { id: parseInt(id) },
      include: {
        tarefa: {
          include: {
            remanejamentoFuncionario: {
              include: {
                funcionario: {
                  select: {
                    id: true,
                    nome: true,
                    matricula: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!observacao) {
      return NextResponse.json(
        { error: 'Observação não encontrada' },
        { status: 404 }
      );
    }

    // Registrar no histórico antes de excluir
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: observacao.tarefa.remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: observacao.tarefa.remanejamentoFuncionarioId,
          tipoAcao: 'EXCLUSAO',
          entidade: 'OBSERVACAO',
          descricaoAcao: `Observação da tarefa "${observacao.tarefa.tipo}" excluída para ${observacao.tarefa.remanejamentoFuncionario.funcionario.nome} (${observacao.tarefa.remanejamentoFuncionario.funcionario.matricula})`,
          usuarioResponsavel: 'Sistema', // Pode ser melhorado para capturar o usuário real
          observacoes: observacao.texto
        }
      });
    } catch (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falha a exclusão se o histórico falhar
    }

    await prisma.observacaoTarefaRemanejamento.delete({
      where: {
        id: parseInt(id)
      }
    });

    return NextResponse.json({ message: 'Observação excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir observação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}