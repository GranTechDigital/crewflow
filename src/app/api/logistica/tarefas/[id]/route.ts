import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { StatusTarefa } from "@/types/remanejamento-funcionario";

// GET - Buscar detalhes de uma tarefa específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tarefa = await prisma.tarefaRemanejamento.findUnique({
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
                centroCusto: true,
              },
            },
            solicitacao: {
              select: {
                id: true,
                justificativa: true,
              },
            },
          },
        },
      },
    });

    if (!tarefa) {
      return NextResponse.json(
        { error: "Tarefa não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(tarefa);
  } catch (error) {
    console.error("Erro ao buscar tarefa:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar status da tarefa
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Obter o usuário autenticado
    const { getUserFromRequest } = await import("@/utils/authUtils");
    const usuarioAutenticado = await getUserFromRequest(request);
    console.log("usuarioAutenticado");
    console.log(usuarioAutenticado);

    // Não exigir autenticação para atualização de status
    // Usar 'Sistema' como nome do usuário se não estiver autenticado

    const body = await request.json();

    const {
      status,
      observacoes,
      dataConclusao,
      dataLimite,
      dataVencimento,
    }: {
      status?: StatusTarefa;
      observacoes?: string;
      dataConclusao?: string;
      dataLimite?: string;
      dataVencimento?: string;
    } = body;

    // Validações - pelo menos um campo deve ser fornecido
    if (
      !status &&
      !observacoes &&
      !dataConclusao &&
      !dataLimite &&
      !dataVencimento
    ) {
      return NextResponse.json(
        { error: "Pelo menos um campo deve ser fornecido para atualização" },
        { status: 400 }
      );
    }

    // Buscar a tarefa atual
    const tarefaAtual = await prisma.tarefaRemanejamento.findUnique({
      where: {
        id: id,
      },
    });

    if (!tarefaAtual) {
      return NextResponse.json(
        { error: "Tarefa não encontrada" },
        { status: 404 }
      );
    }

    // Helper para normalizar qualquer entrada de data (YYYY-MM-DD ou ISO) para meio-dia UTC
    const normalizeToUtcNoon = (value: string | Date): Date => {
      const d = typeof value === "string" ? new Date(value) : value;
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const day = d.getUTCDate();
      return new Date(Date.UTC(y, m, day, 12, 0, 0));
    };

    // Preparar dados para atualização
    const updateData: {
      status?: string;
      observacoes?: string;
      dataLimite?: Date | null;
      dataVencimento?: Date | null;
      dataConclusao?: Date | null;
    } = {};

    if (status !== undefined) updateData.status = status;
    if (observacoes !== undefined) updateData.observacoes = observacoes;
    if (dataLimite !== undefined) {
      if (!dataLimite) {
        updateData.dataLimite = null;
      } else if (typeof dataLimite === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dataLimite)) {
          const [y, m, d] = dataLimite.split("-").map(Number);
          updateData.dataLimite = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        } else {
          updateData.dataLimite = normalizeToUtcNoon(dataLimite);
        }
      } else {
        updateData.dataLimite = normalizeToUtcNoon(dataLimite as unknown as Date);
      }
    }
    if (dataVencimento !== undefined) {
      if (!dataVencimento) {
        updateData.dataVencimento = null;
      } else if (typeof dataVencimento === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dataVencimento)) {
          const [y, m, d] = dataVencimento.split("-").map(Number);
          updateData.dataVencimento = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        } else {
          updateData.dataVencimento = normalizeToUtcNoon(dataVencimento);
        }
      } else {
        updateData.dataVencimento = normalizeToUtcNoon(dataVencimento as unknown as Date);
      }
    }

    // Se a tarefa está sendo marcada como concluída, adicionar data de conclusão
    if (status === "CONCLUIDO" && !tarefaAtual.dataConclusao) {
      updateData.dataConclusao = dataConclusao
        ? new Date(dataConclusao)
        : new Date();
    }

    // Se a tarefa está sendo desmarcada como concluída, remover data de conclusão
    if (status && status !== "CONCLUIDO" && tarefaAtual.dataConclusao) {
      updateData.dataConclusao = null;
    }

    // Atualizar a tarefa
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
            solicitacao: true,
          },
        },
      },
    });

    // Adicionar observação automática se o status foi alterado (exceto para REPROVADO)
    if (status && status !== tarefaAtual.status && status !== "REPROVADO") {
      // Criar uma observação automática sobre a mudança de status
      await prisma.observacaoTarefaRemanejamento.create({
        data: {
          tarefaId: id,
          texto: `Status alterado de "${tarefaAtual.status}" para "${status}".`,
          criadoPor: usuarioAutenticado?.funcionario.nome || "Sistema",
          modificadoPor: usuarioAutenticado?.funcionario.nome || "Sistema",
        },
      });
    }

    // Registrar no histórico se o status foi alterado
    if (status !== undefined && tarefaAtual.status !== status) {
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId:
              tarefaAtualizada.remanejamentoFuncionario.solicitacaoId,
            remanejamentoFuncionarioId:
              tarefaAtualizada.remanejamentoFuncionarioId,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "TAREFA",
            descricaoAcao: `Status da tarefa "${tarefaAtualizada.tipo}" alterado de ${tarefaAtual.status} para ${status} para ${tarefaAtualizada.remanejamentoFuncionario.funcionario.nome} (${tarefaAtualizada.remanejamentoFuncionario.funcionario.matricula})`,
            campoAlterado: "status",
            valorAnterior: tarefaAtual.status,
            valorNovo: status,
            usuarioResponsavel: "Sistema", // Pode ser melhorado para capturar o usuário real
            observacoes: observacoes || undefined,
          },
        });
      } catch (historicoError) {
        console.error("Erro ao registrar histórico:", historicoError);
        // Não falha a atualização se o histórico falhar
      }
    }

    // Registrar no histórico se a data limite foi alterada
    if (dataLimite !== undefined) {
      const dataLimiteAnterior = tarefaAtual.dataLimite
        ? tarefaAtual.dataLimite.toISOString()
        : null;

      // Normalizar a nova data para a mesma referência usada no update
      let dataLimiteNovaIso: string | null = null;
      if (!dataLimite) {
        dataLimiteNovaIso = null;
      } else if (typeof dataLimite === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dataLimite)) {
          const [y, m, d] = dataLimite.split("-").map(Number);
          dataLimiteNovaIso = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
        } else {
          dataLimiteNovaIso = normalizeToUtcNoon(dataLimite).toISOString();
        }
      } else {
        dataLimiteNovaIso = normalizeToUtcNoon(dataLimite as unknown as Date).toISOString();
      }

      if (dataLimiteAnterior !== dataLimiteNovaIso) {
        try {
          await prisma.historicoRemanejamento.create({
            data: {
              solicitacaoId:
                tarefaAtualizada.remanejamentoFuncionario.solicitacaoId,
              remanejamentoFuncionarioId:
                tarefaAtualizada.remanejamentoFuncionarioId,
              tipoAcao: "ATUALIZACAO",
              entidade: "TAREFA",
              descricaoAcao: `Data limite da tarefa "${tarefaAtualizada.tipo}" alterada para ${tarefaAtualizada.remanejamentoFuncionario.funcionario.nome} (${tarefaAtualizada.remanejamentoFuncionario.funcionario.matricula})`,
              campoAlterado: "dataLimite",
              valorAnterior: dataLimiteAnterior
                ? new Date(dataLimiteAnterior).toLocaleDateString("pt-BR")
                : "Não definida",
              valorNovo: dataLimiteNovaIso
                ? new Date(dataLimiteNovaIso).toLocaleDateString("pt-BR")
                : "Removida",
              usuarioResponsavel: "Sistema", // Pode ser melhorado para capturar o usuário real
              observacoes: observacoes || undefined,
            },
          });
        } catch (historicoError) {
          console.error(
            "Erro ao registrar histórico da data limite:",
            historicoError
          );
          // Não falha a atualização se o histórico falhar
        }
      }
    }

    // Atualizar o status das tarefas do funcionário apenas se o status foi alterado
    if (status !== undefined) {
      await atualizarStatusTarefasFuncionario(
        tarefaAtual.remanejamentoFuncionarioId
      );
    }

    return NextResponse.json(tarefaAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar tarefa:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Excluir tarefa
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Buscar a tarefa para obter dados para o histórico
    const tarefa = await prisma.tarefaRemanejamento.findUnique({
      where: { id },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: { id: true, nome: true, matricula: true },
            },
          },
        },
      },
    });

    if (!tarefa) {
      return NextResponse.json(
        { error: "Tarefa não encontrada" },
        { status: 404 }
      );
    }

    await prisma.tarefaRemanejamento.delete({ where: { id } });

    // Registrar no histórico a exclusão
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: tarefa.remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: tarefa.remanejamentoFuncionarioId,
          tipoAcao: "EXCLUSAO",
          entidade: "TAREFA",
          descricaoAcao: `Tarefa "${tarefa.tipo}" excluída para ${tarefa.remanejamentoFuncionario.funcionario.nome} (${tarefa.remanejamentoFuncionario.funcionario.matricula})`,
          usuarioResponsavel: "Sistema",
        },
      });
    } catch (historicoError) {
      console.error(
        "Erro ao registrar histórico da exclusão da tarefa:",
        historicoError
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir tarefa:", error);
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
          } (via atualização de tarefa individual)`,
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
