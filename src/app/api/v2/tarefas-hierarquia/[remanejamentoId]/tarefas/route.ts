import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildTarefaWhere,
  parseFiltros,
  sortTarefasByDataLimite,
} from "../../../tarefas/_filters";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ remanejamentoId: string }> },
) {
  const startedAt = Date.now();

  try {
    const { remanejamentoId } = await params;
    const { searchParams } = new URL(request.url);
    const filtros = parseFiltros(searchParams);
    const tarefaWhere = buildTarefaWhere(filtros);

    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where: {
        AND: [tarefaWhere, { remanejamentoFuncionarioId: remanejamentoId }],
      },
      select: {
        id: true,
        remanejamentoFuncionarioId: true,
        treinamentoId: true,
        treinamento: {
          select: {
            validadeValor: true,
            validadeUnidade: true,
          },
        },
        tipo: true,
        descricao: true,
        responsavel: true,
        status: true,
        prioridade: true,
        dataCriacao: true,
        dataLimite: true,
        dataVencimento: true,
        dataConclusao: true,
        observacoes: true,
      },
    });

    const tarefasOrdenadas = sortTarefasByDataLimite(
      tarefas,
      filtros.ordenacaoDataLimite,
    );

    const payload = {
      items: tarefasOrdenadas,
      totalItems: tarefasOrdenadas.length,
      metrics: {
        durationMs: Date.now() - startedAt,
      },
    };

    return NextResponse.json({
      ...payload,
      metrics: {
        ...payload.metrics,
        payloadBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar tarefas do funcionário v2:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar tarefas do funcionário v2" },
      { status: 500 },
    );
  }
}
