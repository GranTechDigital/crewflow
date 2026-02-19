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
          where: { status: { not: "CONCLUIDO" } },
          select: { id: true, status: true }
        },
        funcionario: { select: { id: true, nome: true, matricula: true } }
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
        // Carregar metadados necessários para equipe/setor
        const tarefasDetalhadas = await prisma.tarefaRemanejamento.findMany({
          where: { id: { in: tarefasPendentes.map(t => t.id) } },
          select: { id: true, tarefaPadraoId: true, treinamentoId: true, responsavel: true, tipo: true, descricao: true }
        });
        const eventosData = [] as any[];
        for (const t of tarefasDetalhadas) {
          let setorBase = '';
          const tpId = t.tarefaPadraoId;
          const trId = t.treinamentoId;
          if (trId) setorBase = 'TREINAMENTO';
          if (!setorBase && tpId) {
            const tp = await prisma.tarefaPadrao.findUnique({ where: { id: tpId }, select: { setor: true } });
            setorBase = tp?.setor || '';
          }
          if (!setorBase) setorBase = t.responsavel || t.tipo || t.descricao || '';
          const eqId = await findEquipeIdBySetor(detectSetor(setorBase));
          if (eqId) {
            try {
              await prisma.tarefaRemanejamento.update({
                where: { id: t.id },
                data: ({ setor: { connect: { id: eqId } } } as any),
              });
            } catch {}
          }
          eventosData.push({
            tarefaId: t.id,
            remanejamentoFuncionarioId: funcionarioId,
            statusAnterior: tarefasPendentes.find(x => x.id === t.id)?.status ?? 'PENDENTE',
            statusNovo: 'CONCLUIDO',
            observacoes: 'Aprovado automaticamente (lote)',
            usuarioResponsavelId: usuarioAutenticado?.id ?? null,
          });
        }
        await prisma.tarefaStatusEvento.createMany({ data: eventosData, skipDuplicates: true });
      }
    } catch (eventoError) {
      console.error("Erro ao registrar eventos de status em lote:", eventoError);
    }

    // Recalcular o status geral considerando regra especial Treinamento 0/0
    const tarefasAtual = await prisma.tarefaRemanejamento.findMany({
      where: { remanejamentoFuncionarioId: funcionarioId },
    });

    const todasConcluidas =
      tarefasAtual.length === 0 ||
      tarefasAtual.every(
        (tarefa) =>
          tarefa.status === "CONCLUIDO" ||
          tarefa.status === "CONCLUIDA" ||
          tarefa.status === "CANCELADO"
      );

    const temTreinamentoAtivo = tarefasAtual.some(
      (t) =>
        t.status !== "CANCELADO" &&
        (t.responsavel || "").toUpperCase().includes("TREIN")
    );

    const statusAnterior = remanejamentoFuncionario.statusTarefas;
    let novoStatus: "SUBMETER RASCUNHO" | "ATENDER TAREFAS" = todasConcluidas
      ? "SUBMETER RASCUNHO"
      : "ATENDER TAREFAS";

    let aplicarDevolucaoTreinamento = false;
    if (
      remanejamentoFuncionario.responsavelAtual === "LOGISTICA" &&
      !temTreinamentoAtivo
    ) {
      novoStatus = "ATENDER TAREFAS";
      aplicarDevolucaoTreinamento = true;
    }

    const dadosUpdate: Record<string, unknown> = {
      statusTarefas: novoStatus,
    };

    await prisma.remanejamentoFuncionario.update({
      where: { id: funcionarioId },
      data: dadosUpdate,
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
          descricaoAcao: `Status geral atualizado para ${novoStatus} após aprovação de todas as tarefas`,
          campoAlterado: "statusTarefas",
          valorNovo: novoStatus,
          usuarioResponsavel: usuarioAutenticado?.funcionario?.nome || "Sistema",
          usuarioResponsavelId: usuarioAutenticado?.id,
          equipeId: usuarioAutenticado?.equipeId,
        },
      });
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
    }

    if (aplicarDevolucaoTreinamento) {
      const textoDevolucao =
        "Devolvido para TREINAMENTO automaticamente: Nenhuma tarefa de treinamento gerada (Matriz inexistente ou vazia). Necessário criar matriz.";
      try {
        await prisma.observacaoRemanejamentoFuncionario.create({
          data: {
            remanejamentoFuncionarioId: funcionarioId,
            texto: `${textoDevolucao} Data: ${new Date().toISOString()}`,
            criadoPor: usuarioAutenticado?.funcionario?.nome || "Sistema",
            modificadoPor: usuarioAutenticado?.funcionario?.nome || "Sistema",
          },
        });
      } catch (e) {
        console.error(
          "Erro ao criar observação de devolução para Treinamento (aprovar-todas):",
          e
        );
      }
    }

    return NextResponse.json({
      message: `Todas as tarefas de ${remanejamentoFuncionario.funcionario.nome} foram aprovadas com sucesso`,
      tarefasAprovadas: tarefasPendentes.length,
      novoStatus,
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
