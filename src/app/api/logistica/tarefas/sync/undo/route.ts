import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST - Desfazer reativações realizadas pela sincronização manual
 * Body opcional:
 * - windowMinutes?: number (default: 60) — janela de tempo para localizar reativações
 * 
 * Critérios de reversão:
 * - HistoricoRemanejamento com tipoAcao="REATIVACAO", entidade="TAREFA"
 * - dataAcao dentro da janela
 * - usuarioResponsavel em ["Sistema - Sincronização Manual", "Sistema"]
 * - A tarefa ainda está com status "PENDENTE"
 * - O último histórico da tarefa é a própria "REATIVACAO" (evita reverter alterações subsequentes)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const windowMinutes = Number(body?.windowMinutes ?? 60);
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const historicos = await prisma.historicoRemanejamento.findMany({
      where: {
        tipoAcao: "REATIVACAO",
        entidade: "TAREFA",
        dataAcao: { gte: since },
        usuarioResponsavel: { in: ["Sistema - Sincronização Manual", "Sistema"] },
      },
      select: {
        id: true,
        tarefaId: true,
        remanejamentoFuncionarioId: true,
        dataAcao: true,
      },
    });

    const tarefaIds = historicos
      .map((h) => h.tarefaId)
      .filter((id): id is string => typeof id === "string");

    if (tarefaIds.length === 0) {
      return NextResponse.json({
        message: "Nenhuma reativação encontrada na janela",
        reverted: 0,
      });
    }

    // Filtrar tarefas candidatas (ainda PENDENTE) e cuja última ação foi a reativação
    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where: { id: { in: tarefaIds }, status: "PENDENTE" },
      select: { id: true, remanejamentoFuncionarioId: true, status: true },
    });

    let reverted = 0;

    for (const tarefa of tarefas) {
      // Validar se o último histórico é REATIVACAO
      const lastHist = await prisma.historicoRemanejamento.findFirst({
        where: { tarefaId: tarefa.id },
        orderBy: { dataAcao: "desc" },
        select: { tipoAcao: true },
      });

      if (!lastHist || lastHist.tipoAcao !== "REATIVACAO") {
        continue;
      }

      // Reverter para CANCELADO
      await prisma.tarefaRemanejamento.update({
        where: { id: tarefa.id },
        data: { status: "CANCELADO" },
      });

      try {
        await prisma.observacaoTarefaRemanejamento.create({
          data: {
            tarefaId: tarefa.id,
            texto:
              "Desfeito automaticamente: reativação revertida (sincronização manual) dentro da janela configurada.",
            criadoPor: "Sistema",
            modificadoPor: "Sistema",
          },
        });
      } catch {}

      try {
        await prisma.historicoRemanejamento.create({
          data: {
            remanejamentoFuncionarioId: tarefa.remanejamentoFuncionarioId,
            tarefaId: tarefa.id,
            tipoAcao: "REVERTER",
            entidade: "TAREFA",
            campoAlterado: "status",
            valorAnterior: "PENDENTE",
            valorNovo: "CANCELADO",
            descricaoAcao:
              "Reversão automática de reativação por sincronização manual (janela de desfazer).",
            usuarioResponsavel: "Sistema",
          },
        });
      } catch {}

      reverted += 1;
    }

    return NextResponse.json({
      message: "Reversão concluída",
      reverted,
      windowMinutes,
    });
  } catch (error) {
    console.error("Erro ao desfazer reativações:", error);
    return NextResponse.json(
      { message: "Erro interno ao desfazer reativações" },
      { status: 500 }
    );
  }
}
