import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET - Relatório das alterações registradas pela sincronização manual
 * Query params:
 * - windowMinutes?: number (default: 60) — janela de tempo para buscar eventos
 * - since?: string ISO — se informado, sobrescreve windowMinutes
 * - usuario?: string — filtra por usuarioResponsavel ("Sistema - Sincronização Manual" por padrão)
 *
 * Retorna itens agrupados por remanejamento, incluindo eventos de:
 * - CRIACAO, CANCELAMENTO, REATIVACAO, ATUALIZACAO_STATUS, REVERTER
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const windowMinutesParam = url.searchParams.get("windowMinutes");
    const sinceParam = url.searchParams.get("since");
    const usuarioParam = url.searchParams.get("usuario") || "";
    const remIdParam = url.searchParams.get("remId") || "";

    let since: Date;
    if (sinceParam) {
      const d = new Date(sinceParam);
      since = isNaN(d.getTime()) ? new Date(Date.now() - 60 * 60 * 1000) : d;
    } else {
      const mins = Number(windowMinutesParam ?? "60");
      since = new Date(Date.now() - mins * 60 * 1000);
    }

    const where: any = {
      dataAcao: { gte: since },
      tipoAcao: {
        in: [
          "CRIACAO",
          "CANCELAMENTO",
          "REATIVACAO",
          "ATUALIZACAO_STATUS",
          "REVERTER",
        ],
      },
    };
    if (usuarioParam) {
      where.usuarioResponsavel = usuarioParam;
    }
    if (remIdParam) {
      where.remanejamentoFuncionarioId = remIdParam;
    }

    const historicos = await prisma.historicoRemanejamento.findMany({
      where,
      select: {
        id: true,
        solicitacaoId: true,
        remanejamentoFuncionarioId: true,
        tarefaId: true,
        tipoAcao: true,
        entidade: true,
        campoAlterado: true,
        valorAnterior: true,
        valorNovo: true,
        descricaoAcao: true,
        dataAcao: true,
        usuarioResponsavel: true,
      },
      orderBy: { dataAcao: "desc" },
    });

    // Agrupar por remanejamento
    const map = new Map<
      string,
      Array<{
        id: number;
        solicitacaoId: number | null;
        remanejamentoFuncionarioId: string | null;
        tarefaId: string | null;
        tipoAcao: string;
        entidade: string | null;
        campoAlterado: string | null;
        valorAnterior: string | null;
        valorNovo: string | null;
        descricaoAcao: string | null;
        dataAcao: Date;
        usuarioResponsavel: string | null;
      }>
    >();

    for (const h of historicos) {
      const key = h.remanejamentoFuncionarioId || "desconhecido";
      const arr = map.get(key) || [];
      arr.push(h as any);
      map.set(key, arr);
    }

    const detalhes = Array.from(map.entries()).map(([remId, items]) => ({
      remanejamentoId: remId,
      eventos: items,
    }));

    return NextResponse.json(
      {
        since: since.toISOString(),
        usuarioFiltro: usuarioParam || null,
        remIdFiltro: remIdParam || null,
        totalEventos: historicos.length,
        totalRemanejamentos: detalhes.length,
        detalhes,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao gerar relatório de sincronização:", error);
    return NextResponse.json(
      { message: "Erro interno ao gerar relatório de sincronização" },
      { status: 500 }
    );
  }
}
