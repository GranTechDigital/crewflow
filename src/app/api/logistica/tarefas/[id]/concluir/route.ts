import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT - Concluir tarefa
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { getUserFromRequest } = await import("@/utils/authUtils");
    const usuarioAutenticado = await getUserFromRequest(request);

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

    // Verificar exceção para Treinamento vitalício (validadeUnidade = "unico")
    let isTreinamentoVitalicio = false;
    if (tarefaAtual.responsavel === "TREINAMENTO") {
      try {
        const treinamento = await prisma.treinamentos.findFirst({
          where: { treinamento: tarefaAtual.tipo },
          select: { validadeUnidade: true },
        });
        const unidade = (treinamento?.validadeUnidade || "").toLowerCase();
        isTreinamentoVitalicio = unidade === "unico" || unidade === "unicos";
      } catch (e) {
        console.warn("Falha ao verificar validade do treinamento:", e);
      }
    }

    // Regra de negócio: data de vencimento obrigatória exceto para RH e Treinamento vitalício
    if (tarefaAtual.responsavel !== "RH" && !isTreinamentoVitalicio && !dataVencimento) {
      return NextResponse.json(
        { error: "Data de vencimento é obrigatória para concluir a tarefa (exceto RH e treinamentos vitalícios)." },
        { status: 400 }
      );
    }

    // Regra D+30: data de vencimento deve ser >= hoje + 30 dias (exceto RH e treinamentos vitalícios)
    if (tarefaAtual.responsavel !== "RH" && !isTreinamentoVitalicio && dataVencimento) {
      const parseYYYYMMDDToUTC = (s: string) => {
        const [y, m, d] = s.split("-").map(Number);
        return Date.UTC(y, m - 1, d);
      };
      const today = new Date();
      const minLocal = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      minLocal.setDate(minLocal.getDate() + 30);
      const minUTC = Date.UTC(
        minLocal.getFullYear(),
        minLocal.getMonth(),
        minLocal.getDate()
      );
      const selectedUTC = parseYYYYMMDDToUTC(dataVencimento);
      if (selectedUTC < minUTC) {
        return NextResponse.json(
          { error: "Data de vencimento deve ser pelo menos 30 dias após hoje." },
          { status: 400 }
        );
      }
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
          usuarioResponsavel: usuarioAutenticado?.funcionario?.nome || "Sistema",
        },
      });
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
    }

    // Atualizar o status das tarefas do funcionário
    await atualizarStatusTarefasFuncionario(
      tarefaAtual.remanejamentoFuncionarioId,
      usuarioAutenticado?.funcionario?.nome || "Sistema"
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
  remanejamentoFuncionarioId: string,
  usuarioResponsavelNome: string
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
    const statusAnterior = remanejamentoFuncionario.statusTarefas;
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
          usuarioResponsavel: usuarioResponsavelNome,
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
