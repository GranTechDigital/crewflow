import { Prisma } from "@prisma/client";

export type OrdenacaoFuncionarios =
  | ""
  | "PENDENCIAS_DESC"
  | "PENDENCIAS_ASC"
  | "PROGRESSO_DESC"
  | "PROGRESSO_ASC"
  | "NOME_AZ"
  | "NOME_ZA"
  | "ATUALIZACAO_DESC"
  | "ATUALIZACAO_ASC";

export type DataCategoria =
  | ""
  | "VENCIDOS"
  | "A_VENCER"
  | "NO_PRAZO"
  | "SEM_DATA"
  | "NOVO";

export type FiltrosV2 = {
  page: number;
  limit: number;
  qNome: string;
  nomes: string[];
  status: string[];
  prioridade: string[];
  setores: string[];
  contratos: number[];
  tipos: string[];
  dataCategoria: DataCategoria;
  dataExata: string;
  ordenacaoFuncionarios: OrdenacaoFuncionarios;
  ordenacaoDataLimite: "" | "asc" | "desc";
};

type ResumoItem = {
  funcionarioNome: string;
  ultimaAtualizacao: number;
  pendencias: number;
  progresso: number;
};

export function parseCsvList(searchParams: URLSearchParams, key: string): string[] {
  const values = searchParams
    .getAll(key)
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

function parseNumberList(searchParams: URLSearchParams, key: string): number[] {
  const values = parseCsvList(searchParams, key)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Array.from(new Set(values));
}

function parsePositiveInteger(raw: string | null, fallbackValue: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackValue;
  return Math.floor(parsed);
}

export function parseFiltros(searchParams: URLSearchParams): FiltrosV2 {
  const dataCategoriaRaw = (searchParams.get("dataCategoria") || "").trim();
  const categoriasPermitidas = [
    "VENCIDOS",
    "A_VENCER",
    "NO_PRAZO",
    "SEM_DATA",
    "NOVO",
  ] as const;
  const dataCategoria = categoriasPermitidas.includes(
    dataCategoriaRaw as (typeof categoriasPermitidas)[number],
  )
    ? (dataCategoriaRaw as DataCategoria)
    : "";

  const ordenacaoFuncionariosRaw = (
    searchParams.get("ordenacaoFuncionarios") || ""
  ).trim();
  const ordenacaoFuncionarios = (
    [
      "",
      "PENDENCIAS_DESC",
      "PENDENCIAS_ASC",
      "PROGRESSO_DESC",
      "PROGRESSO_ASC",
      "NOME_AZ",
      "NOME_ZA",
      "ATUALIZACAO_DESC",
      "ATUALIZACAO_ASC",
    ] as const
  ).includes(ordenacaoFuncionariosRaw as OrdenacaoFuncionarios)
    ? (ordenacaoFuncionariosRaw as OrdenacaoFuncionarios)
    : "";

  const ordenacaoDataLimiteRaw = (searchParams.get("ordenacaoDataLimite") || "").trim();
  const ordenacaoDataLimite =
    ordenacaoDataLimiteRaw === "asc" || ordenacaoDataLimiteRaw === "desc"
      ? ordenacaoDataLimiteRaw
      : "";

  const setores = parseCsvList(searchParams, "setor").map((setor) =>
    setor.toUpperCase(),
  );

  return {
    page: parsePositiveInteger(searchParams.get("page"), 1),
    limit: Math.min(parsePositiveInteger(searchParams.get("limit"), 20), 100),
    qNome: (searchParams.get("qNome") || "").trim(),
    nomes: parseCsvList(searchParams, "nome"),
    status: parseCsvList(searchParams, "status").map((item) => item.toUpperCase()),
    prioridade: parseCsvList(searchParams, "prioridade"),
    setores,
    contratos: parseNumberList(searchParams, "contrato"),
    tipos: parseCsvList(searchParams, "tipo"),
    dataCategoria,
    dataExata: (searchParams.get("dataExata") || "").trim(),
    ordenacaoFuncionarios,
    ordenacaoDataLimite,
  };
}

function getStatusValues(statusFilters: string[]): string[] {
  const normalized = statusFilters.map((status) => status.toUpperCase());
  const statusSet = new Set<string>();

  if (normalized.includes("CONCLUIDO")) {
    statusSet.add("CONCLUIDO");
    statusSet.add("CONCLUIDA");
  }
  if (normalized.includes("PENDENTE")) {
    statusSet.add("PENDENTE");
  }
  if (normalized.includes("REPROVADO")) {
    statusSet.add("REPROVADO");
  }

  return Array.from(statusSet);
}

export function buildTarefaWhere(
  filtros: FiltrosV2,
): Prisma.TarefaRemanejamentoWhereInput {
  const andClauses: Prisma.TarefaRemanejamentoWhereInput[] = [
    { status: { not: "CANCELADO" } },
  ];

  if (filtros.setores.length > 0) {
    andClauses.push({
      responsavel: { in: filtros.setores },
    });
  }

  const statusValues = getStatusValues(filtros.status);
  if (statusValues.length > 0) {
    andClauses.push({
      status: {
        in: statusValues,
      },
    });
  }

  if (filtros.prioridade.length > 0) {
    andClauses.push({
      prioridade: {
        in: filtros.prioridade,
      },
    });
  }

  if (filtros.tipos.length > 0) {
    andClauses.push({
      OR: filtros.tipos.map((tipo) => ({
        tipo: { equals: tipo, mode: "insensitive" },
      })),
    });
  }

  const remanejamentoAnd: Prisma.RemanejamentoFuncionarioWhereInput[] = [
    { statusTarefas: "ATENDER TAREFAS" },
  ];

  if (filtros.qNome) {
    remanejamentoAnd.push({
      funcionario: {
        nome: { contains: filtros.qNome, mode: "insensitive" },
      },
    });
  }

  if (filtros.nomes.length > 0) {
    remanejamentoAnd.push({
      OR: filtros.nomes.map((nome) => ({
        funcionario: {
          nome: { contains: nome, mode: "insensitive" },
        },
      })),
    });
  }

  if (filtros.contratos.length > 0) {
    remanejamentoAnd.push({
      solicitacao: {
        OR: [
          { contratoOrigemId: { in: filtros.contratos } },
          { contratoDestinoId: { in: filtros.contratos } },
        ],
      },
    });
  }

  andClauses.push({
    remanejamentoFuncionario: {
      AND: remanejamentoAnd,
    },
  });

  const now = new Date();
  const hoje = new Date(now);
  hoje.setHours(0, 0, 0, 0);

  if (filtros.dataCategoria === "NOVO") {
    const limite48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    andClauses.push({
      dataCriacao: { gte: limite48h, lte: now },
    });
  }

  if (filtros.dataCategoria === "SEM_DATA") {
    andClauses.push({
      dataLimite: null,
    });
    andClauses.push({
      status: {
        notIn: ["CONCLUIDO", "CONCLUIDA"],
      },
    });
  }

  if (filtros.dataCategoria === "VENCIDOS") {
    andClauses.push({
      dataLimite: { lt: hoje },
    });
    andClauses.push({
      status: {
        notIn: ["CONCLUIDO", "CONCLUIDA"],
      },
    });
  }

  if (filtros.dataCategoria === "A_VENCER") {
    const limiteAte = new Date(hoje.getTime() + 8 * 86400000);
    andClauses.push({
      dataLimite: {
        gte: hoje,
        lt: limiteAte,
      },
    });
    andClauses.push({
      status: {
        notIn: ["CONCLUIDO", "CONCLUIDA"],
      },
    });
  }

  if (filtros.dataCategoria === "NO_PRAZO") {
    const limiteAte = new Date(hoje.getTime() + 8 * 86400000);
    andClauses.push({
      dataLimite: { gte: limiteAte },
    });
    andClauses.push({
      status: {
        notIn: ["CONCLUIDO", "CONCLUIDA"],
      },
    });
  }

  if (filtros.dataExata) {
    const [year, month, day] = filtros.dataExata.split("-").map(Number);
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day)
    ) {
      const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
      andClauses.push({
        dataLimite: {
          gte: start,
          lt: end,
        },
      });
    }
  }

  return andClauses.length === 1 ? andClauses[0] : { AND: andClauses };
}

export function sortResumoItems<T extends ResumoItem>(
  items: T[],
  ordenacao: OrdenacaoFuncionarios,
): T[] {
  const copy = [...items];

  copy.sort((a, b) => {
    const nomeCmp = a.funcionarioNome.localeCompare(b.funcionarioNome, "pt-BR");
    const atualizacaoCmp = b.ultimaAtualizacao - a.ultimaAtualizacao;
    const pendenciasCmp = b.pendencias - a.pendencias;
    const progressoCmp = b.progresso - a.progresso;

    if (ordenacao === "PENDENCIAS_DESC") return pendenciasCmp;
    if (ordenacao === "PENDENCIAS_ASC") return -pendenciasCmp;
    if (ordenacao === "PROGRESSO_DESC") return progressoCmp;
    if (ordenacao === "PROGRESSO_ASC") return -progressoCmp;
    if (ordenacao === "NOME_AZ") return nomeCmp;
    if (ordenacao === "NOME_ZA") return -nomeCmp;
    if (ordenacao === "ATUALIZACAO_ASC") return -atualizacaoCmp;
    if (ordenacao === "ATUALIZACAO_DESC") return atualizacaoCmp;

    if (pendenciasCmp !== 0) return pendenciasCmp;
    if (progressoCmp !== 0) return progressoCmp;
    if (atualizacaoCmp !== 0) return atualizacaoCmp;
    return nomeCmp;
  });

  return copy;
}

export function sortTarefasByDataLimite<T extends { dataLimite: Date | string | null; status: string }>(
  tarefas: T[],
  ordenacaoDataLimite: "" | "asc" | "desc",
): T[] {
  const copy = [...tarefas];
  copy.sort((a, b) => {
    if (ordenacaoDataLimite) {
      const aTime = a.dataLimite ? new Date(a.dataLimite).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.dataLimite ? new Date(b.dataLimite).getTime() : Number.POSITIVE_INFINITY;
      const diff = aTime - bTime;
      return ordenacaoDataLimite === "asc" ? diff : -diff;
    }

    const getStatusPriority = (status: string) => {
      const s = (status || "").toUpperCase();
      if (s === "REPROVADO") return 0;
      if (s === "PENDENTE") return 1;
      if (s === "CONCLUIDA" || s === "CONCLUIDO") return 2;
      return 3;
    };

    return getStatusPriority(a.status) - getStatusPriority(b.status);
  });
  return copy;
}
