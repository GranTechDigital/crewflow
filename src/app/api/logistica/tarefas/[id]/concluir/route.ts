import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT - Concluir tarefa
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Obter dados do corpo da requisição
    const body = await request.json().catch(() => ({}));
    const { dataVencimento } = body;
    
    // Buscar a tarefa atual
    const tarefaAtual = await prisma.tarefaRemanejamento.findUnique({
      where: {
        id: id,
      },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
                funcao: true,
              },
            },
          },
        },
      },
    });

    if (!tarefaAtual) {
      return NextResponse.json(
        { error: "Tarefa não encontrada" },
        { status: 404 }
      );
    }

    // Regra de negócio: data de vencimento obrigatória exceto para RH
    if (tarefaAtual.responsavel !== "RH" && !dataVencimento) {
      return NextResponse.json(
        { error: "Data de vencimento é obrigatória para concluir a tarefa (exceto RH)." },
        { status: 400 }
      );
    }

    // Preparar dados para atualização
    const updateData: {
      status: string;
      dataConclusao: Date;
      dataVencimento?: Date;
    } = {
      status: "CONCLUIDO",
      dataConclusao: new Date(),
    };
    
    // Adicionar data de vencimento se fornecida
    if (dataVencimento) {
      updateData.dataVencimento = new Date(dataVencimento);
    }
    
    // Atualizar a tarefa para concluída
    const tarefaAtualizada = await prisma.tarefaRemanejamento.update({
      where: {
        id: id,
      },
      data: updateData,
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
                funcao: true,
              },
            },
          },
        },
      },
    });

    // Registrar no histórico
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId:
            tarefaAtualizada.remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId:
            tarefaAtualizada.remanejamentoFuncionarioId,
          tipoAcao: "ATUALIZACAO_STATUS",
          entidade: "TAREFA",
          descricaoAcao: `Tarefa "${tarefaAtualizada.tipo}" concluída para ${tarefaAtualizada.remanejamentoFuncionario.funcionario.nome} (${tarefaAtualizada.remanejamentoFuncionario.funcionario.matricula})`,
          campoAlterado: "status",
          valorAnterior: tarefaAtual.status,
          valorNovo: "CONCLUIDO",
          usuarioResponsavel: "Sistema", // Pode ser melhorado para capturar o usuário real
        },
      });
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
      // Não falha a atualização se o histórico falhar
    }

    // Atualizar o status das tarefas do funcionário
    await atualizarStatusTarefasFuncionario(
      tarefaAtual.remanejamentoFuncionarioId
    );

    return NextResponse.json(tarefaAtualizada);
  } catch (error) {
    console.error("Erro ao concluir tarefa:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// Função auxiliar para atualizar o status das tarefas do funcionário
async function atualizarStatusTarefasFuncionario(
  remanejamentoFuncionarioId: string
) {
  try {
    // Buscar todas as tarefas do funcionário
    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where: {
        remanejamentoFuncionarioId,
      },
    });

    // Verificar se todas as tarefas estão concluídas
    // Se não há tarefas, considera como concluído
    const todasConcluidas =
      tarefas.length === 0 ||
      tarefas.every((tarefa) => tarefa.status === "CONCLUIDO");

    // Buscar o funcionário do remanejamento com a solicitação
    const remanejamentoFuncionario =
      await prisma.remanejamentoFuncionario.findUnique({
        where: {
          id: remanejamentoFuncionarioId,
        },
        include: {
          solicitacao: true,
        },
      });

    if (!remanejamentoFuncionario) {
      console.error(
        "RemanejamentoFuncionario não encontrado:",
        remanejamentoFuncionarioId
      );
      return;
    }

    // Atualizar o status das tarefas do funcionário
    await prisma.remanejamentoFuncionario.update({
      where: {
        id: remanejamentoFuncionarioId,
      },
      data: {
        statusTarefas: todasConcluidas
          ? "SUBMETER RASCUNHO"
          : "ATENDER TAREFAS",
      },
    });

    // Registrar no histórico a mudança de status das tarefas
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: remanejamentoFuncionarioId,
          tipoAcao: "ATUALIZACAO_STATUS",
          entidade: "STATUS_TAREFAS",
          descricaoAcao: `Status geral das tarefas atualizado para: ${
            todasConcluidas ? "SUBMETER RASCUNHO" : "ATENDER TAREFAS"
          } (via conclusão de tarefa)`,
          campoAlterado: "statusTarefas",
          valorNovo: todasConcluidas ? "SUBMETER RASCUNHO" : "ATENDER TAREFAS",
          usuarioResponsavel: "Sistema",
        },
      });
    } catch (historicoError) {
      console.error(
        "Erro ao registrar histórico de status das tarefas:",
        historicoError
      );
    }

    // Se todas as tarefas estão concluídas E o Prestserv está aprovado,
    // verificar se todos os funcionários da solicitação estão prontos
    if (
      todasConcluidas &&
      remanejamentoFuncionario.statusPrestserv === "APROVADO"
    ) {
      await verificarConclusaoSolicitacao(
        remanejamentoFuncionario.solicitacaoId
      );
    }
  } catch (error) {
    console.error("Erro ao atualizar status das tarefas:", error);
  }
}

// Função para verificar se toda a solicitação pode ser marcada como concluída
async function verificarConclusaoSolicitacao(solicitacaoId: number) {
  try {
    // Buscar todos os funcionários da solicitação
    const funcionarios = await prisma.remanejamentoFuncionario.findMany({
      where: {
        solicitacaoId,
      },
    });

    // Verificar se todos os funcionários têm SUBMETER RASCUNHO E Prestserv aprovado
    const todosProntos = funcionarios.every(
      (f) => f.statusTarefas === "CONCLUIDO" && f.statusPrestserv === "APROVADO"
    );

    if (todosProntos) {
      // Marcar a solicitação como concluída
      await prisma.solicitacaoRemanejamento.update({
        where: {
          id: solicitacaoId,
        },
        data: {
          status: "CONCLUIDO",
          dataConclusao: new Date(),
        },
      });

      console.log(
        `Solicitação de remanejamento ${solicitacaoId} marcada como concluída`
      );
    }
  } catch (error) {
    console.error("Erro ao verificar conclusão da solicitação:", error);
  }
}