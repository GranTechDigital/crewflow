import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AtualizarStatusPrestserv, NovaTarefaRemanejamento } from '@/types/remanejamento-funcionario';

// GET - Buscar detalhes de um funcionário em remanejamento
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const remanejamentoFuncionario = await prisma.remanejamentoFuncionario.findUnique({
      where: {
        id: params.id
      },
      include: {
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            funcao: true,
            centroCusto: true,
            email: true,
            telefone: true
          }
        },
        solicitacao: {
          include: {
            contratoOrigem: {
              select: {
                id: true,
                numero: true,
                nome: true,
                cliente: true
              }
            },
            contratoDestino: {
              select: {
                id: true,
                numero: true,
                nome: true,
                cliente: true
              }
            }
          }
        },
        tarefas: {
          orderBy: {
            dataCriacao: 'asc'
          }
        }
      }
    });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: 'Funcionário em remanejamento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(remanejamentoFuncionario);
  } catch (error) {
    console.error('Erro ao buscar funcionário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar status do Prestserv
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: AtualizarStatusPrestserv = await request.json();
    
    const {
      statusPrestserv,
      dataRascunhoCriado,
      dataSubmetido,
      dataResposta,
      observacoesPrestserv
    } = body;

    // Validações
    if (!statusPrestserv) {
      return NextResponse.json(
        { error: 'Status do Prestserv é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar o funcionário em remanejamento
    const remanejamentoFuncionario = await prisma.remanejamentoFuncionario.findUnique({
      where: {
        id: params.id
      },
      include: {
        tarefas: true,
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true
          }
        }
      }
    });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: 'Funcionário em remanejamento não encontrado' },
        { status: 404 }
      );
    }

    // Validação: só pode submeter se todas as tarefas estiverem concluídas
    if (statusPrestserv === 'SUBMETIDO') {
      const tarefasPendentes = remanejamentoFuncionario.tarefas.filter(
        tarefa => tarefa.status !== 'CONCLUIDO'
      );
      
      if (tarefasPendentes.length > 0) {
        return NextResponse.json(
          { 
            error: 'Não é possível submeter. Ainda existem tarefas pendentes.',
            tarefasPendentes: tarefasPendentes.length
          },
          { status: 400 }
        );
      }
    }

    // Preparar dados para atualização
    const updateData: any = {
      statusPrestserv,
      observacoesPrestserv
    };

    // Adicionar datas automaticamente conforme o status
    if (statusPrestserv === 'CRIADO' && !remanejamentoFuncionario.dataRascunhoCriado) {
      updateData.dataRascunhoCriado = new Date();
    } else if (statusPrestserv === 'SUBMETIDO') {
      // Para SUBMETIDO, sempre atualizar a data (permite resubmissão)
      updateData.dataSubmetido = new Date();
    } else if (statusPrestserv === 'APROVADO' || statusPrestserv === 'REJEITADO') {
      updateData.dataResposta = new Date();
    }
    
    // Preservar datas existentes se não estão sendo atualizadas
    if (!updateData.dataRascunhoCriado && remanejamentoFuncionario.dataRascunhoCriado) {
      updateData.dataRascunhoCriado = remanejamentoFuncionario.dataRascunhoCriado;
    }
    if (!updateData.dataSubmetido && remanejamentoFuncionario.dataSubmetido && statusPrestserv !== 'SUBMETIDO') {
      updateData.dataSubmetido = remanejamentoFuncionario.dataSubmetido;
    }
    if (!updateData.dataResposta && remanejamentoFuncionario.dataResposta && statusPrestserv !== 'APROVADO' && statusPrestserv !== 'REJEITADO') {
      updateData.dataResposta = remanejamentoFuncionario.dataResposta;
    }
    
    // Permitir override manual das datas se fornecidas
    if (dataRascunhoCriado) {
      updateData.dataRascunhoCriado = new Date(dataRascunhoCriado);
    }
    if (dataSubmetido) {
      updateData.dataSubmetido = new Date(dataSubmetido);
    }
    if (dataResposta) {
      updateData.dataResposta = new Date(dataResposta);
    }

    // Buscar dados atuais antes da atualização para o histórico
    const statusAnterior = remanejamentoFuncionario.statusPrestserv;
    
    // Atualizar o registro
    const funcionarioAtualizado = await prisma.remanejamentoFuncionario.update({
      where: {
        id: params.id
      },
      data: updateData,
      include: {
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            funcao: true,
            centroCusto: true
          }
        },
        solicitacao: {
          include: {
            contratoOrigem: true,
            contratoDestino: true
          }
        },
        tarefas: true
      }
    });

    // Registrar no histórico se o status mudou
    if (statusAnterior !== statusPrestserv) {
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: funcionarioAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            tipoAcao: 'ATUALIZACAO_STATUS',
            entidade: 'PRESTSERV',
            descricaoAcao: `Status do Prestserv alterado de ${statusAnterior} para ${statusPrestserv} para ${funcionarioAtualizado.funcionario.nome} (${funcionarioAtualizado.funcionario.matricula})`,
            campoAlterado: 'statusPrestserv',
            valorAnterior: statusAnterior,
            valorNovo: statusPrestserv,
            usuarioResponsavel: 'Sistema', // Pode ser melhorado para capturar o usuário real
            observacoes: observacoesPrestserv || undefined
          }
        });
      } catch (historicoError) {
        console.error('Erro ao registrar histórico:', historicoError);
        // Não falha a atualização se o histórico falhar
      }
    }

    // Se o Prestserv foi aprovado, mover o funcionário para o contrato de destino
    if (statusPrestserv === 'APROVADO') {
      // Buscar informações da solicitação para obter o contrato de destino
      const solicitacao = await prisma.solicitacaoRemanejamento.findUnique({
        where: { id: funcionarioAtualizado.solicitacaoId },
        select: { contratoDestinoId: true }
      });

      if (solicitacao?.contratoDestinoId) {
        // Atualizar o contrato do funcionário
        await prisma.funcionario.update({
          where: { id: funcionarioAtualizado.funcionarioId },
          data: { contratoId: solicitacao.contratoDestinoId }
        });
        
        console.log(`Funcionário ${funcionarioAtualizado.funcionarioId} movido para contrato ${solicitacao.contratoDestinoId}`);
      }
    }

    // Se o Prestserv foi aprovado e todas as tarefas estão concluídas, verificar se a solicitação pode ser concluída
    if (statusPrestserv === 'APROVADO' && funcionarioAtualizado.statusTarefas === 'CONCLUIDO') {
      await verificarConclusaoSolicitacao(funcionarioAtualizado.solicitacaoId);
    }

    return NextResponse.json(funcionarioAtualizado);
  } catch (error) {
    console.error('Erro ao atualizar status do Prestserv:', error);
    
    // Log mais detalhado do erro
    if (error instanceof Error) {
      console.error('Detalhes do erro:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// PATCH - Atualizar apenas o status do Prestserv (método simplificado)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { statusPrestserv } = body;

    if (!statusPrestserv) {
      return NextResponse.json(
        { error: 'Status do Prestserv é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar o funcionário em remanejamento
    const remanejamentoFuncionario = await prisma.remanejamentoFuncionario.findUnique({
      where: {
        id: params.id
      },
      include: {
        tarefas: true
      }
    });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: 'Funcionário em remanejamento não encontrado' },
        { status: 404 }
      );
    }

    // Validação: só pode submeter se todas as tarefas estiverem concluídas
    if (statusPrestserv === 'SUBMETIDO') {
      const tarefasPendentes = remanejamentoFuncionario.tarefas.filter(
        tarefa => tarefa.status !== 'CONCLUIDO'
      );
      
      if (tarefasPendentes.length > 0) {
        return NextResponse.json(
          { 
            error: 'Não é possível submeter. Ainda existem tarefas pendentes.',
            tarefasPendentes: tarefasPendentes.length
          },
          { status: 400 }
        );
      }
    }

    // Preparar dados para atualização
    const updateData: any = {
      statusPrestserv
    };

    // Adicionar datas automaticamente conforme o status
    if (statusPrestserv === 'CRIADO' && !remanejamentoFuncionario.dataRascunhoCriado) {
      updateData.dataRascunhoCriado = new Date();
    } else if (statusPrestserv === 'SUBMETIDO') {
      // Para SUBMETIDO, sempre atualizar a data (permite resubmissão)
      updateData.dataSubmetido = new Date();
    } else if (statusPrestserv === 'APROVADO' || statusPrestserv === 'REJEITADO') {
      updateData.dataResposta = new Date();
    }
    
    // Preservar datas existentes se não estão sendo atualizadas
    if (!updateData.dataRascunhoCriado && remanejamentoFuncionario.dataRascunhoCriado) {
      updateData.dataRascunhoCriado = remanejamentoFuncionario.dataRascunhoCriado;
    }
    if (!updateData.dataSubmetido && remanejamentoFuncionario.dataSubmetido && statusPrestserv !== 'SUBMETIDO') {
      updateData.dataSubmetido = remanejamentoFuncionario.dataSubmetido;
    }
    if (!updateData.dataResposta && remanejamentoFuncionario.dataResposta && statusPrestserv !== 'APROVADO' && statusPrestserv !== 'REJEITADO') {
      updateData.dataResposta = remanejamentoFuncionario.dataResposta;
    }

    // Buscar dados atuais antes da atualização para o histórico
    const statusAnterior = remanejamentoFuncionario.statusPrestserv;
    
    // Atualizar o registro
    const funcionarioAtualizado = await prisma.remanejamentoFuncionario.update({
      where: {
        id: params.id
      },
      data: updateData,
      include: {
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true
          }
        }
      }
    });

    // Registrar no histórico se o status mudou
    if (statusAnterior !== statusPrestserv) {
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: funcionarioAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            tipoAcao: 'ATUALIZACAO_STATUS',
            entidade: 'PRESTSERV',
            descricaoAcao: `Status do Prestserv alterado de ${statusAnterior} para ${statusPrestserv} para ${funcionarioAtualizado.funcionario.nome} (${funcionarioAtualizado.funcionario.matricula})`,
            campoAlterado: 'statusPrestserv',
            valorAnterior: statusAnterior,
            valorNovo: statusPrestserv,
            usuarioResponsavel: 'Sistema', // Pode ser melhorado para capturar o usuário real
            observacoes: undefined
          }
        });
      } catch (historicoError) {
        console.error('Erro ao registrar histórico:', historicoError);
        // Não falha a atualização se o histórico falhar
      }
    }

    // Se o Prestserv foi aprovado, mover o funcionário para o contrato de destino
    if (statusPrestserv === 'APROVADO') {
      const solicitacao = await prisma.solicitacaoRemanejamento.findUnique({
        where: { id: funcionarioAtualizado.solicitacaoId },
        select: { contratoDestinoId: true }
      });

      if (solicitacao?.contratoDestinoId) {
        await prisma.funcionario.update({
          where: { id: funcionarioAtualizado.funcionarioId },
          data: { contratoId: solicitacao.contratoDestinoId }
        });
      }
    }

    // Se o Prestserv foi aprovado e todas as tarefas estão concluídas, verificar se a solicitação pode ser concluída
    if (statusPrestserv === 'APROVADO' && funcionarioAtualizado.statusTarefas === 'CONCLUIDO') {
      await verificarConclusaoSolicitacao(funcionarioAtualizado.solicitacaoId);
    }

    return NextResponse.json({ success: true, statusPrestserv: funcionarioAtualizado.statusPrestserv });
  } catch (error) {
    console.error('Erro ao atualizar status do Prestserv:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// Função para verificar se toda a solicitação pode ser marcada como concluída
async function verificarConclusaoSolicitacao(solicitacaoId: number) {
  try {
    // Buscar todos os funcionários da solicitação
    const funcionarios = await prisma.remanejamentoFuncionario.findMany({
      where: {
        solicitacaoId
      }
    });

    // Verificar se todos os funcionários têm tarefas concluídas E Prestserv aprovado
    const todosProntos = funcionarios.every(f => 
      f.statusTarefas === 'CONCLUIDO' && f.statusPrestserv === 'APROVADO'
    );

    if (todosProntos) {
      // Marcar a solicitação como concluída
      await prisma.solicitacaoRemanejamento.update({
        where: {
          id: solicitacaoId
        },
        data: {
          status: 'CONCLUIDO',
          dataConclusao: new Date()
        }
      });

      console.log(`Solicitação de remanejamento ${solicitacaoId} marcada como concluída`);
    }
  } catch (error) {
    console.error('Erro ao verificar conclusão da solicitação:', error);
  }
}