import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NovaTarefaRemanejamento } from "@/types/remanejamento-funcionario";
import { Prisma } from "@prisma/client";

// GET - Listar tarefas de remanejamento
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const remanejamentoFuncionarioId = searchParams.get(
      "remanejamentoFuncionarioId"
    );
    const responsavel = searchParams.get("responsavel");
    const status = searchParams.get("status");

    const where: Prisma.TarefaRemanejamentoWhereInput = {};

    if (remanejamentoFuncionarioId) {
      where.remanejamentoFuncionarioId = remanejamentoFuncionarioId;
    }

    if (responsavel) {
      where.responsavel = responsavel;
    }

    if (status) {
      where.status = status;
    }

    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where,
      include: {
        observacoesTarefa: true,
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
                funcao: true,
                status: true,
                statusPrestserv: true,
                emMigracao: true,
              },
            },
            solicitacao: {
              select: {
                id: true,
                contratoOrigemId: true,
                contratoDestinoId: true,
                contratoOrigem: {
                  select: {
                    id: true,
                    nome: true,
                    numero: true,
                  },
                },
                contratoDestino: {
                  select: {
                    id: true,
                    nome: true,
                    numero: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        dataCriacao: "desc",
      },
    });

    return NextResponse.json(tarefas);
  } catch (error) {
    console.error("Erro ao buscar tarefas:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST - Criar nova tarefa de remanejamento
export async function POST(request: NextRequest) {
  try {
    const body: NovaTarefaRemanejamento = await request.json();

    const {
      remanejamentoFuncionarioId,
      tipo,
      descricao,
      responsavel,
      prioridade = "Normal",
      dataLimite,
      dataVencimento,
    } = body;

    // Validações básicas
    if (!remanejamentoFuncionarioId) {
      return NextResponse.json(
        { error: "ID do remanejamento do funcionário é obrigatório" },
        { status: 400 }
      );
    }

    if (!tipo) {
      return NextResponse.json(
        { error: "Tipo da tarefa é obrigatório" },
        { status: 400 }
      );
    }

    if (!responsavel) {
      return NextResponse.json(
        { error: "Responsável é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se o funcionário em remanejamento existe
    const remanejamentoFuncionario =
      await prisma.remanejamentoFuncionario.findUnique({
        where: {
          id: remanejamentoFuncionarioId,
        },
      });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Funcionário em remanejamento não encontrado" },
        { status: 404 }
      );
    }

    // Validar se é possível reprovar tarefas baseado no status do prestserv
    if (
      remanejamentoFuncionario.statusPrestserv === "EM_AVALIACAO" ||
      remanejamentoFuncionario.statusPrestserv === "CONCLUIDO"
    ) {
      return NextResponse.json(
        {
          error:
            "Não é possível criar novas tarefas quando o prestserv está em avaliação ou concluído",
        },
        { status: 400 }
      );
    }

    // Criar a tarefa
    const tarefa = await prisma.tarefaRemanejamento.create({
      data: {
        remanejamentoFuncionarioId,
        tipo,
        descricao,
        responsavel,
        prioridade,
        ...(dataLimite && { dataLimite: new Date(dataLimite) }),
        ...(dataVencimento && { dataVencimento: new Date(dataVencimento) }),
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

    // Registrar no histórico
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: remanejamentoFuncionarioId,
          tipoAcao: "CRIACAO",
          entidade: "TAREFA",
          descricaoAcao: `Nova tarefa "${tipo}" criada para ${tarefa.remanejamentoFuncionario.funcionario.nome} (${tarefa.remanejamentoFuncionario.funcionario.matricula})`,
          usuarioResponsavel: responsavel,
          observacoes: descricao || undefined,
        },
      });
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
      // Não falha a criação da tarefa se o histórico falhar
    }

    // Atualizar o status das tarefas do funcionário
    await atualizarStatusTarefasFuncionario(remanejamentoFuncionarioId);

    return NextResponse.json(tarefa, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar tarefa:", error);
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

    // Atualizar o status das tarefas do funcionário
    await prisma.remanejamentoFuncionario.update({
      where: {
        id: remanejamentoFuncionarioId,
      },
      data: {
        statusTarefas: todasConcluidas
          ? "SOLICITAÇÃO CONCLUÍDA"
          : "ATENDER TAREFAS",
      },
    });

    // Atualizar também o responsável atual baseado no novo status
    const remanejamentoAtualizado =
      await prisma.remanejamentoFuncionario.findUnique({
        where: { id: remanejamentoFuncionarioId },
      });

    if (remanejamentoAtualizado) {
      // Registrar no histórico a mudança de status das tarefas
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: remanejamentoAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: remanejamentoFuncionarioId,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "STATUS_TAREFAS",
            descricaoAcao: `Status geral das tarefas atualizado para: ${
              todasConcluidas ? "SOLICITAÇÃO CONCLUÍDA" : "ATENDER TAREFAS"
            }`,
            campoAlterado: "statusTarefas",
            valorNovo: todasConcluidas
              ? "SOLICITAÇÃO CONCLUÍDA"
              : "ATENDER TAREFAS",
            usuarioResponsavel: "Sistema",
          },
        });
      } catch (historicoError) {
        console.error(
          "Erro ao registrar histórico de status das tarefas:",
          historicoError
        );
      }
    }
  } catch (error) {
    console.error("Erro ao atualizar status das tarefas:", error);
  }
}
