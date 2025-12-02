import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logHistorico } from "@/lib/historico";

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
      where: { id },
      select: {
        id: true,
        remanejamentoFuncionarioId: true,
        tarefaPadraoId: true,
        treinamentoId: true,
        tipo: true,
        descricao: true,
        responsavel: true,
        status: true,
        dataLimite: true,
        dataVencimento: true,
        dataConclusao: true,
        remanejamentoFuncionario: {
          select: {
            funcionario: { select: { id: true, nome: true, matricula: true, funcao: true } },
            solicitacaoId: true,
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

    // Regra D+30: data de vencimento deve ser >= hoje + 30 dias (exceto RH)
    if (tarefaAtual.responsavel !== "RH" && dataVencimento) {
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
    let tarefaAtualizada = await prisma.tarefaRemanejamento.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        remanejamentoFuncionarioId: true,
        tarefaPadraoId: true,
        treinamentoId: true,
        tipo: true,
        descricao: true,
        responsavel: true,
        status: true,
        dataLimite: true,
        dataVencimento: true,
        dataConclusao: true,
        observacoes: true,
        remanejamentoFuncionario: {
          select: {
            funcionario: { select: { id: true, nome: true, matricula: true, funcao: true } },
            solicitacaoId: true,
          },
        },
      },
    });

    // Registrar no histórico
    try {
      await logHistorico(request, {
        solicitacaoId: tarefaAtualizada.remanejamentoFuncionario.solicitacaoId,
        remanejamentoFuncionarioId: tarefaAtualizada.remanejamentoFuncionarioId,
        tarefaId: tarefaAtualizada.id,
        tipoAcao: "ATUALIZACAO_STATUS",
        entidade: "TAREFA",
        descricaoAcao: `Tarefa "${tarefaAtualizada.tipo}" concluída para ${tarefaAtualizada.remanejamentoFuncionario.funcionario.nome} (${tarefaAtualizada.remanejamentoFuncionario.funcionario.matricula})`,
        campoAlterado: "status",
        valorAnterior: tarefaAtual.status,
        valorNovo: "CONCLUIDO",
      })
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
    }

    try {
      const norm = (s: string | null | undefined) => (s || '').normalize('NFD').replace(/[^A-Za-z0-9\s]/g, '').trim().toUpperCase();
      const detectSetor = (s: string | null | undefined) => {
        const v = norm(s);
        if (!v) return '';
        if (v.includes('TREIN')) return 'TREINAMENTO';
        if (v.includes('MEDIC')) return 'MEDICINA';
        if (v.includes('RECURSOS') || v.includes('HUMANOS') || v.includes(' RH') || v === 'RH' || v.includes('RH')) return 'RH';
        return v;
      };
      async function findEquipeIdBySetor(setor: string) {
        const s = norm(setor);
        if (!s) return null;
        if (s === 'RH') {
          const e = await prisma.equipe.findFirst({ where: { OR: [{ nome: { contains: 'RH', mode: 'insensitive' } }, { nome: { contains: 'RECURSOS', mode: 'insensitive' } }, { nome: { contains: 'HUMANOS', mode: 'insensitive' } }] }, select: { id: true } });
          return e?.id ?? null;
        }
        if (s === 'MEDICINA') {
          const e = await prisma.equipe.findFirst({ where: { nome: { contains: 'MEDIC', mode: 'insensitive' } }, select: { id: true } });
          return e?.id ?? null;
        }
        if (s === 'TREINAMENTO') {
          const e = await prisma.equipe.findFirst({ where: { nome: { contains: 'TREIN', mode: 'insensitive' } }, select: { id: true } });
          return e?.id ?? null;
        }
        const e = await prisma.equipe.findFirst({ where: { nome: { equals: s, mode: 'insensitive' } }, select: { id: true } });
        return e?.id ?? null;
      }
      let setorBase = '';
      if (tarefaAtualizada.treinamentoId) setorBase = 'TREINAMENTO';
      if (!setorBase && tarefaAtualizada.tarefaPadraoId) {
        const tp = await prisma.tarefaPadrao.findUnique({ where: { id: tarefaAtualizada.tarefaPadraoId }, select: { setor: true } });
        setorBase = tp?.setor || '';
      }
      if (!setorBase) setorBase = tarefaAtualizada.responsavel || tarefaAtualizada.tipo || tarefaAtualizada.descricao || '';
      const eqId = await findEquipeIdBySetor(detectSetor(setorBase));
      if (eqId) {
        try {
          tarefaAtualizada = await prisma.tarefaRemanejamento.update({
            where: { id: tarefaAtualizada.id },
            data: { setorId: eqId },
            select: {
              id: true,
              remanejamentoFuncionarioId: true,
              tarefaPadraoId: true,
              treinamentoId: true,
              tipo: true,
              descricao: true,
              responsavel: true,
              status: true,
              dataLimite: true,
              dataVencimento: true,
              dataConclusao: true,
              observacoes: true,
              remanejamentoFuncionario: {
                select: {
                  funcionario: {
                    select: { id: true, nome: true, matricula: true, funcao: true },
                  },
                  solicitacaoId: true,
                },
              },
            },
          });
        } catch {}
      }
      await prisma.tarefaStatusEvento.create({
        data: {
          tarefaId: tarefaAtualizada.id,
          remanejamentoFuncionarioId: tarefaAtualizada.remanejamentoFuncionarioId,
          statusAnterior: tarefaAtual.status,
          statusNovo: 'CONCLUIDO',
          observacoes: undefined,
          usuarioResponsavelId: usuarioAutenticado?.id ?? undefined,
        },
      });
    } catch (eventoError) {
      console.error("Erro ao registrar evento de status da tarefa:", eventoError)
    }

    // Atualizar o status das tarefas do funcionário
    await atualizarStatusTarefasFuncionario(
      tarefaAtual.remanejamentoFuncionarioId,
      usuarioAutenticado?.id
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
  usuarioResponsavelId?: number
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
      await logHistorico({} as any, {
        solicitacaoId: remanejamentoFuncionario.solicitacaoId,
        remanejamentoFuncionarioId: remanejamentoFuncionarioId,
        tipoAcao: "ATUALIZACAO_STATUS",
        entidade: "STATUS_TAREFAS",
        descricaoAcao: `Status geral das tarefas atualizado para: ${
          todasConcluidas ? "SUBMETER RASCUNHO" : "ATENDER TAREFAS"
        } (via conclusão de tarefa)`,
        campoAlterado: "statusTarefas",
        valorNovo: todasConcluidas ? "SUBMETER RASCUNHO" : "ATENDER TAREFAS",
      })
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
        remanejamentoFuncionario.solicitacaoId,
        usuarioResponsavelId
      );
    }
  } catch (error) {
    console.error("Erro ao atualizar status das tarefas:", error);
  }
}

// Função para verificar se toda a solicitação pode ser marcada como concluída
async function verificarConclusaoSolicitacao(
  solicitacaoId: number,
  usuarioResponsavelId?: number
) {
  try {
    // Buscar todos os funcionários da solicitação
    const funcionarios = await prisma.remanejamentoFuncionario.findMany({
      where: {
        solicitacaoId,
      },
    });

    // Verificar se todos os funcionários têm SUBMETER RASCUNHO E Prestserv aprovado
    const todosProntos = funcionarios.every(
      (f) => f.statusTarefas === "SUBMETER RASCUNHO" && f.statusPrestserv === "APROVADO"
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
          ...(usuarioResponsavelId
            ? { atualizadoPorUsuario: { connect: { id: usuarioResponsavelId } } }
            : {}),
          ...(usuarioResponsavelId
            ? { concluidoPorUsuario: { connect: { id: usuarioResponsavelId } } }
            : {}),
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