import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTarefaWhere, parseFiltros, sortResumoItems } from "../tarefas/_filters";

export const dynamic = "force-dynamic";

type Resumo = {
  total: number;
  pendentes: number;
  concluidas: number;
  reprovadas: number;
  atrasadas: number;
  ultimaAtualizacao: number;
  dataLimite: number | null;
};

function initResumo(): Resumo {
  return {
    total: 0,
    pendentes: 0,
    concluidas: 0,
    reprovadas: 0,
    atrasadas: 0,
    ultimaAtualizacao: 0,
    dataLimite: null,
  };
}

type TotaisResumo = {
  totalFuncionarios: number;
  totalPendencias: number;
  totalPendenciasNoPrazo: number;
  totalPendenciasForaPrazo: number;
  totalAtrasadas: number;
  totalConcluidas: number;
  totalReprovadas: number;
  totalTarefas: number;
};

const AUDITORIA_INTERVALO_MS = 5 * 60 * 1000;
let ultimaAuditoriaPendenciasForaAtender = 0;

function initTotaisResumo(): TotaisResumo {
  return {
    totalFuncionarios: 0,
    totalPendencias: 0,
    totalPendenciasNoPrazo: 0,
    totalPendenciasForaPrazo: 0,
    totalAtrasadas: 0,
    totalConcluidas: 0,
    totalReprovadas: 0,
    totalTarefas: 0,
  };
}

async function auditarPendenciasForaAtender() {
  const agora = Date.now();
  if (
    agora - ultimaAuditoriaPendenciasForaAtender <
    AUDITORIA_INTERVALO_MS
  ) {
    return;
  }
  ultimaAuditoriaPendenciasForaAtender = agora;

  try {
    const totalForaAtender = await prisma.tarefaRemanejamento.count({
      where: {
        status: { in: ["PENDENTE", "EM_ANDAMENTO", "REPROVADO"] },
        remanejamentoFuncionario: {
          statusTarefas: { not: "ATENDER TAREFAS" },
        },
      },
    });

    if (totalForaAtender > 0) {
      console.warn(
        `[tarefas-v2] Auditoria: ${totalForaAtender} tarefa(s) pendente(s) fora de ATENDER TAREFAS.`,
      );
    }
  } catch (error) {
    console.error(
      "[tarefas-v2] Falha ao executar auditoria de pendências fora de ATENDER TAREFAS:",
      error,
    );
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    await auditarPendenciasForaAtender();
    const { searchParams } = new URL(request.url);
    const filtros = parseFiltros(searchParams);
    const tarefaWhere = buildTarefaWhere(filtros);
    const resumoGeral = initTotaisResumo();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const tarefasFiltradas = await prisma.tarefaRemanejamento.findMany({
      where: tarefaWhere,
      select: {
        remanejamentoFuncionarioId: true,
        status: true,
        dataLimite: true,
        dataCriacao: true,
      },
    });

    const resumoPorRemanejamento = new Map<string, Resumo>();
    for (const tarefa of tarefasFiltradas) {
      const remId = tarefa.remanejamentoFuncionarioId;
      const resumo = resumoPorRemanejamento.get(remId) || initResumo();

      resumo.total += 1;
      const status = (tarefa.status || "").toUpperCase();
      if (status === "REPROVADO") resumo.reprovadas += 1;
      if (status === "PENDENTE") resumo.pendentes += 1;
      if (status === "CONCLUIDO" || status === "CONCLUIDA") resumo.concluidas += 1;

      resumoGeral.totalTarefas += 1;
      if (status === "REPROVADO") resumoGeral.totalReprovadas += 1;
      if (status === "PENDENTE" || status === "REPROVADO")
        resumoGeral.totalPendencias += 1;
      if (status === "CONCLUIDO" || status === "CONCLUIDA")
        resumoGeral.totalConcluidas += 1;

      const dataLimite = tarefa.dataLimite ? new Date(tarefa.dataLimite) : null;
      const concluida = status === "CONCLUIDO" || status === "CONCLUIDA";
      if (dataLimite && status === "PENDENTE" && dataLimite.getTime() < hoje.getTime()) {
        resumo.atrasadas += 1;
        resumoGeral.totalAtrasadas += 1;
        resumoGeral.totalPendenciasForaPrazo += 1;
      } else if (status === "PENDENTE") {
        resumoGeral.totalPendenciasNoPrazo += 1;
      }
      if (dataLimite && !concluida) {
        const dataLimiteMs = dataLimite.getTime();
        if (resumo.dataLimite === null || dataLimiteMs < resumo.dataLimite) {
          resumo.dataLimite = dataLimiteMs;
        }
      }

      const dataCriacaoMs = tarefa.dataCriacao
        ? new Date(tarefa.dataCriacao).getTime()
        : 0;
      if (dataCriacaoMs > resumo.ultimaAtualizacao) {
        resumo.ultimaAtualizacao = dataCriacaoMs;
      }

      resumoPorRemanejamento.set(remId, resumo);
    }
    const remanejamentoIds = Array.from(resumoPorRemanejamento.keys());
    resumoGeral.totalFuncionarios = remanejamentoIds.length;
    if (remanejamentoIds.length === 0) {
      return NextResponse.json({
        items: [],
        totalItems: 0,
        totalPages: 0,
        page: filtros.page,
        limit: filtros.limit,
        resumoFiltrado: initTotaisResumo(),
        resumoGeral,
        metrics: {
          durationMs: Date.now() - startedAt,
          payloadBytes: 0,
          totalTarefasFiltradas: 0,
        },
      });
    }

    const remanejamentos = await prisma.remanejamentoFuncionario.findMany({
      where: {
        id: { in: remanejamentoIds },
      },
      select: {
        id: true,
        statusTarefas: true,
        statusPrestserv: true,
        observacoesPrestserv: true,
        updatedAt: true,
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            funcao: true,
            contrato: {
              select: {
                id: true,
                numero: true,
                nome: true,
              },
            },
            funcaoRef: {
              select: {
                regime: true,
              },
            },
            dataAdmissao: true,
            status: true,
            statusPrestserv: true,
            emMigracao: true,
          },
        },
        solicitacao: {
          select: {
            id: true,
            tipo: true,
            status: true,
            prioridade: true,
            contratoOrigemId: true,
            contratoDestinoId: true,
            contratoOrigem: {
              select: {
                id: true,
                numero: true,
                nome: true,
              },
            },
            contratoDestino: {
              select: {
                id: true,
                numero: true,
                nome: true,
              },
            },
          },
        },
      },
    });

    const setoresEscopo =
      filtros.setores.length > 0
        ? filtros.setores
        : ["RH", "MEDICINA", "TREINAMENTO"];

    const remComPendenciasNoEscopo = await prisma.tarefaRemanejamento.findMany({
      where: {
        remanejamentoFuncionarioId: { in: remanejamentoIds },
        status: { in: ["PENDENTE", "REPROVADO"] },
        responsavel: { in: setoresEscopo },
      },
      select: {
        remanejamentoFuncionarioId: true,
      },
      distinct: ["remanejamentoFuncionarioId"],
    });
    const remComPendenciasSet = new Set(
      remComPendenciasNoEscopo.map((item) => item.remanejamentoFuncionarioId),
    );

    const resumoFiltradoVisivel = initTotaisResumo();
    const remIdsFiltradoVisivel = new Set<string>();
    for (const tarefa of tarefasFiltradas) {
      const remId = tarefa.remanejamentoFuncionarioId;
      if (!remComPendenciasSet.has(remId)) continue;
      remIdsFiltradoVisivel.add(remId);

      const status = (tarefa.status || "").toUpperCase();
      resumoFiltradoVisivel.totalTarefas += 1;

      if (status === "PENDENTE") {
        resumoFiltradoVisivel.totalPendencias += 1;
        const dataLimite = tarefa.dataLimite ? new Date(tarefa.dataLimite) : null;
        if (dataLimite) {
          dataLimite.setHours(0, 0, 0, 0);
        }
        if (dataLimite && dataLimite.getTime() < hoje.getTime()) {
          resumoFiltradoVisivel.totalPendenciasForaPrazo += 1;
        } else {
          resumoFiltradoVisivel.totalPendenciasNoPrazo += 1;
        }
      }
      if (status === "CONCLUIDO" || status === "CONCLUIDA") {
        resumoFiltradoVisivel.totalConcluidas += 1;
      }
        if (status === "REPROVADO") {
        resumoFiltradoVisivel.totalPendencias += 1;
        resumoFiltradoVisivel.totalReprovadas += 1;
      }
      const dataLimite = tarefa.dataLimite ? new Date(tarefa.dataLimite) : null;
      if (
        dataLimite &&
        status === "PENDENTE" &&
        dataLimite.getTime() < hoje.getTime()
      ) {
        resumoFiltradoVisivel.totalAtrasadas += 1;
      }
    }
    resumoFiltradoVisivel.totalFuncionarios = remIdsFiltradoVisivel.size;

    const enriched = remanejamentos
      .filter((item) => remComPendenciasSet.has(item.id))
      .map((item) => {
        const resumo = resumoPorRemanejamento.get(item.id);
        if (!resumo) return null;

        const pendencias = resumo.pendentes + resumo.reprovadas;
        const progresso =
          resumo.total > 0 ? Math.round((resumo.concluidas / resumo.total) * 100) : 0;
        const ultimaAtualizacao = Math.max(
          resumo.ultimaAtualizacao,
          item.updatedAt ? new Date(item.updatedAt).getTime() : 0,
        );

        return {
          remanejamentoId: item.id,
          funcionarioNome: item.funcionario.nome || "",
          ultimaAtualizacao,
          pendencias,
          progresso,
          data: {
            ...item,
            funcionario: {
              ...item.funcionario,
              regime: item.funcionario.funcaoRef?.regime || null,
            },
            resumo: {
              total: resumo.total,
              pendentes: resumo.pendentes,
              concluidas: resumo.concluidas,
              reprovadas: resumo.reprovadas,
              atrasadas: resumo.atrasadas,
              pendencias,
              progresso,
              ultimaAtualizacao: new Date(ultimaAtualizacao).toISOString(),
              dataLimite:
                resumo.dataLimite !== null
                  ? new Date(resumo.dataLimite).toISOString()
                  : null,
            },
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const sorted = sortResumoItems(enriched, filtros.ordenacaoFuncionarios);

    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / filtros.limit);
    const start = (filtros.page - 1) * filtros.limit;
    const end = start + filtros.limit;
    const pageItems = sorted.slice(start, end).map((item) => item.data);
    const resumoFiltrado = {
      ...resumoFiltradoVisivel,
      totalFuncionarios: totalItems,
    };

    const payload = {
      items: pageItems,
      totalItems,
      totalPages,
      page: filtros.page,
      limit: filtros.limit,
      resumoFiltrado,
      resumoGeral,
      metrics: {
        durationMs: Date.now() - startedAt,
        totalTarefasFiltradas: tarefasFiltradas.length,
      },
    };

    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");

    return NextResponse.json({
      ...payload,
      metrics: {
        ...payload.metrics,
        payloadBytes,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar hierarquia de tarefas v2:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar hierarquia de tarefas v2" },
      { status: 500 },
    );
  }
}
