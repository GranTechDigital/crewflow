import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Aprovar todas as tarefas de um funcionário (para teste)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ funcionarioId: string }> }
) {
  try {
    const { funcionarioId } = await params;

    const { getUserFromRequest } = await import("@/utils/authUtils");
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!funcionarioId) {
      return NextResponse.json(
        { error: "ID do funcionário é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar o funcionário e suas tarefas
    const remanejamentoFuncionario = await prisma.remanejamentoFuncionario.findUnique({
      where: { id: funcionarioId },
      include: {
        tarefas: {
          where: {
            status: { not: "CONCLUIDO" }
          }
        },
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
        { error: "Funcionário não encontrado" },
        { status: 404 }
      );
    }

    const tarefasPendentes = remanejamentoFuncionario.tarefas;

    if (tarefasPendentes.length === 0) {
      return NextResponse.json(
        { 
          message: "Nenhuma tarefa pendente encontrada",
          tarefasAprovadas: 0
        },
        { status: 200 }
      );
    }

    // Aprovar todas as tarefas pendentes
    const dataAtual = new Date();
    const tarefasIds = tarefasPendentes.map(t => t.id);

    await prisma.tarefaRemanejamento.updateMany({
      where: {
        id: { in: tarefasIds }
      },
      data: {
        status: "CONCLUIDO",
        dataConclusao: dataAtual,
        observacoes: "Aprovado automaticamente para teste"
      }
    });

    // Registrar eventos de status por tarefa
    try {
      if (tarefasPendentes.length > 0) {
        await prisma.tarefaStatusEvento.createMany({
          data: tarefasPendentes.map((t) => ({
            tarefaId: t.id,
            remanejamentoFuncionarioId: funcionarioId,
            statusAnterior: t.status,
            statusNovo: "CONCLUIDO",
            observacoes: "Aprovado automaticamente (lote)",
            usuarioResponsavelId: usuarioAutenticado?.id ?? null,
            equipeId: usuarioAutenticado?.equipeId ?? null,
          })),
          skipDuplicates: true,
        });
      }
    } catch (eventoError) {
      console.error("Erro ao registrar eventos de status em lote:", eventoError);
    }

    // Atualizar o status geral do funcionário para SUBMETER RASCUNHO
    await prisma.remanejamentoFuncionario.update({
      where: { id: funcionarioId },
      data: {
        statusTarefas: "SUBMETER RASCUNHO"
      }
    });

    // Registrar no histórico
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: funcionarioId,
          tipoAcao: "APROVACAO_LOTE_TAREFAS",
          entidade: "TAREFAS",
          descricaoAcao: `Todas as tarefas foram aprovadas automaticamente para teste (${tarefasPendentes.length} tarefas)`,
          campoAlterado: "status",
          valorNovo: "CONCLUIDO",
          usuarioResponsavel: usuarioAutenticado?.funcionario?.nome || "Sistema",
          usuarioResponsavelId: usuarioAutenticado?.id,
          equipeId: usuarioAutenticado?.equipeId,
        },
      });

      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: funcionarioId,
          tipoAcao: "ATUALIZACAO_STATUS",
          entidade: "STATUS_TAREFAS",
          descricaoAcao: "Status geral atualizado para SUBMETER RASCUNHO após aprovação de todas as tarefas",
          campoAlterado: "statusTarefas",
          valorNovo: "SUBMETER RASCUNHO",
          usuarioResponsavel: usuarioAutenticado?.funcionario?.nome || "Sistema",
          usuarioResponsavelId: usuarioAutenticado?.id,
          equipeId: usuarioAutenticado?.equipeId,
        },
      });
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
    }

    return NextResponse.json({
      message: `Todas as tarefas de ${remanejamentoFuncionario.funcionario.nome} foram aprovadas com sucesso`,
      tarefasAprovadas: tarefasPendentes.length,
      novoStatus: "SUBMETER RASCUNHO"
    });

  } catch (error) {
    console.error("Erro ao aprovar todas as tarefas:", error);
    return NextResponse.json(
      { 
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}