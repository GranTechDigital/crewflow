import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildTarefaWhere,
  parseFiltros,
  sortTarefasByDataLimite,
} from "../../../tarefas/_filters";

export const dynamic = "force-dynamic";

type TarefaComHistorico = {
  id: string;
  tarefaPadraoId: number | null;
  treinamentoId: number | null;
  tipo: string;
  responsavel: string;
  dataVencimento: Date | null;
  dataConclusao: Date | null;
  treinamento?: {
    validadeValor: number;
    validadeUnidade: string;
  } | null;
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function treinamentoExigeValidade(
  treinamento?: { validadeValor: number; validadeUnidade: string } | null,
) {
  if (!treinamento) return true;

  const unidade = normalizeText(treinamento.validadeUnidade).toLowerCase();
  const valor = Number(treinamento.validadeValor);
  const isUnico = unidade.includes("unico");
  const isMesZero =
    (unidade.includes("mes") || unidade.includes("meses")) &&
    Number.isFinite(valor) &&
    valor <= 0;

  return !(isUnico || isMesZero);
}

function tarefaInformaData(tarefa: TarefaComHistorico) {
  const responsavel = normalizeText(tarefa.responsavel);
  if (responsavel === "MEDICINA") return true;
  if (responsavel === "TREINAMENTO") {
    return treinamentoExigeValidade(tarefa.treinamento);
  }
  return false;
}

function isMesmaTarefa(a: TarefaComHistorico, b: TarefaComHistorico) {
  if (a.treinamentoId && b.treinamentoId) {
    return a.treinamentoId === b.treinamentoId;
  }
  if (a.tarefaPadraoId && b.tarefaPadraoId) {
    return a.tarefaPadraoId === b.tarefaPadraoId;
  }
  return normalizeText(a.responsavel) === normalizeText(b.responsavel)
    && normalizeText(a.tipo) === normalizeText(b.tipo);
}

function isVencimentoVencido(dataVencimento: Date) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(dataVencimento);
  vencimento.setHours(0, 0, 0, 0);
  return vencimento.getTime() < hoje.getTime();
}

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
        tarefaPadraoId: true,
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

    const remanejamentoAtual = await prisma.remanejamentoFuncionario.findUnique({
      where: { id: remanejamentoId },
      select: {
        funcionarioId: true,
      },
    });

    const tarefasComData = tarefas.filter((tarefa) =>
      tarefaInformaData(tarefa),
    );
    const historicoPorTarefaId = new Map<
      string,
      {
        tarefaId: string;
        remanejamentoFuncionarioId: string;
        dataVencimento: Date;
        dataConclusao: Date | null;
        status: string;
      }
    >();

    if (remanejamentoAtual && tarefasComData.length > 0) {
      const historicas = await prisma.tarefaRemanejamento.findMany({
        where: {
          remanejamentoFuncionarioId: { not: remanejamentoId },
          dataVencimento: { not: null },
          status: { not: "CANCELADO" },
          remanejamentoFuncionario: {
            funcionarioId: remanejamentoAtual.funcionarioId,
          },
        },
        select: {
          id: true,
          remanejamentoFuncionarioId: true,
          tarefaPadraoId: true,
          treinamentoId: true,
          tipo: true,
          responsavel: true,
          status: true,
          dataVencimento: true,
          dataConclusao: true,
          treinamento: {
            select: {
              validadeValor: true,
              validadeUnidade: true,
            },
          },
        },
      });

      for (const tarefa of tarefasComData) {
        let melhorHistorico: (typeof historicas)[number] | null = null;

        for (const historica of historicas) {
          if (!historica.dataVencimento) continue;
          if (!isMesmaTarefa(tarefa, historica)) continue;
          if (
            !melhorHistorico?.dataVencimento ||
            historica.dataVencimento.getTime() >
              melhorHistorico.dataVencimento.getTime()
          ) {
            melhorHistorico = historica;
          }
        }

        if (melhorHistorico?.dataVencimento) {
          historicoPorTarefaId.set(tarefa.id, {
            tarefaId: melhorHistorico.id,
            remanejamentoFuncionarioId:
              melhorHistorico.remanejamentoFuncionarioId,
            dataVencimento: melhorHistorico.dataVencimento,
            dataConclusao: melhorHistorico.dataConclusao,
            status: melhorHistorico.status,
          });
        }
      }
    }

    const tarefasOrdenadas = sortTarefasByDataLimite(
      tarefas.map((tarefa) => {
        const historico = historicoPorTarefaId.get(tarefa.id);
        return {
          ...tarefa,
          historicoDataAnterior: historico
            ? {
                ...historico,
                vencido: isVencimentoVencido(historico.dataVencimento),
              }
            : null,
        };
      }),
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
