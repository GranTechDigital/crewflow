import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SETORES = ["LOGISTICA", "MEDICINA", "TREINAMENTO", "RH"] as const;
const DATA_CORTE_RELATORIO = new Date("2026-01-01T00:00:00.000Z");

type Setor = (typeof SETORES)[number];

function normalizeText(value?: string | null) {
  return (value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function isCanceled(value?: string | null) {
  const status = normalizeText(value);
  return status === "CANCELADO" || status === "CANCELADA" || status.includes("CANCELAD");
}

function isTaskDone(value?: string | null) {
  const status = normalizeText(value);
  return status === "CONCLUIDO" || status === "CONCLUIDA" || status.includes("CONCLUID");
}

function isMovementDone(statusTarefas?: string | null, statusPrestserv?: string | null, dataConcluido?: Date | null) {
  const tarefas = normalizeText(statusTarefas);
  const prestserv = normalizeText(statusPrestserv);

  return (
    Boolean(dataConcluido) ||
    prestserv === "VALIDADO" ||
    tarefas === "SOLICITACAO CONCLUIDA" ||
    tarefas === "SOLICITAÇÃO CONCLUÍDA" ||
    tarefas.includes("CONCLUID")
  );
}

function detectSetor(value?: string | null): Setor | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (text.includes("LOGISTICA")) return "LOGISTICA";
  if (text.includes("MEDICINA") || text.includes("SAUDE")) return "MEDICINA";
  if (text.includes("TREINAMENTO")) return "TREINAMENTO";
  if (text === "RH" || text.includes("RECURSOS HUMANOS")) return "RH";
  return null;
}

function hasLogisticaPending(statusTarefas?: string | null, statusPrestserv?: string | null) {
  const tarefas = normalizeText(statusTarefas);
  const prestserv = normalizeText(statusPrestserv);

  return (
    tarefas === "APROVAR SOLICITACAO" ||
    tarefas === "APROVAR SOLICITAÇÃO" ||
    tarefas === "REPROVAR TAREFAS" ||
    tarefas === "SUBMETER RASCUNHO" ||
    tarefas === "SOLICITACAO CONCLUIDA" ||
    tarefas === "SOLICITAÇÃO CONCLUÍDA" ||
    prestserv === "INVALIDADO" ||
    prestserv === "EM VALIDACAO" ||
    prestserv === "EM VALIDAÇÃO"
  );
}

function statusLabel(value?: string | null) {
  const text = (value || "-").trim();
  return text || "-";
}

type ContratoResumo = {
  numero: string | null;
  nome: string | null;
};

function formatContrato(contrato?: ContratoResumo | null) {
  if (!contrato?.numero && !contrato?.nome) return "-";
  if (contrato.numero && contrato.nome) return `${contrato.numero} - ${contrato.nome}`;
  return contrato.numero || contrato.nome || "-";
}

function sameContrato(a?: ContratoResumo | null, b?: ContratoResumo | null) {
  if (!a || !b) return false;
  const numeroA = normalizeText(a.numero);
  const numeroB = normalizeText(b.numero);
  if (numeroA && numeroB) return numeroA === numeroB;
  return normalizeText(a.nome) === normalizeText(b.nome);
}

function resolveContratoOrigem({
  tipo,
  contratoOrigem,
  contratoDestino,
  contratoPrincipal,
  vinculos,
}: {
  tipo?: string | null;
  contratoOrigem?: ContratoResumo | null;
  contratoDestino?: ContratoResumo | null;
  contratoPrincipal?: ContratoResumo | null;
  vinculos: Array<{ contrato: ContratoResumo | null }>;
}) {
  const tipoNormalizado = normalizeText(tipo);

  if (tipoNormalizado.includes("ALOC")) {
    return "-";
  }

  if (
    !tipoNormalizado.includes("DESVINCULO") &&
    (tipoNormalizado.includes("VINCULO") || tipoNormalizado.includes("MULTI"))
  ) {
    return formatContrato(contratoPrincipal);
  }

  if (contratoOrigem?.numero || contratoOrigem?.nome) {
    return formatContrato(contratoOrigem);
  }

  if (contratoPrincipal && !sameContrato(contratoPrincipal, contratoDestino)) {
    return formatContrato(contratoPrincipal);
  }

  const vinculoAlternativo = vinculos.find(
    (vinculo) =>
      vinculo.contrato &&
      !sameContrato(vinculo.contrato, contratoDestino) &&
      !sameContrato(vinculo.contrato, contratoPrincipal),
  );

  return formatContrato(vinculoAlternativo?.contrato || null);
}

function parseStartDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEndDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataInicioFiltro = parseStartDate(searchParams.get("inicio"));
    const dataFim = parseEndDate(searchParams.get("fim"));
    const dataInicio = dataInicioFiltro && dataInicioFiltro > DATA_CORTE_RELATORIO ? dataInicioFiltro : DATA_CORTE_RELATORIO;

    const filtroDataSolicitacao = {
      solicitacao: {
        dataSolicitacao: {
          gte: dataInicio,
          ...(dataFim ? { lte: dataFim } : {}),
        },
      },
    };

    const filtrosBase = [
      { statusPrestserv: { not: "CANCELADO" } },
      { statusTarefas: { not: "CANCELADO" } },
      { dataCancelado: null },
      filtroDataSolicitacao,
    ];

    const remanejamentos = await prisma.remanejamentoFuncionario.findMany({
      where: {
        AND: filtrosBase,
      },
      select: {
        id: true,
        solicitacaoId: true,
        statusTarefas: true,
        statusPrestserv: true,
        createdAt: true,
        updatedAt: true,
        dataConcluido: true,
        dataCancelado: true,
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            funcao: true,
            centroCusto: true,
            contrato: {
              select: {
                numero: true,
                nome: true,
              },
            },
            contratosVinculo: {
              orderBy: [{ ativo: "desc" }, { dataInicio: "desc" }],
              select: {
                contrato: {
                  select: {
                    numero: true,
                    nome: true,
                  },
                },
              },
            },
          },
        },
        solicitacao: {
          select: {
            tipo: true,
            prioridade: true,
            dataSolicitacao: true,
            contratoOrigem: { select: { numero: true, nome: true } },
            contratoDestino: { select: { numero: true, nome: true } },
            solicitadoPorUsuario: {
              select: {
                funcionario: {
                  select: {
                    nome: true,
                    matricula: true,
                  },
                },
              },
            },
          },
        },
        tarefas: {
          select: {
            id: true,
            responsavel: true,
            status: true,
          },
        },
        historico: {
          where: {
            entidade: "SOLICITACAO",
            tipoAcao: "CRIACAO",
          },
          orderBy: {
            dataAcao: "asc",
          },
          take: 1,
          select: {
            usuarioResponsavel: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    const remanejamentosAtivos = remanejamentos.filter(
      (rem) => !isCanceled(rem.statusTarefas) && !isCanceled(rem.statusPrestserv) && !rem.dataCancelado,
    );

    const resumo = {
      total: remanejamentosAtivos.length,
      concluidos: 0,
      emAberto: 0,
      pendencias: Object.fromEntries(SETORES.map((setor) => [setor, 0])) as Record<Setor, number>,
    };

    const itens = remanejamentosAtivos.map((rem) => {
      const concluido = isMovementDone(rem.statusTarefas, rem.statusPrestserv, rem.dataConcluido);
      const pendencias = Object.fromEntries(SETORES.map((setor) => [setor, 0])) as Record<Setor, number>;

      if (concluido) {
        resumo.concluidos += 1;
      } else {
        resumo.emAberto += 1;

        for (const tarefa of rem.tarefas) {
          if (isCanceled(tarefa.status) || isTaskDone(tarefa.status)) continue;

          const setor = detectSetor(tarefa.responsavel);
          if (!setor) continue;
          pendencias[setor] += 1;
        }

        if (hasLogisticaPending(rem.statusTarefas, rem.statusPrestserv)) {
          pendencias.LOGISTICA += 1;
        }
      }

      for (const setor of SETORES) {
        resumo.pendencias[setor] += pendencias[setor];
      }

      const contratoOrigem = resolveContratoOrigem({
        tipo: rem.solicitacao.tipo,
        contratoOrigem: rem.solicitacao.contratoOrigem,
        contratoDestino: rem.solicitacao.contratoDestino,
        contratoPrincipal: rem.funcionario.contrato,
        vinculos: rem.funcionario.contratosVinculo,
      });
      const contratoDestino = formatContrato(rem.solicitacao.contratoDestino);
      const solicitante = rem.solicitacao.solicitadoPorUsuario?.funcionario
        ? `${rem.solicitacao.solicitadoPorUsuario.funcionario.nome} (${rem.solicitacao.solicitadoPorUsuario.funcionario.matricula})`
        : rem.historico[0]?.usuarioResponsavel || "-";

      return {
        id: rem.id,
        solicitacaoId: rem.solicitacaoId,
        funcionario: rem.funcionario.nome,
        matricula: rem.funcionario.matricula,
        funcao: rem.funcionario.funcao,
        centroCusto: rem.funcionario.centroCusto,
        tipo: rem.solicitacao.tipo,
        prioridade: rem.solicitacao.prioridade,
        solicitante,
        contratoOrigem,
        contratoDestino,
        statusTarefas: statusLabel(rem.statusTarefas),
        statusPrestserv: statusLabel(rem.statusPrestserv),
        concluido,
        pendencias,
        dataSolicitacao: rem.solicitacao.dataSolicitacao.toISOString(),
        atualizadoEm: rem.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(
      {
        success: true,
        dataCorte: DATA_CORTE_RELATORIO.toISOString(),
        dataFim: dataFim?.toISOString() || null,
        incluirCancelados: false,
        resumo,
        itens,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Erro ao gerar relatório geral:", error);
    return NextResponse.json(
      { success: false, message: "Erro ao gerar relatório geral." },
      { status: 500 },
    );
  }
}
