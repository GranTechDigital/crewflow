import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export const SETORES_RELATORIO = ["LOGISTICA", "MEDICINA", "TREINAMENTO", "RH"] as const;
export const DATA_CORTE_RELATORIO_GERAL = new Date("2026-01-01T00:00:00.000Z");

export type SetorRelatorio = (typeof SETORES_RELATORIO)[number];

export type RelatorioGeralItem = {
  id: string;
  solicitacaoId: number;
  funcionario: string;
  matricula: string;
  funcao: string | null;
  centroCusto: string | null;
  tipo: string;
  prioridade: string;
  solicitante: string;
  contratoOrigem: string;
  contratoDestino: string;
  statusTarefas: string;
  statusPrestserv: string;
  concluido: boolean;
  pendencias: Record<SetorRelatorio, number>;
  tarefasPendentes: Record<SetorRelatorio, number>;
  dataCriacao: string;
  diasDesdeCriacao: number;
  dataSolicitacao: string;
  atualizadoEm: string;
};

export type RelatorioGeralResumo = {
  total: number;
  concluidos: number;
  emAberto: number;
  pendencias: Record<SetorRelatorio, number>;
  tarefasPendentes: Record<SetorRelatorio, number>;
};

export type RelatorioGeralResultado = {
  success: true;
  dataCorte: string;
  dataFim: string | null;
  incluirCancelados: false;
  resumo: RelatorioGeralResumo;
  itens: RelatorioGeralItem[];
};

export type RelatorioGeralSnapshot = {
  generatedAt: string;
  dataCorte: string;
  dataFim: string | null;
  resumo: RelatorioGeralResumo;
};

type ContratoResumo = {
  numero: string | null;
  nome: string | null;
};

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

function detectSetor(value?: string | null): SetorRelatorio | null {
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

  if (tipoNormalizado.includes("ALOC")) return "-";

  if (
    !tipoNormalizado.includes("DESVINCULO") &&
    (tipoNormalizado.includes("VINCULO") || tipoNormalizado.includes("MULTI"))
  ) {
    return formatContrato(contratoPrincipal);
  }

  if (contratoOrigem?.numero || contratoOrigem?.nome) return formatContrato(contratoOrigem);

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

export function parseRelatorioStartDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseRelatorioEndDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}

export function formatDatePtBr(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value instanceof Date ? value : new Date(value));
}

export async function gerarRelatorioGeralPendencias(options: {
  dataInicioFiltro?: Date | null;
  dataFim?: Date | null;
} = {}): Promise<RelatorioGeralResultado> {
  const dataInicio =
    options.dataInicioFiltro && options.dataInicioFiltro > DATA_CORTE_RELATORIO_GERAL
      ? options.dataInicioFiltro
      : DATA_CORTE_RELATORIO_GERAL;

  const filtroDataSolicitacao = {
    solicitacao: {
      dataSolicitacao: {
        gte: dataInicio,
        ...(options.dataFim ? { lte: options.dataFim } : {}),
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

  const resumo: RelatorioGeralResumo = {
    total: remanejamentosAtivos.length,
    concluidos: 0,
    emAberto: 0,
    pendencias: Object.fromEntries(SETORES_RELATORIO.map((setor) => [setor, 0])) as Record<SetorRelatorio, number>,
    tarefasPendentes: Object.fromEntries(SETORES_RELATORIO.map((setor) => [setor, 0])) as Record<SetorRelatorio, number>,
  };

  const itens = remanejamentosAtivos.map((rem) => {
    const concluido = isMovementDone(rem.statusTarefas, rem.statusPrestserv, rem.dataConcluido);
    const pendencias = Object.fromEntries(SETORES_RELATORIO.map((setor) => [setor, 0])) as Record<SetorRelatorio, number>;
    const tarefasPendentes = Object.fromEntries(SETORES_RELATORIO.map((setor) => [setor, 0])) as Record<
      SetorRelatorio,
      number
    >;

    if (concluido) {
      resumo.concluidos += 1;
    } else {
      resumo.emAberto += 1;

      for (const tarefa of rem.tarefas) {
        if (isCanceled(tarefa.status) || isTaskDone(tarefa.status)) continue;

        const setor = detectSetor(tarefa.responsavel);
        if (!setor) continue;
        pendencias[setor] += 1;
        tarefasPendentes[setor] += 1;
      }

      if (hasLogisticaPending(rem.statusTarefas, rem.statusPrestserv)) {
        pendencias.LOGISTICA += 1;
      }
    }

    for (const setor of SETORES_RELATORIO) {
      resumo.pendencias[setor] += pendencias[setor];
      resumo.tarefasPendentes[setor] += tarefasPendentes[setor];
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
      tarefasPendentes,
      dataCriacao: rem.createdAt.toISOString(),
      diasDesdeCriacao: daysSince(rem.createdAt),
      dataSolicitacao: rem.solicitacao.dataSolicitacao.toISOString(),
      atualizadoEm: rem.updatedAt.toISOString(),
    };
  });

  return {
    success: true,
    dataCorte: DATA_CORTE_RELATORIO_GERAL.toISOString(),
    dataFim: options.dataFim?.toISOString() || null,
    incluirCancelados: false,
    resumo,
    itens,
  };
}

export async function criarExcelRelatorioGeralPendencias(
  relatorio: Pick<RelatorioGeralResultado, "dataCorte" | "dataFim" | "itens">,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GranServices";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Pendencias");
  worksheet.views = [{ state: "frozen", ySplit: 4 }];

  const columns = [
    { header: "Funcionário", key: "funcionario" },
    { header: "Matrícula", key: "matricula" },
    { header: "Função", key: "funcao" },
    { header: "Centro de custo", key: "centroCusto" },
    { header: "Tipo", key: "tipo" },
    { header: "Solicitante", key: "solicitante" },
    { header: "Data da solicitação", key: "dataSolicitacao" },
    { header: "Dias corridos", key: "diasDesdeCriacao" },
    { header: "Origem", key: "contratoOrigem" },
    { header: "Destino", key: "contratoDestino" },
    { header: "Status tarefas", key: "statusTarefas" },
    { header: "Status Prestserv", key: "statusPrestserv" },
    { header: "Logística", key: "logistica" },
    { header: "Medicina", key: "medicina" },
    { header: "Treinamento", key: "treinamento" },
    { header: "RH", key: "rh" },
    { header: "Situação", key: "situacao" },
    { header: "Atualizado em", key: "atualizadoEm" },
  ];

  const rows = relatorio.itens.map((item) => [
    item.funcionario,
    item.matricula,
    item.funcao || "-",
    item.centroCusto || "-",
    item.tipo,
    item.solicitante,
    formatDatePtBr(item.dataSolicitacao),
    item.diasDesdeCriacao,
    item.contratoOrigem,
    item.contratoDestino,
    item.statusTarefas,
    item.statusPrestserv,
    item.pendencias.LOGISTICA || 0,
    item.pendencias.MEDICINA || 0,
    item.pendencias.TREINAMENTO || 0,
    item.pendencias.RH || 0,
    item.concluido ? "Concluído" : "Em aberto",
    formatDatePtBr(item.atualizadoEm),
  ]);

  worksheet.mergeCells("A1:R1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "Relatório Geral de Pendências";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 24;

  worksheet.mergeCells("A2:R2");
  const subtitleCell = worksheet.getCell("A2");
  subtitleCell.value = `Critérios fixos: solicitações desde ${formatDatePtBr(relatorio.dataCorte)} e cancelados desconsiderados | Exportado em ${new Intl.DateTimeFormat(
    "pt-BR",
    { dateStyle: "short", timeStyle: "short" },
  ).format(new Date())}`;
  subtitleCell.font = { size: 10, color: { argb: "FF475569" } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.addTable({
    name: "RelatorioGeralRemanejamentos",
    ref: "A4",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: columns.map((column) => ({ name: column.header, filterButton: true })),
    rows,
  });

  const allRows = [columns.map((column) => column.header), ...rows.map((row) => row.map((value) => String(value ?? "")))];

  columns.forEach((_, index) => {
    const maxLength = allRows.reduce((max, row) => {
      const value = row[index] || "";
      return Math.max(max, String(value).length);
    }, 0);
    worksheet.getColumn(index + 1).width = Math.min(Math.max(maxLength + 2, 9), 42);
  });

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = { vertical: "middle", wrapText: rowNumber >= 4 };
    });
  });

  const headerRow = worksheet.getRow(4);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  for (let rowNumber = 5; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = 18;
    [8, 13, 14, 15, 16].forEach((columnNumber) => {
      row.getCell(columnNumber).alignment = { vertical: "middle", horizontal: "center" };
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function criarSnapshotRelatorioGeral(relatorio: RelatorioGeralResultado): RelatorioGeralSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    dataCorte: relatorio.dataCorte,
    dataFim: relatorio.dataFim,
    resumo: relatorio.resumo,
  };
}
